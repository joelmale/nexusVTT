import { describe, expect, it } from 'vitest';
import { defaultDrawingStyle, ELEMENT_THEMES } from '@/types/drawing';
import type {
  Drawing,
  SpellOverlayDrawing,
  SpellOverlayStyle,
} from '@/types/drawing';
import { getDrawingResizeHandles, moveDrawing } from './drawingTransforms';

const base = {
  id: 'shape',
  style: defaultDrawingStyle,
  layer: 'effects' as const,
  roomCode: 'TEST',
  createdBy: 'owner',
  createdAt: 1,
  updatedAt: 1,
};
const style: SpellOverlayStyle = {
  ...defaultDrawingStyle,
  ...ELEMENT_THEMES.arcane,
  elementType: 'arcane',
  gridSnap: false,
};
const origin = { x: 10, y: 20 };
const end = { x: 30, y: 20 };

const spellCases: [SpellOverlayDrawing, Partial<Drawing>][] = [
  [
    { ...base, style, type: 'spell-circle', center: origin, radius: 20 },
    { radius: 30 },
  ],
  [
    {
      ...base,
      style,
      type: 'spell-ring',
      center: origin,
      outerRadius: 20,
      innerRadius: 10,
    },
    { outerRadius: 30, innerRadius: 15 },
  ],
  [
    {
      ...base,
      style,
      type: 'spell-cone',
      origin,
      direction: 0,
      length: 20,
      angle: 90,
    },
    { length: 30 },
  ],
  [
    { ...base, style, type: 'spell-line', start: origin, end, width: 5 },
    { start: { x: 20, y: 20 } },
  ],
  [{ ...base, style, type: 'spell-square', origin, size: 20 }, { size: 30 }],
  [
    {
      ...base,
      style,
      type: 'spell-triangle',
      origin,
      direction: 0,
      length: 20,
      width: 10,
    },
    { length: 30, width: 15 },
  ],
];

describe('drawing transforms', () => {
  it.each(spellCases)(
    'resizes $type at its first handle',
    (drawing, expected) => {
      const [handle] = getDrawingResizeHandles(drawing, 2);
      expect(
        handle.transform({ x: handle.point.x + 10, y: handle.point.y }),
      ).toEqual(expected);
    },
  );

  it('scales a rotated square along its own diagonal', () => {
    const [handle] = getDrawingResizeHandles(
      { ...base, style, type: 'spell-square', origin, size: 20, rotation: 45 },
      1,
    );
    expect(handle.point.x).toBeCloseTo(origin.x);
    expect(
      handle.transform({
        x: handle.point.x,
        y: handle.point.y + Math.SQRT2 * 5,
      }),
    ).toEqual({ size: expect.closeTo(30) });
  });

  it('keeps a rectangle valid when a corner crosses the opposite corner', () => {
    const [handle] = getDrawingResizeHandles(
      { ...base, type: 'rectangle', x: 10, y: 20, width: 30, height: 40 },
      1,
    );
    expect(handle.transform({ x: 50, y: 70 })).toEqual({
      x: 40,
      y: 60,
      width: 10,
      height: 10,
    });
  });

  it('moves and scales the complete freehand path', () => {
    const drawing = {
      ...base,
      type: 'pencil' as const,
      points: [origin, end, { x: 20, y: 30 }],
    };
    expect(moveDrawing(drawing, 3, -2)).toEqual({
      points: [
        { x: 13, y: 18 },
        { x: 33, y: 18 },
        { x: 23, y: 28 },
      ],
    });
    const [handle] = getDrawingResizeHandles(drawing, 1);
    expect(handle.transform({ x: 50, y: 40 })).toEqual({
      points: [origin, { x: 50, y: 20 }, { x: 30, y: 40 }],
    });
  });
});
