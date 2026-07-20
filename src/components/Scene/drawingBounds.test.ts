import { describe, expect, it } from 'vitest';
import type {
  BaseDrawing,
  RectangleDrawing,
  SpellLineDrawing,
  SpellSquareDrawing,
} from '@/types/drawing';
import { defaultDrawingStyle } from '@/types/drawing';
import { getDrawingBounds, getDrawingsBounds } from './drawingBounds';

const baseDrawing: Omit<BaseDrawing, 'type'> = {
  id: 'drawing',
  style: defaultDrawingStyle,
  layer: 'effects',
  roomCode: 'TEST',
  createdAt: 1,
  updatedAt: 1,
  createdBy: 'user',
};

describe('drawingBounds', () => {
  it('normalizes rectangle bounds and combines multiple selections', () => {
    const first: RectangleDrawing = {
      ...baseDrawing,
      id: 'first',
      type: 'rectangle',
      x: 100,
      y: 80,
      width: -40,
      height: 30,
    };
    const second: RectangleDrawing = {
      ...baseDrawing,
      id: 'second',
      type: 'rectangle',
      x: 150,
      y: 20,
      width: 25,
      height: 40,
    };

    expect(getDrawingsBounds([first, second])).toEqual({
      minX: 60,
      minY: 20,
      maxX: 175,
      maxY: 110,
    });
  });

  it('includes a spell line width in its anchor bounds', () => {
    const drawing = {
      ...baseDrawing,
      type: 'spell-line',
      start: { x: 10, y: 20 },
      end: { x: 110, y: 20 },
      width: 20,
    } as SpellLineDrawing;

    expect(getDrawingBounds(drawing)).toEqual({
      minX: 0,
      minY: 10,
      maxX: 120,
      maxY: 30,
    });
  });

  it('accounts for rotation when anchoring a spell square', () => {
    const drawing = {
      ...baseDrawing,
      type: 'spell-square',
      origin: { x: 100, y: 100 },
      size: 40,
      rotation: 45,
    } as SpellSquareDrawing;

    const bounds = getDrawingBounds(drawing);
    expect(bounds?.minX).toBeCloseTo(71.716, 3);
    expect(bounds?.minY).toBeCloseTo(71.716, 3);
    expect(bounds?.maxX).toBeCloseTo(128.284, 3);
    expect(bounds?.maxY).toBeCloseTo(128.284, 3);
  });
});
