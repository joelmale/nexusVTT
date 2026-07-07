/**
 * A9 FogLayer unit tests.
 *
 * Covers:
 *  - renders (draws conceal + reveal punches) when fog.enabled with shapes
 *  - draws nothing when fog is disabled, or when the scene has no fog
 *    configured yet (useSceneFog returns null)
 *  - host vs player conceal opacity (asserted via the fillStyle the canvas
 *    context was given for the conceal fillRect call, not a screenshot)
 *  - subscription narrowness (A5 discipline extended to fog, per the A9
 *    brief): a fog write on the SAME scene re-renders FogLayer; a token
 *    write on the same scene does NOT - mirrors renderIsolation.test.tsx's
 *    render-counting mechanism (wrap the narrow slice hook in a vi.fn()
 *    spy and count calls).
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { v4 as uuidv4 } from 'uuid';
import type { Scene, PlacedToken } from '@/types/game';

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

// Wrap the narrow fog slice hook in a pass-through spy (render counter),
// same convention as renderIsolation.test.tsx's useGridSettings etc wrapping.
vi.mock('@/stores/scene', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/scene')>();
  return {
    ...actual,
    useSceneFog: vi.fn(actual.useSceneFog),
  };
});

import { useGameStore } from '@/stores/gameStore';
import * as sceneSlices from '@/stores/scene';
import { FogLayer } from './FogLayer';
import { drawingPersistenceService } from '@/services/drawingPersistence';

const getInitialState = () => useGameStore.getState();

/** Flush microtasks so the fire-and-forget dynamic
 * `import('@/services/websocket')` inside the fog actions resolves before
 * the test (and vitest's module-mock teardown) proceeds - same convention
 * as src/stores/fog.test.ts. */
const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

const makeScene = (sceneId: string): Scene => ({
  id: sceneId,
  name: 'Fog Test Scene',
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

const STABLE_CAMERA = { x: 0, y: 0, zoom: 1 };
const STABLE_VIEWPORT = { width: 800, height: 600 };

/** A stable, inspectable 2D context spy - installed per-test in place of
 * the global jsdom stub (which returns a fresh object on every call). */
function installCanvasContextSpy() {
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillStyleHistory: [] as string[],
    strokeStyleHistory: [] as string[],
    lineCap: '',
    lineJoin: '',
    lineWidth: 0,
    globalCompositeOperation: 'source-over',
    get fillStyle() {
      return this._fillStyle;
    },
    set fillStyle(v: string) {
      this._fillStyle = v;
      this.fillStyleHistory.push(v);
    },
    _fillStyle: '',
    get strokeStyle() {
      return this._strokeStyle;
    },
    set strokeStyle(v: string) {
      this._strokeStyle = v;
      this.strokeStyleHistory.push(v);
    },
    _strokeStyle: '',
  };

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );

  return ctx;
}

describe('FogLayer (A9)', () => {
  let sceneId: string;
  let tokenId: string;

  beforeEach(async () => {
    vi.mocked(drawingPersistenceService.saveScene).mockResolvedValue(
      undefined,
    );
    const actual =
      await vi.importActual<typeof import('@/stores/scene')>('@/stores/scene');
    vi.mocked(sceneSlices.useSceneFog).mockImplementation(actual.useSceneFog);

    useGameStore.setState(getInitialState(), true);
    sceneId = uuidv4();
    tokenId = uuidv4();

    const scene = makeScene(sceneId);
    scene.placedTokens = [makeToken(sceneId, tokenId)];

    useGameStore.setState((state) => ({
      sceneState: {
        ...state.sceneState,
        scenes: [scene],
        activeSceneId: sceneId,
      },
    }));
  });

  it('draws nothing (no fillRect) when the scene has no fog configured (useSceneFog -> null)', () => {
    const ctx = installCanvasContextSpy();

    render(
      <FogLayer
        sceneId={sceneId}
        isHost={false}
        camera={STABLE_CAMERA}
        viewportWidth={STABLE_VIEWPORT.width}
        viewportHeight={STABLE_VIEWPORT.height}
      />,
    );

    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('draws nothing (no fillRect) when fog.enabled is false', async () => {
    const ctx = installCanvasContextSpy();

    act(() => {
      useGameStore.getState().setFogEnabled(sceneId, false);
    });
    await flushAsync();

    render(
      <FogLayer
        sceneId={sceneId}
        isHost={false}
        camera={STABLE_CAMERA}
        viewportWidth={STABLE_VIEWPORT.width}
        viewportHeight={STABLE_VIEWPORT.height}
      />,
    );

    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('conceals with an OPAQUE fill for a player when fog is enabled', async () => {
    const ctx = installCanvasContextSpy();

    act(() => {
      useGameStore.getState().setFogEnabled(sceneId, true);
    });
    await flushAsync();

    render(
      <FogLayer
        sceneId={sceneId}
        isHost={false}
        camera={STABLE_CAMERA}
        viewportWidth={STABLE_VIEWPORT.width}
        viewportHeight={STABLE_VIEWPORT.height}
      />,
    );

    expect(ctx.fillRect).toHaveBeenCalled();
    // The conceal fillStyle is set before the (large, oversized) conceal
    // fillRect call - it's the first fillStyle assignment.
    expect(ctx.fillStyleHistory[0]).toBe('rgba(10, 10, 14, 1)');
  });

  it('conceals with a 50%-alpha fill for the host when fog is enabled', async () => {
    const ctx = installCanvasContextSpy();

    act(() => {
      useGameStore.getState().setFogEnabled(sceneId, true);
    });
    await flushAsync();

    render(
      <FogLayer
        sceneId={sceneId}
        isHost={true}
        camera={STABLE_CAMERA}
        viewportWidth={STABLE_VIEWPORT.width}
        viewportHeight={STABLE_VIEWPORT.height}
      />,
    );

    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.fillStyleHistory[0]).toBe('rgba(10, 10, 14, 0.5)');
  });

  it('punches a rect reveal shape via destination-out compositing', async () => {
    const ctx = installCanvasContextSpy();

    act(() => {
      useGameStore.getState().setFogEnabled(sceneId, true);
      useGameStore.getState().addFogShape(sceneId, {
        id: 'shape-1',
        kind: 'reveal',
        shape: 'rect',
        points: [
          { x: 10, y: 10 },
          { x: 50, y: 40 },
        ],
        createdAt: Date.now(),
      });
    });
    await flushAsync();

    render(
      <FogLayer
        sceneId={sceneId}
        isHost={false}
        camera={STABLE_CAMERA}
        viewportWidth={STABLE_VIEWPORT.width}
        viewportHeight={STABLE_VIEWPORT.height}
      />,
    );

    // Conceal fillRect (oversized bounds) + one reveal-punch fillRect for
    // the rect shape's bounding box.
    expect(ctx.fillRect).toHaveBeenCalledTimes(2);
    expect(ctx.fillRect).toHaveBeenLastCalledWith(10, 10, 40, 30);
  });

  it('strokes a brush reveal shape via destination-out compositing', async () => {
    const ctx = installCanvasContextSpy();

    act(() => {
      useGameStore.getState().setFogEnabled(sceneId, true);
      useGameStore.getState().addFogShape(sceneId, {
        id: 'shape-2',
        kind: 'reveal',
        shape: 'brush',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
          { x: 20, y: 5 },
        ],
        brushSize: 30,
        createdAt: Date.now(),
      });
    });
    await flushAsync();

    render(
      <FogLayer
        sceneId={sceneId}
        isHost={false}
        camera={STABLE_CAMERA}
        viewportWidth={STABLE_VIEWPORT.width}
        viewportHeight={STABLE_VIEWPORT.height}
      />,
    );

    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    expect(ctx.lineWidth).toBe(30);
  });

  it('SUBSCRIPTION NARROWNESS: a fog write on this scene re-renders FogLayer', async () => {
    installCanvasContextSpy();
    render(
      <FogLayer
        sceneId={sceneId}
        isHost={false}
        camera={STABLE_CAMERA}
        viewportWidth={STABLE_VIEWPORT.width}
        viewportHeight={STABLE_VIEWPORT.height}
      />,
    );

    const before = vi.mocked(sceneSlices.useSceneFog).mock.calls.length;

    act(() => {
      useGameStore.getState().setFogEnabled(sceneId, true);
    });
    await flushAsync();

    const after = vi.mocked(sceneSlices.useSceneFog).mock.calls.length;
    expect(after).toBeGreaterThan(before);
  });

  it('SUBSCRIPTION NARROWNESS: a token move on this scene does NOT re-render FogLayer (fog reads fogSlice only)', () => {
    installCanvasContextSpy();
    render(
      <FogLayer
        sceneId={sceneId}
        isHost={false}
        camera={STABLE_CAMERA}
        viewportWidth={STABLE_VIEWPORT.width}
        viewportHeight={STABLE_VIEWPORT.height}
      />,
    );

    const before = vi.mocked(sceneSlices.useSceneFog).mock.calls.length;

    act(() => {
      useGameStore.getState().applyEvent({
        type: 'token/move',
        data: { sceneId, tokenId, position: { x: 999, y: 888 } },
      });
    });

    const after = vi.mocked(sceneSlices.useSceneFog).mock.calls.length;
    expect(after - before).toBe(0);
  });
});
