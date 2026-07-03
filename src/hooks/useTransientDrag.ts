import { useCallback, useEffect, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { sceneUtils } from '@/utils/sceneUtils';

interface WorldPosition {
  x: number;
  y: number;
}

interface UseTransientDragOptions {
  /** Current world-space position of the token (from store) at drag start. */
  getStartPosition: () => WorldPosition;
  /**
   * Called on pointerup with the final world-space position (already grid
   * snapped if applicable). This is the ONLY place that should touch the
   * store / send the WebSocket event.
   */
  onCommit: (position: WorldPosition) => void;
  /**
   * Optional grid snap, applied only to the final committed position -
   * mirrors the existing release-time snapping behavior.
   */
  snapToGrid?: (position: WorldPosition) => WorldPosition;
  /** Rotation (degrees) to preserve while rewriting the transform attribute. */
  rotation?: number;
  /** Disable dragging (e.g. wrong tool / no permission). */
  disabled?: boolean;
}

interface UseTransientDragResult {
  /** Attach to the draggable element's onPointerDown. */
  onPointerDown: (e: React.PointerEvent<Element>) => void;
  /**
   * True for the duration of an active gesture. A plain mutable object
   * (imperative, not React state) - read it in event handlers/effects, not
   * during render.
   */
  isDraggingRef: { readonly current: boolean };
}

/**
 * Imperative drag engine - a plain mutable controller (not React state).
 * One instance is created per component mount (via `useState`'s lazy
 * initializer) and lives for the component's lifetime, so its methods have
 * stable identity without needing useCallback/dependency-array gymnastics.
 * Latest prop values (onCommit, snapToGrid, rotation, getStartPosition) are
 * pushed into it via a `sync()` call from a `useEffect` (post-render, never
 * during render).
 */
class TransientDragEngine {
  private isDragging = false;
  private element: SVGGElement | null = null;
  private pointerId = 0;
  private startWorld: WorldPosition = { x: 0, y: 0 };
  private startPointer: WorldPosition = { x: 0, y: 0 };
  private currentPosition: WorldPosition = { x: 0, y: 0 };
  private rafId: number | null = null;
  private frameScheduled = false;
  private pendingWorld: WorldPosition | null = null;

  // Latest values, synced post-render via sync().
  private rotation = 0;
  private disabled = false;
  private getStartPosition: () => WorldPosition = () => ({ x: 0, y: 0 });
  private onCommit: (position: WorldPosition) => void = () => {};
  private snapToGrid: ((position: WorldPosition) => WorldPosition) | undefined;

  public readonly isDraggingRef = { current: false };

  sync(opts: {
    rotation: number;
    disabled: boolean;
    getStartPosition: () => WorldPosition;
    onCommit: (position: WorldPosition) => void;
    snapToGrid: ((position: WorldPosition) => WorldPosition) | undefined;
  }) {
    this.rotation = opts.rotation;
    this.disabled = opts.disabled;
    this.getStartPosition = opts.getStartPosition;
    this.onCommit = opts.onCommit;
    this.snapToGrid = opts.snapToGrid;
  }

  private applyTransform(pos: WorldPosition) {
    if (!this.element) return;
    this.element.setAttribute(
      'transform',
      `translate(${pos.x}, ${pos.y}) rotate(${this.rotation})`,
    );
  }

  private flush = () => {
    this.frameScheduled = false;
    this.rafId = null;
    const pending = this.pendingWorld;
    if (!pending) return;
    this.pendingWorld = null;
    this.currentPosition = pending;
    this.applyTransform(pending);
  };

  private scheduleFrame(pos: WorldPosition) {
    this.pendingWorld = pos;
    if (this.frameScheduled) return;
    // Mark as scheduled BEFORE calling requestAnimationFrame: some
    // environments (and synchronous test mocks) invoke the callback
    // immediately/re-entrantly, and `frameScheduled` (not the numeric id,
    // which isn't known until requestAnimationFrame returns) is the guard
    // that must already be true when `flush` runs.
    this.frameScheduled = true;
    this.rafId = requestAnimationFrame(this.flush);
  }

  private screenToWorld(clientX: number, clientY: number, svg: SVGSVGElement) {
    const rect = svg.getBoundingClientRect();
    const camera = useGameStore.getState().sceneState.camera;
    return sceneUtils.screenToWorld(
      clientX - rect.left,
      clientY - rect.top,
      camera,
      rect.width,
      rect.height,
    );
  }

  handlePointerDown = (e: React.PointerEvent<Element>) => {
    if (this.disabled) return;
    if (e.button !== undefined && e.button !== 0) return;

    const target = e.currentTarget as unknown as SVGGElement;
    const svg = target.ownerSVGElement;
    if (!svg) return;

    this.element = target;
    this.pointerId = e.pointerId;

    const start = this.getStartPosition();
    this.startWorld = start;
    this.currentPosition = start;
    this.startPointer = this.screenToWorld(e.clientX, e.clientY, svg);

    this.isDragging = true;
    this.isDraggingRef.current = true;

    target.setPointerCapture(e.pointerId);

    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerCancel);
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.isDragging) return;
    const svg = this.element?.ownerSVGElement;
    if (!svg) return;

    const worldPointer = this.screenToWorld(e.clientX, e.clientY, svg);
    const dx = worldPointer.x - this.startPointer.x;
    const dy = worldPointer.y - this.startPointer.y;

    this.scheduleFrame({
      x: this.startWorld.x + dx,
      y: this.startWorld.y + dy,
    });
  };

  private handlePointerUp = () => this.endDrag(true);
  private handlePointerCancel = () => this.endDrag(false);

  private endDrag(commit: boolean) {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.isDraggingRef.current = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.frameScheduled = false;
    // A pointermove may have scheduled a frame that hasn't flushed yet -
    // apply it synchronously now so the commit uses the latest position
    // rather than a stale one from the last flushed frame.
    if (this.pendingWorld) {
      this.currentPosition = this.pendingWorld;
      this.pendingWorld = null;
    }

    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerCancel);

    const el = this.element;
    if (el && el.hasPointerCapture(this.pointerId)) {
      el.releasePointerCapture(this.pointerId);
    }

    if (commit) {
      let finalPos = this.currentPosition;
      if (this.snapToGrid) {
        finalPos = this.snapToGrid(finalPos);
      }
      // Reflect the (possibly snapped) final position immediately so
      // there's no visual pop before the store re-render lands.
      this.applyTransform(finalPos);
      this.onCommit(finalPos);
    } else {
      // Aborted (e.g. pointercancel) - snap back visually to start.
      this.applyTransform(this.startWorld);
    }
  }

  dispose() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerCancel);
  }
}

/**
 * Transient drag pattern: during the gesture, position updates are applied
 * imperatively (rAF-batched) directly to the DOM element's `transform`
 * attribute in WORLD units - no React setState, no store writes. The store
 * is committed exactly once, on pointerup (or pointercancel abort).
 *
 * Coordinate space: the dragged element lives inside the camera-transformed
 * `<g class="scene-content">` group (see ADR-0002), so its own transform is
 * expressed in world units, not screen pixels. We convert pointer screen
 * coordinates to world coordinates via `sceneUtils.screenToWorld`, reading
 * camera/viewport fresh on each move via `useGameStore.getState()` (no
 * subscription - subscribing would re-render on every camera change).
 */
export function useTransientDrag({
  getStartPosition,
  onCommit,
  snapToGrid,
  rotation = 0,
  disabled = false,
}: UseTransientDragOptions): UseTransientDragResult {
  // Lazy one-time construction of the imperative engine singleton for this
  // component instance. `useState`'s lazy initializer (not `useRef`) is used
  // deliberately - it is the sanctioned React API for one-time-per-mount
  // construction and is not flagged by the `react-hooks/refs` rule the way
  // a "check-and-assign ref.current" pattern is.
  const [engine] = useState(() => new TransientDragEngine());

  // Push the latest prop values into the engine after each render commits
  // (never during render itself).
  useEffect(() => {
    engine.sync({ rotation, disabled, getStartPosition, onCommit, snapToGrid });
  });

  useEffect(() => {
    return () => engine.dispose();
  }, [engine]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<Element>) => engine.handlePointerDown(e),
    [engine],
  );

  return { onPointerDown, isDraggingRef: engine.isDraggingRef };
}
