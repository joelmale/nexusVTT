import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BundleStore } from '@/features/section-shell/bundleStore';
import { renderInSection } from '@/features/section-shell/testUtils';
import * as api from '@/services/campaign-bundle-api';
import { RevisionHistoryModal } from './RevisionHistoryModal';

const sampleRevisions: api.ObjectRevisionSummary[] = [
  {
    revision: 2,
    createdAt: '2026-10-22T20:00:00.000Z',
    createdBy: 'Dungeon Master',
    snapshot: {
      name: 'Vaelin Frost',
      notes: 'Updated ally of the Harpers.',
      cr: '5',
    },
  },
  {
    revision: 1,
    createdAt: '2026-10-20T10:00:00.000Z',
    createdBy: 'Dungeon Master',
    snapshot: {
      name: 'Vaelin Frost',
      notes: 'Mysterious traveler.',
      cr: '3',
    },
  },
];

function mockStore(extra: Partial<BundleStore> = {}): Partial<BundleStore> {
  return {
    editable: true,
    updateItem: vi.fn().mockResolvedValue({ ok: true }),
    ...extra,
  };
}

describe('RevisionHistoryModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render when isOpen is false', () => {
    renderInSection(
      <RevisionHistoryModal
        currentDraft={{ name: 'Vaelin Frost' }}
        isOpen={false}
        kind="npc"
        objectId="npc-1"
        onClose={vi.fn()}
        title="Vaelin Frost"
      />,
      { store: mockStore() },
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('loads and displays server revisions list', async () => {
    vi.spyOn(api, 'fetchObjectRevisions').mockResolvedValue(sampleRevisions);

    renderInSection(
      <RevisionHistoryModal
        currentDraft={{
          name: 'Vaelin Frost',
          notes: 'Current working notes.',
          cr: '5',
        }}
        isOpen={true}
        kind="npc"
        objectId="npc-1"
        onClose={vi.fn()}
        title="Vaelin Frost"
      />,
      { store: mockStore() },
    );

    expect(await screen.findByText('Past Snapshots (2)')).toBeInTheDocument();
    expect(screen.getByText('Rev #2 (Current)')).toBeInTheDocument();
    expect(screen.getByText('Rev #1')).toBeInTheDocument();
  });

  it('selects an earlier revision and shows diff', async () => {
    vi.spyOn(api, 'fetchObjectRevisions').mockResolvedValue(sampleRevisions);

    const { user } = renderInSection(
      <RevisionHistoryModal
        currentDraft={{
          name: 'Vaelin Frost',
          notes: 'Current working notes.',
          cr: '5',
        }}
        isOpen={true}
        kind="npc"
        objectId="npc-1"
        onClose={vi.fn()}
        title="Vaelin Frost"
      />,
      { store: mockStore() },
    );

    await user.click(await screen.findByText('Rev #1'));

    expect(
      screen.getByRole('heading', {
        name: 'Revision #1 vs Current Draft',
      }),
    ).toBeInTheDocument();

    expect(screen.getByText('Mysterious traveler.')).toBeInTheDocument();
    expect(screen.getByText('Current working notes.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore Rev #1' })).toBeInTheDocument();
  });

  it('toggles to raw JSON snapshot view and back', async () => {
    vi.spyOn(api, 'fetchObjectRevisions').mockResolvedValue(sampleRevisions);

    const { user } = renderInSection(
      <RevisionHistoryModal
        currentDraft={{ name: 'Vaelin Frost' }}
        isOpen={true}
        kind="npc"
        objectId="npc-1"
        onClose={vi.fn()}
        title="Vaelin Frost"
      />,
      { store: mockStore() },
    );

    const toggleBtn = await screen.findByRole('button', { name: 'Show Raw Snapshot' });
    await user.click(toggleBtn);

    expect(screen.getByText(/Updated ally of the Harpers/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show Formatted Diff' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show Formatted Diff' }));
    expect(screen.getByRole('button', { name: 'Show Raw Snapshot' })).toBeInTheDocument();
  });

  it('restores an earlier revision via store.updateItem and onRestore callback', async () => {
    vi.spyOn(api, 'fetchObjectRevisions').mockResolvedValue(sampleRevisions);
    const updateItem = vi.fn().mockResolvedValue({ ok: true });
    const onClose = vi.fn();
    const onRestore = vi.fn();

    const { user } = renderInSection(
      <RevisionHistoryModal
        currentDraft={{
          name: 'Vaelin Frost',
          notes: 'Current working notes.',
          cr: '5',
        }}
        isOpen={true}
        kind="npc"
        objectId="npc-1"
        onClose={onClose}
        onRestore={onRestore}
        title="Vaelin Frost"
      />,
      { store: mockStore({ updateItem }) },
    );

    await user.click(await screen.findByText('Rev #1'));
    await user.click(screen.getByRole('button', { name: 'Restore Rev #1' }));

    await waitFor(() => {
      expect(updateItem).toHaveBeenCalledWith(
        'npc',
        'npc-1',
        expect.objectContaining({
          notes: 'Mysterious traveler.',
          cr: '3',
        }),
      );
    });

    expect(onRestore).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: 'Mysterious traveler.',
        cr: '3',
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('renders honest empty state when server campaign returns no revisions (never fabricates synthetic revisions)', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchObjectRevisions').mockResolvedValue([]);

    renderInSection(
      <RevisionHistoryModal
        currentDraft={{
          title: 'Dragon Hoard',
          notes: 'Mountains of gold.',
        }}
        isOpen={true}
        kind="encounter"
        objectId="enc-test"
        onClose={vi.fn()}
        title="Dragon Hoard"
      />,
      { store: mockStore({ editable: true }) },
    );

    expect(
      await screen.findByText('No revision history recorded for this object yet.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Past Snapshots (0)')).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Restore Rev/i })).not.toBeInTheDocument();
  });

  it('renders honest error state with Retry button when server fetch throws (never fabricates synthetic revisions)', async () => {
    const fetchSpy = vi
      .spyOn(api, 'fetchObjectRevisions')
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValueOnce(sampleRevisions);

    const { user } = renderInSection(
      <RevisionHistoryModal
        currentDraft={{
          name: 'Vaelin Frost',
          notes: 'Current working notes.',
        }}
        isOpen={true}
        kind="npc"
        objectId="npc-1"
        onClose={vi.fn()}
        title="Vaelin Frost"
      />,
      { store: mockStore({ editable: true }) },
    );

    expect(
      await screen.findByText('Unable to load revision history from server.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Past Snapshots (0)')).toBeInTheDocument();
    expect(screen.queryByText(/Rev #3/)).not.toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: 'Retry' });
    await user.click(retryBtn);

    expect(await screen.findByText('Past Snapshots (2)')).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('uses synthetic demo revisions without calling server and disables restore when store is read-only (!store.editable)', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchObjectRevisions');
    const updateItem = vi.fn();

    const { user } = renderInSection(
      <RevisionHistoryModal
        currentDraft={{
          title: 'Dragon Hoard',
          notes: 'Mountains of gold.',
        }}
        isOpen={true}
        kind="encounter"
        objectId="enc-test"
        onClose={vi.fn()}
        title="Dragon Hoard"
      />,
      { store: mockStore({ editable: false, updateItem }) },
    );

    expect(await screen.findByText('Past Snapshots (3)')).toBeInTheDocument();
    expect(screen.getByText('Rev #3 (Current)')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    await user.click(screen.getByText('Rev #2'));
    const restoreBtn = screen.getByRole('button', { name: 'Restore Rev #2' });
    expect(restoreBtn).toBeDisabled();
    expect(updateItem).not.toHaveBeenCalled();
  });

  it('closes on close button click', async () => {
    vi.spyOn(api, 'fetchObjectRevisions').mockResolvedValue(sampleRevisions);
    const onClose = vi.fn();

    const { user } = renderInSection(
      <RevisionHistoryModal
        currentDraft={{ name: 'Vaelin Frost' }}
        isOpen={true}
        kind="npc"
        objectId="npc-1"
        onClose={onClose}
        title="Vaelin Frost"
      />,
      { store: mockStore() },
    );

    await user.click(await screen.findByLabelText('Close revision history'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
