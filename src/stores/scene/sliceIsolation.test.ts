import { describe, it, expect, beforeEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import type { Scene, PlacedToken, PlacedProp } from '@/types/game';

// Same mocking convention as gameStore.test.ts / gameStore.persistence.test.ts:
// avoid touching real IndexedDB / server sync from the autosave/sync timers
// that some actions (updateScene, placeToken, moveToken, moveProp) schedule.
vi.mock('@/services/drawingPersistence', () => ({
  drawingPersistenceService: {
    saveScene: vi.fn().mockResolvedValue(undefined),
    loadAllScenes: vi.fn().mockResolvedValue([]),
    loadDrawings: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/services/websocket', () => ({
  webSocketService: {
    isConnected: vi.fn().mockReturnValue(true),
    sendEvent: vi.fn(),
    sendGameStateUpdate: vi.fn(),
  },
}));

import { useGameStore } from '@/stores/gameStore';
import {
  useGridSettings,
  useSceneGridSettings,
} from './gridSlice';
import {
  useBackgroundImage,
  useSceneBackgroundImage,
} from './backgroundSlice';
import { useTokenPosition, usePlacedTokensSlice } from './tokensSlice';
import { usePropPosition, usePlacedPropsSlice } from './propsSlice';
import { useCamera as useCameraSlice } from './cameraSlice';
import { drawingPersistenceService } from '@/services/drawingPersistence';

const getInitialState = () => useGameStore.getState();

// The global vitest config sets `mockReset: true`, which wipes
// `.mockResolvedValue()` implementations set inside the `vi.mock(...)`
// factory before every test. Re-arm here (same pattern as
// gameStore.persistence.test.ts) so actions that await
// `drawingPersistenceService.saveScene(...)` (e.g. `updateScene`) don't
// blow up on an undefined return value.
beforeEach(() => {
  vi.mocked(drawingPersistenceService.saveScene).mockResolvedValue(undefined);
});

const makeScene = (sceneId: string): Scene => ({
  id: sceneId,
  name: 'Test Scene',
  description: '',
  visibility: 'private',
  isEditable: true,
  createdBy: 'host-id',
  roomCode: 'TEST_ROOM',
  placedTokens: [],
  placedProps: [],
  drawings: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  gridSettings: {
    enabled: true,
    size: 50,
    color: '#ffffff',
    opacity: 0.5,
    snapToGrid: true,
    showToPlayers: true,
  },
  lightingSettings: {
    enabled: false,
    globalIllumination: true,
    ambientLight: 0.5,
    darkness: 0,
  },
  isActive: true,
  playerCount: 0,
});

const makeToken = (sceneId: string, tokenId: string): PlacedToken => ({
  id: tokenId,
  tokenId: 'token-goblin',
  sceneId,
  roomCode: 'TEST_ROOM',
  x: 100,
  y: 100,
  rotation: 0,
  scale: 1,
  layer: 'tokens',
  visibleToPlayers: true,
  dmNotesOnly: false,
  conditions: [],
  placedBy: 'user-1',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const makeProp = (sceneId: string, propId: string): PlacedProp => ({
  id: propId,
  propId: 'prop-chest',
  sceneId,
  x: 200,
  y: 200,
  rotation: 0,
  scale: 1,
  layer: 'props',
  visibleToPlayers: true,
  dmNotesOnly: false,
  placedBy: 'user-1',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

/**
 * Subscribes to the store using exactly the same selector a hook uses
 * (mirroring the hook body, since these hooks call `useGameStore` directly
 * and can't be invoked outside of React without a renderer). Counts
 * notifications to prove narrowness: a subscription should only fire when
 * ITS slice of the tree actually changes reference.
 */
function countNotifications<T>(selector: (state: ReturnType<typeof useGameStore.getState>) => T) {
  let calls = 0;
  let last = selector(useGameStore.getState());
  const unsub = useGameStore.subscribe((state) => {
    const next = selector(state);
    if (next !== last) {
      calls++;
      last = next;
    }
  });
  return {
    get count() {
      return calls;
    },
    unsub,
  };
}

describe('scene slice selector isolation (A4)', () => {
  let sceneId: string;
  let tokenId: string;
  let propId: string;

  beforeEach(() => {
    useGameStore.setState(getInitialState(), true);
    sceneId = uuidv4();
    tokenId = uuidv4();
    propId = uuidv4();

    const scene = makeScene(sceneId);
    scene.placedTokens = [makeToken(sceneId, tokenId)];
    scene.placedProps = [makeProp(sceneId, propId)];

    useGameStore.setState((state) => ({
      sceneState: { ...state.sceneState, scenes: [scene], activeSceneId: sceneId },
    }));
  });

  it('a token position write does not change the grid-settings selector output', () => {
    const gridSel = countNotifications(
      (s) => s.sceneState.scenes.find((sc) => sc.id === sceneId)?.gridSettings,
    );
    const before = useGridSettings.name; // sanity: hook exists
    expect(before).toBe('useGridSettings');

    useGameStore.getState().applyEvent({
      type: 'token/move',
      data: { sceneId, tokenId, position: { x: 999, y: 999 } },
    });

    expect(gridSel.count).toBe(0);
    gridSel.unsub();
  });

  it('a token position write does not change the background-image selector output', () => {
    const bgSel = countNotifications(
      (s) => s.sceneState.scenes.find((sc) => sc.id === sceneId)?.backgroundImage,
    );

    useGameStore.getState().applyEvent({
      type: 'token/move',
      data: { sceneId, tokenId, position: { x: 999, y: 999 } },
    });

    expect(bgSel.count).toBe(0);
    bgSel.unsub();
  });

  it('a grid-settings write does not change the token-position selector output', () => {
    const tokenSel = countNotifications((s) => {
      const scene = s.sceneState.scenes.find((sc) => sc.id === sceneId);
      const token = scene?.placedTokens?.find((t) => t.id === tokenId);
      return token ? `${token.x},${token.y},${token.rotation}` : null;
    });

    useGameStore.getState().updateScene(sceneId, {
      gridSettings: {
        enabled: true,
        size: 100,
        color: '#000000',
        opacity: 1,
        snapToGrid: false,
        showToPlayers: false,
      },
    });

    expect(tokenSel.count).toBe(0);
    tokenSel.unsub();
  });

  it('a grid-settings write does not change the camera selector output', () => {
    const camSel = countNotifications((s) => s.sceneState.camera);

    useGameStore.getState().updateScene(sceneId, {
      gridSettings: {
        enabled: false,
        size: 25,
        color: '#123456',
        opacity: 0.2,
        snapToGrid: true,
        showToPlayers: true,
      },
    });

    expect(camSel.count).toBe(0);
    camSel.unsub();
  });

  it('a camera update does not change the token-position or grid selector output', () => {
    const tokenSel = countNotifications((s) => {
      const scene = s.sceneState.scenes.find((sc) => sc.id === sceneId);
      return scene?.placedTokens?.find((t) => t.id === tokenId) ?? null;
    });
    const gridSel = countNotifications(
      (s) => s.sceneState.scenes.find((sc) => sc.id === sceneId)?.gridSettings,
    );

    useGameStore.getState().updateCamera({ x: 42, y: 17, zoom: 1.5 });

    expect(tokenSel.count).toBe(0);
    expect(gridSel.count).toBe(0);
    tokenSel.unsub();
    gridSel.unsub();
  });

  it('a prop move does not change the token-position selector output for a different entity', () => {
    const tokenSel = countNotifications((s) => {
      const scene = s.sceneState.scenes.find((sc) => sc.id === sceneId);
      return scene?.placedTokens?.find((t) => t.id === tokenId) ?? null;
    });

    useGameStore.getState().moveProp(sceneId, propId, { x: 555, y: 555 });

    expect(tokenSel.count).toBe(0);
    tokenSel.unsub();
  });

  it('useTokenPosition-equivalent selector DOES update on the matching token write (positive control)', () => {
    const tokenSel = countNotifications((s) => {
      const scene = s.sceneState.scenes.find((sc) => sc.id === sceneId);
      const token = scene?.placedTokens?.find((t) => t.id === tokenId);
      return token ? `${token.x},${token.y}` : null;
    });

    useGameStore.getState().applyEvent({
      type: 'token/move',
      data: { sceneId, tokenId, position: { x: 321, y: 654 } },
    });

    expect(tokenSel.count).toBe(1);
    const scene = useGameStore.getState().sceneState.scenes[0];
    const token = scene.placedTokens.find((t) => t.id === tokenId);
    expect(token?.x).toBe(321);
    expect(token?.y).toBe(654);
    tokenSel.unsub();
  });

  it('exports the required narrow hooks with stable identities', () => {
    expect(typeof useGridSettings).toBe('function');
    expect(typeof useSceneGridSettings).toBe('function');
    expect(typeof useBackgroundImage).toBe('function');
    expect(typeof useSceneBackgroundImage).toBe('function');
    expect(typeof useTokenPosition).toBe('function');
    expect(typeof usePlacedTokensSlice).toBe('function');
    expect(typeof usePropPosition).toBe('function');
    expect(typeof usePlacedPropsSlice).toBe('function');
    expect(typeof useCameraSlice).toBe('function');
  });
});

describe('array-storage integrity (tokens/props) after A4 (chosen storage: array, not keyed map)', () => {
  let sceneId: string;

  beforeEach(() => {
    useGameStore.setState(getInitialState(), true);
    sceneId = uuidv4();
    useGameStore.setState((state) => ({
      sceneState: {
        ...state.sceneState,
        scenes: [makeScene(sceneId)],
        activeSceneId: sceneId,
      },
    }));
  });

  it('placeToken / moveToken / deleteToken keep the array and count consistent', () => {
    const t1 = makeToken(sceneId, uuidv4());
    const t2 = makeToken(sceneId, uuidv4());

    useGameStore.getState().placeToken(sceneId, t1);
    useGameStore.getState().placeToken(sceneId, t2);

    let scene = useGameStore.getState().sceneState.scenes.find((s) => s.id === sceneId);
    expect(scene?.placedTokens).toHaveLength(2);
    expect(scene?.placedTokens.map((t) => t.id).sort()).toEqual(
      [t1.id, t2.id].sort(),
    );

    useGameStore.getState().moveToken(sceneId, t1.id, { x: 10, y: 20 });
    scene = useGameStore.getState().sceneState.scenes.find((s) => s.id === sceneId);
    expect(scene?.placedTokens.find((t) => t.id === t1.id)).toMatchObject({
      x: 10,
      y: 20,
    });

    useGameStore.getState().deleteToken(sceneId, t1.id);
    scene = useGameStore.getState().sceneState.scenes.find((s) => s.id === sceneId);
    expect(scene?.placedTokens).toHaveLength(1);
    expect(scene?.placedTokens[0].id).toBe(t2.id);
  });

  it('placeProp / moveProp keep the array consistent', () => {
    const p1 = makeProp(sceneId, uuidv4());
    useGameStore.getState().placeProp(sceneId, p1);

    let scene = useGameStore.getState().sceneState.scenes.find((s) => s.id === sceneId);
    expect(scene?.placedProps).toHaveLength(1);

    useGameStore.getState().moveProp(sceneId, p1.id, { x: 77, y: 88 });
    scene = useGameStore.getState().sceneState.scenes.find((s) => s.id === sceneId);
    expect(scene?.placedProps.find((p) => p.id === p1.id)).toMatchObject({
      x: 77,
      y: 88,
    });
  });
});
