/**
 * Unit tests for inkHitTest (A8b).
 *
 * jsdom does not rasterize Path2D (no real isPointInPath/isPointInStroke
 * geometry), so these tests inject a FAKE ctx that records every call and
 * returns caller-controlled answers. That lets us pin down exactly the
 * logic that's actually ours: top-down (last-rendered-wins) iteration
 * order, stroke-width + tolerance-from-zoom math, and fill-vs-stroke
 * dispatch per drawing type. Whether a real browser rasterizer agrees a
 * given pixel is "in" a given Path2D is not something jsdom can verify -
 * that's covered by Joel's manual visual gate (tools/ink-compare/index.html)
 * per the S8 T3 ruling.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// jsdom has no Path2D (geometry is rasterizer-backed, not implementable in
// JS), so `new Path2D()` inside inkHitTest.ts would throw before any of our
// logic even runs. This module only ever calls Path2D as an opaque geometry
// handle - it never inspects it - so a minimal no-op stub (this suite's own
// fake HitTestContext never looks at the path's internals either) is enough
// to let buildPath()/getCachedPath() execute. Scoped to this file only; the
// shared tests/setup.ts is intentionally left untouched (out of this
// packet's domain and not needed by any other suite today).
class FakePath2D {
  moveTo(): void {}
  lineTo(): void {}
  rect(): void {}
  arc(): void {}
  closePath(): void {}
}
(globalThis as unknown as { Path2D: typeof FakePath2D }).Path2D = FakePath2D;

import {
  hitTestDrawings,
  toleranceForZoom,
  getCachedPath,
  __clearHitTestCache,
  type HitTestContext,
} from './inkHitTest';
import type {
  Drawing,
  PencilDrawing,
  RectangleDrawing,
  CircleDrawing,
  PolygonDrawing,
  LineDrawing,
  TextDrawing,
} from '@/types/drawing';

const BASE = {
  roomCode: 'ABCD',
  createdAt: 0,
  createdBy: 'user-1',
  layer: 'effects' as const,
  style: {
    fillColor: '#ff0000',
    fillOpacity: 0.5,
    strokeColor: '#000000',
    strokeWidth: 4,
  },
};

function pencil(id: string, updatedAt = 1): PencilDrawing {
  return {
    ...BASE,
    id,
    type: 'pencil',
    updatedAt,
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ],
  };
}

function rect(id: string, updatedAt = 1): RectangleDrawing {
  return {
    ...BASE,
    id,
    type: 'rectangle',
    updatedAt,
    x: 0,
    y: 0,
    width: 20,
    height: 20,
  };
}

function circle(id: string, updatedAt = 1): CircleDrawing {
  return {
    ...BASE,
    id,
    type: 'circle',
    updatedAt,
    center: { x: 50, y: 50 },
    radius: 10,
  };
}

function polygon(id: string, updatedAt = 1): PolygonDrawing {
  return {
    ...BASE,
    id,
    type: 'polygon',
    updatedAt,
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ],
  };
}

function line(id: string, updatedAt = 1): LineDrawing {
  return {
    ...BASE,
    id,
    type: 'line',
    updatedAt,
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
  };
}

function text(id: string): TextDrawing {
  return {
    ...BASE,
    id,
    type: 'text',
    updatedAt: 1,
    position: { x: 0, y: 0 },
    text: 'hi',
    fontSize: 12,
    fontFamily: 'sans-serif',
  };
}

/** Fake ctx: always-miss by default; tests flip specific answers on. */
function makeFakeCtx(overrides?: {
  pointInPath?: (path: Path2D, x: number, y: number) => boolean;
  pointInStroke?: (path: Path2D, x: number, y: number) => boolean;
}): HitTestContext & {
  isPointInPath: ReturnType<typeof vi.fn>;
  isPointInStroke: ReturnType<typeof vi.fn>;
} {
  return {
    lineWidth: 0,
    isPointInPath: vi.fn(overrides?.pointInPath ?? (() => false)),
    isPointInStroke: vi.fn(overrides?.pointInStroke ?? (() => false)),
  };
}

describe('inkHitTest', () => {
  beforeEach(() => {
    __clearHitTestCache();
  });

  describe('toleranceForZoom', () => {
    it('scales inversely with zoom', () => {
      expect(toleranceForZoom(1)).toBeCloseTo(8);
      expect(toleranceForZoom(2)).toBeCloseTo(4);
      expect(toleranceForZoom(0.5)).toBeCloseTo(16);
    });

    it('guards against zero/negative zoom (treats as 1x)', () => {
      expect(toleranceForZoom(0)).toBeCloseTo(8);
      expect(toleranceForZoom(-1)).toBeCloseTo(8);
    });
  });

  describe('getCachedPath', () => {
    it('returns the same Path2D instance on repeated calls with unchanged updatedAt', () => {
      const d = pencil('p1');
      const first = getCachedPath(d);
      const second = getCachedPath(d);
      expect(first).toBe(second);
    });

    it('rebuilds the path when updatedAt changes', () => {
      const d1 = pencil('p1', 1);
      const first = getCachedPath(d1);
      const d2 = pencil('p1', 2);
      const second = getCachedPath(d2);
      expect(first).not.toBe(second);
    });
  });

  describe('hitTestDrawings - ordering (top-most / last-rendered wins)', () => {
    it('returns the LAST drawing in array order when multiple overlap', () => {
      const drawings: Drawing[] = [rect('bottom'), rect('middle'), rect('top')];
      const ctx = makeFakeCtx({ pointInPath: () => true });

      const hit = hitTestDrawings(drawings, { x: 5, y: 5 }, 1, ctx);

      expect(hit).toBe('top');
    });

    it('three stacked shapes: top-most wins even when all three would match', () => {
      const drawings: Drawing[] = [circle('c1'), rect('r1'), polygon('poly1')];
      const ctx = makeFakeCtx({
        pointInPath: () => true,
        pointInStroke: () => true,
      });

      const hit = hitTestDrawings(drawings, { x: 1, y: 1 }, 1, ctx);

      expect(hit).toBe('poly1');
    });

    it('falls through to the next-lower drawing when the top one misses', () => {
      const drawings: Drawing[] = [rect('bottom'), rect('top')];
      const ctx = makeFakeCtx({
        pointInPath: (path) => path === getCachedPath(drawings[0] as RectangleDrawing),
      });

      const hit = hitTestDrawings(drawings, { x: 5, y: 5 }, 1, ctx);

      expect(hit).toBe('bottom');
    });

    it('returns null when nothing hits (miss)', () => {
      const drawings: Drawing[] = [rect('r1'), circle('c1')];
      const ctx = makeFakeCtx();

      const hit = hitTestDrawings(drawings, { x: 999, y: 999 }, 1, ctx);

      expect(hit).toBeNull();
    });
  });

  describe('hitTestDrawings - fill vs stroke dispatch', () => {
    it('filled types (rectangle/circle/polygon) are tested with isPointInPath first', () => {
      const d = rect('r1');
      const ctx = makeFakeCtx({ pointInPath: () => true });

      const hit = hitTestDrawings([d], { x: 1, y: 1 }, 1, ctx);

      expect(hit).toBe('r1');
      expect(ctx.isPointInPath).toHaveBeenCalled();
    });

    it('filled types fall back to stroke test when fill misses (thin/unfilled shape)', () => {
      const d = circle('c1');
      const ctx = makeFakeCtx({
        pointInPath: () => false,
        pointInStroke: () => true,
      });

      const hit = hitTestDrawings([d], { x: 1, y: 1 }, 1, ctx);

      expect(hit).toBe('c1');
      expect(ctx.isPointInPath).toHaveBeenCalled();
      expect(ctx.isPointInStroke).toHaveBeenCalled();
    });

    it('stroked-only types (pencil/line) never call isPointInPath', () => {
      const d = pencil('p1');
      const ctx = makeFakeCtx({ pointInStroke: () => true });

      const hit = hitTestDrawings([d], { x: 1, y: 1 }, 1, ctx);

      expect(hit).toBe('p1');
      expect(ctx.isPointInPath).not.toHaveBeenCalled();
    });

    it('line drawings are hit-testable via isPointInStroke', () => {
      const d = line('l1');
      const ctx = makeFakeCtx({ pointInStroke: () => true });

      const hit = hitTestDrawings([d], { x: 5, y: 0 }, 1, ctx);

      expect(hit).toBe('l1');
    });
  });

  describe('hitTestDrawings - tolerance / zoom scaling', () => {
    it('sets ctx.lineWidth to style.strokeWidth + tolerance(zoom) before stroke test', () => {
      const d = pencil('p1');
      const ctx = makeFakeCtx({ pointInStroke: () => true });

      hitTestDrawings([d], { x: 1, y: 1 }, 1, ctx);

      // strokeWidth 4 + tolerance(8/1) = 12
      expect(ctx.lineWidth).toBeCloseTo(12);
    });

    it('at zoom 0.3, tolerance widens (8 / 0.3)', () => {
      const d = pencil('p1');
      const ctx = makeFakeCtx({ pointInStroke: () => true });

      hitTestDrawings([d], { x: 1, y: 1 }, 0.3, ctx);

      expect(ctx.lineWidth).toBeCloseTo(4 + 8 / 0.3);
    });

    it('at zoom 3.0, tolerance narrows (8 / 3)', () => {
      const d = pencil('p1');
      const ctx = makeFakeCtx({ pointInStroke: () => true });

      hitTestDrawings([d], { x: 1, y: 1 }, 3, ctx);

      expect(ctx.lineWidth).toBeCloseTo(4 + 8 / 3);
    });
  });

  describe('hitTestDrawings - unsupported drawing types', () => {
    it('skips drawing types with no hit-test geometry (e.g. text) without throwing', () => {
      const drawings: Drawing[] = [text('t1'), rect('r1')];
      const ctx = makeFakeCtx({ pointInPath: () => true });

      const hit = hitTestDrawings(drawings, { x: 1, y: 1 }, 1, ctx);

      expect(hit).toBe('r1');
    });
  });
});
