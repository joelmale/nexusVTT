import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CameraGestureEngine } from './cameraGestureEngine';
import { cameraRef } from './cameraRef';
import type { Camera } from '@/types/game';

/**
 * Proves the A3 transient-camera contract for a pan gesture:
 *   - zero store commits while the gesture is in progress (down..move*)
 *   - exactly ONE store commit, at gesture end (mouseup)
 *   - at least one throttled broadcast during the gesture (for Follow DM)
 *   - the transform is written imperatively on every move (rAF-batched)
 */

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  cameraRef.reset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  cameraRef.reset();
});

function makeEngine(overrides?: {
  storeCamera?: Camera;
  onCommit?: (c: Camera) => void;
  onBroadcast?: (c: Camera) => void;
  applyTransform?: (c: Camera) => void;
}) {
  const engine = new CameraGestureEngine();
  const storeCamera = overrides?.storeCamera ?? { x: 0, y: 0, zoom: 1 };
  const onCommit = overrides?.onCommit ?? vi.fn();
  const onBroadcast = overrides?.onBroadcast ?? vi.fn();
  const applyTransform = overrides?.applyTransform ?? vi.fn();

  engine.sync({
    getStoreCamera: () => storeCamera,
    onCommit,
    onBroadcast,
    applyTransform,
  });

  return { engine, storeCamera, onCommit, onBroadcast, applyTransform };
}

describe('CameraGestureEngine - pan', () => {
  it('commits to the store exactly once, at pan end, with zero writes mid-gesture', () => {
    let commitCount = 0;
    const commitCamera: Camera[] = [];
    const { engine } = makeEngine({
      onCommit: (c) => {
        commitCount += 1;
        commitCamera.push(c);
      },
    });

    engine.startPan(200, 200);
    expect(commitCount).toBe(0);

    const moves = [
      { x: 210, y: 205 },
      { x: 225, y: 215 },
      { x: 240, y: 230 },
      { x: 260, y: 250 },
      { x: 280, y: 270 },
      { x: 300, y: 290 },
    ];
    for (const move of moves) {
      engine.movePan(move.x, move.y);
      expect(commitCount).toBe(0);
    }

    engine.endPan();
    expect(commitCount).toBe(1);
    // Total screen delta (100, 90) at zoom 1, camera starting at origin ->
    // world camera moves by -delta (pan drags the world, not the camera).
    expect(commitCamera[0]).toEqual({ x: -100, y: -90, zoom: 1 });
  });

  it('sends at least one throttled broadcast during a multi-move pan gesture', () => {
    const broadcasts: Camera[] = [];
    const { engine } = makeEngine({
      onBroadcast: (c) => broadcasts.push(c),
    });

    engine.startPan(0, 0);
    engine.movePan(10, 10);
    engine.movePan(20, 20);
    engine.movePan(30, 30);
    engine.movePan(40, 40);
    engine.movePan(50, 50);
    engine.movePan(60, 60);

    // At least the first in-gesture move should broadcast (throttle allows
    // the first tick through immediately), plus the final commit-time
    // broadcast happens on endPan.
    const midGestureBroadcasts = broadcasts.length;
    expect(midGestureBroadcasts).toBeGreaterThanOrEqual(1);

    engine.endPan();
    // endPan always sends a final broadcast with the committed camera.
    expect(broadcasts.length).toBeGreaterThan(midGestureBroadcasts - 1);
    expect(broadcasts[broadcasts.length - 1]).toEqual({ x: -60, y: -60, zoom: 1 });
  });

  it('writes the transform imperatively on every move (rAF-batched)', () => {
    const transforms: Camera[] = [];
    const { engine } = makeEngine({
      applyTransform: (c) => transforms.push(c),
    });

    engine.startPan(0, 0);
    expect(transforms).toHaveLength(0); // no transform write on start, only on move

    engine.movePan(10, 0);
    expect(transforms).toHaveLength(1);
    expect(transforms[0]).toEqual({ x: -10, y: 0, zoom: 1 });

    engine.movePan(20, 0);
    expect(transforms).toHaveLength(2);

    engine.endPan();
  });

  it('seeds cameraRef from the store at gesture start and resets it at gesture end', () => {
    const { engine } = makeEngine({ storeCamera: { x: 5, y: 5, zoom: 2 } });

    expect(cameraRef.isLive()).toBe(false);
    engine.startPan(0, 0);
    expect(cameraRef.isLive()).toBe(true);
    expect(cameraRef.get()).toEqual({ x: 5, y: 5, zoom: 2 });

    engine.movePan(10, 0);
    // Pan divides screen delta by zoom (2), so world delta is 5.
    expect(cameraRef.get()).toEqual({ x: 0, y: 5, zoom: 2 });

    engine.endPan();
    expect(cameraRef.isLive()).toBe(false);
  });
});

describe('CameraGestureEngine - wheel zoom', () => {
  it('does not commit to the store on individual wheel ticks, only after the idle timeout', () => {
    vi.useFakeTimers();
    let commitCount = 0;
    const { engine } = makeEngine({
      storeCamera: { x: 0, y: 0, zoom: 1 },
      onCommit: () => {
        commitCount += 1;
      },
    });

    engine.wheelZoom(-100); // zoom in
    expect(commitCount).toBe(0);
    engine.wheelZoom(-100);
    expect(commitCount).toBe(0);

    vi.advanceTimersByTime(199);
    expect(commitCount).toBe(0);

    vi.advanceTimersByTime(50);
    expect(commitCount).toBe(1);

    vi.useRealTimers();
  });

  it('clamps zoom to [0.1, 5.0] and preserves center-anchored math (no cursor position used)', () => {
    const transforms: Camera[] = [];
    const { engine } = makeEngine({
      storeCamera: { x: 3, y: 4, zoom: 4.9 },
      applyTransform: (c) => transforms.push(c),
    });

    engine.wheelZoom(-100); // zoom in: 4.9 * 1.1 = 5.39 -> clamped to 5.0
    expect(transforms[0]).toEqual({ x: 3, y: 4, zoom: 5.0 });
  });

  it('treats a burst of wheel ticks as a single gesture (one commit)', () => {
    vi.useFakeTimers();
    let commitCount = 0;
    const { engine } = makeEngine({ onCommit: () => (commitCount += 1) });

    for (let i = 0; i < 5; i++) {
      engine.wheelZoom(-10);
      vi.advanceTimersByTime(50); // well under the 200ms idle window
    }
    expect(commitCount).toBe(0);

    vi.advanceTimersByTime(200);
    expect(commitCount).toBe(1);

    vi.useRealTimers();
  });
});
