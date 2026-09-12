/**
 * A5 render-isolation gate tests (roadmap packet A5 — subscription surgery).
 *
 * Proves the core guarantee at the COMPONENT level: dispatching a
 * `token/move` through the store never re-renders SceneGrid,
 * SceneBackground, or DrawingRenderer — only the moved token's own
 * TokenRenderer re-renders (exactly once, at commit, per A2).
 *
 * Render counting mechanism: each layer component calls its narrow slice
 * hook exactly once per render (useGridSettings / useSceneBackgroundImage /
 * useSceneDrawingsSlice / useTokenRenderData). We wrap those hooks in
 * pass-through vi.fn() spies, so `mock.calls.length` IS the component's
 * render count. This measures both isolation paths with one mechanism:
 *   1. subscription isolation — store dispatch with a static harness
 *      (the only way a layer can re-render is via its own subscription);
 *   2. memo bailout — parent re-render churn with reference-stable props
 *      (mirrors production, where GameUI's `useActiveScene()` hands
 *      SceneCanvas a new `scene` object on every scene mutation).
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { v4 as uuidv4 } from 'uuid';
import type { Scene, PlacedToken } from '@/types/game';
import type { Token } from '@/types/token';
import type { RectangleDrawing } from '@/types/drawing';

// Same service-mocking convention as sliceIsolation.test.ts /
// gameStore.test.ts: keep autosave/sync timers scheduled by store actions
// (updateScene, applyEvent) away from real IndexedDB / sockets.
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
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
}));

// TokenRenderer resolves its base Token asset synchronously via the asset
// manager — stub it so no real asset loading happens in jsdom.
vi.mock('@/services/tokenAssets', () => ({
  tokenAssetManager: {
    getTokenById: vi.fn(),
    initialize: vi.fn().mockResolvedValue(undefined),
    refreshCustomizations: vi.fn().mockResolvedValue(undefined),
  },
}));

// Wrap the narrow slice hooks in pass-through spies (render counters).
vi.mock('@/stores/scene', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/scene')>();
  return {
    ...actual,
    useGridSettings: vi.fn(actual.useGridSettings),
    useSceneBackgroundImage: vi.fn(actual.useSceneBackgroundImage),
    useSceneDrawingsSlice: vi.fn(actual.useSceneDrawingsSlice),
    useTokenRenderData: vi.fn(actual.useTokenRenderData),
  };
});

import { useGameStore } from '@/stores/gameStore';
import * as sceneSlices from '@/stores/scene';
import { SceneGrid } from './SceneGrid';
import { SceneBackground } from './SceneBackground';
import { DrawingRenderer } from './DrawingRenderer';
import { TokenRenderer } from './TokenRenderer';
import { tokenAssetManager } from '@/services/tokenAssets';
import { drawingPersistenceService } from '@/services/drawingPersistence';

const getInitialState = () => useGameStore.getState();

const FAKE_TOKEN = {
  id: 'token-goblin',
  name: 'Goblin',
  size: 'medium',
  image: 'data:image/png;base64,goblin',
} as unknown as Token;

const makeScene = (sceneId: string): Scene => ({
  id: sceneId,
  name: 'Render Isolation Scene',
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
  backgroundImage: {
    url: 'data:image/png;base64,bg',
    width: 1000,
    height: 800,
    offsetX: 0,
    offsetY: 0,
    scale: 1,
  },
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

const makeDrawing = (): RectangleDrawing => ({
  id: uuidv4(),
  type: 'rectangle',
  x: 10,
  y: 10,
  width: 40,
  height: 40,
  style: {
    fillColor: '#ff0000',
    fillOpacity: 0.5,
    strokeColor: '#000000',
    strokeWidth: 2,
  },
  layer: 'overlay',
  roomCode: 'TEST_ROOM',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  createdBy: 'host-id',
});

// Reference-stable props for the layer components — mirrors production,
// where viewportSize is SceneCanvas state and the handlers are useCallbacks
// whose identities survive token moves.
const STABLE_CAMERA = { x: 0, y: 0, zoom: 1 };
const STABLE_VIEWPORT = { width: 800, height: 600 };
const noop = () => {};

const Layers: React.FC<{ sceneId: string; tokenIds: string[] }> = ({
  sceneId,
  tokenIds,
}) => (
  <svg>
    <SceneBackground sceneId={sceneId} />
    <SceneGrid viewportSize={STABLE_VIEWPORT} camera={STABLE_CAMERA} />
    <DrawingRenderer sceneId={sceneId} camera={STABLE_CAMERA} isHost={true} />
    <g id="tokens-layer">
      {tokenIds.map((id) => (
        <TokenRenderer
          key={id}
          placedTokenId={id}
          gridSize={50}
          isSelected={false}
          onSelect={noop}
          onMoveEnd={noop}
          isHost={true}
          currentUserId="user-1"
        />
      ))}
    </g>
  </svg>
);

// Parent-churn harness: re-renders the whole layer tree with UNCHANGED
// props, standing in for SceneCanvas re-rendering because its `scene` prop
// got a new object identity (GameUI's useActiveScene fires on any scene
// mutation). The memoized layers must bail out.
let bumpChurn: () => void = () => {};
const ChurnHarness: React.FC<{ sceneId: string; tokenIds: string[] }> = ({
  sceneId,
  tokenIds,
}) => {
  const [, setN] = React.useState(0);
  // Assigned in an effect (not during render) to satisfy react-hooks rules;
  // the test only calls bumpChurn after mount, inside act().
  React.useEffect(() => {
    bumpChurn = () => setN((n) => n + 1);
  }, []);
  return <Layers sceneId={sceneId} tokenIds={tokenIds} />;
};

/** Render counts derived from per-render hook invocations. */
const counts = () => ({
  grid: vi.mocked(sceneSlices.useGridSettings).mock.calls.length,
  background: vi.mocked(sceneSlices.useSceneBackgroundImage).mock.calls.length,
  drawings: vi.mocked(sceneSlices.useSceneDrawingsSlice).mock.calls.length,
});
const tokenCount = (placedTokenId: string) =>
  vi
    .mocked(sceneSlices.useTokenRenderData)
    .mock.calls.filter((call) => call[0] === placedTokenId).length;

describe('A5 render isolation (SceneGrid / SceneBackground / DrawingRenderer vs token moves)', () => {
  let sceneId: string;
  let tokenA: string;
  let tokenB: string;

  beforeEach(async () => {
    // vitest config sets mockReset: true — re-arm implementations that the
    // vi.mock factories installed (same pattern as sliceIsolation.test.ts).
    vi.mocked(drawingPersistenceService.saveScene).mockResolvedValue(
      undefined,
    );
    vi.mocked(tokenAssetManager.getTokenById).mockReturnValue(FAKE_TOKEN);
    const actual =
      await vi.importActual<typeof import('@/stores/scene')>('@/stores/scene');
    vi.mocked(sceneSlices.useGridSettings).mockImplementation(
      actual.useGridSettings,
    );
    vi.mocked(sceneSlices.useSceneBackgroundImage).mockImplementation(
      actual.useSceneBackgroundImage,
    );
    vi.mocked(sceneSlices.useSceneDrawingsSlice).mockImplementation(
      actual.useSceneDrawingsSlice,
    );
    vi.mocked(sceneSlices.useTokenRenderData).mockImplementation(
      actual.useTokenRenderData,
    );

    useGameStore.setState(getInitialState(), true);
    sceneId = uuidv4();
    tokenA = uuidv4();
    tokenB = uuidv4();

    const scene = makeScene(sceneId);
    scene.placedTokens = [makeToken(sceneId, tokenA), makeToken(sceneId, tokenB)];
    scene.drawings = [makeDrawing()];

    useGameStore.setState((state) => ({
      sceneState: {
        ...state.sceneState,
        scenes: [scene],
        activeSceneId: sceneId,
      },
    }));
  });

  it('a token move re-renders ONLY the moved token — grid, background, and drawings render 0 times', () => {
    render(<Layers sceneId={sceneId} tokenIds={[tokenA, tokenB]} />);
    const before = counts();
    const tokenABefore = tokenCount(tokenA);
    const tokenBBefore = tokenCount(tokenB);

    act(() => {
      useGameStore.getState().applyEvent({
        type: 'token/move',
        data: { sceneId, tokenId: tokenA, position: { x: 999, y: 888 } },
      });
    });

    const after = counts();
    expect(after.grid - before.grid).toBe(0);
    expect(after.background - before.background).toBe(0);
    expect(after.drawings - before.drawings).toBe(0);
    // The moved token commits exactly once (A2: single commit per gesture)…
    expect(tokenCount(tokenA) - tokenABefore).toBe(1);
    // …and its sibling token is untouched.
    expect(tokenCount(tokenB) - tokenBBefore).toBe(0);

    // Sanity: the store actually applied the move.
    const moved = useGameStore
      .getState()
      .sceneState.scenes[0].placedTokens.find((t) => t.id === tokenA);
    expect(moved).toMatchObject({ x: 999, y: 888 });
  });

  it('INVERSE CONTROL: a grid-settings change re-renders the grid exactly once — background and tokens stay at 0', () => {
    render(<Layers sceneId={sceneId} tokenIds={[tokenA]} />);
    const before = counts();
    const tokenABefore = tokenCount(tokenA);

    act(() => {
      useGameStore.getState().updateScene(sceneId, {
        gridSettings: {
          enabled: true,
          size: 100,
          color: '#123456',
          opacity: 1,
          snapToGrid: false,
          showToPlayers: false,
        },
      });
    });

    const after = counts();
    expect(after.grid - before.grid).toBe(1);
    expect(after.background - before.background).toBe(0);
    expect(tokenCount(tokenA) - tokenABefore).toBe(0);
  });

  it('INVERSE CONTROL: a background-image change re-renders the background — grid and tokens stay at 0', () => {
    render(<Layers sceneId={sceneId} tokenIds={[tokenA]} />);
    const before = counts();
    const tokenABefore = tokenCount(tokenA);

    act(() => {
      useGameStore.getState().updateScene(sceneId, {
        backgroundImage: {
          url: 'data:image/png;base64,newbg',
          width: 500,
          height: 400,
          offsetX: 10,
          offsetY: 10,
          scale: 2,
        },
      });
    });

    const after = counts();
    expect(after.background - before.background).toBe(1);
    expect(after.grid - before.grid).toBe(0);
    expect(tokenCount(tokenA) - tokenABefore).toBe(0);
  });

  it('a drawing change re-renders the drawings layer but not grid/background/tokens', () => {
    render(<Layers sceneId={sceneId} tokenIds={[tokenA]} />);
    const before = counts();
    const tokenABefore = tokenCount(tokenA);

    act(() => {
      useGameStore.getState().createDrawing(sceneId, makeDrawing());
    });

    const after = counts();
    expect(after.drawings - before.drawings).toBeGreaterThanOrEqual(1);
    expect(after.grid - before.grid).toBe(0);
    expect(after.background - before.background).toBe(0);
    expect(tokenCount(tokenA) - tokenABefore).toBe(0);
  });

  it('MEMO BAILOUT: parent re-renders with stable props do not re-render any layer (production scene-prop churn)', () => {
    render(<ChurnHarness sceneId={sceneId} tokenIds={[tokenA, tokenB]} />);
    const before = counts();
    const tokenABefore = tokenCount(tokenA);

    act(() => {
      bumpChurn();
    });
    act(() => {
      bumpChurn();
    });

    const after = counts();
    expect(after.grid - before.grid).toBe(0);
    expect(after.background - before.background).toBe(0);
    expect(after.drawings - before.drawings).toBe(0);
    expect(tokenCount(tokenA) - tokenABefore).toBe(0);
  });
});
