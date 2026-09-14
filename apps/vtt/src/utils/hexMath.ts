/**
 * Hexagonal Grid Mathematics
 *
 * This module provides mathematical utilities for working with flat-top hexagonal grids.
 * Uses axial coordinate system (q, r) for efficient hex operations.
 */

import type { Point } from '@/types/drawing';

// ============================================================================
// HEX COORDINATE SYSTEM
// ============================================================================

/**
 * Axial coordinates for hexagonal grids (flat-top orientation)
 * q: column coordinate
 * r: row coordinate
 */
export interface HexCoord {
  q: number;
  r: number;
}

/**
 * Cube coordinates for hexagonal grids (used for distance calculations)
 * x + y + z = 0
 */
export interface CubeCoord {
  x: number;
  y: number;
  z: number;
}

// ============================================================================
// COORDINATE CONVERSION
// ============================================================================

/**
 * Convert axial coordinates to cube coordinates
 */
export function axialToCube(hex: HexCoord): CubeCoord {
  const x = hex.q;
  const z = hex.r;
  const y = -x - z;
  return { x, y, z };
}

/**
 * Convert cube coordinates to axial coordinates
 */
export function cubeToAxial(cube: CubeCoord): HexCoord {
  return { q: cube.x, r: cube.z };
}

/**
 * Convert pixel coordinates to axial hex coordinates
 * @param point - Pixel coordinates in scene space
 * @param hexSize - Size of hex (distance from center to flat edge)
 * @param offsetX - Grid offset X
 * @param offsetY - Grid offset Y
 * @param hexScale - Scale factor for hexes (default: 1.0)
 */
export function pixelToHex(
  point: Point,
  hexSize: number,
  offsetX: number = 0,
  offsetY: number = 0,
  hexScale: number = 1.0,
): HexCoord {
  const scaledSize = hexSize * hexScale;

  // Adjust for grid offset
  const x = point.x - offsetX;
  const y = point.y - offsetY;

  // Flat-top hex conversion formulas
  const q = ((2 / 3) * x) / scaledSize;
  const r = ((-1 / 3) * x + (Math.sqrt(3) / 3) * y) / scaledSize;

  // Round to nearest hex
  return hexRound({ q, r });
}

/**
 * Convert axial hex coordinates to pixel coordinates (center of hex)
 * @param hex - Axial hex coordinates
 * @param hexSize - Size of hex (distance from center to flat edge)
 * @param offsetX - Grid offset X
 * @param offsetY - Grid offset Y
 * @param hexScale - Scale factor for hexes (default: 1.0)
 */
export function hexToPixel(
  hex: HexCoord,
  hexSize: number,
  offsetX: number = 0,
  offsetY: number = 0,
  hexScale: number = 1.0,
): Point {
  const scaledSize = hexSize * hexScale;

  const x = scaledSize * (3 / 2) * hex.q + offsetX;
  const y =
    scaledSize * (Math.sqrt(3) / 2) * hex.q +
    scaledSize * Math.sqrt(3) * hex.r +
    offsetY;

  return { x, y };
}

/**
 * Round fractional hex coordinates to the nearest hex
 */
export function hexRound(hex: HexCoord): HexCoord {
  const cube = axialToCube(hex);
  const rounded = cubeRound(cube);
  return cubeToAxial(rounded);
}

/**
 * Round cube coordinates to the nearest integer cube coordinates
 */
export function cubeRound(cube: CubeCoord): CubeCoord {
  let rx = Math.round(cube.x);
  let ry = Math.round(cube.y);
  let rz = Math.round(cube.z);

  const xDiff = Math.abs(rx - cube.x);
  const yDiff = Math.abs(ry - cube.y);
  const zDiff = Math.abs(rz - cube.z);

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { x: rx, y: ry, z: rz };
}

// ============================================================================
// DISTANCE AND MOVEMENT
// ============================================================================

/**
 * Calculate distance between two hexes in hex units
 * Each adjacent hex is 1 unit away
 */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  const cubeA = axialToCube(a);
  const cubeB = axialToCube(b);

  return Math.max(
    Math.abs(cubeA.x - cubeB.x),
    Math.abs(cubeA.y - cubeB.y),
    Math.abs(cubeA.z - cubeB.z),
  );
}

/**
 * Calculate movement distance in feet between two hexes
 * @param startHex - Starting hex coordinates
 * @param endHex - Ending hex coordinates
 * @param hexSize - Size of hex in pixels
 * @param difficultTerrain - Array of hex coordinates marked as difficult terrain
 * @param feetPerHex - Feet per hex (default: 5 for D&D 5e)
 */
export function calculateHexMovementDistance(
  startHex: HexCoord,
  endHex: HexCoord,
  hexSize: number,
  difficultTerrain: HexCoord[] = [],
  feetPerHex: number = 5,
): number {
  const distance = hexDistance(startHex, endHex);

  // Check if path goes through difficult terrain
  const path = hexLine(startHex, endHex);
  const hasDifficultTerrain = path.some((hex) =>
    difficultTerrain.some((dt) => dt.q === hex.q && dt.r === hex.r),
  );

  // Difficult terrain doubles movement cost
  const multiplier = hasDifficultTerrain ? 2 : 1;

  return distance * feetPerHex * multiplier;
}

/**
 * Get all hexes along a line between two hexes (Bresenham's line algorithm for hex)
 */
export function hexLine(start: HexCoord, end: HexCoord): HexCoord[] {
  const distance = hexDistance(start, end);
  const results: HexCoord[] = [];

  if (distance === 0) {
    return [start];
  }

  for (let i = 0; i <= distance; i++) {
    const t = i / distance;
    const interpolated = hexLerp(start, end, t);
    results.push(hexRound(interpolated));
  }

  return results;
}

/**
 * Linear interpolation between two hex coordinates
 */
export function hexLerp(a: HexCoord, b: HexCoord, t: number): HexCoord {
  return {
    q: a.q + (b.q - a.q) * t,
    r: a.r + (b.r - a.r) * t,
  };
}

// ============================================================================
// HEX GEOMETRY AND NEIGHBORS
// ============================================================================

/**
 * Get the six neighboring hexes
 */
export function hexNeighbors(hex: HexCoord): HexCoord[] {
  const directions = [
    { q: 1, r: 0 }, // East
    { q: 1, r: -1 }, // Northeast
    { q: 0, r: -1 }, // Northwest
    { q: -1, r: 0 }, // West
    { q: -1, r: 1 }, // Southwest
    { q: 0, r: 1 }, // Southeast
  ];

  return directions.map((dir) => ({
    q: hex.q + dir.q,
    r: hex.r + dir.r,
  }));
}

/**
 * Get hex at specific direction (0-5, clockwise from East)
 */
export function hexNeighbor(hex: HexCoord, direction: number): HexCoord {
  const directions = [
    { q: 1, r: 0 }, // 0: East
    { q: 1, r: -1 }, // 1: Northeast
    { q: 0, r: -1 }, // 2: Northwest
    { q: -1, r: 0 }, // 3: West
    { q: -1, r: 1 }, // 4: Southwest
    { q: 0, r: 1 }, // 5: Southeast
  ];

  const dir = directions[direction % 6];
  return {
    q: hex.q + dir.q,
    r: hex.r + dir.r,
  };
}

/**
 * Generate vertices for drawing a flat-top hex
 * @param center - Center point of hex
 * @param hexSize - Size of hex (distance from center to flat edge)
 * @param hexScale - Scale factor (default: 1.0)
 */
export function hexVertices(
  center: Point,
  hexSize: number,
  hexScale: number = 1.0,
): Point[] {
  const scaledSize = hexSize * hexScale;
  const vertices: Point[] = [];

  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i; // 60 degrees * i
    const x = center.x + scaledSize * Math.cos(angle);
    const y = center.y + scaledSize * Math.sin(angle);
    vertices.push({ x, y });
  }

  return vertices;
}

/**
 * Check if a point is inside a hex
 * @param point - Point to test
 * @param hexCenter - Center of the hex
 * @param hexSize - Size of hex
 * @param hexScale - Scale factor (default: 1.0)
 */
export function isPointInHex(
  point: Point,
  hexCenter: Point,
  hexSize: number,
  hexScale: number = 1.0,
): boolean {
  const scaledSize = hexSize * hexScale;
  const dx = point.x - hexCenter.x;
  const dy = point.y - hexCenter.y;

  // For flat-top hex, check if point is within bounding box and hexagon shape
  const halfWidth = scaledSize;
  const halfHeight = (scaledSize * Math.sqrt(3)) / 2;

  // Quick bounding box check
  if (Math.abs(dx) > halfWidth || Math.abs(dy) > halfHeight) {
    return false;
  }

  // Check if point is within hexagon using point-in-polygon algorithm
  const vertices = hexVertices(hexCenter, hexSize, hexScale);
  return isPointInPolygon(point, vertices);
}

/**
 * Point-in-polygon test using ray casting algorithm
 */
function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    if (
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }

  return inside;
}

// ============================================================================
// GRID GENERATION AND RENDERING
// ============================================================================

/**
 * Generate all hex coordinates within a rectangular viewport
 * @param center - Center of viewport in scene coordinates
 * @param viewportSize - Size of viewport {width, height}
 * @param hexSize - Size of hex
 * @param offsetX - Grid offset X
 * @param offsetY - Grid offset Y
 * @param hexScale - Scale factor (default: 1.0)
 */
export function getHexesInViewport(
  center: Point,
  viewportSize: { width: number; height: number },
  hexSize: number,
  offsetX: number = 0,
  offsetY: number = 0,
  hexScale: number = 1.0,
): HexCoord[] {
  const scaledSize = hexSize * hexScale;

  // Calculate viewport bounds
  const left = center.x - viewportSize.width / 2;
  const right = center.x + viewportSize.width / 2;
  const top = center.y - viewportSize.height / 2;
  const bottom = center.y + viewportSize.height / 2;

  // Calculate hex bounds (with padding)
  const hexWidth = scaledSize * 1.5; // Horizontal spacing
  const hexHeight = scaledSize * Math.sqrt(3); // Vertical spacing

  const minQ = Math.floor((left - offsetX) / hexWidth) - 1;
  const maxQ = Math.ceil((right - offsetX) / hexWidth) + 1;
  const minR = Math.floor((top - offsetY) / hexHeight) - 1;
  const maxR = Math.ceil((bottom - offsetY) / hexHeight) + 1;

  const hexes: HexCoord[] = [];

  for (let q = minQ; q <= maxQ; q++) {
    for (let r = minR; r <= maxR; r++) {
      // Check if hex center is within viewport bounds
      const hexCenter = hexToPixel(
        { q, r },
        hexSize,
        offsetX,
        offsetY,
        hexScale,
      );
      if (
        hexCenter.x >= left - hexWidth &&
        hexCenter.x <= right + hexWidth &&
        hexCenter.y >= top - hexHeight &&
        hexCenter.y <= bottom + hexHeight
      ) {
        hexes.push({ q, r });
      }
    }
  }

  return hexes;
}

/**
 * Calculate appropriate hex size to match square grid area
 * @param squareSize - Size of equivalent square
 */
export function calculateHexSizeForSquareArea(squareSize: number): number {
  // Area of square = squareSize²
  // Area of flat-top hex = (3√3/2) * radius²
  // So radius = squareSize / √(3√3/2) ≈ squareSize / 1.732
  return squareSize / Math.sqrt((3 * Math.sqrt(3)) / 2);
}
