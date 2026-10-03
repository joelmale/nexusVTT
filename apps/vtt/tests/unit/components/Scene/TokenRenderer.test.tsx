import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TokenRenderer } from '../../../../src/components/Scene/TokenRenderer';
import { useGameStore } from '../../../../src/stores/gameStore';
import { tokenAssetManager } from '../../../../src/services/tokenAssets';

const TOKEN_ID = 'placed-token-1';
const ASSET_ID = 'asset-token-1';
const SCENE_ID = 'scene-1';

describe('TokenRenderer Stealth Ghost View', () => {
  beforeEach(() => {
    window.Element.prototype.setPointerCapture = vi.fn();
    window.Element.prototype.releasePointerCapture = vi.fn();

    vi.spyOn(tokenAssetManager, 'getTokenById').mockReturnValue({
      id: ASSET_ID,
      name: 'Sneaky Rogue',
      image: '/assets/tokens/rogue.png',
      size: 'medium',
      category: 'pc',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const state = useGameStore.getState();
    useGameStore.setState({
      ...state,
      sceneState: {
        ...state.sceneState,
        activeSceneId: SCENE_ID,
        scenes: [
          {
            id: SCENE_ID,
            name: 'Dungeon',
            placedTokens: [
              {
                id: TOKEN_ID,
                tokenId: ASSET_ID,
                sceneId: SCENE_ID,
                x: 100,
                y: 100,
                rotation: 0,
                scale: 1,
                layer: 'tokens',
                visibleToPlayers: false, // Hidden
                dmNotesOnly: false,
                placedBy: 'host-1',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                roomCode: 'TEST',
                conditions: [],
                currentStats: { hp: 20 },
              },
            ],
            drawings: [],
            placedProps: [],
            gridSettings: { size: 50, enabled: true, color: '#444' },
            width: 1000,
            height: 1000,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      },
    } as never);
  });

  it('renders nothing for a player when token is hidden from players', () => {
    const { container } = render(
      <svg>
        <TokenRenderer
          placedTokenId={TOKEN_ID}
          gridSize={50}
          isSelected={false}
          onSelect={vi.fn()}
          onMoveEnd={vi.fn()}
          isHost={false}
          currentUserId="player-1"
          sceneId={SCENE_ID}
        />
      </svg>,
    );

    expect(container.querySelector('g[data-token-id]')).toBeNull();
    expect(screen.queryByTestId('token-ghost-indicator')).toBeNull();
  });

  it('renders DM Stealth Ghost View at 50% opacity with eye badge when isHost is true', () => {
    render(
      <svg>
        <TokenRenderer
          placedTokenId={TOKEN_ID}
          gridSize={50}
          isSelected={false}
          onSelect={vi.fn()}
          onMoveEnd={vi.fn()}
          isHost={true}
          currentUserId="host-1"
          sceneId={SCENE_ID}
        />
      </svg>,
    );

    const ghostIndicator = screen.getByTestId('token-ghost-indicator');
    expect(ghostIndicator).toBeInTheDocument();
    expect(screen.getByText('👁️')).toBeInTheDocument();

    const group = screen.getByLabelText('Token: Sneaky Rogue');
    expect(group).toBeInTheDocument();
    const image = group.querySelector('image');
    expect(image).toHaveStyle({ opacity: '0.5' });
  });

  it('renders ghost indicator when token has invisible condition', () => {
    // Make token visible to players, but with 'invisible' condition
    const state = useGameStore.getState();
    const token = state.sceneState.scenes[0].placedTokens[0];
    token.visibleToPlayers = true;
    token.conditions = [{ id: 'invisible', name: 'Invisible' }];

    render(
      <svg>
        <TokenRenderer
          placedTokenId={TOKEN_ID}
          gridSize={50}
          isSelected={false}
          onSelect={vi.fn()}
          onMoveEnd={vi.fn()}
          isHost={true}
          currentUserId="host-1"
          sceneId={SCENE_ID}
        />
      </svg>,
    );

    expect(screen.getByTestId('token-ghost-indicator')).toBeInTheDocument();
  });

  it('handles left click selection and shift+click multi-selection', () => {
    const handleSelect = vi.fn();
    const state = useGameStore.getState();
    const token = state.sceneState.scenes[0].placedTokens[0];
    token.visibleToPlayers = true;

    const { container } = render(
      <svg>
        <TokenRenderer
          placedTokenId={TOKEN_ID}
          gridSize={50}
          isSelected={false}
          onSelect={handleSelect}
          onMoveEnd={vi.fn()}
          isHost={true}
          currentUserId="host-1"
          sceneId={SCENE_ID}
        />
      </svg>,
    );

    const group = container.querySelector('g[data-token-id]')!;
    expect(group).toBeTruthy();

    // Standard left-click
    fireEvent.pointerDown(group, { button: 0 });
    expect(handleSelect).toHaveBeenCalledWith(TOKEN_ID, false);

    // Shift + left-click (multi-select)
    fireEvent.pointerDown(group, { button: 0, shiftKey: true });
    expect(handleSelect).toHaveBeenCalledWith(TOKEN_ID, true);
  });

  it('handles right-click context menu event', () => {
    const handleSelect = vi.fn();
    const state = useGameStore.getState();
    const token = state.sceneState.scenes[0].placedTokens[0];
    token.visibleToPlayers = true;

    const { container } = render(
      <svg>
        <TokenRenderer
          placedTokenId={TOKEN_ID}
          gridSize={50}
          isSelected={false}
          onSelect={handleSelect}
          onMoveEnd={vi.fn()}
          isHost={true}
          currentUserId="host-1"
          sceneId={SCENE_ID}
        />
      </svg>,
    );

    const group = container.querySelector('g[data-token-id]')!;
    fireEvent.contextMenu(group);
    expect(handleSelect).toHaveBeenCalledWith(TOKEN_ID, false);
  });

  it('renders dead indicator (black X) and grayscale filter when isDead is true', () => {
    const state = useGameStore.getState();
    const token = state.sceneState.scenes[0].placedTokens[0];
    token.visibleToPlayers = true;
    token.isDead = true;

    const { container } = render(
      <svg>
        <TokenRenderer
          placedTokenId={TOKEN_ID}
          gridSize={50}
          isSelected={false}
          onSelect={vi.fn()}
          onMoveEnd={vi.fn()}
          isHost={true}
          currentUserId="host-1"
          sceneId={SCENE_ID}
        />
      </svg>,
    );

    const image = container.querySelector('image')!;
    expect(image).toHaveStyle({ filter: 'grayscale(100%)' });
    // Check for black X lines
    const lines = container.querySelectorAll('line[stroke="#000"]');
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it('renders condition dots when token has active conditions', () => {
    const state = useGameStore.getState();
    const token = state.sceneState.scenes[0].placedTokens[0];
    token.visibleToPlayers = true;
    token.conditions = [
      { id: 'poisoned', name: 'Poisoned', color: '#10b981' },
      { id: 'stunned', name: 'Stunned', color: '#fbbf24' },
    ];

    const { container } = render(
      <svg>
        <TokenRenderer
          placedTokenId={TOKEN_ID}
          gridSize={50}
          isSelected={false}
          onSelect={vi.fn()}
          onMoveEnd={vi.fn()}
          isHost={true}
          currentUserId="host-1"
          sceneId={SCENE_ID}
        />
      </svg>,
    );

    const aura = screen.getByTestId('token-condition-aura');
    expect(aura).toBeInTheDocument();
    expect(aura).toHaveAttribute('stroke', '#10b981');

    expect(screen.getByTestId('condition-badge-poisoned')).toBeInTheDocument();
    expect(screen.getByTestId('condition-badge-stunned')).toBeInTheDocument();
    expect(container.textContent).toContain('Disadvantage on attack rolls and ability checks');
  });

  it('renders selection ring when token isSelected is true', () => {
    const state = useGameStore.getState();
    const token = state.sceneState.scenes[0].placedTokens[0];
    token.visibleToPlayers = true;

    const { container } = render(
      <svg>
        <TokenRenderer
          placedTokenId={TOKEN_ID}
          gridSize={50}
          isSelected={true}
          onSelect={vi.fn()}
          onMoveEnd={vi.fn()}
          isHost={true}
          currentUserId="host-1"
          sceneId={SCENE_ID}
        />
      </svg>,
    );

    const selectionCircle = container.querySelector('circle[stroke-dasharray="5,5"]');
    expect(selectionCircle).toBeInTheDocument();
  });

  it('renders red border when dmNotesOnly is true', () => {
    const state = useGameStore.getState();
    const token = state.sceneState.scenes[0].placedTokens[0];
    token.visibleToPlayers = true;
    token.dmNotesOnly = true;

    const { container } = render(
      <svg>
        <TokenRenderer
          placedTokenId={TOKEN_ID}
          gridSize={50}
          isSelected={false}
          onSelect={vi.fn()}
          onMoveEnd={vi.fn()}
          isHost={true}
          currentUserId="host-1"
          sceneId={SCENE_ID}
        />
      </svg>,
    );

    const borderCircle = container.querySelector('circle[stroke="#ff0000"]');
    expect(borderCircle).toBeInTheDocument();
  });
});
