import React from 'react';
import type { Drawing, Point } from '@/types/drawing';
import { getDrawingBounds, getDrawingsBounds } from './drawingBounds';
import {
  getDrawingResizeHandles,
  type DrawingTransform,
} from './drawingTransforms';

interface SelectionOverlayProps {
  drawings: readonly Drawing[];
  zoom: number;
  onResizeStart: (
    event: React.MouseEvent,
    drawing: Drawing,
    point: Point,
    transform: DrawingTransform,
  ) => void;
}

export const SelectionOverlay = React.memo(function SelectionOverlay({
  drawings,
  zoom,
  onResizeStart,
}: SelectionOverlayProps) {
  const size = 10 / zoom;
  const padding = 4 / zoom;
  const outline = (bounds: ReturnType<typeof getDrawingBounds>, key: string) =>
    bounds && (
      <rect
        key={key}
        x={bounds.minX - padding}
        y={bounds.minY - padding}
        width={bounds.maxX - bounds.minX + padding * 2}
        height={bounds.maxY - bounds.minY + padding * 2}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth={2 / zoom}
        strokeDasharray={`${6 / zoom},${3 / zoom}`}
      />
    );

  const selected = drawings.length === 1 ? drawings[0] : undefined;
  return (
    <g className="selection-overlay" pointerEvents="none">
      {drawings.map((drawing) =>
        outline(getDrawingBounds(drawing), drawing.id),
      )}
      {drawings.length > 1 && outline(getDrawingsBounds(drawings), 'selection')}
      {selected &&
        getDrawingResizeHandles(selected, zoom).map(
          ({ point, transform, cursor }, index) => (
            <rect
              key={index}
              className="selection-handle"
              x={point.x - size / 2}
              y={point.y - size / 2}
              width={size}
              height={size}
              fill="var(--color-primary)"
              stroke="var(--primary-text)"
              strokeWidth={1 / zoom}
              pointerEvents="all"
              style={{ cursor: cursor ?? 'move' }}
              onMouseDown={(event) => {
                if (!event.altKey)
                  onResizeStart(event, selected, point, transform);
              }}
            />
          ),
        )}
    </g>
  );
});
