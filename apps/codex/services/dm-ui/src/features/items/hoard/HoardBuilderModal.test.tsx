import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getFixtureBundle } from '../../../demo/fixture-registry';
import type { BundleStore } from '../../section-shell/bundleStore';
import { HoardBuilderModal } from './HoardBuilderModal';

describe('HoardBuilderModal', () => {
  const bundle = getFixtureBundle('ashes-of-veyra')!;

  let mockStore: BundleStore;

  beforeEach(() => {
    mockStore = {
      addItem: vi.fn().mockResolvedValue({ ok: true, id: 'item-new' }),
      updateItem: vi.fn().mockResolvedValue({ ok: true }),
      deleteItem: vi.fn().mockResolvedValue({ ok: true }),
      isEditable: true,
    } as unknown as BundleStore;
  });

  it('does not render when isOpen is false', () => {
    render(
      <HoardBuilderModal
        isOpen={false}
        onClose={vi.fn()}
        bundle={bundle}
        store={mockStore}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders modal dialog when open with initial rolled hoard', () => {
    render(
      <HoardBuilderModal
        isOpen={true}
        onClose={vi.fn()}
        bundle={bundle}
        store={mockStore}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Treasure Hoard Builder/)).toBeInTheDocument();
    expect(screen.getByText(/Coins/)).toBeInTheDocument();
  });

  it('closes on Escape key press', () => {
    const handleClose = vi.fn();
    render(
      <HoardBuilderModal
        isOpen={true}
        onClose={handleClose}
        bundle={bundle}
        store={mockStore}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('switches challenge tier and re-rolls', () => {
    render(
      <HoardBuilderModal
        isOpen={true}
        onClose={vi.fn()}
        bundle={bundle}
        store={mockStore}
      />,
    );
    const tierSelect = screen.getByLabelText(/Challenge Tier/i);
    fireEvent.change(tierSelect, { target: { value: '5-10' } });

    const rollBtn = screen.getByRole('button', { name: /Roll/i });
    fireEvent.click(rollBtn);

    expect(screen.getByText(/Coins/)).toBeInTheDocument();
  });

  it('adds rolled items to the campaign with selected holder and session', async () => {
    const handleAdded = vi.fn();
    render(
      <HoardBuilderModal
        isOpen={true}
        onClose={vi.fn()}
        bundle={bundle}
        store={mockStore}
        onItemsAdded={handleAdded}
      />,
    );

    const pcId = bundle.campaign.playerCharacters[0].id;
    const sessionId = bundle.sessions[0].id;

    // Select PC holder
    const holderSelect = screen.getByLabelText(/Assign Holder/i);
    fireEvent.change(holderSelect, { target: { value: pcId } });

    // Select Session
    const sessionSelect = screen.getByLabelText(/Session Reward/i);
    fireEvent.change(sessionSelect, { target: { value: sessionId } });

    // Click Add All to Campaign
    const addBtn = screen.getByRole('button', { name: /Add All to Campaign/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(mockStore.addItem).toHaveBeenCalled();
      expect(handleAdded).toHaveBeenCalledTimes(1);
    });

    const callArgs = vi.mocked(mockStore.addItem).mock.calls;
    expect(callArgs.length).toBeGreaterThan(0);
    // Verified holder was assigned
    expect(callArgs[0][1].holder).toEqual({ kind: 'party-member', id: pcId });
    expect(callArgs[0][1].sessionId).toBe(sessionId);
  });
});
