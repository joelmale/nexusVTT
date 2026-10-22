import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getFixtureBundle, type CampaignFixtureBundle } from '@/demo/fixture-registry';
import type { BundleStore } from '@/features/section-shell/bundleStore';
import { renderInSection } from '@/features/section-shell/testUtils';

import { InboxPane } from './InboxPane';

describe('InboxPane', () => {
  let mockBundle: CampaignFixtureBundle;
  let mockStore: BundleStore;
  const baseBundle = getFixtureBundle('ashes-of-veyra')!;

  beforeEach(() => {
    mockBundle = {
      ...baseBundle,
      inboxNotes: [
        {
          id: 'note-unfiled',
          campaignId: baseBundle.campaignId,
          text: 'Investigate the abandoned apothecary in the lower ward',
          createdAt: '2026-10-22T10:00:00Z',
        },
        {
          id: 'note-triaged',
          campaignId: baseBundle.campaignId,
          text: 'Elena the Cartographer needs rare inks',
          createdAt: '2026-10-21T09:00:00Z',
          triagedTo: { kind: 'quest', id: 'quest-ink' },
        },
      ],
      quests: [
        ...baseBundle.quests,
        {
          ...baseBundle.quests[0],
          id: 'quest-ink',
          title: 'Rare Inks for Elena',
        },
      ],
    };

    mockStore = {
      bundle: mockBundle,
      editable: true,
      status: 'ready',
      addItem: vi.fn().mockResolvedValue({ ok: true, id: 'created-id-456' }),
      updateItem: vi.fn().mockResolvedValue({ ok: true }),
      removeItem: vi.fn().mockResolvedValue({ ok: true }),
      restoreItem: vi.fn().mockResolvedValue({ ok: true }),
      reload: vi.fn().mockResolvedValue(undefined),
      reorderNotes: vi.fn().mockResolvedValue({ ok: true }),
      getBacklinks: vi.fn().mockResolvedValue([]),
    };
  });

  it('renders stats bar with unfiled, triaged, and total counts', () => {
    renderInSection(<InboxPane />, {
      path: '/demo/ashes-of-veyra/notes?tab=inbox',
      store: mockStore,
    });

    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2); // 1 unfiled, 1 triaged
    expect(screen.getAllByText('Unfiled')[0]).toBeInTheDocument();
    expect(screen.getByText('Triaged')).toBeInTheDocument();
    expect(screen.getByText('Total Captured')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // 2 total
  });

  it('renders notes list with unfiled and triaged badges', () => {
    renderInSection(<InboxPane />, {
      path: '/demo/ashes-of-veyra/notes?tab=inbox',
      store: mockStore,
    });

    expect(
      screen.getByText(/Investigate the abandoned apothecary/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Elena the Cartographer needs rare inks/i),
    ).toBeInTheDocument();

    expect(screen.getAllByText('Unfiled').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Quest: Rare Inks for Elena')).toBeInTheDocument();
  });

  it('filters by status when facet is clicked', async () => {
    const user = userEvent.setup();
    renderInSection(<InboxPane />, {
      path: '/demo/ashes-of-veyra/notes?tab=inbox',
      store: mockStore,
    });

    const statusSelect = screen.getByLabelText(/^Status/i);
    await user.selectOptions(statusSelect, 'unfiled');

    expect(
      screen.getByText(/Investigate the abandoned apothecary/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Elena the Cartographer needs rare inks/i),
    ).not.toBeInTheDocument();
  });

  it('triages an unfiled note to NPC', async () => {
    const user = userEvent.setup();
    renderInSection(<InboxPane />, {
      path: '/demo/ashes-of-veyra/notes?tab=inbox',
      store: mockStore,
    });

    const npcButtons = screen.getAllByRole('button', { name: /NPC/i });
    await user.click(npcButtons[0]);

    await waitFor(() => {
      expect(mockStore.addItem).toHaveBeenCalledWith(
        'npc',
        expect.objectContaining({
          name: expect.stringContaining('Investigate the abandoned apothecary'),
        }),
      );
      expect(mockStore.updateItem).toHaveBeenCalledWith(
        'inbox-note',
        'note-unfiled',
        expect.objectContaining({
          triagedTo: { kind: 'npc', id: 'created-id-456' },
        }),
      );
    });
  });

  it('triages an unfiled note to Quest', async () => {
    const user = userEvent.setup();
    renderInSection(<InboxPane />, {
      path: '/demo/ashes-of-veyra/notes?tab=inbox',
      store: mockStore,
    });

    const questButtons = screen.getAllByRole('button', { name: /Quest/i });
    await user.click(questButtons[0]);

    await waitFor(() => {
      expect(mockStore.addItem).toHaveBeenCalledWith(
        'quest',
        expect.objectContaining({
          status: 'active',
        }),
      );
      expect(mockStore.updateItem).toHaveBeenCalledWith(
        'inbox-note',
        'note-unfiled',
        expect.objectContaining({
          triagedTo: { kind: 'quest', id: 'created-id-456' },
        }),
      );
    });
  });

  it('triages an unfiled note to Secret', async () => {
    const user = userEvent.setup();
    renderInSection(<InboxPane />, {
      path: '/demo/ashes-of-veyra/notes?tab=inbox',
      store: mockStore,
    });

    const secretButtons = screen.getAllByRole('button', { name: /Secret/i });
    await user.click(secretButtons[0]);

    await waitFor(() => {
      expect(mockStore.addItem).toHaveBeenCalledWith(
        'secret',
        expect.objectContaining({
          revealed: false,
        }),
      );
      expect(mockStore.updateItem).toHaveBeenCalledWith(
        'inbox-note',
        'note-unfiled',
        expect.objectContaining({
          triagedTo: { kind: 'secret', id: 'created-id-456' },
        }),
      );
    });
  });

  it('triages an unfiled note to permanent Note', async () => {
    const user = userEvent.setup();
    renderInSection(<InboxPane />, {
      path: '/demo/ashes-of-veyra/notes?tab=inbox',
      store: mockStore,
    });

    const noteButtons = screen.getAllByTitle(
      'Convert to a permanent Campaign Note',
    );
    await user.click(noteButtons[0]);

    await waitFor(() => {
      expect(mockStore.addItem).toHaveBeenCalledWith(
        'note',
        expect.objectContaining({
          audience: 'none',
          title: expect.stringContaining('Investigate the abandoned apothecary'),
        }),
      );
      expect(mockStore.updateItem).toHaveBeenCalledWith(
        'inbox-note',
        'note-unfiled',
        expect.objectContaining({
          triagedTo: { kind: 'note', id: 'created-id-456' },
        }),
      );
    });
  });

  it('deletes a note on clicking delete button', async () => {
    const user = userEvent.setup();
    renderInSection(<InboxPane />, {
      path: '/demo/ashes-of-veyra/notes?tab=inbox',
      store: mockStore,
    });

    const deleteButtons = screen.getAllByRole('button', { name: /Delete note/i });
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockStore.removeItem).toHaveBeenCalledWith(
        'inbox-note',
        'note-unfiled',
      );
    });
  });

  it('renders empty state when there are no notes', () => {
    const emptyBundle = {
      ...mockBundle,
      inboxNotes: [],
    };
    const emptyStore = {
      ...mockStore,
      bundle: emptyBundle,
    };

    renderInSection(<InboxPane />, {
      path: '/demo/ashes-of-veyra/notes?tab=inbox',
      store: emptyStore,
    });

    expect(screen.getByText('No inbox notes found')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Capture First Note/i }),
    ).toBeInTheDocument();
  });

  it('opens QuickCaptureModal when New Note button is clicked', async () => {
    const user = userEvent.setup();
    renderInSection(<InboxPane />, {
      path: '/demo/ashes-of-veyra/notes?tab=inbox',
      store: mockStore,
    });

    const newNoteBtn = screen.getByRole('button', { name: /New Note/i });
    await user.click(newNoteBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Quick Capture')).toBeInTheDocument();
  });
});
