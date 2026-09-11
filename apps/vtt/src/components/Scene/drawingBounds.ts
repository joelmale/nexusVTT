import type { Drawing, Point } from '@/types/drawing';

export interface DrawingBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const boundsFromPoints = (points: readonly Point[]): DrawingBounds | null => {
  if (points.length === 0) return null;
  return points.reduce<DrawingBounds>(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    {
      minX: points[0].x,
      minY: points[0].y,
      maxX: points[0].x,
      maxY: points[0].y,
    },
  );
};

const radialBounds = (
  center: Point,
  radiusX: number,
  radiusY = radiusX,
): DrawingBounds => ({
  minX: center.x - radiusX,
  minY: center.y - radiusY,
  maxX: center.x + radiusX,
  maxY: center.y + radiusY,
});

const expandedBounds = (
  bounds: DrawingBounds,
  padding: number,
): DrawingBounds => ({
  minX: bounds.minX - padding,
  minY: bounds.minY - padding,
  maxX: bounds.maxX + padding,
  maxY: bounds.maxY + padding,
});

const rotatedSquarePoints = (
  center: Point,
  size: number,
  rotationDegrees: number,
): Point[] => {
  const half = size / 2;
  const radians = (rotationDegrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    { x: -half, y: -half },
    { x: half, y: -half },
    { x: half, y: half },
    { x: -half, y: half },
  ].map((point) => ({
    x: center.x + point.x * cosine - point.y * sine,
    y: center.y + point.x * sine + point.y * cosine,
  }));
};

export function getDrawingBounds(drawing: Drawing): DrawingBounds | null {
  switch (drawing.type) {
    case 'line':
      return expandedBounds(
        boundsFromPoints([drawing.start, drawing.end])!,
        drawing.style.strokeWidth / 2,
      );
    case 'rectangle':
      return {
        minX: Math.min(drawing.x, drawing.x + drawing.width),
        minY: Math.min(drawing.y, drawing.y + drawing.height),
        maxX: Math.max(drawing.x, drawing.x + drawing.width),
        maxY: Math.max(drawing.y, drawing.y + drawing.height),
      };
    case 'circle':
    case 'aoe-sphere':
      return radialBounds(drawing.center, drawing.radius);
    case 'polygon':
    case 'pencil':
      return boundsFromPoints(drawing.points);
    case 'text': {
      const halfWidth = Math.max(
        drawing.fontSize / 2,
        drawing.text.length * drawing.fontSize * 0.3,
      );
      return radialBounds(drawing.position, halfWidth, drawing.fontSize / 2);
    }
    case 'cone':
      return radialBounds(drawing.origin, drawing.length);
    case 'aoe-cube':
      return radialBounds(drawing.origin, drawing.size / 2);
    case 'aoe-cylinder':
      return radialBounds(drawing.center, drawing.radius);
    case 'aoe-line':
      return expandedBounds(
        boundsFromPoints([drawing.start, drawing.end])!,
        drawing.width / 2,
      );
    case 'fog-of-war':
      return boundsFromPoints(drawing.area);
    case 'dynamic-lighting':
      return radialBounds(
        drawing.center,
        Math.max(drawing.brightRadius, drawing.dimRadius),
      );
    case 'vision-blocking':
      return boundsFromPoints(drawing.points);
    case 'dm-notes':
    case 'ping':
      return radialBounds(drawing.position, 20);
    case 'spell-circle':
      return radialBounds(drawing.center, drawing.radius);
    case 'spell-ring':
      return radialBounds(drawing.center, drawing.outerRadius);
    case 'spell-cone':
      return radialBounds(drawing.origin, drawing.length);
    case 'spell-line':
      return expandedBounds(
        boundsFromPoints([drawing.start, drawing.end])!,
        drawing.width / 2,
      );
    case 'spell-square':
      return boundsFromPoints(
        rotatedSquarePoints(
          drawing.origin,
          drawing.size,
          drawing.rotation || 0,
        ),
      );
    case 'spell-triangle': {
      const radians = (drawing.direction * Math.PI) / 180;
      const perpendicular = radians + Math.PI / 2;
      const baseCenter = {
        x: drawing.origin.x + drawing.length * Math.cos(radians),
        y: drawing.origin.y + drawing.length * Math.sin(radians),
      };
      const halfWidth = drawing.width / 2;
      return boundsFromPoints([
        drawing.origin,
        {
          x: baseCenter.x + halfWidth * Math.cos(perpendicular),
          y: baseCenter.y + halfWidth * Math.sin(perpendicular),
        },
        {
          x: baseCenter.x - halfWidth * Math.cos(perpendicular),
          y: baseCenter.y - halfWidth * Math.sin(perpendicular),
        },
      ]);
    }
  }
}

export function getDrawingsBounds(
  drawings: readonly Drawing[],
): DrawingBounds | null {
  const bounds = drawings
    .map(getDrawingBounds)
    .filter((value): value is DrawingBounds => value !== null);
  if (bounds.length === 0) return null;

  return bounds.reduce<DrawingBounds>(
    (combined, current) => ({
      minX: Math.min(combined.minX, current.minX),
      minY: Math.min(combined.minY, current.minY),
      maxX: Math.max(combined.maxX, current.maxX),
      maxY: Math.max(combined.maxY, current.maxY),
    }),
    { ...bounds[0] },
  );
}
