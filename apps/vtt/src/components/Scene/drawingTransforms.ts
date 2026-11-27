import type { Drawing, Point } from '@/types/drawing';
import { getDrawingBounds } from './drawingBounds';

export type DrawingTransform = (point: Point) => Partial<Drawing>;
export type DrawingPreview = ReadonlyMap<string, Drawing>;

interface ResizeHandle {
  point: Point;
  transform: DrawingTransform;
  cursor?: string;
}

export function moveDrawing(
  drawing: Drawing,
  dx: number,
  dy: number,
): Partial<Drawing> {
  const move = ({ x, y }: Point): Point => ({ x: x + dx, y: y + dy });
  switch (drawing.type) {
    case 'line':
    case 'aoe-line':
    case 'spell-line':
      return { start: move(drawing.start), end: move(drawing.end) };
    case 'rectangle':
      return move(drawing);
    case 'circle':
    case 'aoe-sphere':
    case 'aoe-cylinder':
    case 'dynamic-lighting':
    case 'spell-circle':
    case 'spell-ring':
      return { center: move(drawing.center) };
    case 'cone':
    case 'aoe-cube':
    case 'spell-cone':
    case 'spell-square':
    case 'spell-triangle':
      return { origin: move(drawing.origin) };
    case 'polygon':
    case 'pencil':
    case 'vision-blocking':
      return { points: drawing.points.map(move) };
    case 'fog-of-war':
      return { area: drawing.area.map(move) };
    case 'text':
    case 'dm-notes':
    case 'ping':
      return { position: move(drawing.position) };
  }
}

const MIN_SIZE = 1;

function radialHandles(
  center: Point,
  radius: number,
  resize: (radius: number) => Partial<Drawing>,
): ResizeHandle[] {
  return [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ].map(({ x, y }) => ({
    point: { x: center.x + x * radius, y: center.y + y * radius },
    cursor: x ? 'ew-resize' : 'ns-resize',
    transform: (point) =>
      resize(
        Math.max(MIN_SIZE, (point.x - center.x) * x + (point.y - center.y) * y),
      ),
  }));
}

export function getDrawingResizeHandles(
  drawing: Drawing,
  zoom: number,
): ResizeHandle[] {
  switch (drawing.type) {
    case 'line':
    case 'aoe-line':
    case 'spell-line':
      return [
        { point: drawing.start, transform: (start) => ({ start }) },
        { point: drawing.end, transform: (end) => ({ end }) },
      ];
    case 'rectangle': {
      const { minX, minY, maxX, maxY } = getDrawingBounds(drawing)!;
      const corners = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: minX, y: maxY },
        { x: maxX, y: maxY },
      ];
      return corners.map((point, index) => ({
        point,
        cursor: index === 0 || index === 3 ? 'nwse-resize' : 'nesw-resize',
        transform: ({ x, y }) => {
          const opposite = corners[3 - index];
          return {
            x: Math.min(x, opposite.x),
            y: Math.min(y, opposite.y),
            width: Math.max(MIN_SIZE, Math.abs(x - opposite.x)),
            height: Math.max(MIN_SIZE, Math.abs(y - opposite.y)),
          };
        },
      }));
    }
    case 'circle':
    case 'aoe-sphere':
    case 'aoe-cylinder':
    case 'spell-circle':
      return radialHandles(drawing.center, drawing.radius, (radius) => ({
        radius,
      }));
    case 'spell-ring':
      return radialHandles(
        drawing.center,
        drawing.outerRadius,
        (outerRadius) => ({
          outerRadius,
          innerRadius: drawing.outerRadius
            ? (drawing.innerRadius / drawing.outerRadius) * outerRadius
            : 0,
        }),
      );
    case 'aoe-cube':
    case 'spell-square': {
      const radians =
        ((drawing.type === 'spell-square' ? (drawing.rotation ?? 0) : 0) *
          Math.PI) /
        180;
      const x = Math.cos(radians);
      const y = Math.sin(radians);
      return [
        {
          point: {
            x: drawing.origin.x + ((x - y) * drawing.size) / 2,
            y: drawing.origin.y + ((y + x) * drawing.size) / 2,
          },
          cursor: 'nwse-resize',
          transform: (point) => ({
            size: Math.max(
              MIN_SIZE,
              (point.x - drawing.origin.x) * (x - y) +
                (point.y - drawing.origin.y) * (y + x),
            ),
          }),
        },
      ];
    }
    case 'cone':
    case 'spell-cone':
    case 'spell-triangle': {
      const radians = (drawing.direction * Math.PI) / 180;
      const x = Math.cos(radians);
      const y = Math.sin(radians);
      const pointAt = (length: number): Point => ({
        x: drawing.origin.x + x * length,
        y: drawing.origin.y + y * length,
      });
      return [
        {
          point: pointAt(drawing.length),
          transform: (point) => {
            const length = Math.max(
              MIN_SIZE,
              (point.x - drawing.origin.x) * x +
                (point.y - drawing.origin.y) * y,
            );
            return drawing.type === 'spell-triangle' && drawing.length
              ? { length, width: (drawing.width / drawing.length) * length }
              : { length };
          },
        },
        {
          point: pointAt(drawing.length + 20 / zoom),
          cursor: 'grab',
          transform: (point) => ({
            direction:
              (Math.atan2(
                point.y - drawing.origin.y,
                point.x - drawing.origin.x,
              ) *
                180) /
              Math.PI,
          }),
        },
      ];
    }
    case 'polygon':
    case 'vision-blocking':
    case 'fog-of-war': {
      const points =
        drawing.type === 'fog-of-war' ? drawing.area : drawing.points;
      return points.map((point, index) => ({
        point,
        transform: (next) => {
          const vertices = points.map((vertex, i) =>
            i === index ? next : vertex,
          );
          return drawing.type === 'fog-of-war'
            ? { area: vertices }
            : { points: vertices };
        },
      }));
    }
    case 'pencil': {
      const bounds = getDrawingBounds(drawing);
      if (!bounds) return [];
      const { minX, minY, maxX, maxY } = bounds;
      return [
        {
          point: { x: maxX, y: maxY },
          cursor: 'nwse-resize',
          transform: (point) => {
            const xScale =
              maxX === minX
                ? 1
                : Math.max(MIN_SIZE, point.x - minX) / (maxX - minX);
            const yScale =
              maxY === minY
                ? 1
                : Math.max(MIN_SIZE, point.y - minY) / (maxY - minY);
            return {
              points: drawing.points.map(({ x, y }) => ({
                x: minX + (x - minX) * xScale,
                y: minY + (y - minY) * yScale,
              })),
            };
          },
        },
      ];
    }
    case 'text': {
      const { maxX } = getDrawingBounds(drawing)!;
      const halfWidth = (maxX - drawing.position.x) / zoom;
      return [
        {
          point: { x: drawing.position.x + halfWidth, y: drawing.position.y },
          cursor: 'ew-resize',
          transform: (point) => ({
            fontSize: Math.max(
              MIN_SIZE,
              (drawing.fontSize * (point.x - drawing.position.x)) / halfWidth,
            ),
          }),
        },
      ];
    }
    case 'dynamic-lighting': {
      const radius = Math.max(drawing.brightRadius, drawing.dimRadius);
      return radialHandles(drawing.center, radius, (size) => ({
        brightRadius: radius ? (drawing.brightRadius / radius) * size : size,
        dimRadius: radius ? (drawing.dimRadius / radius) * size : size,
      }));
    }
    case 'dm-notes':
    case 'ping':
      return [];
  }
}
