/**
 * Math Utilities for VTT Canvas Operations
 *
 * This module provides geometric calculations, collision detection,
 * and D&D 5e-specific math utilities for scene canvas operations.
 */

import type { Point } from '@/types/drawing';

// ============================================================================
// BASIC GEOMETRY
// ============================================================================

/**
 * Calculate the Euclidean distance between two points
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate squared distance (faster than distance, use for comparisons)
 */
export function distanceSquared(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return dx * dx + dy * dy;
}

/**
 * Calculate the midpoint between two points
 */
export function midpoint(p1: Point, p2: Point): Point {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

/**
 * Calculate angle between two points in radians
 * Returns angle from p1 to p2, where 0 is east, PI/2 is south
 */
export function angleBetween(p1: Point, p2: Point): number {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

/**
 * Calculate angle between two points in degrees
 * Returns angle from p1 to p2, where 0 is east, 90 is south
 */
export function angleBetweenDegrees(p1: Point, p2: Point): number {
  return (angleBetween(p1, p2) * 180) / Math.PI;
}

/**
 * Rotate a point around an origin by a given angle (in radians)
 */
export function rotatePoint(point: Point, origin: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;

  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between two values
 * @param t - Interpolation factor (0-1)
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Linear interpolation between two points
 */
export function lerpPoint(p1: Point, p2: Point, t: number): Point {
  return {
    x: lerp(p1.x, p2.x, t),
    y: lerp(p1.y, p2.y, t),
  };
}

// ============================================================================
// POINT-LINE GEOMETRY
// ============================================================================

/**
 * Check if a point is near a line segment within a threshold
 */
export function isPointNearLine(
  point: Point,
  lineStart: Point,
  lineEnd: Point,
  threshold: number,
): boolean {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx: number, yy: number;

  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;
  return Math.sqrt(dx * dx + dy * dy) <= threshold;
}

/**
 * Find the closest point on a line segment to a given point
 */
export function closestPointOnLine(
  point: Point,
  lineStart: Point,
  lineEnd: Point,
): Point {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;

  let param = -1;
  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  param = clamp(param, 0, 1);

  return {
    x: lineStart.x + param * C,
    y: lineStart.y + param * D,
  };
}

/**
 * Calculate intersection point of two line segments
 * Returns null if lines don't intersect
 */
export function lineIntersection(
  line1Start: Point,
  line1End: Point,
  line2Start: Point,
  line2End: Point,
): Point | null {
  const x1 = line1Start.x;
  const y1 = line1Start.y;
  const x2 = line1End.x;
  const y2 = line1End.y;
  const x3 = line2Start.x;
  const y3 = line2Start.y;
  const x4 = line2End.x;
  const y4 = line2End.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  if (Math.abs(denom) < 0.0001) {
    return null; // Lines are parallel
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
    };
  }

  return null;
}

// ============================================================================
// SHAPE COLLISION DETECTION
// ============================================================================

/**
 * Check if a point is inside or near a rectangle
 */
export function isPointInRectangle(
  point: Point,
  rect: { x: number; y: number; width: number; height: number },
  threshold: number = 0,
): boolean {
  return (
    point.x >= rect.x - threshold &&
    point.x <= rect.x + rect.width + threshold &&
    point.y >= rect.y - threshold &&
    point.y <= rect.y + rect.height + threshold
  );
}

/**
 * Check if a point is inside a circle
 */
export function isPointInCircle(
  point: Point,
  center: Point,
  radius: number,
): boolean {
  return distanceSquared(point, center) <= radius * radius;
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Check if a point is inside a cone
 * @param origin - Cone origin point
 * @param direction - Cone direction in radians
 * @param length - Cone length
 * @param angle - Cone angle (full angle, not half-angle) in radians
 */
export function isPointInCone(
  point: Point,
  origin: Point,
  direction: number,
  length: number,
  angle: number,
): boolean {
  // Check if point is within length radius
  const dist = distance(point, origin);
  if (dist > length) return false;

  // Check if point is within cone angle
  const angleToPoint = angleBetween(origin, point);
  let angleDiff = Math.abs(angleToPoint - direction);

  // Normalize angle difference to [-PI, PI]
  while (angleDiff > Math.PI) {
    angleDiff -= 2 * Math.PI;
  }
  while (angleDiff < -Math.PI) {
    angleDiff += 2 * Math.PI;
  }

  return Math.abs(angleDiff) <= angle / 2;
}

/**
 * Check if two rectangles overlap
 */
export function rectanglesOverlap(
  rect1: { x: number; y: number; width: number; height: number },
  rect2: { x: number; y: number; width: number; height: number },
): boolean {
  return !(
    rect1.x + rect1.width < rect2.x ||
    rect2.x + rect2.width < rect1.x ||
    rect1.y + rect1.height < rect2.y ||
    rect2.y + rect2.height < rect1.y
  );
}

/**
 * Check if two circles overlap
 */
export function circlesOverlap(
  circle1: { center: Point; radius: number },
  circle2: { center: Point; radius: number },
): boolean {
  const dist = distance(circle1.center, circle2.center);
  return dist <= circle1.radius + circle2.radius;
}

// ============================================================================
// D&D 5E SPECIFIC UTILITIES
// ============================================================================

/**
 * Convert feet to pixels based on grid size
 * Assumes standard D&D grid where 1 square = 5 feet
 */
export function feetToPixels(feet: number, gridSize: number): number {
  return (feet / 5) * gridSize;
}

/**
 * Convert pixels to feet based on grid size
 * Assumes standard D&D grid where 1 square = 5 feet
 */
export function pixelsToFeet(pixels: number, gridSize: number): number {
  return (pixels / gridSize) * 5;
}

/**
 * Calculate diagonal distance using D&D 5e rules
 * Every second diagonal counts as 10 feet instead of 5
 */
export function calculateDiagonalDistance(
  deltaX: number,
  deltaY: number,
  gridSize: number,
): number {
  const xSquares = Math.abs(deltaX / gridSize);
  const ySquares = Math.abs(deltaY / gridSize);
  const minSquares = Math.min(xSquares, ySquares);
  const maxSquares = Math.max(xSquares, ySquares);

  // First diagonal movement costs 5 feet, second costs 10 feet, alternating
  const diagonalCost = Math.floor(minSquares / 2) * 15 + (minSquares % 2) * 5;
  const straightCost = (maxSquares - minSquares) * 5;

  return diagonalCost + straightCost;
}

/**
 * Snap a point to the nearest grid intersection (square grid)
 */
export function gridSnap(point: Point, gridSize: number): Point {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

/**
 * Snap a point to the nearest grid position (grid-type aware)
 */
export function snapToGrid(
  point: Point,
  gridSettings: {
    type?: 'square' | 'hex';
    size: number;
    offsetX?: number;
    offsetY?: number;
    hexScale?: number;
  },
): Point {
  const gridType = gridSettings.type || 'square';
  const gridSize = gridSettings.size;
  const offsetX = gridSettings.offsetX || 0;
  const offsetY = gridSettings.offsetY || 0;
  const hexScale = gridSettings.hexScale || 1.0;

  if (gridType === 'hex') {
    // Import hex math functions here to avoid circular dependencies
    // Note: This require is necessary to avoid circular dependency between mathUtils and hexMath
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { pixelToHex, hexToPixel } = require('./hexMath');
    const hexCoord = pixelToHex(point, gridSize, offsetX, offsetY, hexScale);
    return hexToPixel(hexCoord, gridSize, offsetX, offsetY, hexScale);
  } else {
    // Square grid snapping
    return {
      x: Math.round((point.x - offsetX) / gridSize) * gridSize + offsetX,
      y: Math.round((point.y - offsetY) / gridSize) * gridSize + offsetY,
    };
  }
}

/**
 * Get the 8 adjacent grid squares around a point
 */
export function getAdjacentSquares(point: Point, gridSize: number): Point[] {
  const snapped = gridSnap(point, gridSize);
  const offsets = [
    { x: -1, y: -1 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ];

  return offsets.map((offset) => ({
    x: snapped.x + offset.x * gridSize,
    y: snapped.y + offset.y * gridSize,
  }));
}

/**
 * Check if a point is within D&D range of another point
 * @param range - Range in feet
 */
export function isWithinRange(
  from: Point,
  to: Point,
  range: number,
  gridSize: number,
): boolean {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const distInFeet = calculateDiagonalDistance(deltaX, deltaY, gridSize);
  return distInFeet <= range;
}

// ============================================================================
// AREA OF EFFECT HELPERS
// ============================================================================

/**
 * Get all grid points within a circular area
 */
export function getPointsInCircle(
  center: Point,
  radius: number,
  gridSize: number,
): Point[] {
  const points: Point[] = [];
  const radiusInSquares = Math.ceil(radius / gridSize);

  for (let dx = -radiusInSquares; dx <= radiusInSquares; dx++) {
    for (let dy = -radiusInSquares; dy <= radiusInSquares; dy++) {
      const point = {
        x: center.x + dx * gridSize,
        y: center.y + dy * gridSize,
      };

      if (distance(center, point) <= radius) {
        points.push(point);
      }
    }
  }

  return points;
}

/**
 * Get all grid points within a cone area
 */
export function getPointsInCone(
  origin: Point,
  direction: number,
  length: number,
  angle: number,
  gridSize: number,
): Point[] {
  const points: Point[] = [];
  const radiusInSquares = Math.ceil(length / gridSize);

  for (let dx = -radiusInSquares; dx <= radiusInSquares; dx++) {
    for (let dy = -radiusInSquares; dy <= radiusInSquares; dy++) {
      const point = {
        x: origin.x + dx * gridSize,
        y: origin.y + dy * gridSize,
      };

      if (isPointInCone(point, origin, direction, length, angle)) {
        points.push(point);
      }
    }
  }

  return points;
}

/**
 * Get all grid points within a cube area
 */
export function getPointsInCube(
  origin: Point,
  size: number,
  gridSize: number,
): Point[] {
  const points: Point[] = [];
  const squaresPerSide = Math.ceil(size / gridSize);

  for (let dx = 0; dx < squaresPerSide; dx++) {
    for (let dy = 0; dy < squaresPerSide; dy++) {
      points.push({
        x: origin.x + dx * gridSize,
        y: origin.y + dy * gridSize,
      });
    }
  }

  return points;
}

/**
 * Get all grid points within a line area
 */
export function getPointsInLine(
  start: Point,
  end: Point,
  width: number,
  gridSize: number,
): Point[] {
  const points: Point[] = [];
  const lineLength = distance(start, end);
  const numSegments = Math.ceil(lineLength / gridSize);

  for (let i = 0; i <= numSegments; i++) {
    const t = i / numSegments;
    const centerPoint = lerpPoint(start, end, t);

    // Add points perpendicular to line within width
    const angle = angleBetween(start, end) + Math.PI / 2;
    const halfWidth = width / 2;
    const widthSegments = Math.ceil(width / gridSize);

    for (let w = -widthSegments; w <= widthSegments; w++) {
      const offset = (w / widthSegments) * halfWidth;
      const point = {
        x: centerPoint.x + Math.cos(angle) * offset,
        y: centerPoint.y + Math.sin(angle) * offset,
      };

      const snapped = gridSnap(point, gridSize);

      // Avoid duplicates
      if (!points.some((p) => p.x === snapped.x && p.y === snapped.y)) {
        points.push(snapped);
      }
    }
  }

  return points;
}

// ============================================================================
// SELECTION & BOUNDS
// ============================================================================

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculate the bounding box for an array of points
 */
export function getBoundingBox(points: Point[]): Rectangle {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Normalize a rectangle to have positive width/height
 */
export function normalizeRectangle(rect: Rectangle): Rectangle {
  return {
    x: rect.width < 0 ? rect.x + rect.width : rect.x,
    y: rect.height < 0 ? rect.y + rect.height : rect.y,
    width: Math.abs(rect.width),
    height: Math.abs(rect.height),
  };
}
