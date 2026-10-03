import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PropRenderer } from '../../../../src/components/Scene/PropRenderer';
import { useGameStore } from '../../../../src/stores/gameStore';
import { propAssetManager } from '../../../../src/services/propAssets';
import type { PlacedProp, Scene } from '../../../../src/types/game';

const PROP_ID = 'placed-door-1';
const ASSET_ID = 'asset-door-1';
const SCENE_ID = 'scene-1';

describe('PropRenderer Door and Container Interactions', () => {
  beforeEach(() => {
    vi.spyOn(propAssetManager, 'getPropById').mockReturnValue({
      id: ASSET_ID,
      name: 'Wooden Door',
      image: '/assets/props/door.png',
      size: 'small',
      category: 'door',
      interactive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const state = useGameStore.getState();
    useGameStore.setState({
      ...state,
      user: { ...state.user, id: 'host-1', type: 'host' },
      sceneState: {
        ...state.sceneState,
        activeSceneId: SCENE_ID,
        scenes: [
          {
            id: SCENE_ID,
            name: 'Dungeon',
            placedProps: [
              {
                id: PROP_ID,
                propId: ASSET_ID,
                sceneId: SCENE_ID,
                x: 200,
                y: 200,
                rotation: 0,
                scale: 1,
                layer: 'props',
                visibleToPlayers: true,
                dmNotesOnly: false,
                placedBy: 'host-1',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                currentStats: { state: 'closed' },
              },
            ],
            placedTokens: [],
            drawings: [],
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

  it('toggles door state to open on double-click and adds reveal fog shape', () => {
    const addFogShapeSpy = vi.spyOn(useGameStore.getState(), 'addFogShape');

    const { container } = render(
      <svg>
        <PropRenderer
          placedPropId={PROP_ID}
          gridSize={50}
          isSelected={false}
          onSelect={vi.fn()}
          onMove={vi.fn()}
          currentUserId="host-1"
          sceneId={SCENE_ID}
        />
      </svg>,
    );

    const group = container.querySelector('g[transform]');
    expect(group).toBeTruthy();

    fireEvent.doubleClick(group!);

    const state = useGameStore.getState();
    const prop = state.sceneState.scenes[0].placedProps.find((p: PlacedProp) => p.id === PROP_ID);
    expect(prop?.currentStats?.state).toBe('open');
    expect(addFogShapeSpy).toHaveBeenCalledWith(
      SCENE_ID,
      expect.objectContaining({
        kind: 'reveal',
        shape: 'rect',
      }),
    );
  });

  it('toggles open door back to closed on double-click', () => {
    const state = useGameStore.getState();
    const prop = state.sceneState.scenes[0].placedProps[0];
    prop.currentStats = { state: 'open' };

    const { container } = render(
      <svg>
        <PropRenderer
          placedPropId={PROP_ID}
          gridSize={50}
          isSelected={false}
          onSelect={vi.fn()}
          onMove={vi.fn()}
          currentUserId="host-1"
          sceneId={SCENE_ID}
        />
      </svg>,
    );

    const group = container.querySelector('g[transform]');
    fireEvent.doubleClick(group!);

    const updatedState = useGameStore.getState();
    const updatedProp = updatedState.sceneState.scenes[0].placedProps.find(
      (p: PlacedProp) => p.id === PROP_ID,
    );
    expect(updatedProp?.currentStats?.state).toBe('closed');
  });

  it('handles double-click on containers to open container modal', () => {
    vi.spyOn(propAssetManager, 'getPropById').mockReturnValue({
      id: ASSET_ID,
      name: 'Treasure Chest',
      image: '/assets/props/chest.png',
      size: 'small',
      category: 'container',
      interactive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const { container } = render(
      <svg>
        <PropRenderer
          placedPropId={PROP_ID}
          gridSize={50}
          isSelected={false}
          onSelect={vi.fn()}
          onMove={vi.fn()}
          currentUserId="host-1"
          sceneId={SCENE_ID}
        />
      </svg>,
    );

    const group = container.querySelector('g[transform]');
    expect(group).toBeTruthy();
    fireEvent.doubleClick(group!);
  });

  it('renders light source indicators when prop has lightRadius', () => {
    vi.spyOn(propAssetManager, 'getPropById').mockReturnValue({
      id: ASSET_ID,
      name: 'Torch',
      image: '/assets/props/torch.png',
      size: 'tiny',
      category: 'light',
      lightRadius: 20,
      lightColor: '#ffaa00',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const { container } = render(
      <svg>
        <PropRenderer
          placedPropId={PROP_ID}
          gridSize={50}
          isSelected={false}
          onSelect={vi.fn()}
          onMove={vi.fn()}
          currentUserId="host-1"
          sceneId={SCENE_ID}
        />
      </svg>,
    );

    expect(container.textContent).toContain('💡');
  });

  it('renders nothing for players when prop is hidden from players', () => {
    const state = useGameStore.getState();
    useGameStore.setState({
      ...state,
      user: { ...state.user, id: 'player-1', type: 'player' },
      sceneState: {
        ...state.sceneState,
        scenes: state.sceneState.scenes.map((s: Scene) =>
          s.id === SCENE_ID
            ? {
                ...s,
                placedProps: s.placedProps.map((p: PlacedProp) =>
                  p.id === PROP_ID ? { ...p, visibleToPlayers: false } : p,
                ),
              }
            : s,
        ),
      },
    } as never);

    const { container } = render(
      <svg>
        <PropRenderer
          placedPropId={PROP_ID}
          gridSize={50}
          isSelected={false}
          onSelect={vi.fn()}
          onMove={vi.fn()}
          currentUserId="player-1"
          sceneId={SCENE_ID}
        />
      </svg>,
    );

    expect(container.querySelector('g[transform]')).toBeNull();
  });

  it('handles left click and right click selection', () => {
    const handleSelect = vi.fn();
    const { container } = render(
      <svg>
        <PropRenderer
          placedPropId={PROP_ID}
          gridSize={50}
          isSelected={false}
          onSelect={handleSelect}
          onMove={vi.fn()}
          currentUserId="host-1"
          sceneId={SCENE_ID}
        />
      </svg>,
    );

    const group = container.querySelector('g[transform]')!;
    fireEvent.mouseDown(group, { button: 0 });
    expect(handleSelect).toHaveBeenCalledWith(PROP_ID, false);

    fireEvent.contextMenu(group);
    expect(handleSelect).toHaveBeenCalledWith(PROP_ID, false);
  });
});
