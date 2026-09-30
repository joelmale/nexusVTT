import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  getFixtureBundle,
  type CampaignFixtureBundle,
} from '@/demo/fixture-registry';
import { renderInSection } from '@/features/section-shell/testUtils';

import { LoreView } from './LoreSection';

const base = getFixtureBundle('ashes-of-veyra')!;
const ok = () => Promise.resolve({ ok: true });
const NOTES = '/campaigns/campaign-blank/lore/notes';
const HANDOUTS = '/campaigns/campaign-blank/lore/handouts';

function bundle(): CampaignFixtureBundle {
  const mk = (id: string, order: number) => ({
    id,
    campaignId: base.campaignId,
    title: `Note ${id}`,
    body: `Body of **${id}**`,
    anchor: { type: 'campaign' as const },
    color: 'yellow' as const,
    size: 'small' as const,
    order,
  });
  const h = (id: string, order: number, folderId?: string) => ({
    ...base.handouts[0],
    id,
    title: `Handout ${id}`,
    kind: 'handout' as const,
    body: `text ${id}`,
    order,
    folderId,
    audience: 'hidden' as const,
  });
  return {
    ...base,
    notes: [mk('a', 0), mk('b', 1), mk('c', 2)],
    handouts: [h('h1', 0, 'fold'), h('h2', 1, 'fold')],
    folders: [
      {
        id: 'fold',
        title: 'Props',
        actId: '',
        objectIds: [],
        children: [],
        kind: 'handout-folder',
        order: 0,
      },
    ],
  };
}

describe('Lore notes tab', () => {
  it('is read-only on examples: no add, drag or edit', () => {
    renderInSection(<LoreView tab="notes" />, {
      path: '/demo/ashes-of-veyra/lore/notes',
    });
    expect(screen.queryByText('Take a note…')).toBeNull();
    expect(screen.queryByRole('button', { name: /Move earlier/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Edit note/ })).toBeNull();
    expect(document.querySelector('[draggable="true"]')).toBeNull();
  });

  it('adds via the Take a note card', async () => {
    const addItem = vi.fn().mockResolvedValue({ ok: true, id: 'n' });
    const { user } = renderInSection(<LoreView tab="notes" />, {
      path: NOTES,
      store: { bundle: bundle(), editable: true, addItem },
    });
    await user.click(screen.getByRole('button', { name: 'Take a note…' }));
    await user.type(screen.getByLabelText('Title'), 'Idea');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await waitFor(() =>
      expect(addItem).toHaveBeenCalledWith(
        'note',
        expect.objectContaining({ title: 'Idea', order: 3 }),
      ),
    );
  });

  it('edits in place and saves only the changed fields', async () => {
    const updateItem = vi.fn().mockResolvedValue({ ok: true });
    const { user } = renderInSection(<LoreView tab="notes" />, {
      path: NOTES,
      store: { bundle: bundle(), editable: true, updateItem },
    });
    await user.click(screen.getByRole('button', { name: 'Edit note: Note a' }));
    await user.click(screen.getByRole('radio', { name: 'Pink' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(updateItem).toHaveBeenCalledWith('note', 'a', { color: 'pink' }),
    );
  });

  it('reorders with keyboard actions and announces', async () => {
    const reorderNotes = vi.fn(ok);
    const { user } = renderInSection(<LoreView tab="notes" />, {
      path: NOTES,
      store: { bundle: bundle(), editable: true, reorderNotes },
    });
    await user.click(
      screen.getByRole('button', { name: 'Move later: Note a' }),
    );
    expect(reorderNotes).toHaveBeenCalledWith(['b', 'a', 'c']);
    expect(
      await screen.findByText(/Moved Note a to position 2 of 3/),
    ).toBeInTheDocument();
  });

  it('reorders by drag and drop', async () => {
    const reorderNotes = vi.fn(ok);
    renderInSection(<LoreView tab="notes" />, {
      path: NOTES,
      store: { bundle: bundle(), editable: true, reorderNotes },
    });
    const cards = screen.getAllByRole('article');
    fireEvent.dragStart(cards[2]);
    fireEvent.drop(cards[0]);
    await waitFor(() =>
      expect(reorderNotes).toHaveBeenCalledWith(['c', 'a', 'b']),
    );
  });
});

describe('Lore handouts tab', () => {
  it('is read-only on examples', () => {
    renderInSection(<LoreView tab="handouts" />, {
      path: '/demo/ashes-of-veyra/lore/handouts',
    });
    expect(screen.queryByRole('button', { name: /Add handout/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Rename folder/ })).toBeNull();
  });

  it('renders folders, one add row, and renames inline', async () => {
    const updateItem = vi.fn().mockResolvedValue({ ok: true });
    const { user } = renderInSection(<LoreView tab="handouts" />, {
      path: HANDOUTS,
      store: { bundle: bundle(), editable: true, updateItem },
    });
    expect(screen.getByRole('heading', { name: 'Props' })).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /Add handout/ }),
    ).toHaveLength(1);
    await user.click(
      screen.getByRole('button', { name: 'Rename folder Props' }),
    );
    const input = screen.getByLabelText('Folder name');
    await user.clear(input);
    await user.type(input, 'Letters{Enter}');
    await waitFor(() =>
      expect(updateItem).toHaveBeenCalledWith('handout-folder', 'fold', {
        title: 'Letters',
      }),
    );
  });

  it('moves a handout down by renumbering its folder', async () => {
    const updateItem = vi.fn().mockResolvedValue({ ok: true });
    const { user } = renderInSection(<LoreView tab="handouts" />, {
      path: HANDOUTS,
      store: { bundle: bundle(), editable: true, updateItem },
    });
    await user.click(
      screen.getByRole('button', { name: 'Move Handout h1 down' }),
    );
    await waitFor(() => expect(updateItem).toHaveBeenCalledTimes(2));
    expect(updateItem).toHaveBeenCalledWith('handout', 'h2', { order: 0 });
    expect(updateItem).toHaveBeenCalledWith('handout', 'h1', { order: 1 });
  });

  it('edits share state to a selected player character', async () => {
    const updateItem = vi.fn().mockResolvedValue({ ok: true });
    const b = bundle();
    const pc = b.catalog.playerCharacters![0];
    const { user } = renderInSection(<LoreView itemId="h1" tab="handouts" />, {
      path: `${HANDOUTS}/h1`,
      store: { bundle: b, editable: true, updateItem },
    });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.selectOptions(screen.getByLabelText('Share with'), 'selected');
    await user.click(screen.getByRole('checkbox', { name: pc.name }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(updateItem).toHaveBeenCalledWith('handout', 'h1', {
        audience: [pc.id],
      }),
    );
  });

  it('treats unknown tab values as legacy item ids', () => {
    renderInSection(<LoreView tab="h1" />, {
      path: '/campaigns/campaign-blank/lore/h1',
      store: { bundle: bundle() },
    });
    expect(
      screen.getByRole('heading', { name: 'Handout h1' }),
    ).toBeInTheDocument();
  });
});
