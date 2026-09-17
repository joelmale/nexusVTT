import { describe, it, expect } from 'vitest';
import {
  axialToCube,
  cubeToAxial,
  pixelToHex,
  hexToPixel,
  hexRound,
  cubeRound,
  hexDistance,
  calculateHexMovementDistance,
  hexLine,
  hexLerp,
  hexNeighbors,
  hexNeighbor,
  hexVertices,
  isPointInHex,
  getHexesInViewport,
  calculateHexSizeForSquareArea,
} from './hexMath';
import type { HexCoord } from './hexMath';
import type { Point } from '@/types/drawing';

const SIZE = 40;

/**
 * `Math.round` yields `-0` for small negative inputs, so a correctly
 * round-tripped hex can come back as `{ q: 1, r: -0 }`. That compares equal
 * with `===` but not with a deep-equal matcher, so normalize before asserting.
 */
const normalizeHex = (hex: HexCoord): HexCoord => ({
  q: hex.q === 0 ? 0 : hex.q,
  r: hex.r === 0 ? 0 : hex.r,
});

describe('hexMath', () => {
  describe('coordinate conversion', () => {
    it('converts axial to cube coordinates satisfying x + y + z === 0', () => {
      const cube = axialToCube({ q: 3, r: -5 });

      expect(cube).toEqual({ x: 3, y: 2, z: -5 });
      expect(cube.x + cube.y + cube.z).toBe(0);
    });

    it('round-trips axial -> cube -> axial', () => {
      const cases: HexCoord[] = [
        { q: 0, r: 0 },
        { q: 7, r: 2 },
        { q: -4, r: 9 },
        { q: -11, r: -6 },
      ];

      for (const hex of cases) {
        expect(cubeToAxial(axialToCube(hex))).toEqual(hex);
      }
    });

    it('round-trips hex -> pixel -> hex exactly, including offsets and scale', () => {
      const cases: HexCoord[] = [
        { q: 0, r: 0 },
        { q: 1, r: 0 },
        { q: 0, r: 1 },
        { q: -3, r: 5 },
        { q: 12, r: -8 },
      ];

      for (const hex of cases) {
        const pixel = hexToPixel(hex, SIZE, 120, -75, 1.5);
        expect(normalizeHex(pixelToHex(pixel, SIZE, 120, -75, 1.5))).toEqual(
          hex,
        );
      }
    });

    it('places the origin hex at the grid offset', () => {
      expect(hexToPixel({ q: 0, r: 0 }, SIZE, 25, 60)).toEqual({
        x: 25,
        y: 60,
      });
    });

    it('spaces adjacent columns by 1.5 * size and rows by sqrt(3) * size', () => {
      const origin = hexToPixel({ q: 0, r: 0 }, SIZE);
      const eastward = hexToPixel({ q: 1, r: 0 }, SIZE);
      const southward = hexToPixel({ q: 0, r: 1 }, SIZE);

      expect(eastward.x - origin.x).toBeCloseTo(SIZE * 1.5, 10);
      expect(southward.y - origin.y).toBeCloseTo(SIZE * Math.sqrt(3), 10);
      expect(southward.x - origin.x).toBeCloseTo(0, 10);
    });

    it('scales hex spacing by hexScale', () => {
      const unscaled = hexToPixel({ q: 2, r: 3 }, SIZE);
      const scaled = hexToPixel({ q: 2, r: 3 }, SIZE, 0, 0, 2);

      expect(scaled.x).toBeCloseTo(unscaled.x * 2, 10);
      expect(scaled.y).toBeCloseTo(unscaled.y * 2, 10);
    });

    it('snaps an off-center pixel to the hex that contains it', () => {
      const center = hexToPixel({ q: 2, r: -1 }, SIZE);
      const nudged: Point = { x: center.x + 4, y: center.y - 6 };

      expect(normalizeHex(pixelToHex(nudged, SIZE))).toEqual({ q: 2, r: -1 });
    });
  });

  describe('rounding', () => {
    it('returns integer coordinates that still satisfy the cube constraint', () => {
      const rounded = cubeRound({ x: 1.4, y: -2.3, z: 0.9 });

      expect(Number.isInteger(rounded.x)).toBe(true);
      expect(Number.isInteger(rounded.y)).toBe(true);
      expect(Number.isInteger(rounded.z)).toBe(true);
      expect(rounded.x + rounded.y + rounded.z).toBe(0);
    });

    it('resets the axis with the largest rounding error (x)', () => {
      // x is furthest from an integer, so it is recomputed from y and z.
      const rounded = cubeRound({ x: 0.5, y: -0.2, z: -0.1 });

      expect(rounded.x).toBeCloseTo(0, 10);
      expect(rounded.y).toBeCloseTo(0, 10);
      expect(rounded.z).toBeCloseTo(0, 10);
    });

    it('resets the axis with the largest rounding error (y)', () => {
      const rounded = cubeRound({ x: 1.1, y: -0.6, z: -0.5 });

      expect(rounded.x + rounded.y + rounded.z).toBe(0);
      expect(rounded.x).toBe(1);
      expect(rounded.y).toBe(-1);
    });

    it('resets z when neither x nor y dominates the error', () => {
      const rounded = cubeRound({ x: 1.0, y: 2.0, z: -3.0 });

      expect(rounded).toEqual({ x: 1, y: 2, z: -3 });
    });

    it('rounds fractional axial coordinates to a whole hex', () => {
      expect(normalizeHex(hexRound({ q: 2.2, r: -0.8 }))).toEqual({
        q: 2,
        r: -1,
      });
    });

    it('leaves already-integral hexes untouched', () => {
      expect(hexRound({ q: -4, r: 6 })).toEqual({ q: -4, r: 6 });
    });
  });

  describe('distance', () => {
    it('is zero for a hex and itself', () => {
      expect(hexDistance({ q: 5, r: -2 }, { q: 5, r: -2 })).toBe(0);
    });

    it('is one for every immediate neighbor', () => {
      const origin: HexCoord = { q: 3, r: 3 };

      for (const neighbor of hexNeighbors(origin)) {
        expect(hexDistance(origin, neighbor)).toBe(1);
      }
    });

    it('is symmetric', () => {
      const a: HexCoord = { q: -2, r: 7 };
      const b: HexCoord = { q: 4, r: -1 };

      expect(hexDistance(a, b)).toBe(hexDistance(b, a));
    });

    it('counts diagonal-looking moves along a single axis correctly', () => {
      // q and r both change in opposite directions: still a straight hex run.
      expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: -3 })).toBe(3);
      // q and r change in the same direction: the third cube axis dominates.
      expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: 3 })).toBe(6);
    });
  });

  describe('movement cost', () => {
    it('charges feetPerHex for each hex of distance', () => {
      expect(
        calculateHexMovementDistance({ q: 0, r: 0 }, { q: 4, r: 0 }, SIZE),
      ).toBe(20);
    });

    it('honors a non-default feetPerHex', () => {
      expect(
        calculateHexMovementDistance(
          { q: 0, r: 0 },
          { q: 3, r: 0 },
          SIZE,
          [],
          10,
        ),
      ).toBe(30);
    });

    it('doubles the cost when the path crosses difficult terrain', () => {
      const start: HexCoord = { q: 0, r: 0 };
      const end: HexCoord = { q: 4, r: 0 };
      const onThePath = hexLine(start, end)[2];

      expect(calculateHexMovementDistance(start, end, SIZE, [onThePath])).toBe(
        40,
      );
    });

    it('ignores difficult terrain that the path does not cross', () => {
      expect(
        calculateHexMovementDistance({ q: 0, r: 0 }, { q: 4, r: 0 }, SIZE, [
          { q: 0, r: 9 },
        ]),
      ).toBe(20);
    });

    it('costs nothing to stay put, even on difficult terrain', () => {
      expect(
        calculateHexMovementDistance({ q: 2, r: 2 }, { q: 2, r: 2 }, SIZE, [
          { q: 2, r: 2 },
        ]),
      ).toBe(0);
    });
  });

  describe('lines and interpolation', () => {
    it('returns just the start hex for a zero-length line', () => {
      expect(hexLine({ q: 1, r: 1 }, { q: 1, r: 1 })).toEqual([{ q: 1, r: 1 }]);
    });

    it('returns distance + 1 hexes, anchored at both endpoints', () => {
      const start: HexCoord = { q: 0, r: 0 };
      const end: HexCoord = { q: 4, r: -2 };
      const line = hexLine(start, end);

      expect(line).toHaveLength(hexDistance(start, end) + 1);
      expect(line[0]).toEqual(start);
      expect(line[line.length - 1]).toEqual(end);
    });

    it('produces a contiguous path where each step is one hex', () => {
      const line = hexLine({ q: -3, r: 1 }, { q: 2, r: 4 });

      for (let i = 1; i < line.length; i++) {
        expect(hexDistance(line[i - 1], line[i])).toBe(1);
      }
    });

    it('interpolates between two hexes without rounding', () => {
      expect(hexLerp({ q: 0, r: 0 }, { q: 4, r: 2 }, 0.5)).toEqual({
        q: 2,
        r: 1,
      });
      expect(hexLerp({ q: 0, r: 0 }, { q: 3, r: 1 }, 0)).toEqual({
        q: 0,
        r: 0,
      });
      expect(hexLerp({ q: 0, r: 0 }, { q: 3, r: 1 }, 1)).toEqual({
        q: 3,
        r: 1,
      });
    });
  });

  describe('neighbors', () => {
    it('returns six distinct neighbors', () => {
      const neighbors = hexNeighbors({ q: 0, r: 0 });
      const unique = new Set(neighbors.map((h) => `${h.q},${h.r}`));

      expect(neighbors).toHaveLength(6);
      expect(unique.size).toBe(6);
    });

    it('offsets neighbors relative to the source hex', () => {
      const neighbors = hexNeighbors({ q: 10, r: -10 });

      expect(neighbors).toContainEqual({ q: 11, r: -10 });
      expect(neighbors).toContainEqual({ q: 9, r: -9 });
    });

    it('indexes a single neighbor by direction', () => {
      const origin: HexCoord = { q: 0, r: 0 };

      expect(hexNeighbor(origin, 0)).toEqual({ q: 1, r: 0 });
      expect(hexNeighbor(origin, 3)).toEqual({ q: -1, r: 0 });
      expect(hexNeighbor(origin, 5)).toEqual({ q: 0, r: 1 });
    });

    it('wraps direction indices past 5 back around the ring', () => {
      const origin: HexCoord = { q: 0, r: 0 };

      expect(hexNeighbor(origin, 6)).toEqual(hexNeighbor(origin, 0));
      expect(hexNeighbor(origin, 13)).toEqual(hexNeighbor(origin, 1));
    });

    it('agrees with hexNeighbors for every direction', () => {
      const origin: HexCoord = { q: -2, r: 5 };
      const all = hexNeighbors(origin);

      for (let direction = 0; direction < 6; direction++) {
        expect(hexNeighbor(origin, direction)).toEqual(all[direction]);
      }
    });
  });

  describe('geometry', () => {
    it('produces six vertices all at the circumradius from the center', () => {
      const center: Point = { x: 100, y: 200 };
      const vertices = hexVertices(center, SIZE);

      expect(vertices).toHaveLength(6);
      for (const vertex of vertices) {
        const radius = Math.hypot(vertex.x - center.x, vertex.y - center.y);
        expect(radius).toBeCloseTo(SIZE, 10);
      }
    });

    it('starts the vertex ring due east of the center (flat-top)', () => {
      const vertices = hexVertices({ x: 0, y: 0 }, SIZE);

      expect(vertices[0].x).toBeCloseTo(SIZE, 10);
      expect(vertices[0].y).toBeCloseTo(0, 10);
    });

    it('scales vertices by hexScale', () => {
      const vertices = hexVertices({ x: 0, y: 0 }, SIZE, 0.5);

      expect(Math.hypot(vertices[2].x, vertices[2].y)).toBeCloseTo(
        SIZE / 2,
        10,
      );
    });

    it('accepts the hex center itself', () => {
      expect(isPointInHex({ x: 50, y: 50 }, { x: 50, y: 50 }, SIZE)).toBe(true);
    });

    it('accepts a point just inside the eastern corner', () => {
      const center: Point = { x: 0, y: 0 };

      expect(isPointInHex({ x: SIZE * 0.9, y: 0 }, center, SIZE)).toBe(true);
    });

    it('rejects a point outside the bounding box entirely', () => {
      const center: Point = { x: 0, y: 0 };

      // Fails the fast width check.
      expect(isPointInHex({ x: SIZE * 1.2, y: 0 }, center, SIZE)).toBe(false);
      // Fails the fast height check.
      expect(isPointInHex({ x: 0, y: SIZE * 1.2 }, center, SIZE)).toBe(false);
    });

    it('rejects a point inside the bounding box but outside the hexagon', () => {
      const center: Point = { x: 0, y: 0 };

      // Inside the bbox corner region, beyond the sloped edge.
      expect(
        isPointInHex({ x: SIZE * 0.99, y: SIZE * 0.5 }, center, SIZE),
      ).toBe(false);
    });

    it('shrinks the accepted region when hexScale shrinks', () => {
      const center: Point = { x: 0, y: 0 };
      const point: Point = { x: SIZE * 0.7, y: 0 };

      expect(isPointInHex(point, center, SIZE, 1)).toBe(true);
      expect(isPointInHex(point, center, SIZE, 0.5)).toBe(false);
    });
  });

  describe('viewport generation', () => {
    it('includes the hex under the viewport center', () => {
      const center: Point = { x: 300, y: 250 };
      const hexes = getHexesInViewport(
        center,
        { width: 800, height: 600 },
        SIZE,
      );
      const centerHex = normalizeHex(pixelToHex(center, SIZE));

      expect(hexes).toContainEqual(centerHex);
    });

    it('keeps every returned hex near the viewport', () => {
      const center: Point = { x: 0, y: 0 };
      const viewport = { width: 400, height: 300 };
      const hexes = getHexesInViewport(center, viewport, SIZE);
      const maxX = viewport.width / 2 + SIZE * 1.5;
      const maxY = viewport.height / 2 + SIZE * Math.sqrt(3);

      expect(hexes.length).toBeGreaterThan(0);
      for (const hex of hexes) {
        const pixel = hexToPixel(hex, SIZE);
        expect(Math.abs(pixel.x)).toBeLessThanOrEqual(maxX);
        expect(Math.abs(pixel.y)).toBeLessThanOrEqual(maxY);
      }
    });

    it('returns more hexes for a larger viewport', () => {
      const center: Point = { x: 0, y: 0 };
      const small = getHexesInViewport(
        center,
        { width: 200, height: 200 },
        SIZE,
      );
      const large = getHexesInViewport(
        center,
        { width: 1200, height: 1200 },
        SIZE,
      );

      expect(large.length).toBeGreaterThan(small.length);
    });

    it('returns fewer hexes as the hexes get bigger', () => {
      const center: Point = { x: 0, y: 0 };
      const viewport = { width: 800, height: 600 };

      expect(getHexesInViewport(center, viewport, 100).length).toBeLessThan(
        getHexesInViewport(center, viewport, 20).length,
      );
    });

    it('shifts the covered region with the grid offset', () => {
      const viewport = { width: 400, height: 400 };
      const unshifted = getHexesInViewport({ x: 0, y: 0 }, viewport, SIZE);
      const shifted = getHexesInViewport(
        { x: 0, y: 0 },
        viewport,
        SIZE,
        1000,
        1000,
      );

      expect(shifted).not.toEqual(unshifted);
    });
  });

  describe('sizing', () => {
    it('produces a hex whose area matches the equivalent square', () => {
      const squareSize = 50;
      const radius = calculateHexSizeForSquareArea(squareSize);
      const hexArea = ((3 * Math.sqrt(3)) / 2) * radius * radius;

      expect(hexArea).toBeCloseTo(squareSize * squareSize, 6);
    });

    it('scales linearly with the square size', () => {
      expect(calculateHexSizeForSquareArea(100)).toBeCloseTo(
        calculateHexSizeForSquareArea(50) * 2,
        10,
      );
    });
  });
});
