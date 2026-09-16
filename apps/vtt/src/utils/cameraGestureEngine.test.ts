import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CameraGestureEngine,
  isZoomWheelEvent,
  type ViewportRect,
} from './cameraGestureEngine';
import { cameraRef } from './cameraRef';
import { sceneUtils } from './sceneUtils';
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
  getViewportRect?: () => ViewportRect;
  minZoom?: number;
  maxZoom?: number;
}) {
  const engine = new CameraGestureEngine();
  const storeCamera = overrides?.storeCamera ?? { x: 0, y: 0, zoom: 1 };
  const onCommit = overrides?.onCommit ?? vi.fn();
  const onBroadcast = overrides?.onBroadcast ?? vi.fn();
  const applyTransform = overrides?.applyTransform ?? vi.fn();
  const getViewportRect =
    overrides?.getViewportRect ??
    (() => ({ width: 800, height: 600, left: 0, top: 0 }));

  engine.sync({
    getStoreCamera: () => storeCamera,
    onCommit,
    onBroadcast,
    applyTransform,
    getViewportRect,
    minZoom: overrides?.minZoom,
    maxZoom: overrides?.maxZoom,
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

  it('clamps zoom to [0.1, 5.0] and preserves center-anchored math when cursor position is omitted', () => {
    const transforms: Camera[] = [];
    const { engine } = makeEngine({
      storeCamera: { x: 3, y: 4, zoom: 4.9 },
      applyTransform: (c) => transforms.push(c),
    });

    engine.wheelZoom(-100); // zoom in: 4.9 * exp(0.1) ≈ 5.41 -> clamped to 5.0
    expect(transforms[0]).toEqual({ x: 3, y: 4, zoom: 5.0 });
  });

  it('keeps the world point under the cursor invariant across a zoom', () => {
    const viewport = { width: 1000, height: 800, left: 100, top: 50 };
    const { engine, storeCamera } = makeEngine({
      storeCamera: { x: 200, y: -150, zoom: 1 },
      getViewportRect: () => viewport,
    });

    const clientX = 400;
    const clientY = 350;
    const sx = clientX - viewport.left; // 300
    const sy = clientY - viewport.top; // 300

    const worldBefore = sceneUtils.screenToWorld(
      sx,
      sy,
      storeCamera,
      viewport.width,
      viewport.height,
    );

    engine.wheelZoom(-100, clientX, clientY);

    const liveCamera = cameraRef.get();
    expect(liveCamera.zoom).toBeGreaterThan(1);

    const worldAfter = sceneUtils.screenToWorld(
      sx,
      sy,
      liveCamera,
      viewport.width,
      viewport.height,
    );

    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 5);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 5);
  });

  it('scales zoom change with deltaY magnitude', () => {
    const { engine: engineSmall } = makeEngine({
      storeCamera: { x: 0, y: 0, zoom: 1 },
    });
    engineSmall.wheelZoom(-50);
    const zoomSmall = cameraRef.get().zoom;

    cameraRef.reset();
    const { engine: engineLarge } = makeEngine({
      storeCamera: { x: 0, y: 0, zoom: 1 },
    });
    engineLarge.wheelZoom(-200);
    const zoomLarge = cameraRef.get().zoom;

    expect(zoomLarge).toBeGreaterThan(zoomSmall);
  });

  it('normalises deltaMode (pixels, lines, pages)', () => {
    const { engine: enginePixels } = makeEngine({
      storeCamera: { x: 0, y: 0, zoom: 1 },
    });
    enginePixels.wheelZoom(-160, undefined, undefined, 0); // 160 px
    const zoomPixels = cameraRef.get().zoom;

    cameraRef.reset();
    const { engine: engineLines } = makeEngine({
      storeCamera: { x: 0, y: 0, zoom: 1 },
    });
    engineLines.wheelZoom(-10, undefined, undefined, 1); // 10 lines * 16 = 160 px
    const zoomLines = cameraRef.get().zoom;

    expect(zoomLines).toBeCloseTo(zoomPixels, 5);

    cameraRef.reset();
    const { engine: enginePages } = makeEngine({
      storeCamera: { x: 0, y: 0, zoom: 1 },
      getViewportRect: () => ({ width: 800, height: 600, left: 0, top: 0 }),
    });
    enginePages.wheelZoom(-1, undefined, undefined, 2); // 1 page = 600 px
    const zoomPages = cameraRef.get().zoom;

    cameraRef.reset();
    const { engine: engineEquivalent } = makeEngine({
      storeCamera: { x: 0, y: 0, zoom: 1 },
    });
    engineEquivalent.wheelZoom(-600, undefined, undefined, 0);
    const zoomEquivalent = cameraRef.get().zoom;

    expect(zoomPages).toBeCloseTo(zoomEquivalent, 5);
  });

  it('clamps zoom at both minZoom and maxZoom', () => {
    const { engine } = makeEngine({
      storeCamera: { x: 0, y: 0, zoom: 1 },
      minZoom: 0.2,
      maxZoom: 3.0,
    });

    // Zoom way out
    engine.wheelZoom(10000);
    expect(cameraRef.get().zoom).toBe(0.2);

    // Zoom way in
    engine.wheelZoom(-10000);
    expect(cameraRef.get().zoom).toBe(3.0);
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

describe('isZoomWheelEvent', () => {
  it('dispatches ctrlKey/metaKey as zoom', () => {
    expect(isZoomWheelEvent({ ctrlKey: true, deltaX: 0, deltaY: 5 })).toBe(true);
    expect(isZoomWheelEvent({ metaKey: true, deltaX: 10, deltaY: 5 })).toBe(true);
  });

  it('dispatches non-zero deltaMode as zoom', () => {
    expect(isZoomWheelEvent({ deltaX: 0, deltaY: 3, deltaMode: 1 })).toBe(true);
    expect(isZoomWheelEvent({ deltaX: 0, deltaY: 1, deltaMode: 2 })).toBe(true);
  });

  it('dispatches discrete mouse wheel notches as zoom', () => {
    expect(isZoomWheelEvent({ deltaX: 0, deltaY: 100, deltaMode: 0 })).toBe(true);
    expect(isZoomWheelEvent({ deltaX: 0, deltaY: -120, deltaMode: 0 })).toBe(true);
    expect(isZoomWheelEvent({ deltaX: 0, deltaY: 50, deltaMode: 0 })).toBe(true);
  });

  it('dispatches trackpad scroll with small deltaY or non-zero deltaX as pan', () => {
    expect(isZoomWheelEvent({ deltaX: 0, deltaY: 15, deltaMode: 0 })).toBe(false);
    expect(isZoomWheelEvent({ deltaX: 10, deltaY: 0, deltaMode: 0 })).toBe(false);
    expect(isZoomWheelEvent({ deltaX: 5, deltaY: 60, deltaMode: 0 })).toBe(false);
  });
});

describe('CameraGestureEngine - wheel pan', () => {
  it('pans the camera by delta / zoom and commits on idle', () => {
    vi.useFakeTimers();
    let commitCount = 0;
    const commitCamera: Camera[] = [];
    const { engine } = makeEngine({
      storeCamera: { x: 10, y: 20, zoom: 2 },
      onCommit: (c) => {
        commitCount += 1;
        commitCamera.push(c);
      },
    });

    engine.wheelPan(20, 40); // 20/2 = 10, 40/2 = 20
    expect(commitCount).toBe(0);
    expect(cameraRef.get()).toEqual({ x: 20, y: 40, zoom: 2 });

    vi.advanceTimersByTime(200);
    expect(commitCount).toBe(1);
    expect(commitCamera[0]).toEqual({ x: 20, y: 40, zoom: 2 });

    vi.useRealTimers();
  });
});


describe('CameraGestureEngine - pinch', () => {
  const tp = (clientX: number, clientY: number) => ({ clientX, clientY });

  it('commits exactly once, at pinchEnd, with zero writes mid-gesture', () => {
    let commitCount = 0;
    const { engine } = makeEngine({
      onCommit: () => {
        commitCount += 1;
      },
    });

    engine.pinchStart(tp(300, 300), tp(500, 300)); // spread 200, centroid (400,300)
    expect(commitCount).toBe(0);

    engine.pinchMove(tp(250, 300), tp(550, 300)); // spread 300
    engine.pinchMove(tp(200, 300), tp(600, 300)); // spread 400
    expect(commitCount).toBe(0);

    engine.pinchEnd();
    expect(commitCount).toBe(1);
  });

  it('scales zoom by the ratio of finger spread', () => {
    const { engine } = makeEngine({ storeCamera: { x: 0, y: 0, zoom: 1 } });

    engine.pinchStart(tp(300, 300), tp(500, 300)); // spread 200
    engine.pinchMove(tp(200, 300), tp(600, 300)); // spread 400 -> 2x

    expect(cameraRef.get().zoom).toBeCloseTo(2, 5);
    engine.pinchEnd();
  });

  it('keeps the world point under the centroid fixed while zooming', () => {
    const vw = 800;
    const vh = 600;
    const { engine } = makeEngine({
      storeCamera: { x: 0, y: 0, zoom: 1 },
      getViewportRect: () => ({ width: vw, height: vh, left: 0, top: 0 }),
    });

    // Centroid sits at viewport (400, 200) - off-centre on the y axis so a
    // centre-anchored implementation would visibly fail this.
    const worldBefore = sceneUtils.screenToWorld(
      400,
      200,
      { x: 0, y: 0, zoom: 1 },
      vw,
      vh,
    );

    engine.pinchStart(tp(300, 200), tp(500, 200)); // spread 200, centroid (400,200)
    engine.pinchMove(tp(200, 200), tp(600, 200)); // spread 400, same centroid

    const after = cameraRef.get();
    const worldAfter = sceneUtils.screenToWorld(400, 200, after, vw, vh);

    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 5);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 5);
    engine.pinchEnd();
  });

  it('pans when the centroid moves without the spread changing', () => {
    const { engine } = makeEngine({ storeCamera: { x: 0, y: 0, zoom: 1 } });

    engine.pinchStart(tp(300, 300), tp(500, 300)); // centroid (400,300)
    engine.pinchMove(tp(340, 320), tp(540, 320)); // centroid (440,320), spread unchanged

    const after = cameraRef.get();
    expect(after.zoom).toBeCloseTo(1, 5);
    // Dragging fingers right/down moves the camera left/up by the same amount.
    expect(after.x).toBeCloseTo(-40, 5);
    expect(after.y).toBeCloseTo(-20, 5);
    engine.pinchEnd();
  });

  it('respects the zoom clamp', () => {
    const { engine } = makeEngine({
      storeCamera: { x: 0, y: 0, zoom: 4 },
      maxZoom: 5,
    });

    engine.pinchStart(tp(300, 300), tp(500, 300)); // spread 200
    engine.pinchMove(tp(100, 300), tp(700, 300)); // spread 600 -> 3x -> 12, clamped

    expect(cameraRef.get().zoom).toBe(5);
    engine.pinchEnd();
  });

  it('reports isGestureActive during a pinch and blocks commit while active', () => {
    let commitCount = 0;
    const { engine } = makeEngine({
      onCommit: () => {
        commitCount += 1;
      },
    });

    expect(engine.isGestureActive).toBe(false);
    engine.pinchStart(tp(300, 300), tp(500, 300));
    expect(engine.isGestureActive).toBe(true);

    // A pan ending mid-pinch must NOT commit - the pinch is still running.
    engine.startPan(100, 100);
    engine.endPan();
    expect(commitCount).toBe(0);

    engine.pinchEnd();
    expect(engine.isGestureActive).toBe(false);
    expect(commitCount).toBe(1);
  });

  it('ignores pinchMove and pinchEnd without a pinchStart', () => {
    let commitCount = 0;
    const { engine } = makeEngine({
      onCommit: () => {
        commitCount += 1;
      },
    });

    engine.pinchMove(tp(0, 0), tp(10, 10));
    engine.pinchEnd();
    expect(commitCount).toBe(0);
  });
});
