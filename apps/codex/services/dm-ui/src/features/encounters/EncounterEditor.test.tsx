import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EditableSection } from '@/features/section-shell/EditableSection';
import type { BundleStore } from '@/features/section-shell/bundleStore';
import { renderInSection } from '@/features/section-shell/testUtils';

import { EncounterEditor } from './EncounterEditor';

const initial = {
  title: 'Dock ambush',
  kind: 'combat',
  trigger: '',
  intendedUse: '',
  tactics: '',
  rulesetNotes: '',
  composition: [] as unknown[],
};

function Harness() {
  return (
    <EditableSection
      heading="Dock ambush"
      id="enc-1"
      initialDraft={initial}
      kind="encounter"
      renderForm={(draft, setDraft) => (
        <EncounterEditor draft={draft} setDraft={setDraft} />
      )}
    >
      <p>read view</p>
    </EditableSection>
  );
}

function editable(extra: Partial<BundleStore> = {}): Partial<BundleStore> {
  return {
    editable: true,
    updateItem: vi.fn().mockResolvedValue({ ok: true }),
    addItem: vi.fn().mockResolvedValue({ ok: true, id: 'hb-new' }),
    ...extra,
  };
}

describe('EncounterEditor', () => {
  it('adds a canonical monster from the catalog and saves the composition with its difficulty hint', async () => {
    const store = editable();
    const { user } = renderInSection(<Harness />, { store });
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    await user.type(screen.getByLabelText('Find a monster'), 'goblin');
    const results = screen.getByRole('list', { name: 'Monster results' });
    expect(within(results).getAllByText('SRD').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Add Goblin' }));

    const rows = screen.getByRole('list', { name: 'Encounter composition' });
    expect(within(rows).getByText(/CR 1\/4/)).toBeVisible();
    await user.clear(screen.getByLabelText('Count for Goblin'));
    await user.type(screen.getByLabelText('Count for Goblin'), '3');
    expect(
      screen.getByText(/Calculated difficulty: .* XP vs\. \d+ characters/),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(store.updateItem).toHaveBeenCalled());
    expect(store.updateItem).toHaveBeenCalledWith(
      'encounter',
      'enc-1',
      expect.objectContaining({
        composition: [
          expect.objectContaining({
            name: 'Goblin',
            count: 3,
            monsterKey: 'srd:goblin',
            cr: '1/4',
            ruleset: '2014-srd',
          }),
        ],
      }),
    );
  });

  it('filters by source and shows when nothing matches', async () => {
    const { user } = renderInSection(<Harness />, { store: editable() });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.selectOptions(screen.getByLabelText('Source'), 'homebrew');
    expect(screen.getByText('No monsters match.')).toBeVisible();
    await user.selectOptions(screen.getByLabelText('Source'), 'canonical');
    expect(
      within(screen.getByRole('list', { name: 'Monster results' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(8);
  });

  it('creates a homebrew monster as its own object and adds it to the encounter', async () => {
    const store = editable();
    const { user } = renderInSection(<Harness />, { store });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(
      screen.getByRole('button', { name: 'Create homebrew monster' }),
    );
    const form = screen.getByRole('group', { name: 'New homebrew monster' });

    await user.click(
      within(form).getByRole('button', { name: 'Save monster and add' }),
    );
    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'Give the monster a name.',
    );
    expect(store.addItem).not.toHaveBeenCalled();

    await user.type(within(form).getByLabelText('Monster name'), 'Gloomwing');
    await user.clear(within(form).getByLabelText('CR'));
    await user.type(within(form).getByLabelText('CR'), '1/2');
    await user.click(
      within(form).getByRole('button', { name: 'Save monster and add' }),
    );

    await waitFor(() =>
      expect(store.addItem).toHaveBeenCalledWith(
        'homebrew-monster',
        expect.objectContaining({
          name: 'Gloomwing',
          cr: '1/2',
          abilities: [10, 10, 10, 10, 10, 10],
        }),
      ),
    );
    const rows = await screen.findByRole('list', {
      name: 'Encounter composition',
    });
    expect(within(rows).getByText('Gloomwing')).toBeVisible();
    expect(within(rows).getByText(/Homebrew/)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(store.updateItem).toHaveBeenCalled());
    expect(store.updateItem).toHaveBeenCalledWith(
      'encounter',
      'enc-1',
      expect.objectContaining({
        composition: [
          expect.objectContaining({ monsterKey: 'homebrew:hb-new', cr: '1/2' }),
        ],
      }),
    );
  });

  it('keeps the form open and reports a failed homebrew save', async () => {
    const store = editable({
      addItem: vi.fn().mockResolvedValue({ ok: false, error: 'nope' }),
    });
    const { user } = renderInSection(<Harness />, { store });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(
      screen.getByRole('button', { name: 'Create homebrew monster' }),
    );
    const form = screen.getByRole('group', { name: 'New homebrew monster' });
    await user.type(within(form).getByLabelText('Monster name'), 'Gloomwing');
    await user.click(
      within(form).getByRole('button', { name: 'Save monster and add' }),
    );
    expect(await within(form).findByRole('alert')).toHaveTextContent('nope');
    expect(screen.getByText('No monsters yet. Add one below.')).toBeVisible();
  });

  it('configures and saves a complex puzzle trap with custom DCs and timer', async () => {
    const store = editable();
    const { user } = renderInSection(<Harness />, { store });
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    // Switch Kind to Trap
    await user.selectOptions(screen.getByLabelText('Kind'), 'trap');

    // The Trap specification fieldset should be visible
    expect(screen.getByText('Trap & Puzzle Specification')).toBeVisible();

    // Select Complex Trap
    await user.selectOptions(screen.getByLabelText('Complexity & Type'), 'complex');

    // Fill in trap fields
    await user.type(screen.getByLabelText('Detection DC (Perception / Investigation)'), '16');
    await user.type(screen.getByLabelText("Disarm / Disable DC (Thieves' Tools / Arcana)"), '18');
    await user.type(screen.getByLabelText('Initiative / Round Timer'), 'Initiative 20 & 10 (4 rounds)');
    await user.type(screen.getByLabelText('Damage & Harm Effect'), '4d10 piercing and pinned');
    await user.type(
      screen.getByLabelText('Countermeasures, Disarm Steps & Puzzle Solution'),
      'Jam gears with iron spikes; solve zodiac runes',
    );

    // Save
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(store.updateItem).toHaveBeenCalled());

    expect(store.updateItem).toHaveBeenCalledWith(
      'encounter',
      'enc-1',
      expect.objectContaining({
        kind: 'trap',
        trapDetails: expect.objectContaining({
          complexity: 'complex',
          detectionDc: 16,
          disarmDc: 18,
          initiativeOrTimer: 'Initiative 20 & 10 (4 rounds)',
          effect: '4d10 piercing and pinned',
          countermeasures: 'Jam gears with iron spikes; solve zodiac runes',
        }),
      }),
    );
  });
});
