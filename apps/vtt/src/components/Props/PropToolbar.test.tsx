import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PropToolbar } from './PropToolbar';
import { useGameStore } from '@/stores/gameStore';
import { propAssetManager } from '@/services/propAssets';
import type { PlacedProp, Prop } from '@/types/prop';

const PROP_ID = 'test-prop-id';
const SCENE_ID = 'test-scene-1';
const PLACED_PROP_ID = 'placed-prop-1';

const mockPropDef: Prop = {
  id: PROP_ID,
  name: 'Wooden Chest',
  category: 'furniture',
  tags: ['chest', 'wooden'],
  thumbnailImage: '',
  image: 'chest.png',
  size: 'small',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  interactive: true,
};

const mockPlacedProp: PlacedProp = {
  id: PLACED_PROP_ID,
  propId: PROP_ID,
  sceneId: SCENE_ID,
  x: 100,
  y: 100,
  rotation: 0,
  scale: 1,
  layer: 'background',
  visibleToPlayers: true,
  dmNotesOnly: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  placedBy: 'user-1',
  currentStats: {
    locked: false,
  },
};

function seedStore() {
  const state = useGameStore.getState();
  useGameStore.setState({
    ...state,
    user: { ...state.user, id: 'user-1', type: 'host' },
    sceneState: {
      ...state.sceneState,
      activeSceneId: SCENE_ID,
      selectedObjectIds: [PLACED_PROP_ID],
      scenes: [
        {
          ...(state.sceneState.scenes[0] ?? {}),
          id: SCENE_ID,
          name: 'Test Scene',
          placedProps: [{ ...mockPlacedProp }],
          placedTokens: [],
          drawings: [],
        },
      ],
    },
  } as never);
}

describe('PropToolbar', () => {
  beforeEach(() => {
    const portalRoot = document.createElement('div');
    portalRoot.id = 'portal-root';
    document.body.appendChild(portalRoot);

    vi.spyOn(propAssetManager, 'getPropById').mockReturnValue(mockPropDef);
    seedStore();
  });

  afterEach(() => {
    cleanup();
    document.getElementById('portal-root')?.remove();
    vi.restoreAllMocks();
  });

  it('renders action buttons including delete, duplicate, and lock', () => {
    render(<PropToolbar position={{ x: 100, y: 100 }} placedProp={mockPlacedProp} />);

    expect(screen.getByTitle('Remove Prop')).toBeInTheDocument();
    expect(screen.getByTitle('Duplicate Prop (or press D)')).toBeInTheDocument();
    expect(screen.getByTitle('Lock Position')).toBeInTheDocument();
  });

  it('deletes prop and clears selection when trashcan button is clicked without confirmation modal', () => {
    render(<PropToolbar position={{ x: 100, y: 100 }} placedProp={mockPlacedProp} />);

    fireEvent.click(screen.getByTitle('Remove Prop'));

    const scene = useGameStore.getState().sceneState.scenes.find((s) => s.id === SCENE_ID);
    expect(scene?.placedProps?.find((p) => p.id === PLACED_PROP_ID)).toBeUndefined();
    expect(useGameStore.getState().sceneState.selectedObjectIds).toEqual([]);
  });

  it('duplicates prop and places it with offset when duplicate button is clicked', () => {
    render(<PropToolbar position={{ x: 100, y: 100 }} placedProp={mockPlacedProp} />);

    fireEvent.click(screen.getByTitle('Duplicate Prop (or press D)'));

    const scene = useGameStore.getState().sceneState.scenes.find((s) => s.id === SCENE_ID);
    expect(scene?.placedProps?.length).toBe(2);
    expect(scene?.placedProps?.[1].x).toBe(mockPlacedProp.x + 20);
    expect(scene?.placedProps?.[1].y).toBe(mockPlacedProp.y + 20);
  });

  it('toggles lock position when lock button is clicked', () => {
    render(<PropToolbar position={{ x: 100, y: 100 }} placedProp={mockPlacedProp} />);

    fireEvent.click(screen.getByTitle('Lock Position'));

    const scene = useGameStore.getState().sceneState.scenes.find((s) => s.id === SCENE_ID);
    expect(scene?.placedProps?.[0].currentStats?.locked).toBe(true);
  });

  it('rotates prop clockwise and counter-clockwise', () => {
    const { rerender } = render(
      <PropToolbar position={{ x: 100, y: 100 }} placedProp={mockPlacedProp} />,
    );

    fireEvent.click(screen.getByTitle('Rotate +45°'));
    let scene = useGameStore.getState().sceneState.scenes.find((s) => s.id === SCENE_ID);
    expect(scene?.placedProps?.[0].rotation).toBe(45);

    rerender(
      <PropToolbar
        position={{ x: 100, y: 100 }}
        placedProp={scene!.placedProps![0]}
      />,
    );

    fireEvent.click(screen.getByTitle('Rotate -45°'));
    scene = useGameStore.getState().sceneState.scenes.find((s) => s.id === SCENE_ID);
    expect(scene?.placedProps?.[0].rotation).toBe(0);
  });
});
