import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getFixtureBundle, type CampaignFixtureBundle } from '@/demo/fixture-registry';
import type { BundleStore } from '@/features/section-shell/bundleStore';
import { renderInSection } from '@/features/section-shell/testUtils';

import { QuickCaptureModal } from './QuickCaptureModal';

describe('QuickCaptureModal', () => {
  let mockBundle: CampaignFixtureBundle;
  let mockStore: BundleStore;
  let onClose: ReturnType<typeof vi.fn>;
  let onOpenInbox: ReturnType<typeof vi.fn>;

  const baseBundle = getFixtureBundle('ashes-of-veyra')!;

  beforeEach(() => {
    mockBundle = {
      ...baseBundle,
      inboxNotes: [
        {
          id: 'note-1',
          campaignId: baseBundle.campaignId,
          text: 'Unfiled idea',
          createdAt: '2026-10-22T10:00:00Z',
        },
      ],
    };

    mockStore = {
      bundle: mockBundle,
      editable: true,
      status: 'ready',
      addItem: vi.fn().mockResolvedValue({ ok: true, id: 'new-id-123' }),
      updateItem: vi.fn().mockResolvedValue({ ok: true }),
      removeItem: vi.fn().mockResolvedValue({ ok: true }),
      restoreItem: vi.fn().mockResolvedValue({ ok: true }),
      reload: vi.fn().mockResolvedValue(undefined),
      reorderNotes: vi.fn().mockResolvedValue({ ok: true }),
      getBacklinks: vi.fn().mockResolvedValue([]),
    };

    onClose = vi.fn();
    onOpenInbox = vi.fn();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = renderInSection(
      <QuickCaptureModal
        bundleOverride={mockBundle}
        isOpen={false}
        onClose={onClose}
        storeOverride={mockStore}
      />,
      { path: '/demo/ashes-of-veyra/notes', store: mockStore },
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders modal dialog with unfiled count and closes on Escape', () => {
    renderInSection(
      <QuickCaptureModal
        bundleOverride={mockBundle}
        isOpen={true}
        onClose={onClose}
        storeOverride={mockStore}
      />,
      { path: '/demo/ashes-of-veyra/notes', store: mockStore },
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Quick Capture')).toBeInTheDocument();
    expect(screen.getByText('1 unfiled')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('saves an unfiled note to inbox on capture button click', async () => {
    const user = userEvent.setup();
    renderInSection(
      <QuickCaptureModal
        bundleOverride={mockBundle}
        isOpen={true}
        onClose={onClose}
        storeOverride={mockStore}
      />,
      { path: '/demo/ashes-of-veyra/notes', store: mockStore },
    );

    const textarea = screen.getByPlaceholderText(
      /Capture an idea, secret, or quest lead/i,
    );
    await user.type(textarea, 'A strange glowing lantern found near the dock');

    const captureButton = screen.getByRole('button', { name: /Capture/i });
    expect(captureButton).not.toBeDisabled();
    await user.click(captureButton);

    await waitFor(() => {
      expect(mockStore.addItem).toHaveBeenCalledWith(
        'inbox-note',
        expect.objectContaining({
          text: 'A strange glowing lantern found near the dock',
        }),
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('submits on Ctrl+Enter keyboard shortcut', async () => {
    const user = userEvent.setup();
    renderInSection(
      <QuickCaptureModal
        bundleOverride={mockBundle}
        isOpen={true}
        onClose={onClose}
        storeOverride={mockStore}
      />,
      { path: '/demo/ashes-of-veyra/notes', store: mockStore },
    );

    const textarea = screen.getByPlaceholderText(
      /Capture an idea, secret, or quest lead/i,
    );
    await user.type(textarea, 'Shortcut capture idea');

    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });

    await waitFor(() => {
      expect(mockStore.addItem).toHaveBeenCalledWith(
        'inbox-note',
        expect.objectContaining({
          text: 'Shortcut capture idea',
        }),
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('triages directly to NPC destination', async () => {
    const user = userEvent.setup();
    renderInSection(
      <QuickCaptureModal
        bundleOverride={mockBundle}
        isOpen={true}
        onClose={onClose}
        storeOverride={mockStore}
      />,
      { path: '/demo/ashes-of-veyra/notes', store: mockStore },
    );

    const select = screen.getByLabelText(/Destination/i);
    await user.selectOptions(select, 'npc');

    const textarea = screen.getByPlaceholderText(
      /Capture an idea, secret, or quest lead/i,
    );
    await user.type(textarea, 'Lord Vane\nA ruthless debt collector');

    const captureButton = screen.getByRole('button', { name: /Capture/i });
    await user.click(captureButton);

    await waitFor(() => {
      expect(mockStore.addItem).toHaveBeenCalledWith(
        'npc',
        expect.objectContaining({
          name: 'Lord Vane',
          role: 'Contact',
        }),
      );
      expect(mockStore.addItem).toHaveBeenCalledWith(
        'inbox-note',
        expect.objectContaining({
          triagedTo: { kind: 'npc', id: 'new-id-123' },
        }),
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('triages directly to Quest destination', async () => {
    const user = userEvent.setup();
    renderInSection(
      <QuickCaptureModal
        bundleOverride={mockBundle}
        isOpen={true}
        onClose={onClose}
        storeOverride={mockStore}
      />,
      { path: '/demo/ashes-of-veyra/notes', store: mockStore },
    );

    const select = screen.getByLabelText(/Destination/i);
    await user.selectOptions(select, 'quest');

    const textarea = screen.getByPlaceholderText(
      /Capture an idea, secret, or quest lead/i,
    );
    await user.type(textarea, 'Investigate the crypt');

    await user.click(screen.getByRole('button', { name: /Capture/i }));

    await waitFor(() => {
      expect(mockStore.addItem).toHaveBeenCalledWith(
        'quest',
        expect.objectContaining({
          title: 'Investigate the crypt',
          status: 'active',
        }),
      );
    });
  });

  it('triages directly to Secret destination', async () => {
    const user = userEvent.setup();
    renderInSection(
      <QuickCaptureModal
        bundleOverride={mockBundle}
        isOpen={true}
        onClose={onClose}
        storeOverride={mockStore}
      />,
      { path: '/demo/ashes-of-veyra/notes', store: mockStore },
    );

    const select = screen.getByLabelText(/Destination/i);
    await user.selectOptions(select, 'secret');

    const textarea = screen.getByPlaceholderText(
      /Capture an idea, secret, or quest lead/i,
    );
    await user.type(textarea, 'The priest is a doppelganger');

    await user.click(screen.getByRole('button', { name: /Capture/i }));

    await waitFor(() => {
      expect(mockStore.addItem).toHaveBeenCalledWith(
        'secret',
        expect.objectContaining({
          text: 'The priest is a doppelganger',
          revealed: false,
        }),
      );
    });
  });

  it('triages directly to Note destination', async () => {
    const user = userEvent.setup();
    renderInSection(
      <QuickCaptureModal
        bundleOverride={mockBundle}
        isOpen={true}
        onClose={onClose}
        storeOverride={mockStore}
      />,
      { path: '/demo/ashes-of-veyra/notes', store: mockStore },
    );

    const select = screen.getByLabelText(/Destination/i);
    await user.selectOptions(select, 'note');

    const textarea = screen.getByPlaceholderText(
      /Capture an idea, secret, or quest lead/i,
    );
    await user.type(textarea, 'General Campaign Note');

    await user.click(screen.getByRole('button', { name: /Capture/i }));

    await waitFor(() => {
      expect(mockStore.addItem).toHaveBeenCalledWith(
        'note',
        expect.objectContaining({
          title: 'General Campaign Note',
        }),
      );
    });
  });

  it('navigates to inbox when Open Inbox button is clicked', async () => {
    const user = userEvent.setup();
    renderInSection(
      <QuickCaptureModal
        bundleOverride={mockBundle}
        isOpen={true}
        onClose={onClose}
        onOpenInbox={onOpenInbox}
        storeOverride={mockStore}
      />,
      { path: '/demo/ashes-of-veyra/notes', store: mockStore },
    );

    const openInboxBtn = screen.getByRole('button', { name: /Open Inbox/i });
    await user.click(openInboxBtn);

    expect(onOpenInbox).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
