import type { Camera } from '@/types/game';
import { cameraRef } from '@/utils/cameraRef';
import { sceneUtils } from '@/utils/sceneUtils';

const BROADCAST_THROTTLE_MS = 150;
const WHEEL_IDLE_MS = 200;
export const WHEEL_MOUSE_THRESHOLD = 50;
const ZOOM_SENSITIVITY = 0.001;

/** Minimal shape shared by PointerEvent and Touch - all pinch math needs. */
export interface TouchPoint {
  clientX: number;
  clientY: number;
}

export interface ViewportRect {
  width: number;
  height: number;
  left?: number;
  top?: number;
}

export interface CameraGestureEngineOptions {
  /** Read the current authoritative (store) camera. */
  getStoreCamera: () => Camera;
  /** Commit the final camera to the store exactly once, at gesture end. */
  onCommit: (camera: Camera) => void;
  /** Send a `camera/update` WebSocket event with the given camera (host only - caller decides whether to call). */
  onBroadcast: (camera: Camera) => void;
  /** Imperatively write the transform attribute for the given camera. */
  applyTransform: (camera: Camera) => void;
  /** Viewport rectangle provider for cursor-anchored zoom calculations. */
  getViewportRect?: () => ViewportRect;
  /** Zoom clamp bounds. */
  minZoom?: number;
  maxZoom?: number;
}

/**
 * Discriminates between a zoom gesture (ctrl/pinch or discrete mouse wheel tick)
 * and a pan gesture (two-finger trackpad scroll with non-trivial deltaX or small deltaY).
 */
export function isZoomWheelEvent(e: {
  ctrlKey?: boolean;
  metaKey?: boolean;
  deltaX: number;
  deltaY: number;
  deltaMode?: number;
}): boolean {
  return (
    Boolean(e.ctrlKey || e.metaKey) ||
    (e.deltaMode !== undefined && e.deltaMode !== 0) ||
    (Math.abs(e.deltaY) >= WHEEL_MOUSE_THRESHOLD && e.deltaX === 0)
  );
}

let activeEngine: CameraGestureEngine | null = null;

function setActiveEngine(engine: CameraGestureEngine | null) {
  activeEngine = engine;
}

export function getActiveCameraGestureEngine(): CameraGestureEngine | null {
  return activeEngine;
}

/**
 * Imperative pan/zoom engine (A3 - transient camera), mirroring
 * `TransientDragEngine` in `useTransientDrag.ts`: a plain mutable
 * controller, not React state, constructed once via `useState`'s lazy
 * initializer (never `useRef` - see useTransientDrag.ts's note on why).
 *
 * During a gesture (mouse-pan or a wheel-zoom "burst"):
 *  - `cameraRef` is updated synchronously on every move/wheel-tick.
 *  - The DOM transform is rewritten imperatively, rAF-batched.
 *  - NO store writes happen.
 *  - A `camera/update` broadcast is sent at most once per
 *    `BROADCAST_THROTTLE_MS` so "Follow DM" viewers track live.
 *
 * At gesture end (pointerup for pan; ~`WHEEL_IDLE_MS` of wheel inactivity
 * for zoom - a wheel burst counts as one gesture) the live camera is
 * committed to the store exactly once, a final `camera/update` broadcast is
 * sent with that exact value, and `cameraRef` is reset so idle reads fall
 * back to the (now up to date) store camera.
 */
export class CameraGestureEngine {
  private panActive = false;
  private panStartClient: { x: number; y: number } = { x: 0, y: 0 };
  private panStartCamera: Camera = { x: 0, y: 0, zoom: 1 };

  private wheelIdleTimer: ReturnType<typeof setTimeout> | null = null;
  private wheelGestureActive = false;

  private pinchActive = false;
  /** World point anchored under the two-finger centroid for the whole pinch. */
  private pinchWorldAnchor: { x: number; y: number } = { x: 0, y: 0 };
  private pinchStartSpread = 0;
  private pinchStartZoom = 1;

  private rafId: number | null = null;
  private frameScheduled = false;
  private pendingCamera: Camera | null = null;

  private lastBroadcastAt = 0;

  private getStoreCamera: () => Camera = () => ({ x: 0, y: 0, zoom: 1 });
  private onCommit: (camera: Camera) => void = () => {};
  private onBroadcast: (camera: Camera) => void = () => {};
  private applyTransform: (camera: Camera) => void = () => {};
  private getViewportRect: () => ViewportRect = () => ({
    width: 800,
    height: 600,
    left: 0,
    top: 0,
  });
  private minZoom = 0.1;
  private maxZoom = 5.0;

  constructor() {
    setActiveEngine(this);
  }

  sync(opts: CameraGestureEngineOptions) {
    setActiveEngine(this);
    this.getStoreCamera = opts.getStoreCamera;
    this.onCommit = opts.onCommit;
    this.onBroadcast = opts.onBroadcast;
    this.applyTransform = opts.applyTransform;
    if (opts.getViewportRect) {
      this.getViewportRect = opts.getViewportRect;
    }
    this.minZoom = opts.minZoom ?? 0.1;
    this.maxZoom = opts.maxZoom ?? 5.0;
  }

  get isGestureActive(): boolean {
    return this.panActive || this.wheelGestureActive || this.pinchActive;
  }

  private ensureSeeded() {
    if (!cameraRef.isLive()) {
      cameraRef.seed(this.getStoreCamera());
    }
  }

  private scheduleFrame(camera: Camera) {
    this.pendingCamera = camera;
    if (this.frameScheduled) return;
    // Mark scheduled before requestAnimationFrame - see TransientDragEngine
    // for why (synchronous/re-entrant rAF mocks in tests).
    this.frameScheduled = true;
    this.rafId = requestAnimationFrame(this.flush);
  }

  private flush = () => {
    this.frameScheduled = false;
    this.rafId = null;
    const pending = this.pendingCamera;
    if (!pending) return;
    this.pendingCamera = null;
    this.applyTransform(pending);
  };

  private maybeBroadcast(camera: Camera) {
    const now = Date.now();
    if (now - this.lastBroadcastAt < BROADCAST_THROTTLE_MS) return;
    this.lastBroadcastAt = now;
    this.onBroadcast(camera);
  }

  private endGestureIfIdle() {
    if (this.panActive || this.wheelGestureActive || this.pinchActive) return;

    // Flush any pending frame synchronously so the commit uses the latest
    // value rather than a stale one from the last flushed frame.
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.frameScheduled = false;
    if (this.pendingCamera) {
      this.applyTransform(this.pendingCamera);
      this.pendingCamera = null;
    }

    const finalCamera = cameraRef.get();
    this.onCommit(finalCamera);
    this.onBroadcast(finalCamera);
    cameraRef.reset();
  }

  // ---- Pan ----

  startPan(clientX: number, clientY: number) {
    this.ensureSeeded();
    this.panActive = true;
    this.panStartClient = { x: clientX, y: clientY };
    this.panStartCamera = cameraRef.get();
  }

  movePan(clientX: number, clientY: number) {
    if (!this.panActive) return;
    const base = this.panStartCamera;
    const deltaX = clientX - this.panStartClient.x;
    const deltaY = clientY - this.panStartClient.y;
    const scaledDeltaX = deltaX / base.zoom;
    const scaledDeltaY = deltaY / base.zoom;

    const next: Camera = {
      x: base.x - scaledDeltaX,
      y: base.y - scaledDeltaY,
      zoom: base.zoom,
    };
    cameraRef.set(next);
    this.scheduleFrame(next);
    this.maybeBroadcast(next);
  }

  endPan() {
    if (!this.panActive) return;
    this.panActive = false;
    this.endGestureIfIdle();
  }

  // ---- Pinch (two-finger pan + zoom, tracked together) ----

  /**
   * Viewport-relative centroid and spread for a two-finger gesture.
   * Client coords in, viewport-local coords out.
   */
  private pinchGeometry(
    a: TouchPoint,
    b: TouchPoint,
  ): { sx: number; sy: number; spread: number; vw: number; vh: number } {
    const rect = this.getViewportRect();
    const vw = rect.width > 0 ? rect.width : 800;
    const vh = rect.height > 0 ? rect.height : 600;
    const rectLeft = rect.left ?? 0;
    const rectTop = rect.top ?? 0;

    const sx = (a.clientX + b.clientX) / 2 - rectLeft;
    const sy = (a.clientY + b.clientY) / 2 - rectTop;
    const spread = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    return { sx, sy, spread, vw, vh };
  }

  /**
   * Begin a pinch. Unlike `startPan`, zoom is NOT frozen for the gesture -
   * `movePan` anchors on `panStartCamera.zoom`, which would compute the wrong
   * world delta while the pinch is also scaling. Instead we anchor the world
   * point under the initial centroid and re-solve the camera on every move.
   */
  pinchStart(a: TouchPoint, b: TouchPoint) {
    this.ensureSeeded();
    const { sx, sy, spread, vw, vh } = this.pinchGeometry(a, b);

    this.pinchActive = true;
    this.pinchStartSpread = spread > 0 ? spread : 1;
    this.pinchStartZoom = cameraRef.get().zoom;
    this.pinchWorldAnchor = sceneUtils.screenToWorldLive(sx, sy, vw, vh);
  }

  pinchMove(a: TouchPoint, b: TouchPoint) {
    if (!this.pinchActive) return;
    const { sx, sy, spread, vw, vh } = this.pinchGeometry(a, b);

    const scale = spread / this.pinchStartSpread;
    const clampedZoom = Math.max(
      this.minZoom,
      Math.min(this.maxZoom, this.pinchStartZoom * scale),
    );

    // Keep the anchored world point under the *current* centroid, so the
    // gesture pans and zooms in one solve.
    const next: Camera = {
      x: this.pinchWorldAnchor.x - (sx - vw / 2) / clampedZoom,
      y: this.pinchWorldAnchor.y - (sy - vh / 2) / clampedZoom,
      zoom: clampedZoom,
    };

    cameraRef.set(next);
    this.scheduleFrame(next);
    this.maybeBroadcast(next);
  }

  pinchEnd() {
    if (!this.pinchActive) return;
    this.pinchActive = false;
    this.endGestureIfIdle();
  }

  // ---- Wheel and zoom ----

  private normalizeWheelDelta(
    delta: number,
    deltaMode: number,
    pageSize: number,
  ): number {
    if (deltaMode === 1) {
      return delta * 16;
    }
    if (deltaMode === 2) {
      return delta * (pageSize || 800);
    }
    return delta;
  }

  private applyZoom(newZoom: number, clientX?: number, clientY?: number) {
    this.ensureSeeded();
    const clampedZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));

    const rect = this.getViewportRect();
    const vw = rect.width > 0 ? rect.width : 800;
    const vh = rect.height > 0 ? rect.height : 600;
    const rectLeft = rect.left ?? 0;
    const rectTop = rect.top ?? 0;

    const sx = clientX !== undefined ? clientX - rectLeft : vw / 2;
    const sy = clientY !== undefined ? clientY - rectTop : vh / 2;

    const worldAtCursor = sceneUtils.screenToWorldLive(sx, sy, vw, vh);

    const nextCamera: Camera = {
      x: worldAtCursor.x - (sx - vw / 2) / clampedZoom,
      y: worldAtCursor.y - (sy - vh / 2) / clampedZoom,
      zoom: clampedZoom,
    };

    cameraRef.set(nextCamera);
    this.scheduleFrame(nextCamera);
    this.maybeBroadcast(nextCamera);

    this.wheelGestureActive = true;
    if (this.wheelIdleTimer !== null) {
      clearTimeout(this.wheelIdleTimer);
    }
    this.wheelIdleTimer = setTimeout(() => {
      this.wheelIdleTimer = null;
      this.wheelGestureActive = false;
      this.endGestureIfIdle();
    }, WHEEL_IDLE_MS);
  }

  wheelZoom(
    deltaY: number,
    clientX?: number,
    clientY?: number,
    deltaMode = 0,
  ) {
    this.ensureSeeded();
    const currentZoom = cameraRef.get().zoom;
    const rect = this.getViewportRect();
    const vh = rect.height > 0 ? rect.height : 600;
    const normalizedDelta = this.normalizeWheelDelta(deltaY, deltaMode, vh);
    const zoomFactor = Math.exp(-normalizedDelta * ZOOM_SENSITIVITY);
    this.applyZoom(currentZoom * zoomFactor, clientX, clientY);
  }

  stepZoom(factor: number, clientX?: number, clientY?: number) {
    this.ensureSeeded();
    const current = cameraRef.get();
    this.applyZoom(current.zoom * factor, clientX, clientY);
  }

  setCamera(camera: Camera) {
    this.ensureSeeded();
    cameraRef.set(camera);
    this.scheduleFrame(camera);
    this.maybeBroadcast(camera);
    this.endGestureIfIdle();
  }

  wheelPan(deltaX: number, deltaY: number, deltaMode = 0) {
    this.ensureSeeded();
    const current = cameraRef.get();
    const rect = this.getViewportRect();
    const vw = rect.width > 0 ? rect.width : 800;
    const vh = rect.height > 0 ? rect.height : 600;
    const normX = this.normalizeWheelDelta(deltaX, deltaMode, vw);
    const normY = this.normalizeWheelDelta(deltaY, deltaMode, vh);

    const scaledDeltaX = normX / current.zoom;
    const scaledDeltaY = normY / current.zoom;

    const next: Camera = {
      ...current,
      x: current.x + scaledDeltaX,
      y: current.y + scaledDeltaY,
    };
    cameraRef.set(next);
    this.scheduleFrame(next);
    this.maybeBroadcast(next);

    this.wheelGestureActive = true;
    if (this.wheelIdleTimer !== null) {
      clearTimeout(this.wheelIdleTimer);
    }
    this.wheelIdleTimer = setTimeout(() => {
      this.wheelIdleTimer = null;
      this.wheelGestureActive = false;
      this.endGestureIfIdle();
    }, WHEEL_IDLE_MS);
  }

  dispose() {
    if (activeEngine === this) {
      setActiveEngine(null);
    }
    this.pinchActive = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.wheelIdleTimer !== null) {
      clearTimeout(this.wheelIdleTimer);
      this.wheelIdleTimer = null;
    }
  }
}
