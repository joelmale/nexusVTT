import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContainerModal } from '../../../../src/components/Props/ContainerModal';
import { useGameStore } from '../../../../src/stores/gameStore';
import type { PlacedProp } from '../../../../src/types/prop';

describe('ContainerModal', () => {
  const mockUpdateProp = vi.fn();
  const mockOnClose = vi.fn();
  const sceneId = 'scene-1';

  const baseProp: PlacedProp = {
    id: 'prop-chest-1',
    propId: 'asset-chest-1',
    sceneId: 'scene-1',
    x: 100,
    y: 100,
    rotation: 0,
    scale: 1,
    layer: 'props',
    visibleToPlayers: true,
    dmNotesOnly: false,
    placedBy: 'host-1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    name: 'Treasure Chest',
    currentStats: {
      state: 'open',
      contents: [
        { id: 'item-1', name: 'Gold Coins', quantity: 50, description: 'Shiny coins' },
        { id: 'item-2', name: 'Health Potion', quantity: 1 },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useGameStore.setState({
      updateProp: mockUpdateProp,
    } as never);
  });

  it('renders container title and open badge', () => {
    render(
      <ContainerModal
        placedProp={baseProp}
        sceneId={sceneId}
        onClose={mockOnClose}
        isHost={true}
      />,
    );

    expect(screen.getByText('Treasure Chest')).toBeInTheDocument();
    expect(screen.getByText('🔓 Open')).toBeInTheDocument();
    expect(screen.getByText('Contents (2 items)')).toBeInTheDocument();
    expect(screen.getByText('Gold Coins')).toBeInTheDocument();
    expect(screen.getByText('Shiny coins')).toBeInTheDocument();
    expect(screen.getByText('Health Potion')).toBeInTheDocument();
  });

  it('renders locked message for non-host player when locked', () => {
    const lockedProp: PlacedProp = {
      ...baseProp,
      currentStats: { ...baseProp.currentStats, state: 'locked' },
    };

    render(
      <ContainerModal
        placedProp={lockedProp}
        sceneId={sceneId}
        onClose={mockOnClose}
        isHost={false}
      />,
    );

    expect(screen.getByText('🔒 Locked')).toBeInTheDocument();
    expect(
      screen.getByText('This container is locked. Only the DM can access its contents.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Contents (2 items)')).not.toBeInTheDocument();
  });

  it('renders closed message for non-host player when closed', () => {
    const closedProp: PlacedProp = {
      ...baseProp,
      currentStats: { ...baseProp.currentStats, state: 'closed' },
    };

    render(
      <ContainerModal
        placedProp={closedProp}
        sceneId={sceneId}
        onClose={mockOnClose}
        isHost={false}
      />,
    );

    expect(screen.getByText('🚪 Closed')).toBeInTheDocument();
    expect(
      screen.getByText('This container is closed. Ask the DM to open it.'),
    ).toBeInTheDocument();
  });

  it('renders empty message when there are no items and container is accessible', () => {
    const emptyProp: PlacedProp = {
      ...baseProp,
      currentStats: { state: 'open', contents: [] },
    };

    render(
      <ContainerModal
        placedProp={emptyProp}
        sceneId={sceneId}
        onClose={mockOnClose}
        isHost={true}
      />,
    );

    expect(screen.getByText('This container is empty.')).toBeInTheDocument();
  });

  it('allows host to add a new item', () => {
    render(
      <ContainerModal
        placedProp={baseProp}
        sceneId={sceneId}
        onClose={mockOnClose}
        isHost={true}
      />,
    );

    const nameInput = screen.getByPlaceholderText('Item name');
    const qtyInput = screen.getByPlaceholderText('Qty');
    const descInput = screen.getByPlaceholderText('Description (optional)');
    const addButton = screen.getByRole('button', { name: 'Add Item' });

    fireEvent.change(nameInput, { target: { value: 'Magic Scroll' } });
    fireEvent.change(qtyInput, { target: { value: '3' } });
    fireEvent.change(descInput, { target: { value: 'Scroll of Fireball' } });
    fireEvent.click(addButton);

    expect(mockUpdateProp).toHaveBeenCalledWith(
      sceneId,
      baseProp.id,
      expect.objectContaining({
        currentStats: expect.objectContaining({
          contents: expect.arrayContaining([
            expect.objectContaining({
              name: 'Magic Scroll',
              quantity: 3,
              description: 'Scroll of Fireball',
            }),
          ]),
        }),
      }),
    );
  });

  it('allows host to add item via Enter key in name field', () => {
    render(
      <ContainerModal
        placedProp={baseProp}
        sceneId={sceneId}
        onClose={mockOnClose}
        isHost={true}
      />,
    );

    const nameInput = screen.getByPlaceholderText('Item name');
    fireEvent.change(nameInput, { target: { value: 'Dagger' } });
    fireEvent.keyDown(nameInput, { key: 'Enter' });

    expect(mockUpdateProp).toHaveBeenCalledWith(
      sceneId,
      baseProp.id,
      expect.objectContaining({
        currentStats: expect.objectContaining({
          contents: expect.arrayContaining([
            expect.objectContaining({
              name: 'Dagger',
              quantity: 1,
            }),
          ]),
        }),
      }),
    );
  });

  it('allows host to remove an item', () => {
    render(
      <ContainerModal
        placedProp={baseProp}
        sceneId={sceneId}
        onClose={mockOnClose}
        isHost={true}
      />,
    );

    const removeButtons = screen.getAllByTitle('Remove item');
    fireEvent.click(removeButtons[0]);

    expect(mockUpdateProp).toHaveBeenCalledWith(sceneId, baseProp.id, {
      currentStats: {
        ...baseProp.currentStats,
        contents: [baseProp.currentStats!.contents![1]],
      },
    });
  });

  it('allows increasing and decreasing item quantity', () => {
    render(
      <ContainerModal
        placedProp={baseProp}
        sceneId={sceneId}
        onClose={mockOnClose}
        isHost={false}
      />,
    );

    const increaseButtons = screen.getAllByTitle('Increase quantity');
    fireEvent.click(increaseButtons[0]); // increase Gold Coins from 50 to 51

    expect(mockUpdateProp).toHaveBeenCalledWith(sceneId, baseProp.id, {
      currentStats: {
        ...baseProp.currentStats,
        contents: [
          { ...baseProp.currentStats!.contents![0], quantity: 51 },
          baseProp.currentStats!.contents![1],
        ],
      },
    });

    const decreaseButtons = screen.getAllByTitle('Decrease quantity');
    fireEvent.click(decreaseButtons[1]); // decrease Health Potion from 1 to 0 -> should remove it

    expect(mockUpdateProp).toHaveBeenCalledWith(sceneId, baseProp.id, {
      currentStats: {
        ...baseProp.currentStats,
        contents: [baseProp.currentStats!.contents![0]],
      },
    });
  });

  it('handles closing the modal via button and backdrop click', () => {
    const { container } = render(
      <ContainerModal
        placedProp={baseProp}
        sceneId={sceneId}
        onClose={mockOnClose}
        isHost={true}
      />,
    );

    const closeBtn = screen.getByTitle('Close');
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    const overlay = container.querySelector('.container-modal-overlay')!;
    fireEvent.click(overlay);
    expect(mockOnClose).toHaveBeenCalledTimes(2);

    const modalBody = container.querySelector('.container-modal')!;
    fireEvent.click(modalBody);
    expect(mockOnClose).toHaveBeenCalledTimes(2); // stopPropagation prevented close
  });
});
