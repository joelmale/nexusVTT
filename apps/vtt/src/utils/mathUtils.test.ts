import { describe, it, expect } from 'vitest';
import {
  distance,
  distanceSquared,
  midpoint,
  angleBetween,
  angleBetweenDegrees,
  rotatePoint,
  clamp,
  lerp,
  lerpPoint,
  isPointNearLine,
  closestPointOnLine,
  lineIntersection,
  isPointInRectangle,
  isPointInCircle,
  isPointInPolygon,
  isPointInCone,
  rectanglesOverlap,
  circlesOverlap,
  feetToPixels,
  pixelsToFeet,
  calculateDiagonalDistance,
  gridSnap,
  getAdjacentSquares,
  isWithinRange,
  getPointsInCircle,
  getPointsInCone,
  getPointsInCube,
  getBoundingBox,
  normalizeRectangle,
} from './mathUtils';
import type { Point } from '@/types/drawing';

describe('mathUtils', () => {
  describe('Basic Geometry', () => {
    it('should calculate distance between two points', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 3, y: 4 };
      expect(distance(p1, p2)).toBe(5);
    });

    it('should calculate squared distance', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 3, y: 4 };
      expect(distanceSquared(p1, p2)).toBe(25);
    });

    it('should calculate midpoint', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 10, y: 10 };
      const mid = midpoint(p1, p2);
      expect(mid.x).toBe(5);
      expect(mid.y).toBe(5);
    });

    it('should calculate angle between points in radians', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 1, y: 0 };
      expect(angleBetween(p1, p2)).toBe(0);

      const p3: Point = { x: 0, y: 1 };
      expect(angleBetween(p1, p3)).toBeCloseTo(Math.PI / 2);
    });

    it('should calculate angle between points in degrees', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 1, y: 0 };
      expect(angleBetweenDegrees(p1, p2)).toBe(0);

      const p3: Point = { x: 0, y: 1 };
      expect(angleBetweenDegrees(p1, p3)).toBeCloseTo(90);
    });

    it('should rotate point around origin', () => {
      const point: Point = { x: 1, y: 0 };
      const origin: Point = { x: 0, y: 0 };
      const rotated = rotatePoint(point, origin, Math.PI / 2);

      expect(rotated.x).toBeCloseTo(0, 5);
      expect(rotated.y).toBeCloseTo(1, 5);
    });

    it('should clamp values', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should lerp between values', () => {
      expect(lerp(0, 10, 0)).toBe(0);
      expect(lerp(0, 10, 0.5)).toBe(5);
      expect(lerp(0, 10, 1)).toBe(10);
    });

    it('should lerp between points', () => {
      const p1: Point = { x: 0, y: 0 };
      const p2: Point = { x: 10, y: 10 };
      const mid = lerpPoint(p1, p2, 0.5);

      expect(mid.x).toBe(5);
      expect(mid.y).toBe(5);
    });
  });

  describe('Point-Line Geometry', () => {
    it('should detect point near line segment', () => {
      const point: Point = { x: 5, y: 1 };
      const lineStart: Point = { x: 0, y: 0 };
      const lineEnd: Point = { x: 10, y: 0 };

      expect(isPointNearLine(point, lineStart, lineEnd, 2)).toBe(true);
      expect(isPointNearLine(point, lineStart, lineEnd, 0.5)).toBe(false);
    });

    it('should find closest point on line', () => {
      const point: Point = { x: 5, y: 5 };
      const lineStart: Point = { x: 0, y: 0 };
      const lineEnd: Point = { x: 10, y: 0 };

      const closest = closestPointOnLine(point, lineStart, lineEnd);
      expect(closest.x).toBe(5);
      expect(closest.y).toBe(0);
    });

    it('should detect line intersection', () => {
      const line1Start: Point = { x: 0, y: 0 };
      const line1End: Point = { x: 10, y: 10 };
      const line2Start: Point = { x: 0, y: 10 };
      const line2End: Point = { x: 10, y: 0 };

      const intersection = lineIntersection(
        line1Start,
        line1End,
        line2Start,
        line2End,
      );

      expect(intersection).not.toBeNull();
      expect(intersection!.x).toBeCloseTo(5);
      expect(intersection!.y).toBeCloseTo(5);
    });

    it('should return null for parallel lines', () => {
      const line1Start: Point = { x: 0, y: 0 };
      const line1End: Point = { x: 10, y: 0 };
      const line2Start: Point = { x: 0, y: 5 };
      const line2End: Point = { x: 10, y: 5 };

      const intersection = lineIntersection(
        line1Start,
        line1End,
        line2Start,
        line2End,
      );

      expect(intersection).toBeNull();
    });
  });

  describe('Shape Collision Detection', () => {
    it('should detect point in rectangle', () => {
      const point: Point = { x: 5, y: 5 };
      const rect = { x: 0, y: 0, width: 10, height: 10 };

      expect(isPointInRectangle(point, rect)).toBe(true);
      expect(isPointInRectangle({ x: 15, y: 15 }, rect)).toBe(false);
    });

    it('should detect point in circle', () => {
      const center: Point = { x: 0, y: 0 };
      const point: Point = { x: 3, y: 4 };

      expect(isPointInCircle(point, center, 5)).toBe(true);
      expect(isPointInCircle(point, center, 6)).toBe(true);
      expect(isPointInCircle(point, center, 4)).toBe(false);
    });

    it('should detect point in polygon using ray casting', () => {
      const polygon: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];

      expect(isPointInPolygon({ x: 5, y: 5 }, polygon)).toBe(true);
      expect(isPointInPolygon({ x: 15, y: 15 }, polygon)).toBe(false);
    });

    it('should detect point in cone', () => {
      const origin: Point = { x: 0, y: 0 };
      const direction = 0; // East
      const length = 10;
      const angle = Math.PI / 2; // 90 degrees (cone spans -45° to +45° from east)

      // Point at (5, 2) is within the cone
      expect(
        isPointInCone({ x: 5, y: 2 }, origin, direction, length, angle),
      ).toBe(true);
      // Point at (5, 5) is outside the 45° angle limit (atan2(5,5) = 45°, but it's right at the edge)
      // Adjusting to a point clearly outside the cone angle
      expect(
        isPointInCone({ x: 3, y: 8 }, origin, direction, length, angle),
      ).toBe(false);
      // Point at (15, 0) is beyond the length
      expect(
        isPointInCone({ x: 15, y: 0 }, origin, direction, length, angle),
      ).toBe(false);
    });

    it('should detect rectangle overlap', () => {
      const rect1 = { x: 0, y: 0, width: 10, height: 10 };
      const rect2 = { x: 5, y: 5, width: 10, height: 10 };
      const rect3 = { x: 20, y: 20, width: 10, height: 10 };

      expect(rectanglesOverlap(rect1, rect2)).toBe(true);
      expect(rectanglesOverlap(rect1, rect3)).toBe(false);
    });

    it('should detect circle overlap', () => {
      const circle1 = { center: { x: 0, y: 0 }, radius: 5 };
      const circle2 = { center: { x: 8, y: 0 }, radius: 5 };
      const circle3 = { center: { x: 20, y: 0 }, radius: 5 };

      expect(circlesOverlap(circle1, circle2)).toBe(true);
      expect(circlesOverlap(circle1, circle3)).toBe(false);
    });
  });

  describe('D&D 5e Utilities', () => {
    it('should convert feet to pixels', () => {
      const gridSize = 50; // 50 pixels per square
      expect(feetToPixels(5, gridSize)).toBe(50); // 5 feet = 1 square
      expect(feetToPixels(10, gridSize)).toBe(100); // 10 feet = 2 squares
      expect(feetToPixels(15, gridSize)).toBe(150); // 15 feet = 3 squares
    });

    it('should convert pixels to feet', () => {
      const gridSize = 50;
      expect(pixelsToFeet(50, gridSize)).toBe(5);
      expect(pixelsToFeet(100, gridSize)).toBe(10);
      expect(pixelsToFeet(150, gridSize)).toBe(15);
    });

    it('should calculate diagonal distance using D&D 5e rules', () => {
      const gridSize = 50;

      // Straight line = 5 feet per square
      expect(calculateDiagonalDistance(50, 0, gridSize)).toBe(5);

      // 1 diagonal = 5 feet (first diagonal)
      expect(calculateDiagonalDistance(50, 50, gridSize)).toBe(5);

      // 2 diagonals = 15 feet (first at 5, second at 10)
      expect(calculateDiagonalDistance(100, 100, gridSize)).toBe(15);

      // 3 diagonals = 20 feet (5 + 10 + 5)
      expect(calculateDiagonalDistance(150, 150, gridSize)).toBe(20);
    });

    it('should snap point to grid', () => {
      const gridSize = 50;
      // 23 rounds to 0, 78 rounds to 100 (78/50 = 1.56, rounds to 2, 2*50 = 100)
      expect(gridSnap({ x: 23, y: 78 }, gridSize)).toEqual({ x: 0, y: 100 });
      // 27 rounds to 50 (27/50 = 0.54, rounds to 1, 1*50 = 50)
      expect(gridSnap({ x: 27, y: 78 }, gridSize)).toEqual({ x: 50, y: 100 });
      expect(gridSnap({ x: 100, y: 100 }, gridSize)).toEqual({
        x: 100,
        y: 100,
      });
    });

    it('should get adjacent squares', () => {
      const gridSize = 50;
      const adjacent = getAdjacentSquares({ x: 100, y: 100 }, gridSize);

      expect(adjacent).toHaveLength(8);
      expect(adjacent).toContainEqual({ x: 50, y: 50 }); // NW
      expect(adjacent).toContainEqual({ x: 100, y: 50 }); // N
      expect(adjacent).toContainEqual({ x: 150, y: 50 }); // NE
      expect(adjacent).toContainEqual({ x: 50, y: 100 }); // W
      expect(adjacent).toContainEqual({ x: 150, y: 100 }); // E
      expect(adjacent).toContainEqual({ x: 50, y: 150 }); // SW
      expect(adjacent).toContainEqual({ x: 100, y: 150 }); // S
      expect(adjacent).toContainEqual({ x: 150, y: 150 }); // SE
    });

    it('should check if point is within D&D range', () => {
      const gridSize = 50;
      const from: Point = { x: 0, y: 0 };

      // 5 feet range (1 square)
      expect(isWithinRange(from, { x: 50, y: 0 }, 5, gridSize)).toBe(true);
      expect(isWithinRange(from, { x: 100, y: 0 }, 5, gridSize)).toBe(false);

      // 10 feet range (2 squares)
      expect(isWithinRange(from, { x: 100, y: 0 }, 10, gridSize)).toBe(true);
      expect(isWithinRange(from, { x: 150, y: 0 }, 10, gridSize)).toBe(false);
    });
  });

  describe('Area of Effect Helpers', () => {
    it('should get points in circle', () => {
      const gridSize = 50;
      const center: Point = { x: 100, y: 100 };
      const radius = 75; // Should include center + adjacent squares

      const points = getPointsInCircle(center, radius, gridSize);

      expect(points.length).toBeGreaterThan(0);
      expect(points).toContainEqual(center);
    });

    it('should get points in cone', () => {
      const gridSize = 50;
      const origin: Point = { x: 100, y: 100 };
      const direction = 0; // East
      const length = 100;
      const angle = Math.PI / 2; // 90 degrees

      const points = getPointsInCone(
        origin,
        direction,
        length,
        angle,
        gridSize,
      );

      expect(points.length).toBeGreaterThan(0);
      expect(points).toContainEqual(origin);
    });

    it('should get points in cube', () => {
      const gridSize = 50;
      const origin: Point = { x: 0, y: 0 };
      const size = 100; // 2x2 squares

      const points = getPointsInCube(origin, size, gridSize);

      expect(points).toHaveLength(4);
      expect(points).toContainEqual({ x: 0, y: 0 });
      expect(points).toContainEqual({ x: 50, y: 0 });
      expect(points).toContainEqual({ x: 0, y: 50 });
      expect(points).toContainEqual({ x: 50, y: 50 });
    });
  });

  describe('Selection & Bounds', () => {
    it('should calculate bounding box', () => {
      const points: Point[] = [
        { x: 10, y: 10 },
        { x: 20, y: 30 },
        { x: 5, y: 15 },
      ];

      const bbox = getBoundingBox(points);

      expect(bbox.x).toBe(5);
      expect(bbox.y).toBe(10);
      expect(bbox.width).toBe(15);
      expect(bbox.height).toBe(20);
    });

    it('should handle empty points array', () => {
      const bbox = getBoundingBox([]);

      expect(bbox).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });

    it('should normalize rectangle with negative dimensions', () => {
      const rect = { x: 10, y: 10, width: -20, height: -30 };
      const normalized = normalizeRectangle(rect);

      expect(normalized.x).toBe(-10);
      expect(normalized.y).toBe(-20);
      expect(normalized.width).toBe(20);
      expect(normalized.height).toBe(30);
    });

    it('should keep positive dimensions unchanged', () => {
      const rect = { x: 10, y: 10, width: 20, height: 30 };
      const normalized = normalizeRectangle(rect);

      expect(normalized).toEqual(rect);
    });
  });
});
