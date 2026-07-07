/**
 * Ink hit-testing (A8b).
 *
 * Canvas-rendered drawings (CanvasInkLayer, A8a) are painted on a
 * `pointerEvents: none` <canvas>, so the browser's native SVG/DOM hit-testing
 * cannot select them — clicking a drawing must be resolved in JS instead.
 * This module does that resolution with the same primitives the browser
 * itself uses: `Path2D` + `CanvasRenderingContext2D.isPointInPath` /
 * `isPointInStroke` (ADR-0009: no invisible DOM twin layer).
 *
 * Path2D cache
 * ------------
 * A8a's actual `CanvasInkLayer` (as landed) does NOT keep a `Path2D` cache —
 * it re-issues raw `moveTo`/`lineTo` calls straight against the 2D context
 * every rAF frame, and only paints `pencil` drawings (rectangle/circle/
 * polygon/line are never drawn by it; they still render as normal SVG
 * elements regardless of the flag). So there is no existing cache to reuse.
 * This module owns its own `Map<id, { path, updatedAt }>` cache, invalidated
 * per-drawing by `updatedAt` (bumped on every drawing mutation - see
 * gameStore's updateDrawing). CanvasInkLayer is free to adopt this same
 * cache in a follow-up if/when it starts drawing shapes beyond pencil; nothing
 * here depends on it doing so.
 *
 * Context strategy
 * -----------------
 * `isPointInPath`/`isPointInStroke` need a real `CanvasRenderingContext2D`
 * (Path2D geometry is evaluated by the browser's rasterizer, not by JS math),
 * so this module takes a ctx as a parameter rather than constructing one
 * itself - callers use a shared detached `<canvas>` (or `OffscreenCanvas`
 * where available) that is never attached to the DOM and never rendered;
 * it exists purely as a geometry oracle. `createHitTestContext()` below
 * picks `OffscreenCanvas` when present (Node test envs / older browsers
 * fall back to a plain detached `<canvas>` element, which also works for
 * hit-testing purposes even though it's less efficient to allocate).
 *
 * jsdom cannot rasterize Path2D (isPointInPath/isPointInStroke are stubbed
 * or absent), so unit tests here inject a FAKE ctx that records calls and
 * returns caller-controlled answers. That validates the part that's actually
 * our logic - top-down iteration order, tolerance-from-zoom math, stroke vs.
 * fill dispatch - without needing real rasterization. Real hit-feel (does a
 * click 3px from a thin line register) is a jsdom-can't-test concern and is
 * covered by Joel's manual gate via tools/ink-compare/index.html.
 */
import type { Drawing, Point } from '@/types/drawing';

/** Minimum extra hit-test radius in world units before dividing by zoom. */
const BASE_TOLERANCE_PX = 8;

/** Drawing types this module knows how to hit-test. */
export type HitTestableDrawing = Extract<
  Drawing,
  { type: 'pencil' | 'line' | 'rectangle' | 'circle' | 'polygon' }
>;

export function isHitTestable(drawing: Drawing): drawing is HitTestableDrawing {
  return (
    drawing.type === 'pencil' ||
    drawing.type === 'line' ||
    drawing.type === 'rectangle' ||
    drawing.type === 'circle' ||
    drawing.type === 'polygon'
  );
}

/** World-space tolerance for stroke hit-testing, scaled inversely with zoom
 * so that a click needs to be "N screen pixels" close regardless of how far
 * zoomed in/out the camera is. */
export function toleranceForZoom(zoom: number): number {
  const safeZoom = zoom > 0 ? zoom : 1;
  return BASE_TOLERANCE_PX / safeZoom;
}

interface CacheEntry {
  path: Path2D;
  updatedAt: number;
  strokeWidth: number;
}

/**
 * Shared Path2D cache keyed by drawing id, invalidated by `updatedAt`.
 * A module-level singleton is fine: drawings are globally unique ids across
 * scenes, and stale entries for deleted drawings are harmless (small, GC'd
 * with the module - could add pruning if this ever becomes a real budget
 * concern, but drawing counts per session are small, matching CanvasInkLayer's
 * own no-eviction cache).
 */
const pathCache = new Map<string, CacheEntry>();

function buildPath(drawing: HitTestableDrawing): Path2D {
  const path = new Path2D();
  switch (drawing.type) {
    case 'pencil': {
      const [first, ...rest] = drawing.points;
      if (first) {
        path.moveTo(first.x, first.y);
        for (const p of rest) path.lineTo(p.x, p.y);
      }
      break;
    }
    case 'line':
      path.moveTo(drawing.start.x, drawing.start.y);
      path.lineTo(drawing.end.x, drawing.end.y);
      break;
    case 'rectangle':
      path.rect(drawing.x, drawing.y, drawing.width, drawing.height);
      break;
    case 'circle':
      path.arc(drawing.center.x, drawing.center.y, drawing.radius, 0, Math.PI * 2);
      break;
    case 'polygon': {
      const [first, ...rest] = drawing.points;
      if (first) {
        path.moveTo(first.x, first.y);
        for (const p of rest) path.lineTo(p.x, p.y);
        path.closePath();
      }
      break;
    }
  }
  return path;
}

/** Returns (building if necessary) the cached Path2D for a drawing. */
export function getCachedPath(drawing: HitTestableDrawing): Path2D {
  const existing = pathCache.get(drawing.id);
  if (existing && existing.updatedAt === drawing.updatedAt) {
    return existing.path;
  }
  const path = buildPath(drawing);
  pathCache.set(drawing.id, {
    path,
    updatedAt: drawing.updatedAt,
    strokeWidth: drawing.style.strokeWidth,
  });
  return path;
}

/** Test-only: clears the module-level cache (avoids cross-test leakage). */
export function __clearHitTestCache(): void {
  pathCache.clear();
}

/** Shapes that are filled (isPointInPath) vs. stroked-only (isPointInStroke). */
function isFilledType(type: HitTestableDrawing['type']): boolean {
  return type === 'rectangle' || type === 'circle' || type === 'polygon';
}

/**
 * A minimal ctx surface this module needs. The real caller passes a
 * CanvasRenderingContext2D; unit tests pass a fake implementing just this.
 */
export interface HitTestContext {
  isPointInPath(path: Path2D, x: number, y: number): boolean;
  isPointInStroke(path: Path2D, x: number, y: number): boolean;
  lineWidth: number;
}

/**
 * Creates a real, detached (never attached to the DOM, never rendered)
 * canvas 2D context for hit-testing. Prefers OffscreenCanvas since it avoids
 * touching the DOM at all; falls back to a plain <canvas> element (still
 * detached - not appended anywhere) when OffscreenCanvas is unavailable.
 * Size is irrelevant since we never rasterize into the canvas, only query
 * Path2D geometry against it - 1x1 is enough.
 */
export function createHitTestContext(): CanvasRenderingContext2D {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(1, 1);
    const ctx = canvas.getContext('2d');
    if (ctx) return ctx as unknown as CanvasRenderingContext2D;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('inkHitTest: unable to obtain a 2D rendering context');
  }
  return ctx;
}

/**
 * Given the drawings array (in render order, i.e. array order === paint
 * order, same convention CanvasInkLayer/DrawingRenderer iterate in), a
 * world-space point, and the current zoom, returns the id of the top-most
 * drawing hit, or null. "Top-most" = last in the array (last-rendered wins,
 * matching normal painter's-algorithm z-order — later elements paint over
 * earlier ones, so on overlap the last one is what's visually on top and
 * should win the click).
 */
export function hitTestDrawings(
  drawings: readonly Drawing[],
  point: Point,
  zoom: number,
  ctx: HitTestContext,
): string | null {
  const tolerance = toleranceForZoom(zoom);

  for (let i = drawings.length - 1; i >= 0; i--) {
    const drawing = drawings[i];
    if (!isHitTestable(drawing)) continue;

    const path = getCachedPath(drawing);

    if (isFilledType(drawing.type)) {
      if (ctx.isPointInPath(path, point.x, point.y)) {
        return drawing.id;
      }
      // Filled shapes are still clickable via their outline stroke even if
      // the click lands just outside the fill (thin/zero-fill shapes, or a
      // shape drawn with fillOpacity 0) - fall through to stroke test below.
    }

    ctx.lineWidth = drawing.style.strokeWidth + tolerance;
    if (ctx.isPointInStroke(path, point.x, point.y)) {
      return drawing.id;
    }
  }

  return null;
}
