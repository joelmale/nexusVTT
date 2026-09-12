import type { Drawing, Point } from '@/types/drawing';
import {
  isPointInCircle,
  isPointInPolygon,
  isPointInRectangle,
  isPointNearLine,
} from '@/utils/mathUtils';

interface DrawingAccess {
  isHost: boolean;
  userId: string;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function rotatePoint(target: Point, origin: Point, angleDeg: number): Point {
  const angleRad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

function pointInBounds(point: Point, bounds: Bounds): boolean {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  );
}

function directionalDrawingIntersectsBounds(
  origin: Point,
  direction: number,
  length: number,
  bounds: Bounds,
): boolean {
  const directionRad = (direction * Math.PI) / 180;
  const end = {
    x: origin.x + Math.cos(directionRad) * length,
    y: origin.y + Math.sin(directionRad) * length,
  };
  return pointInBounds(origin, bounds) || pointInBounds(end, bounds);
}

function drawingContainsPoint(
  drawing: Drawing,
  point: Point,
  radius: number,
): boolean {
  switch (drawing.type) {
    case 'line':
      return isPointNearLine(point, drawing.start, drawing.end, radius);
    case 'rectangle':
      return isPointInRectangle(
        point,
        {
          x: drawing.x,
          y: drawing.y,
          width: drawing.width,
          height: drawing.height,
        },
        radius,
      );
    case 'circle':
    case 'spell-circle':
      return isPointInCircle(point, drawing.center, drawing.radius + radius);
    case 'pencil':
      return drawing.points.some((candidate) =>
        isPointInCircle(point, candidate, radius),
      );
    case 'polygon':
      return (
        isPointInPolygon(point, drawing.points) ||
        drawing.points.some((candidate) =>
          isPointInCircle(point, candidate, radius),
        )
      );
    case 'cone':
    case 'spell-cone': {
      const dx = point.x - drawing.origin.x;
      const dy = point.y - drawing.origin.y;
      const pointDistance = Math.sqrt(dx * dx + dy * dy);
      if (pointDistance > drawing.length + radius) return false;

      const clickAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const angleDiff = Math.abs(
        ((clickAngle - drawing.direction + 180) % 360) - 180,
      );
      const tolerance = drawing.type === 'cone' ? 30 : 5;
      return angleDiff <= drawing.angle / 2 + tolerance;
    }
    case 'spell-ring': {
      const inOuter = isPointInCircle(
        point,
        drawing.center,
        drawing.outerRadius + radius,
      );
      const innerRadius = Math.max(0, drawing.innerRadius - radius);
      return inOuter && !isPointInCircle(point, drawing.center, innerRadius);
    }
    case 'spell-line':
      return isPointNearLine(
        point,
        drawing.start,
        drawing.end,
        drawing.width / 2 + radius,
      );
    case 'spell-square': {
      const rotation = drawing.rotation || 0;
      const adjustedPoint =
        rotation === 0 ? point : rotatePoint(point, drawing.origin, -rotation);
      const halfSize = drawing.size / 2;
      return isPointInRectangle(
        adjustedPoint,
        {
          x: drawing.origin.x - halfSize,
          y: drawing.origin.y - halfSize,
          width: drawing.size,
          height: drawing.size,
        },
        radius,
      );
    }
    case 'spell-triangle': {
      const angleRad = (drawing.direction * Math.PI) / 180;
      const baseCenter = {
        x: drawing.origin.x + Math.cos(angleRad) * drawing.length,
        y: drawing.origin.y + Math.sin(angleRad) * drawing.length,
      };
      const halfWidth = drawing.width / 2;
      const perpendicular = angleRad + Math.PI / 2;
      const baseLeft = {
        x: baseCenter.x + Math.cos(perpendicular) * halfWidth,
        y: baseCenter.y + Math.sin(perpendicular) * halfWidth,
      };
      const baseRight = {
        x: baseCenter.x - Math.cos(perpendicular) * halfWidth,
        y: baseCenter.y - Math.sin(perpendicular) * halfWidth,
      };
      const points = [drawing.origin, baseLeft, baseRight];
      return (
        isPointInPolygon(point, points) ||
        points.some((candidate) => isPointInCircle(point, candidate, radius))
      );
    }
    case 'text':
    case 'ping':
      return isPointInCircle(point, drawing.position, radius + 15);
    case 'fog-of-war':
      return (
        isPointInPolygon(point, drawing.area) ||
        drawing.area.some((candidate) =>
          isPointInCircle(point, candidate, radius),
        )
      );
    default:
      return false;
  }
}

export function getDrawingIdsAtPoint(
  drawings: readonly Drawing[],
  point: Point,
  radius: number,
  access: DrawingAccess,
): string[] {
  return drawings
    .filter(
      (drawing) =>
        (access.isHost || drawing.createdBy === access.userId) &&
        drawingContainsPoint(drawing, point, radius),
    )
    .map((drawing) => drawing.id);
}

function drawingIntersectsBounds(drawing: Drawing, bounds: Bounds): boolean {
  switch (drawing.type) {
    case 'line':
    case 'spell-line':
      return (
        pointInBounds(drawing.start, bounds) ||
        pointInBounds(drawing.end, bounds)
      );
    case 'rectangle':
      return !(
        drawing.x + drawing.width < bounds.minX ||
        drawing.x > bounds.maxX ||
        drawing.y + drawing.height < bounds.minY ||
        drawing.y > bounds.maxY
      );
    case 'circle':
    case 'spell-circle':
    case 'spell-ring':
      return pointInBounds(drawing.center, bounds);
    case 'pencil':
    case 'polygon':
      return drawing.points.some((point) => pointInBounds(point, bounds));
    case 'cone':
    case 'spell-cone':
    case 'spell-triangle':
      return directionalDrawingIntersectsBounds(
        drawing.origin,
        drawing.direction,
        drawing.length,
        bounds,
      );
    case 'spell-square': {
      const halfSize = drawing.size / 2;
      return !(
        drawing.origin.x + halfSize < bounds.minX ||
        drawing.origin.x - halfSize > bounds.maxX ||
        drawing.origin.y + halfSize < bounds.minY ||
        drawing.origin.y - halfSize > bounds.maxY
      );
    }
    case 'text':
    case 'ping':
      return pointInBounds(drawing.position, bounds);
    default:
      return false;
  }
}

export function getDrawingIdsInSelection(
  drawings: readonly Drawing[],
  start: Point,
  end: Point,
): string[] {
  const bounds: Bounds = {
    minX: Math.min(start.x, end.x),
    maxX: Math.max(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxY: Math.max(start.y, end.y),
  };
  return drawings
    .filter((drawing) => drawingIntersectsBounds(drawing, bounds))
    .map((drawing) => drawing.id);
}
