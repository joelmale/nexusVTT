import React, { useState, useCallback } from 'react';
import { useActiveScene, useDrawingActions } from '@/stores/gameStore';
import { webSocketService } from '@/services/websocket';
import type { Camera } from '@/types/game';
import type { Drawing, Point } from '@/types/drawing';

interface SelectionOverlayProps {
  selectedDrawings: string[];
  sceneId: string;
  camera: Camera;
  onClearSelection?: () => void;
}

interface ResizingHandle {
  drawingId: string;
  handleIndex: number;
  type: 'corner' | 'radius' | 'endpoint' | 'length' | 'rotation';
}

const SelectionOverlayComponent: React.FC<SelectionOverlayProps> = ({
  selectedDrawings,
  sceneId,
  camera,
  onClearSelection: _onClearSelection,
}) => {
  const activeScene = useActiveScene();
  const { updateDrawing } = useDrawingActions();
  const [resizingHandle, setResizingHandle] = useState<ResizingHandle | null>(
    null,
  );
  const [draggingSelection, setDraggingSelection] = useState<{
    startPos: Point;
    drawingIds: string[];
  } | null>(null);

  // Convert screen coordinates to scene coordinates
  const screenToScene = useCallback(
    (clientX: number, clientY: number, svgRef: SVGSVGElement | null): Point => {
      if (!svgRef) return { x: 0, y: 0 };
      const rect = svgRef.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;
      const viewportWidth = rect.width;
      const viewportHeight = rect.height;
      const sceneX = (screenX - viewportWidth / 2) / camera.zoom + camera.x;
      const sceneY = (screenY - viewportHeight / 2) / camera.zoom + camera.y;
      return { x: sceneX, y: sceneY };
    },
    [camera],
  );

  // Handle mouse move for resizing and dragging
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const svgElement = (e.target as Element).closest('svg');
      const mousePos = screenToScene(e.clientX, e.clientY, svgElement);

      // Handle dragging selection
      if (draggingSelection && activeScene) {
        const dx = mousePos.x - draggingSelection.startPos.x;
        const dy = mousePos.y - draggingSelection.startPos.y;

        draggingSelection.drawingIds.forEach((drawingId) => {
          const drawing = activeScene.drawings.find((d) => d.id === drawingId);
          if (!drawing) return;

          let updates: Partial<Drawing> = {};

          switch (drawing.type) {
            case 'line':
              updates = {
                start: { x: drawing.start.x + dx, y: drawing.start.y + dy },
                end: { x: drawing.end.x + dx, y: drawing.end.y + dy },
              };
              break;
            case 'rectangle':
              updates = { x: drawing.x + dx, y: drawing.y + dy };
              break;
            case 'circle':
              updates = {
                center: { x: drawing.center.x + dx, y: drawing.center.y + dy },
              };
              break;
            case 'polygon':
              updates = {
                points: drawing.points.map((p: Point) => ({
                  x: p.x + dx,
                  y: p.y + dy,
                })),
              };
              break;
            case 'pencil':
              updates = {
                points: drawing.points.map((p: Point) => ({
                  x: p.x + dx,
                  y: p.y + dy,
                })),
              };
              break;
            case 'cone':
              updates = {
                origin: { x: drawing.origin.x + dx, y: drawing.origin.y + dy },
              };
              break;
            case 'text':
            case 'ping':
              updates = {
                position: {
                  x: drawing.position.x + dx,
                  y: drawing.position.y + dy,
                },
              };
              break;
          }

          if (Object.keys(updates).length > 0) {
            updateDrawing(sceneId, drawingId, updates);
            webSocketService.sendEvent({
              type: 'drawing/update',
              data: { sceneId, drawingId, updates },
            });
          }
        });

        // Update start position for next move
        setDraggingSelection({ ...draggingSelection, startPos: mousePos });
        return;
      }

      // Handle resizing via handles
      if (!resizingHandle || !activeScene) return;

      const drawing = activeScene.drawings.find(
        (d) => d.id === resizingHandle.drawingId,
      );
      if (!drawing) return;

      let updates: Partial<Drawing> = {};

      switch (drawing.type) {
        case 'rectangle': {
          if (resizingHandle.type === 'rotation') {
            // Rotate rectangle - store rotation in future (not yet supported)
            // For now, this is a placeholder
            break;
          }
          const corners = [
            { x: drawing.x, y: drawing.y }, // top-left
            { x: drawing.x + drawing.width, y: drawing.y }, // top-right
            { x: drawing.x, y: drawing.y + drawing.height }, // bottom-left
            { x: drawing.x + drawing.width, y: drawing.y + drawing.height }, // bottom-right
          ];
          const handleIndex = resizingHandle.handleIndex;

          if (handleIndex === 0) {
            // top-left
            updates = {
              x: mousePos.x,
              y: mousePos.y,
              width: corners[3].x - mousePos.x,
              height: corners[3].y - mousePos.y,
            };
          } else if (handleIndex === 1) {
            // top-right
            updates = {
              y: mousePos.y,
              width: mousePos.x - drawing.x,
              height: corners[2].y - mousePos.y,
            };
          } else if (handleIndex === 2) {
            // bottom-left
            updates = {
              x: mousePos.x,
              width: corners[1].x - mousePos.x,
              height: mousePos.y - drawing.y,
            };
          } else if (handleIndex === 3) {
            // bottom-right
            updates = {
              width: mousePos.x - drawing.x,
              height: mousePos.y - drawing.y,
            };
          }
          break;
        }

        case 'circle': {
          if (resizingHandle.type === 'rotation') {
            // Circles don't rotate, skip
            break;
          }
          const dx = mousePos.x - drawing.center.x;
          const dy = mousePos.y - drawing.center.y;
          const newRadius = Math.sqrt(dx * dx + dy * dy);
          updates = { radius: Math.max(5, newRadius) };
          break;
        }

        case 'line': {
          if (resizingHandle.handleIndex === 0) {
            updates = { start: mousePos };
          } else if (resizingHandle.handleIndex === 1) {
            updates = { end: mousePos };
          }
          break;
        }

        case 'polygon': {
          // Update specific vertex
          const newPoints = [...drawing.points];
          newPoints[resizingHandle.handleIndex] = mousePos;
          updates = { points: newPoints };
          break;
        }

        case 'cone': {
          if (resizingHandle.type === 'length') {
            // Resize cone length
            const dx = mousePos.x - drawing.origin.x;
            const dy = mousePos.y - drawing.origin.y;
            const newLength = Math.sqrt(dx * dx + dy * dy);
            updates = { length: Math.max(5, newLength) };
          } else if (resizingHandle.type === 'rotation') {
            // Rotate cone direction
            const dx = mousePos.x - drawing.origin.x;
            const dy = mousePos.y - drawing.origin.y;
            const newDirection = (Math.atan2(dy, dx) * 180) / Math.PI;
            updates = { direction: newDirection };
          }
          break;
        }
      }

      if (Object.keys(updates).length > 0) {
        updateDrawing(sceneId, drawing.id, updates);

        // Sync to other players
        webSocketService.sendEvent({
          type: 'drawing/update',
          data: {
            sceneId,
            drawingId: drawing.id,
            updates,
          },
        });
      }
    },
    [
      resizingHandle,
      draggingSelection,
      activeScene,
      screenToScene,
      updateDrawing,
      sceneId,
    ],
  );

  // Handle mouse up to stop resizing and dragging
  const handleMouseUp = useCallback(() => {
    setResizingHandle(null);
    setDraggingSelection(null);
  }, []);

  // Set up mouse event listeners
  React.useEffect(() => {
    if (resizingHandle || draggingSelection) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizingHandle, draggingSelection, handleMouseMove, handleMouseUp]);

  // Early return after all hooks
  if (
    !activeScene ||
    activeScene.id !== sceneId ||
    selectedDrawings.length === 0
  ) {
    return null;
  }

  const selectedDrawingObjects = activeScene.drawings.filter((drawing) =>
    selectedDrawings.includes(drawing.id),
  );

  const renderSelectionIndicator = (drawing: Drawing) => {
    const strokeWidth = 2 / camera.zoom;
    const selectionProps = {
      fill: 'none',
      stroke: '#007bff',
      strokeWidth: strokeWidth * 2,
      strokeDasharray: `${8 / camera.zoom},${4 / camera.zoom}`,
      className: 'selection-indicator',
      opacity: 0.8,
    };

    const handleSelectionMouseDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      const svgElement = (e.target as Element).closest('svg');
      const startPos = screenToScene(e.clientX, e.clientY, svgElement);
      setDraggingSelection({ startPos, drawingIds: selectedDrawings });
    };

    const interactionProps = {
      ...selectionProps,
      style: { cursor: 'move', pointerEvents: 'all' as const },
      onMouseDown: handleSelectionMouseDown,
    };

    switch (drawing.type) {
      case 'line': {
        return (
          <line
            key={`selection-${drawing.id}`}
            x1={drawing.start.x}
            y1={drawing.start.y}
            x2={drawing.end.x}
            y2={drawing.end.y}
            {...interactionProps}
          />
        );
      }

      case 'rectangle': {
        const padding = 5 / camera.zoom;
        return (
          <rect
            key={`selection-${drawing.id}`}
            x={drawing.x - padding}
            y={drawing.y - padding}
            width={drawing.width + padding * 2}
            height={drawing.height + padding * 2}
            {...interactionProps}
          />
        );
      }

      case 'circle': {
        const radiusPadding = 5 / camera.zoom;
        return (
          <circle
            key={`selection-${drawing.id}`}
            cx={drawing.center.x}
            cy={drawing.center.y}
            r={drawing.radius + radiusPadding}
            {...interactionProps}
          />
        );
      }

      case 'polygon': {
        if (drawing.points.length < 3) return null;
        const pathData = `M ${drawing.points.map((p: Point) => `${p.x} ${p.y}`).join(' L ')} Z`;
        return (
          <path
            key={`selection-${drawing.id}`}
            d={pathData}
            {...interactionProps}
          />
        );
      }

      case 'pencil': {
        if (drawing.points.length < 2) return null;
        const pencilPath = `M ${drawing.points.map((p: Point) => `${p.x} ${p.y}`).join(' L ')}`;
        return (
          <path
            key={`selection-${drawing.id}`}
            d={pencilPath}
            {...interactionProps}
          />
        );
      }

      case 'aoe-sphere': {
        return (
          <circle
            key={`selection-${drawing.id}`}
            cx={drawing.center.x}
            cy={drawing.center.y}
            r={drawing.radius + 5 / camera.zoom}
            {...interactionProps}
          />
        );
      }

      case 'aoe-cube': {
        const cubePadding = 5 / camera.zoom;
        return (
          <rect
            key={`selection-${drawing.id}`}
            x={drawing.origin.x - drawing.size / 2 - cubePadding}
            y={drawing.origin.y - drawing.size / 2 - cubePadding}
            width={drawing.size + cubePadding * 2}
            height={drawing.size + cubePadding * 2}
            {...interactionProps}
          />
        );
      }

      case 'cone': {
        // Draw cone selection outline matching the actual cone shape
        const directionRad = (drawing.direction * Math.PI) / 180;
        const halfAngleRad = (drawing.angle / 2) * (Math.PI / 180);

        // Calculate the two edge points of the cone
        const edge1X =
          drawing.origin.x +
          drawing.length * Math.cos(directionRad - halfAngleRad);
        const edge1Y =
          drawing.origin.y +
          drawing.length * Math.sin(directionRad - halfAngleRad);
        const edge2X =
          drawing.origin.x +
          drawing.length * Math.cos(directionRad + halfAngleRad);
        const edge2Y =
          drawing.origin.y +
          drawing.length * Math.sin(directionRad + halfAngleRad);

        // Create path for cone outline
        const pathData = `
          M ${drawing.origin.x} ${drawing.origin.y}
          L ${edge1X} ${edge1Y}
          A ${drawing.length} ${drawing.length} 0 0 1 ${edge2X} ${edge2Y}
          Z
        `;

        return (
          <path
            key={`selection-${drawing.id}`}
            d={pathData}
            {...interactionProps}
          />
        );
      }
      default:
        return null;
    }
  };

  return (
    <g className="selection-overlay">
      {selectedDrawingObjects.map(renderSelectionIndicator)}

      {/* Selection control handles */}
      {selectedDrawings.length === 1 && selectedDrawingObjects[0] && (
        <g className="selection-handles">
          {renderSelectionHandles(
            selectedDrawingObjects[0],
            camera,
            (drawingId, handleIndex, type) => {
              setResizingHandle({ drawingId, handleIndex, type });
            },
          )}
        </g>
      )}

      {/* Multi-selection bounding box */}
      {selectedDrawings.length > 1 && (
        <g className="multi-selection-bounds">
          {renderMultiSelectionBounds(selectedDrawingObjects, camera)}
        </g>
      )}
    </g>
  );
};

// Helper function to render selection handles for single selection
const renderSelectionHandles = (
  drawing: Drawing,
  camera: Camera,
  onHandleMouseDown: (
    drawingId: string,
    handleIndex: number,
    type: 'corner' | 'radius' | 'endpoint' | 'length' | 'rotation',
  ) => void,
) => {
  const handleSize = 8 / camera.zoom;
  const handleProps = {
    width: handleSize,
    height: handleSize,
    fill: '#007bff',
    stroke: '#ffffff',
    strokeWidth: 1 / camera.zoom,
    className: 'selection-handle',
    cursor: 'pointer',
  };

  const handles: React.ReactElement[] = [];

  switch (drawing.type) {
    case 'rectangle': {
      // Corner handles for rectangles
      const corners = [
        { x: drawing.x, y: drawing.y },
        { x: drawing.x + drawing.width, y: drawing.y },
        { x: drawing.x, y: drawing.y + drawing.height },
        { x: drawing.x + drawing.width, y: drawing.y + drawing.height },
      ];
      corners.forEach((corner, index) => {
        handles.push(
          <rect
            key={`handle-${index}`}
            x={corner.x - handleSize / 2}
            y={corner.y - handleSize / 2}
            {...handleProps}
            onMouseDown={(e) => {
              e.stopPropagation();
              onHandleMouseDown(drawing.id, index, 'corner');
            }}
            style={{ cursor: 'nwse-resize' }}
          />,
        );
      });

      // Rotation handle at top-right corner offset
      const rotationOffset = 20 / camera.zoom;
      const rotationX = drawing.x + drawing.width + rotationOffset;
      const rotationY = drawing.y - rotationOffset;

      handles.push(
        <circle
          key="handle-rotation"
          cx={rotationX}
          cy={rotationY}
          r={handleSize / 2}
          fill="#00ff00"
          stroke="#ffffff"
          strokeWidth={1 / camera.zoom}
          className="selection-handle rotation-handle"
          onMouseDown={(e) => {
            e.stopPropagation();
            onHandleMouseDown(drawing.id, 4, 'rotation');
          }}
          style={{ cursor: 'grab' }}
        />,
      );
      break;
    }

    case 'circle': {
      // Radius handles for circles
      const radiusPoints = [
        { x: drawing.center.x + drawing.radius, y: drawing.center.y },
        { x: drawing.center.x - drawing.radius, y: drawing.center.y },
        { x: drawing.center.x, y: drawing.center.y + drawing.radius },
        { x: drawing.center.x, y: drawing.center.y - drawing.radius },
      ];
      radiusPoints.forEach((point, index) => {
        handles.push(
          <rect
            key={`handle-${index}`}
            x={point.x - handleSize / 2}
            y={point.y - handleSize / 2}
            {...handleProps}
            onMouseDown={(e) => {
              e.stopPropagation();
              onHandleMouseDown(drawing.id, index, 'radius');
            }}
            style={{ cursor: 'pointer' }}
          />,
        );
      });
      break;
    }

    case 'line': {
      // End point handles for lines
      [drawing.start, drawing.end].forEach((point, index) => {
        handles.push(
          <rect
            key={`handle-${index}`}
            x={point.x - handleSize / 2}
            y={point.y - handleSize / 2}
            {...handleProps}
            onMouseDown={(e) => {
              e.stopPropagation();
              onHandleMouseDown(drawing.id, index, 'endpoint');
            }}
            style={{ cursor: 'move' }}
          />,
        );
      });
      break;
    }

    case 'polygon': {
      // Vertex handles for polygons
      drawing.points.forEach((point: Point, index: number) => {
        handles.push(
          <rect
            key={`handle-${index}`}
            x={point.x - handleSize / 2}
            y={point.y - handleSize / 2}
            {...handleProps}
            onMouseDown={(e) => {
              e.stopPropagation();
              onHandleMouseDown(drawing.id, index, 'endpoint');
            }}
            style={{ cursor: 'move' }}
          />,
        );
      });
      break;
    }

    case 'cone': {
      // Calculate the end point of the cone based on direction and length
      const endX =
        drawing.origin.x +
        drawing.length * Math.cos((drawing.direction * Math.PI) / 180);
      const endY =
        drawing.origin.y +
        drawing.length * Math.sin((drawing.direction * Math.PI) / 180);

      // Length handle at the end of the cone
      handles.push(
        <rect
          key="handle-length"
          x={endX - handleSize / 2}
          y={endY - handleSize / 2}
          {...handleProps}
          onMouseDown={(e) => {
            e.stopPropagation();
            onHandleMouseDown(drawing.id, 0, 'length');
          }}
          style={{ cursor: 'ew-resize' }}
        />,
      );

      // Rotation handle - a circular handle offset from the end point
      const rotationOffset = 20 / camera.zoom;
      const rotationX =
        endX + rotationOffset * Math.cos((drawing.direction * Math.PI) / 180);
      const rotationY =
        endY + rotationOffset * Math.sin((drawing.direction * Math.PI) / 180);

      handles.push(
        <circle
          key="handle-rotation"
          cx={rotationX}
          cy={rotationY}
          r={handleSize / 2}
          fill="#00ff00"
          stroke="#ffffff"
          strokeWidth={1 / camera.zoom}
          className="selection-handle rotation-handle"
          onMouseDown={(e) => {
            e.stopPropagation();
            onHandleMouseDown(drawing.id, 1, 'rotation');
          }}
          style={{ cursor: 'grab' }}
        />,
      );
      break;
    }

    default:
      break;
  }

  return handles;
};

// Helper function to render bounding box for multi-selection
const renderMultiSelectionBounds = (drawings: Drawing[], camera: Camera) => {
  if (drawings.length === 0) return null;

  // Calculate bounding box for all selected drawings
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  drawings.forEach((drawing) => {
    switch (drawing.type) {
      case 'line':
        minX = Math.min(minX, drawing.start.x, drawing.end.x);
        maxX = Math.max(maxX, drawing.start.x, drawing.end.x);
        minY = Math.min(minY, drawing.start.y, drawing.end.y);
        maxY = Math.max(maxY, drawing.start.y, drawing.end.y);
        break;
      case 'rectangle':
        minX = Math.min(minX, drawing.x);
        maxX = Math.max(maxX, drawing.x + drawing.width);
        minY = Math.min(minY, drawing.y);
        maxY = Math.max(maxY, drawing.y + drawing.height);
        break;
      case 'circle':
        minX = Math.min(minX, drawing.center.x - drawing.radius);
        maxX = Math.max(maxX, drawing.center.x + drawing.radius);
        minY = Math.min(minY, drawing.center.y - drawing.radius);
        maxY = Math.max(maxY, drawing.center.y + drawing.radius);
        break;
      case 'polygon':
        drawing.points.forEach((point: Point) => {
          minX = Math.min(minX, point.x);
          maxX = Math.max(maxX, point.x);
          minY = Math.min(minY, point.y);
          maxY = Math.max(maxY, point.y);
        });
        break;
      case 'pencil':
        drawing.points.forEach((point: Point) => {
          minX = Math.min(minX, point.x);
          maxX = Math.max(maxX, point.x);
          minY = Math.min(minY, point.y);
          maxY = Math.max(maxY, point.y);
        });
        break;
      case 'cone': {
        // Calculate cone bounds based on origin and all edge points
        const directionRad = (drawing.direction * Math.PI) / 180;
        const halfAngleRad = (drawing.angle / 2) * (Math.PI / 180);

        // Origin point
        minX = Math.min(minX, drawing.origin.x);
        maxX = Math.max(maxX, drawing.origin.x);
        minY = Math.min(minY, drawing.origin.y);
        maxY = Math.max(maxY, drawing.origin.y);

        // Two edge points
        const edge1X =
          drawing.origin.x +
          drawing.length * Math.cos(directionRad - halfAngleRad);
        const edge1Y =
          drawing.origin.y +
          drawing.length * Math.sin(directionRad - halfAngleRad);
        const edge2X =
          drawing.origin.x +
          drawing.length * Math.cos(directionRad + halfAngleRad);
        const edge2Y =
          drawing.origin.y +
          drawing.length * Math.sin(directionRad + halfAngleRad);

        minX = Math.min(minX, edge1X, edge2X);
        maxX = Math.max(maxX, edge1X, edge2X);
        minY = Math.min(minY, edge1Y, edge2Y);
        maxY = Math.max(maxY, edge1Y, edge2Y);
        break;
      }
      default:
        break;
    }
  });

  const padding = 10 / camera.zoom;

  return (
    <rect
      x={minX - padding}
      y={minY - padding}
      width={maxX - minX + padding * 2}
      height={maxY - minY + padding * 2}
      fill="none"
      stroke="#007bff"
      strokeWidth={2 / camera.zoom}
      strokeDasharray={`${8 / camera.zoom},${4 / camera.zoom}`}
      className="multi-selection-bounds"
      opacity={0.6}
    />
  );
};

// Memoize to prevent unnecessary rerenders
export const SelectionOverlay = React.memo(SelectionOverlayComponent);
