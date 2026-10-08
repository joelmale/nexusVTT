import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getFixtureBundle } from '@/demo/fixture-registry';

import { RemoveItemButton } from './RemoveItemButton';
import { renderInSection } from './testUtils';
import { clearUndoToast } from './undoToast';

afterEach(() => clearUndoToast());

function setup(store: Record<string, unknown> = {}, props = {}) {
  const removeItem = vi.fn().mockResolvedValue({ ok: true });
  const restoreItem = vi.fn().mockResolvedValue({ ok: true });
  const getBacklinks = vi.fn().mockResolvedValue([]);
  const rendered = renderInSection(
    <RemoveItemButton id="npc-1" kind="npc" label="Mira" {...props} />,
    {
      path: '/campaigns/campaign-blank/npcs/npc-1',
      store: {
        editable: true,
        removeItem,
        restoreItem,
        getBacklinks,
        ...store,
      },
    },
  );
  return { ...rendered, removeItem, restoreItem, getBacklinks };
}

describe('RemoveItemButton', () => {
  it('is hidden when the store is read-only', () => {
    setup({ editable: false });
    expect(screen.queryByRole('button', { name: /remove/i })).toBeNull();
  });

  it('removes only after confirmation, then offers Undo', async () => {
    const { user, removeItem, restoreItem } = setup({}, { listPath: 'npcs' });
    await user.click(screen.getByRole('button', { name: 'Remove Mira' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeTruthy();
    expect(removeItem).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() =>
      expect(removeItem).toHaveBeenCalledWith('npc', 'npc-1'),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByTestId('location').textContent).toContain(
      '/campaigns/campaign-blank/npcs',
    );

    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(restoreItem).toHaveBeenCalledWith('npc', 'npc-1'),
    );
    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toContain(
        '/campaigns/campaign-blank/npcs/npc-1',
      ),
    );
  });

  it('focuses Cancel first, and Cancel or Escape leave the item alone', async () => {
    const { user, removeItem } = setup();
    await user.click(screen.getByRole('button', { name: 'Remove Mira' }));
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(document.activeElement).toBe(cancel));

    await user.click(cancel);
    expect(screen.queryByRole('alertdialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Remove Mira' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('lists the items that reference it', async () => {
    const { user } = setup({
      getBacklinks: vi.fn().mockResolvedValue([
        { id: 'q1', kind: 'quest', title: 'Find the Relic' },
        { id: 'f1', kind: 'faction', title: 'Harbor Guild' },
      ]),
    });
    await user.click(screen.getByRole('button', { name: 'Remove Mira' }));
    expect(await screen.findByText('Referenced by:')).toBeTruthy();
    expect(screen.getByText('Find the Relic')).toBeTruthy();
    expect(screen.getByText('Harbor Guild')).toBeTruthy();
  });

  it('keeps the dialog open and shows the error when removal fails', async () => {
    const { user } = setup({
      removeItem: vi.fn().mockResolvedValue({ ok: false, error: 'boom' }),
    });
    await user.click(screen.getByRole('button', { name: 'Remove Mira' }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect((await screen.findByRole('alert')).textContent).toBe('boom');
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });

  it('blocks removing a handout folder that still has handouts', async () => {
    const base = getFixtureBundle('ashes-of-veyra')!;
    const bundle = {
      ...base,
      handouts: [
        ...base.handouts,
        { ...base.handouts[0], id: 'h-in-folder', folderId: 'folder-1' },
      ],
    };
    const { user, removeItem } = setup(
      { bundle },
      { kind: 'handout-folder', id: 'folder-1', label: 'Props' },
    );
    await user.click(screen.getByRole('button', { name: 'Remove Props' }));
    expect(screen.getByText(/still holds 1 handout/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(removeItem).not.toHaveBeenCalled();
  });
});
