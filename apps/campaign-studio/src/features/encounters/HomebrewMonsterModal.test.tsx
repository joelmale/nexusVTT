import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { HomebrewMonster } from '@/demo/fixture-registry';
import type { BundleStore } from '@/features/section-shell/bundleStore';
import { renderInSection } from '@/features/section-shell/testUtils';
import { HomebrewMonsterModal } from './HomebrewMonsterModal';

function mockStore(extra: Partial<BundleStore> = {}): Partial<BundleStore> {
  return {
    editable: true,
    addItem: vi.fn().mockResolvedValue({ ok: true, id: 'hb-created-1' }),
    updateItem: vi.fn().mockResolvedValue({ ok: true }),
    ...extra,
  };
}

describe('HomebrewMonsterModal', () => {
  it('does not render when isOpen is false', () => {
    renderInSection(
      <HomebrewMonsterModal isOpen={false} onClose={vi.fn()} />,
      { store: mockStore() },
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders authoring fields with defaults when isOpen is true', () => {
    renderInSection(
      <HomebrewMonsterModal isOpen={true} onClose={vi.fn()} />,
      { store: mockStore() },
    );

    expect(screen.getByRole('heading', { name: 'Author Homebrew Creature' })).toBeInTheDocument();
    expect(screen.getByLabelText('Creature Name')).toHaveValue('');
    expect(screen.getByLabelText('Challenge Rating')).toHaveValue('1');
    expect(screen.getByLabelText('Armor Class')).toHaveValue(12);
    expect(screen.getByLabelText('Hit Points')).toHaveValue(20);
    expect(screen.getByLabelText('STR score')).toHaveValue(10);
  });

  it('validates empty name on submission', async () => {
    const { user } = renderInSection(
      <HomebrewMonsterModal isOpen={true} onClose={vi.fn()} />,
      { store: mockStore() },
    );

    const submitBtn = screen.getByRole('button', { name: 'Create Creature' });
    await user.click(submitBtn);

    expect(await screen.findByRole('alert')).toHaveTextContent('Please provide a name');
  });

  it('creates a new homebrew monster successfully', async () => {
    const addItem = vi.fn().mockResolvedValue({ ok: true, id: 'hb-new-123' });
    const onClose = vi.fn();
    const onSaved = vi.fn();

    const { user } = renderInSection(
      <HomebrewMonsterModal
        isOpen={true}
        onClose={onClose}
        onSaved={onSaved}
      />,
      { store: mockStore({ addItem }) },
    );

    await user.type(screen.getByLabelText('Creature Name'), 'Void Fiend');
    await user.selectOptions(screen.getByLabelText('Challenge Rating'), '5');
    await user.selectOptions(screen.getByLabelText('Creature Size'), 'Large');
    await user.selectOptions(screen.getByLabelText('Creature Type'), 'fiend');
    fireEvent.change(screen.getByLabelText('Armor Class'), { target: { value: '16' } });
    fireEvent.change(screen.getByLabelText('Hit Points'), { target: { value: '95' } });
    fireEvent.change(screen.getByLabelText('STR score'), { target: { value: '18' } });
    await user.type(
      screen.getByLabelText('Traits, Actions & Notes'),
      'Void Burst: 4d6 necrotic damage.',
    );

    await user.click(screen.getByRole('button', { name: 'Create Creature' }));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        'homebrew-monster',
        expect.objectContaining({
          name: 'Void Fiend',
          cr: '5',
          size: 'Large',
          type: 'fiend',
          ac: 16,
          hp: 95,
          abilities: [18, 10, 10, 10, 10, 10],
          notes: 'Void Burst: 4d6 necrotic damage.',
        }),
      );
    });

    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'hb-new-123',
        name: 'Void Fiend',
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('edits an existing monster and calls updateItem', async () => {
    const existing: HomebrewMonster = {
      id: 'hb-existing-42',
      campaignId: 'cmp-1',
      name: 'Ash Golem',
      cr: '3',
      size: 'Large',
      type: 'construct',
      ac: 14,
      hp: 60,
      speed: 25,
      abilities: [16, 8, 15, 6, 10, 5],
      edition: '2024',
      notes: 'Fire absorption.',
    };

    const updateItem = vi.fn().mockResolvedValue({ ok: true });
    const onClose = vi.fn();
    const onSaved = vi.fn();

    const { user } = renderInSection(
      <HomebrewMonsterModal
        initialMonster={existing}
        isOpen={true}
        onClose={onClose}
        onSaved={onSaved}
      />,
      { store: mockStore({ updateItem }) },
    );

    expect(screen.getByRole('heading', { name: 'Edit Homebrew Creature' })).toBeInTheDocument();
    expect(screen.getByLabelText('Creature Name')).toHaveValue('Ash Golem');
    expect(screen.getByLabelText('Challenge Rating')).toHaveValue('3');

    fireEvent.change(screen.getByLabelText('Armor Class'), { target: { value: '15' } });
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(updateItem).toHaveBeenCalledWith(
        'homebrew-monster',
        'hb-existing-42',
        expect.objectContaining({
          name: 'Ash Golem',
          ac: 15,
        }),
      );
    });
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('displays store error if addItem fails', async () => {
    const addItem = vi.fn().mockResolvedValue({ ok: false, error: 'Database constraint failed' });
    const { user } = renderInSection(
      <HomebrewMonsterModal isOpen={true} onClose={vi.fn()} />,
      { store: mockStore({ addItem }) },
    );

    await user.type(screen.getByLabelText('Creature Name'), 'Doom Spider');
    await user.click(screen.getByRole('button', { name: 'Create Creature' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Database constraint failed');
  });

  it('closes on cancel button click', async () => {
    const onClose = vi.fn();
    const { user } = renderInSection(
      <HomebrewMonsterModal isOpen={true} onClose={onClose} />,
      { store: mockStore() },
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
