import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { getFixtureBundle } from '@/demo/fixture-registry';
import type { BundleStore } from '@/features/section-shell/bundleStore';
import { PartyMemberModal } from './PartyMemberModal';

describe('PartyMemberModal', () => {
  const baseBundle = getFixtureBundle('stars-below-kharad', 'test')!;

  const createMockStore = (): BundleStore => ({
    bundle: baseBundle,
    status: 'ready',
    editable: true,
    reload: vi.fn().mockResolvedValue(undefined),
    updateItem: vi.fn().mockResolvedValue({ ok: true }),
    addItem: vi.fn().mockResolvedValue({ ok: true, id: 'new-pc' }),
    reorderNotes: vi.fn().mockResolvedValue({ ok: true }),
    removeItem: vi.fn().mockResolvedValue({ ok: true }),
    restoreItem: vi.fn().mockResolvedValue({ ok: true }),
    getBacklinks: vi.fn().mockResolvedValue([]),
    togglePin: vi.fn().mockResolvedValue({ ok: true }),
  });

  it('renders party management roster by default when character is not provided', () => {
    const store = createMockStore();
    render(
      <PartyMemberModal
        bundle={baseBundle}
        isOpen={true}
        onClose={vi.fn()}
        store={store}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Party Management')).toBeInTheDocument();
    expect(
      screen.getByText(
        new RegExp(`${baseBundle.campaign.playerCharacters.length} characters? in party`),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(baseBundle.campaign.playerCharacters[0].name),
    ).toBeInTheDocument();
  });

  it('renders edit mode pre-populated when character is provided', () => {
    const store = createMockStore();
    const character = baseBundle.campaign.playerCharacters[0];

    render(
      <PartyMemberModal
        bundle={baseBundle}
        character={character}
        isOpen={true}
        onClose={vi.fn()}
        store={store}
      />,
    );

    expect(
      screen.getByText(`Edit Party Member: ${character.name}`),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Character Name/i)).toHaveValue(character.name);
    expect(screen.getByLabelText(/Class/i)).toHaveValue(character.className);
    expect(screen.getByLabelText(/Ancestry/i)).toHaveValue(character.ancestry);
    expect(screen.getByLabelText(/Level/i)).toHaveValue(character.level);
  });

  it('submits edits to an existing character via store.updateItem', async () => {
    const user = userEvent.setup();
    const store = createMockStore();
    const character = baseBundle.campaign.playerCharacters[0];
    const handleClose = vi.fn();

    render(
      <PartyMemberModal
        bundle={baseBundle}
        character={character}
        isOpen={true}
        onClose={handleClose}
        store={store}
      />,
    );

    const nameInput = screen.getByLabelText(/Character Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed Hero');

    const levelInput = screen.getByLabelText(/Level/i);
    await user.clear(levelInput);
    await user.type(levelInput, '8');

    const saveBtn = screen.getByRole('button', { name: 'Save Changes' });
    await user.click(saveBtn);

    expect(store.updateItem).toHaveBeenCalledWith(
      'party-member',
      character.id,
      expect.objectContaining({
        name: 'Renamed Hero',
        level: 8,
      }),
    );
    expect(store.reload).toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalled();
  });

  it('adds a new character via store.addItem in create mode', async () => {
    const user = userEvent.setup();
    const store = createMockStore();
    const handleClose = vi.fn();

    render(
      <PartyMemberModal
        bundle={baseBundle}
        initialMode="create"
        isOpen={true}
        onClose={handleClose}
        store={store}
      />,
    );

    expect(screen.getByText('Add Party Member')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Character Name/i), 'Lyra Sunwhisper');
    await user.type(screen.getByLabelText(/Class/i), 'Cleric');
    await user.type(screen.getByLabelText(/Ancestry/i), 'Aasimar');
    const levelInput = screen.getByLabelText(/Level/i);
    await user.clear(levelInput);
    await user.type(levelInput, '4');
    await user.type(
      screen.getByLabelText(/Personal Hook/i),
      'Follows a holy omen to the dungeon',
    );

    const addBtn = screen.getByRole('button', { name: 'Add Member' });
    await user.click(addBtn);

    expect(store.addItem).toHaveBeenCalledWith(
      'party-member',
      expect.objectContaining({
        name: 'Lyra Sunwhisper',
        className: 'Cleric',
        ancestry: 'Aasimar',
        level: 4,
        hook: 'Follows a holy omen to the dungeon',
      }),
    );
    expect(store.reload).toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalled();
  });

  it('removes a character via store.removeItem in edit mode', async () => {
    const user = userEvent.setup();
    const store = createMockStore();
    const character = baseBundle.campaign.playerCharacters[0];
    const handleClose = vi.fn();

    render(
      <PartyMemberModal
        bundle={baseBundle}
        character={character}
        isOpen={true}
        onClose={handleClose}
        store={store}
      />,
    );

    const removeBtn = screen.getByRole('button', { name: 'Remove Member' });
    await user.click(removeBtn);

    expect(store.removeItem).toHaveBeenCalledWith('party-member', character.id);
    expect(store.reload).toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalled();
  });

  it('removes a character directly from the manage roster view', async () => {
    const user = userEvent.setup();
    const store = createMockStore();
    const character = baseBundle.campaign.playerCharacters[0];
    const handleClose = vi.fn();

    render(
      <PartyMemberModal
        bundle={baseBundle}
        isOpen={true}
        onClose={handleClose}
        store={store}
      />,
    );

    const removeBtn = screen.getByRole('button', {
      name: `Remove ${character.name}`,
    });
    await user.click(removeBtn);

    expect(store.removeItem).toHaveBeenCalledWith('party-member', character.id);
    expect(store.reload).toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalled();
  });

  it('closes on Escape key press or close button click', async () => {
    const user = userEvent.setup();
    const store = createMockStore();
    const handleClose = vi.fn();

    const { rerender } = render(
      <PartyMemberModal
        bundle={baseBundle}
        isOpen={true}
        onClose={handleClose}
        store={store}
      />,
    );

    await user.keyboard('{Escape}');
    expect(handleClose).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByRole('button', {
      name: 'Close party member modal',
    });
    await user.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(2);

    rerender(
      <PartyMemberModal
        bundle={baseBundle}
        isOpen={false}
        onClose={handleClose}
        store={store}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
