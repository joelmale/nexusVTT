import type { Camera } from '@/types/game';
import { cameraRef } from '@/utils/cameraRef';

const BROADCAST_THROTTLE_MS = 150;
const WHEEL_IDLE_MS = 200;

export interface CameraGestureEngineOptions {
  /** Read the current authoritative (store) camera. */
  getStoreCamera: () => Camera;
  /** Commit the final camera to the store exactly once, at gesture end. */
  onCommit: (camera: Camera) => void;
  /** Send a `camera/update` WebSocket event with the given camera (host only - caller decides whether to call). */
  onBroadcast: (camera: Camera) => void;
  /** Imperatively write the transform attribute for the given camera. */
  applyTransform: (camera: Camera) => void;
  /** Zoom clamp bounds. */
  minZoom?: number;
  maxZoom?: number;
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

  private rafId: number | null = null;
  private frameScheduled = false;
  private pendingCamera: Camera | null = null;

  private lastBroadcastAt = 0;

  private getStoreCamera: () => Camera = () => ({ x: 0, y: 0, zoom: 1 });
  private onCommit: (camera: Camera) => void = () => {};
  private onBroadcast: (camera: Camera) => void = () => {};
  private applyTransform: (camera: Camera) => void = () => {};
  private minZoom = 0.1;
  private maxZoom = 5.0;

  sync(opts: CameraGestureEngineOptions) {
    this.getStoreCamera = opts.getStoreCamera;
    this.onCommit = opts.onCommit;
    this.onBroadcast = opts.onBroadcast;
    this.applyTransform = opts.applyTransform;
    this.minZoom = opts.minZoom ?? 0.1;
    this.maxZoom = opts.maxZoom ?? 5.0;
  }

  get isGestureActive(): boolean {
    return this.panActive || this.wheelGestureActive;
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
    if (this.panActive || this.wheelGestureActive) return;

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

  // ---- Wheel zoom (center-anchored, matches existing behavior exactly) ----

  wheelZoom(deltaY: number) {
    this.ensureSeeded();
    const current = cameraRef.get();
    const zoomFactor = deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(
      this.minZoom,
      Math.min(this.maxZoom, current.zoom * zoomFactor),
    );
    const next: Camera = { ...current, zoom: newZoom };
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
