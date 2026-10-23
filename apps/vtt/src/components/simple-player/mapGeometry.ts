import type { PlacedToken } from '@/types/token';

export interface Point {
  x: number;
  y: number;
}

export interface GridLike {
  size: number;
  snapToGrid: boolean;
}

export const FEET_PER_SQUARE = 5;

/** A token the player may move: linked to one of their characters or placed by them. */
export function isOwnedToken(
  token: PlacedToken,
  userId: string,
  ownedCharacterIds: ReadonlySet<string>,
): boolean {
  return (
    token.placedBy === userId ||
    (token.characterId !== undefined &&
      ownedCharacterIds.has(token.characterId))
  );
}

/**
 * The token's new top-left for a tap at `point`. With snapping on, the token
 * fills the tapped cell, matching where a desktop drag would snap it.
 */
export function tapDestination(point: Point, grid: GridLike): Point {
  if (grid.snapToGrid && grid.size > 0) {
    return {
      x: Math.floor(point.x / grid.size) * grid.size,
      y: Math.floor(point.y / grid.size) * grid.size,
    };
  }
  const half = grid.size > 0 ? grid.size / 2 : 0;
  return { x: point.x - half, y: point.y - half };
}

/** 5e "every square is 5 ft" distance (diagonals count as one square). */
export function gridDistanceFeet(
  from: Point,
  to: Point,
  gridSize: number,
): number {
  if (gridSize <= 0) return 0;
  const squares = Math.max(
    Math.abs(to.x - from.x) / gridSize,
    Math.abs(to.y - from.y) / gridSize,
  );
  return Math.round(squares) * FEET_PER_SQUARE;
}

/** Whether a scene point lands on the token's footprint. */
export function isPointOnToken(
  point: Point,
  token: Pick<PlacedToken, 'x' | 'y' | 'scale'>,
  gridSize: number,
): boolean {
  const size = gridSize * (token.scale || 1);
  return (
    point.x >= token.x &&
    point.x <= token.x + size &&
    point.y >= token.y &&
    point.y <= token.y + size
  );
}
