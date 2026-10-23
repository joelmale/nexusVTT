import { describe, expect, it } from 'vitest';
import {
  gridDistanceFeet,
  isOwnedToken,
  isPointOnToken,
  tapDestination,
} from '@/components/simple-player/mapGeometry';
import type { PlacedToken } from '@/types/token';

const token = {
  id: 't1',
  x: 100,
  y: 100,
  scale: 1,
  placedBy: 'dm',
  characterId: 'c1',
} as PlacedToken;

describe('mapGeometry', () => {
  it('recognises tokens owned by character or by placement', () => {
    expect(isOwnedToken(token, 'p1', new Set(['c1']))).toBe(true);
    expect(isOwnedToken(token, 'dm', new Set())).toBe(true);
    expect(isOwnedToken(token, 'p2', new Set(['c9']))).toBe(false);
    expect(
      isOwnedToken({ ...token, characterId: undefined }, 'p1', new Set(['c1'])),
    ).toBe(false);
  });

  it('snaps a tap to the tapped cell', () => {
    expect(
      tapDestination({ x: 173, y: 249 }, { size: 50, snapToGrid: true }),
    ).toEqual({
      x: 150,
      y: 200,
    });
  });

  it('centres the token on the tap without snapping', () => {
    expect(
      tapDestination({ x: 173, y: 249 }, { size: 50, snapToGrid: false }),
    ).toEqual({
      x: 148,
      y: 224,
    });
    expect(
      tapDestination({ x: 5, y: 6 }, { size: 0, snapToGrid: true }),
    ).toEqual({
      x: 5,
      y: 6,
    });
  });

  it('measures 5e grid distance with diagonals as one square', () => {
    expect(gridDistanceFeet({ x: 0, y: 0 }, { x: 250, y: 100 }, 50)).toBe(25);
    expect(gridDistanceFeet({ x: 0, y: 0 }, { x: 150, y: 150 }, 50)).toBe(15);
    expect(gridDistanceFeet({ x: 0, y: 0 }, { x: 150, y: 150 }, 0)).toBe(0);
  });

  it('hit-tests the token footprint', () => {
    expect(isPointOnToken({ x: 120, y: 140 }, token, 50)).toBe(true);
    expect(isPointOnToken({ x: 151, y: 140 }, token, 50)).toBe(false);
    expect(isPointOnToken({ x: 190, y: 190 }, { ...token, scale: 2 }, 50)).toBe(
      true,
    );
    expect(isPointOnToken({ x: 140, y: 140 }, { ...token, scale: 0 }, 50)).toBe(
      true,
    );
  });
});
