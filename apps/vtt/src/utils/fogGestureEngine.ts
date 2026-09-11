import { sceneUtils } from '@/utils/sceneUtils';

interface WorldPoint {
  x: number;
  y: number;
}

export type FogToolKind = 'rect' | 'brush';

export interface FogGestureEngineOptions {
  /** Which reveal shape the active tool draws. */
  kind: FogToolKind;
  /** Brush stroke width (world units) - only read for kind === 'brush'. */
  brushSize: number;
  /**
   * Called exactly once per gesture, on pointerup, with the final set of
   * world-space points (2 corners for rect, a polyline for brush). This is
   * the ONLY place that should touch the store / send the WebSocket event -
   * mirrors useTransientDrag's onCommit contract.
   */
  onCommit: (points: WorldPoint[]) => void;
  /**
   * Imperative preview callback, rAF-batched: receives the in-progress
   * point list on every scheduled frame so the caller can update an SVG
   * preview element's attributes directly (no React state / store writes
   * mid-gesture - same discipline as TransientDragEngine's applyTransform).
   */
  onPreview: (points: WorldPoint[] | null) => void;
  /** Disable the gesture entirely (e.g. non-host, or a non-fog tool active). */
  disabled?: boolean;
}

/**
 * Imperative rAF-batched gesture engine for the two fog-reveal tools
 * (`fog-reveal-rect`, `fog-reveal-brush`). Mirrors the conventions in
 * `useTransientDrag.ts` (TransientDragEngine) and
 * `cameraGestureEngine.ts` (CameraGestureEngine): a plain mutable
 * controller, not React state - constructed once via `useState`'s lazy
 * initializer in the component, latest option values pushed in via
 * `sync()` post-render.
 *
 * Coordinates: pointer screen coordinates are converted to world space via
 * `sceneUtils.screenToWorldLive` (ADR-0002) - the mid-gesture variant that
 * reads the live camera ref rather than subscribing, so a simultaneous
 * pan/zoom gesture doesn't go stale. No hand-rolled screen<->world math.
 *
 * Rect tool: two points are recorded - the pointerdown point (fixed) and
 * the live pointer position (updated every move). Brush tool: every move
 * appends a new point to the polyline (no de-duplication needed - the
 * consumer strokes it as-is).
 */
export class FogGestureEngine {
  private active = false;
  private pointerId = 0;
  private capturedTarget: Element | null = null;
  private startWorld: WorldPoint = { x: 0, y: 0 };
  private points: WorldPoint[] = [];
  private cachedSvg: SVGSVGElement | null = null;

  private rafId: number | null = null;
  private frameScheduled = false;
  private pendingPoints: WorldPoint[] | null = null;

  private kind: FogToolKind = 'rect';
  private brushSize = 40;
  private disabled = false;
  private onCommit: (points: WorldPoint[]) => void = () => {};
  private onPreview: (points: WorldPoint[] | null) => void = () => {};

  sync(opts: FogGestureEngineOptions) {
    this.kind = opts.kind;
    this.brushSize = opts.brushSize;
    this.disabled = opts.disabled ?? false;
    this.onCommit = opts.onCommit;
    this.onPreview = opts.onPreview;
  }

  get isActive(): boolean {
    return this.active;
  }

  get currentBrushSize(): number {
    return this.brushSize;
  }

  private screenToWorld(
    clientX: number,
    clientY: number,
    svg: SVGSVGElement,
  ): WorldPoint {
    const rect = svg.getBoundingClientRect();
    return sceneUtils.screenToWorldLive(
      clientX - rect.left,
      clientY - rect.top,
      rect.width,
      rect.height,
    );
  }

  private scheduleFrame(points: WorldPoint[]) {
    this.pendingPoints = points;
    if (this.frameScheduled) return;
    // Mark scheduled BEFORE requestAnimationFrame - see TransientDragEngine
    // for why (some environments/test mocks invoke the callback
    // synchronously/re-entrantly).
    this.frameScheduled = true;
    this.rafId = requestAnimationFrame(this.flush);
  }

  private flush = () => {
    this.frameScheduled = false;
    this.rafId = null;
    const pending = this.pendingPoints;
    if (!pending) return;
    this.pendingPoints = null;
    this.onPreview(pending);
  };

  handlePointerDown = (e: React.PointerEvent<SVGElement>) => {
    if (this.disabled) return;
    if (e.button !== undefined && e.button !== 0) return;

    const svg = (e.currentTarget as unknown as SVGGraphicsElement)
      .ownerSVGElement;
    if (!svg) return;

    const target = e.currentTarget as unknown as Element;
    this.pointerId = e.pointerId;
    this.capturedTarget = target;
    (target as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(
      e.pointerId,
    );
    this.cachedSvg = svg;

    const world = this.screenToWorld(e.clientX, e.clientY, svg);
    this.startWorld = world;
    this.points = this.kind === 'rect' ? [world, world] : [world];
    this.active = true;

    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerCancel);

    this.scheduleFrame(this.points);
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.active || !this.cachedSvg) return;
    const world = this.screenToWorld(e.clientX, e.clientY, this.cachedSvg);

    if (this.kind === 'rect') {
      this.points = [this.startWorld, world];
    } else {
      this.points = [...this.points, world];
    }
    this.scheduleFrame(this.points);
  };

  private handlePointerUp = () => this.endGesture(true);
  private handlePointerCancel = () => this.endGesture(false);

  private endGesture(commit: boolean) {
    if (!this.active) return;
    this.active = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.frameScheduled = false;
    if (this.pendingPoints) {
      this.points = this.pendingPoints;
      this.pendingPoints = null;
    }

    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerCancel);

    const target = this.capturedTarget as unknown as
      | { hasPointerCapture?: (id: number) => boolean; releasePointerCapture?: (id: number) => void }
      | null;
    if (target?.hasPointerCapture?.(this.pointerId)) {
      target.releasePointerCapture?.(this.pointerId);
    }
    this.capturedTarget = null;

    this.onPreview(null);

    if (commit && this.points.length > 0) {
      this.onCommit(this.points);
    }

    this.points = [];
    this.cachedSvg = null;
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
