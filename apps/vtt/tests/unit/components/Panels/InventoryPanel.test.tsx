import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { InventoryPanel } from '../../../../src/components/Panels/InventoryPanel';
import { commandClient } from '../../../../src/services/commandClient';
import { useCharacterStore } from '../../../../src/stores/characterStore';
import type { ObjectLink } from '../../../../src/services/panelRegistry';
import type { Character } from '@nexus/character-contracts';

vi.mock('../../../../src/services/commandClient', () => ({
  commandClient: {
    transferItem: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('InventoryPanel', () => {
  const mockLink: ObjectLink = {
    kind: 'item',
    id: 'actor-source-1',
    campaignId: 'camp-1',
    title: 'Rogue Satchel',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (commandClient.transferItem as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    useCharacterStore.setState({
      characters: [
        { id: 'actor-source-1', name: 'Astarion' } as unknown as Character,
        { id: 'actor-target-2', name: 'Shadowheart' } as unknown as Character,
      ],
    });
  });

  it('renders inventory header, stats, and item cards', () => {
    render(
      <InventoryPanel
        link={mockLink}
        onClose={vi.fn()}
        isPopout={false}
      />,
    );

    expect(screen.getByTestId('inventory-panel')).toBeInTheDocument();
    expect(screen.getByText("Astarion's Inventory")).toBeInTheDocument();
    expect(screen.getByText('Wand of Magic Missiles')).toBeInTheDocument();
    expect(screen.getByText('Potion of Healing')).toBeInTheDocument();
    expect(screen.getByText('x3')).toBeInTheDocument();
    expect(screen.getByText('7/7 Charges')).toBeInTheDocument();
    expect(screen.getAllByText('Equipped').length).toBeGreaterThan(0);
    expect(screen.getByText('Attuned')).toBeInTheDocument();
  });

  it('opens transfer form and cancels it', () => {
    render(
      <InventoryPanel
        link={mockLink}
        onClose={vi.fn()}
        isPopout={false}
      />,
    );

    expect(screen.queryByTestId('transfer-form')).not.toBeInTheDocument();

    const transferBtn = screen.getByTestId('transfer-btn-item-potion-healing');
    fireEvent.click(transferBtn);

    expect(screen.getByTestId('transfer-form')).toBeInTheDocument();

    const cancelBtn = screen.getByTestId('cancel-transfer-btn');
    fireEvent.click(cancelBtn);

    expect(screen.queryByTestId('transfer-form')).not.toBeInTheDocument();
  });

  it('executes item transfer and decrements local quantity', async () => {
    render(
      <InventoryPanel
        link={mockLink}
        onClose={vi.fn()}
        isPopout={false}
      />,
    );

    // Open transfer on Potion of Healing (qty 3)
    fireEvent.click(screen.getByTestId('transfer-btn-item-potion-healing'));

    const qtyInput = screen.getByTestId('transfer-qty-input');
    fireEvent.change(qtyInput, { target: { value: '2' } });

    const targetSelect = screen.getByTestId('transfer-target-select');
    fireEvent.change(targetSelect, { target: { value: 'actor-target-2' } });

    const confirmBtn = screen.getByTestId('confirm-transfer-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(commandClient.transferItem).toHaveBeenCalledWith(
        'camp-1',
        'item-potion-healing',
        expect.objectContaining({
          sourceActorId: 'actor-source-1',
          targetActorId: 'actor-target-2',
          quantity: 2,
        }),
      );
      expect(screen.getByTestId('inventory-status')).toHaveTextContent(
        'Transferred 2x Potion of Healing successfully.',
      );
      // Remaining quantity is 1
      expect(screen.getByTestId('item-card-item-potion-healing')).toBeInTheDocument();
      expect(screen.queryByTestId('transfer-form')).not.toBeInTheDocument();
    });
  });

  it('removes item card when transferring entire quantity', async () => {
    render(
      <InventoryPanel
        link={mockLink}
        onClose={vi.fn()}
        isPopout={false}
      />,
    );

    // Transfer Longsword +1 (qty 1)
    fireEvent.click(screen.getByTestId('transfer-btn-item-longsword'));
    fireEvent.click(screen.getByTestId('confirm-transfer-btn'));

    await waitFor(() => {
      expect(commandClient.transferItem).toHaveBeenCalledWith(
        'camp-1',
        'item-longsword',
        expect.objectContaining({
          quantity: 1,
        }),
      );
      expect(screen.queryByTestId('item-card-item-longsword')).not.toBeInTheDocument();
    });
  });
});
