import { describe, expect, it } from 'vitest';
import type { Drawing } from '@/types/drawing';
import {
  getDrawingIdsAtPoint,
  getDrawingIdsInSelection,
} from './drawingHitTesting';

const drawings: Drawing[] = [
  {
    id: 'line-1',
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: 100, y: 0 },
    createdBy: 'owner',
    createdAt: 1,
    updatedAt: 1,
    roomCode: 'TEST',
    layer: 'overlay',
    style: {
      strokeColor: '#000000',
      strokeWidth: 2,
      fillColor: 'none',
      fillOpacity: 0,
    },
  },
];

describe('drawing hit testing', () => {
  it('enforces drawing ownership for point selection', () => {
    expect(
      getDrawingIdsAtPoint(drawings, { x: 25, y: 1 }, 5, {
        isHost: false,
        userId: 'other-user',
      }),
    ).toEqual([]);
    expect(
      getDrawingIdsAtPoint(drawings, { x: 25, y: 1 }, 5, {
        isHost: true,
        userId: 'host',
      }),
    ).toEqual(['line-1']);
  });

  it('finds drawings with an endpoint in a selection box', () => {
    expect(
      getDrawingIdsInSelection(drawings, { x: -5, y: -5 }, { x: 5, y: 5 }),
    ).toEqual(['line-1']);
  });
});
