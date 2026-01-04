import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  type Point,
  type Drawing,
  type DrawingStyle,
  type DrawingTool,
  type ElementType,
  ELEMENT_THEMES,
} from '@/types/drawing';
import type { Camera, PlacedToken, PlacedProp } from '@/types/game';
// tokenStore no longer used - selection managed by gameStore
import {
  useUser,
  useActiveScene,
  useDrawingActions,
  useGameStore,
  useServerRoomCode,
} from '@/stores/gameStore';
import { webSocketService } from '@/utils/websocket';
import { clipboardService } from '@/services/clipboardService';
import {
  distance,
  isPointNearLine,
  isPointInRectangle,
  isPointInPolygon,
  isPointInCircle,
  gridSnap,
} from '@/utils/mathUtils';
import { tokenAssetManager } from '@/services/tokenAssets';
import { getTokenPixelSize } from '@/types/token';

interface DrawingToolsProps {
  activeTool:
    | DrawingTool
    | 'select'
    | 'pan'
    | 'measure'
    | 'move'
    | 'copy'
    | 'cut'
    | 'paste'
    | 'mask-create'
    | 'mask-toggle'
    | 'mask-remove'
    | 'mask-show'
    | 'mask-hide'
    | 'grid-align';
  drawingStyle: DrawingStyle;
  camera: Camera;
  _gridSize: number;
  svgRef: React.RefObject<SVGSVGElement | null>;
  onSelectionChange?: (
    selectedDrawings: string[],
    selectionBox?: { start: Point; end: Point },
  ) => void;
  snapToGrid?: boolean;
  selectedObjectIds: string[];
  setSelection: (ids: string[]) => void;
  clearSelection: () => void;
  placedTokens: PlacedToken[];
  placedProps: PlacedProp[];
}

const DrawingToolsComponent: React.FC<DrawingToolsProps> = ({
  activeTool,
  drawingStyle,
  camera,
  _gridSize,
  svgRef,
  snapToGrid: shouldSnapToGrid = false,
  selectedObjectIds,
  setSelection,
  clearSelection,
  placedTokens,
  placedProps,
}) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<Point[]>([]);
  const [pencilPath, setPencilPath] = useState<Point[]>([]);

  const [isErasing, setIsErasing] = useState(false);
  const eraserRadius = 20;
  const [selectionBox, setSelectionBox] = useState<{
    start: Point;
    end: Point;
  } | null>(null);
  const dragEntityRef = useRef<{
    type: 'token' | 'prop';
    id: string;
    lastPoint: Point;
  } | null>(null);

  // Grid alignment states
  const [gridAlignPoints, setGridAlignPoints] = useState<Point[]>([]);
  const [gridAlignMode, setGridAlignMode] = useState<
    'waiting-first' | 'waiting-second' | 'fine-tuning' | null
  >(null);
  const [fineTuningOffset, setFineTuningOffset] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Spell overlay states
  const [spellElementType] = useState<ElementType>('arcane');
  const [spellGridSnap] = useState(true);

  const user = useUser();
  const activeScene = useActiveScene();
  const roomCode = useServerRoomCode();
  const { createDrawing, deleteDrawing, updateDrawing } = useDrawingActions();
  const updateScene = useGameStore((state) => state.updateScene);
  const moveTokenOptimistic = useGameStore(
    (state) => state.moveTokenOptimistic,
  );
  const movePropOptimistic = useGameStore((state) => state.movePropOptimistic);
  const getSceneTokens = useGameStore((state) => state.getSceneTokens);
  const getSceneProps = useGameStore((state) => state.getSceneProps);
  const deleteToken = useGameStore((state) => state.deleteToken);
  const deleteProp = useGameStore((state) => state.deleteProp);

  const isHost = user.type === 'host';

  // Convert screen coordinates to scene coordinates
  const screenToScene = useCallback(
    (
      screenX: number,
      screenY: number,
      applySnap: boolean = shouldSnapToGrid,
    ): Point => {
      if (!svgRef.current) return { x: 0, y: 0 };

      const rect = svgRef.current.getBoundingClientRect();
      const svgX = screenX - rect.left;
      const svgY = screenY - rect.top;

      let sceneX = (svgX - rect.width / 2) / camera.zoom + camera.x;
      let sceneY = (svgY - rect.height / 2) / camera.zoom + camera.y;

      // Apply grid snapping if enabled
      if (applySnap && _gridSize > 0) {
        const snapped = gridSnap({ x: sceneX, y: sceneY }, _gridSize);
        sceneX = snapped.x;
        sceneY = snapped.y;
      }

      return { x: sceneX, y: sceneY };
    },
    [camera, svgRef, shouldSnapToGrid, _gridSize],
  );

  // Create and sync a drawing
  const createAndSyncDrawing = useCallback(
    (drawing: Drawing) => {
      if (!activeScene) return;

      createDrawing(activeScene.id, drawing);

      webSocketService.sendEvent({
        type: 'drawing/create',
        data: {
          sceneId: activeScene.id,
          drawing,
        },
      });
    },
    [activeScene, createDrawing],
  );

  // Delete and sync drawing removal
  const deleteAndSyncDrawing = useCallback(
    (drawingId: string) => {
      if (!activeScene) return;

      deleteDrawing(activeScene.id, drawingId);

      webSocketService.sendEvent({
        type: 'drawing/delete',
        data: {
          sceneId: activeScene.id,
          drawingId,
        },
      });
    },
    [activeScene, deleteDrawing],
  );

  // Handle copy/cut/paste operations
  const handleCopy = useCallback(() => {
    if (!activeScene || selectedObjectIds.length === 0) return;

    const drawingsToCopy = activeScene.drawings.filter((d) =>
      selectedObjectIds.includes(d.id),
    );
    clipboardService.copy(drawingsToCopy);
  }, [activeScene, selectedObjectIds]);

  const handleCut = useCallback(() => {
    if (!activeScene || selectedObjectIds.length === 0) return;

    const drawingsToCopy = activeScene.drawings.filter((d) =>
      selectedObjectIds.includes(d.id),
    );
    clipboardService.copy(drawingsToCopy);

    // Delete the selected drawings
    selectedObjectIds.forEach((drawingId) => {
      deleteAndSyncDrawing(drawingId);
    });

    clearSelection();
  }, [activeScene, selectedObjectIds, deleteAndSyncDrawing, clearSelection]);

  const handlePaste = useCallback(() => {
    if (!activeScene) return;

    const pastedDrawings = clipboardService.paste();
    pastedDrawings.forEach((drawing) => {
      createAndSyncDrawing(drawing);
    });

    // Select the newly pasted drawings
    const pastedIds = pastedDrawings.map((d) => d.id);
    setSelection(pastedIds);
  }, [activeScene, createAndSyncDrawing, setSelection]);

  // Keyboard shortcuts for copy/cut/paste
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        handleCopy();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault();
        handleCut();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        handlePaste();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCopy, handleCut, handlePaste]);

  // Handle activeTool changes for copy/cut/paste
  useEffect(() => {
    if (activeTool === 'copy') {
      handleCopy();
      // Switch back to select tool after copying
      const { setActiveTool } = useGameStore.getState();
      setActiveTool('select');
    } else if (activeTool === 'cut') {
      handleCut();
      // Switch back to select tool after cutting
      const { setActiveTool } = useGameStore.getState();
      setActiveTool('select');
    } else if (activeTool === 'paste') {
      handlePaste();
      // Switch back to select tool after pasting
      const { setActiveTool } = useGameStore.getState();
      setActiveTool('select');
    }
  }, [activeTool, handleCopy, handleCut, handlePaste]);

  // Initialize grid alignment mode when tool is activated
  useEffect(() => {
    if (activeTool === 'grid-align') {
      setGridAlignMode('waiting-first');
      setGridAlignPoints([]);
      setFineTuningOffset(null);
    } else {
      // Clean up when switching away from grid-align tool
      setGridAlignMode(null);
      setGridAlignPoints([]);
      setFineTuningOffset(null);
    }
  }, [activeTool]);

  // Get drawings that intersect with a point (for eraser and selection)
  const getDrawingsAtPoint = useCallback(
    (point: Point, radius: number = 5): string[] => {
      if (!activeScene) return [];

      const intersectedDrawings: string[] = [];
      const rotatePoint = (
        target: Point,
        origin: Point,
        angleDeg: number,
      ): Point => {
        const angleRad = (angleDeg * Math.PI) / 180;
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        const dx = target.x - origin.x;
        const dy = target.y - origin.y;
        return {
          x: origin.x + dx * cos - dy * sin,
          y: origin.y + dx * sin + dy * cos,
        };
      };

      activeScene.drawings.forEach((drawing) => {
        // Filter: non-hosts can only select their own drawings
        if (!isHost && drawing.createdBy !== user.id) {
          return;
        }

        let intersects = false;

        switch (drawing.type) {
          case 'line': {
            intersects = isPointNearLine(
              point,
              drawing.start,
              drawing.end,
              radius,
            );
            break;
          }
          case 'rectangle': {
            intersects = isPointInRectangle(
              point,
              {
                x: drawing.x,
                y: drawing.y,
                width: drawing.width,
                height: drawing.height,
              },
              radius,
            );
            break;
          }
          case 'circle': {
            intersects = isPointInCircle(
              point,
              drawing.center,
              drawing.radius + radius,
            );
            break;
          }
          case 'pencil': {
            intersects = drawing.points.some((p) =>
              isPointInCircle(point, p, radius),
            );
            break;
          }
          case 'polygon': {
            intersects =
              isPointInPolygon(point, drawing.points) ||
              drawing.points.some((p) => isPointInCircle(point, p, radius));
            break;
          }
          case 'cone': {
            // Check if point is within the cone's bounding area
            const dx = point.x - drawing.origin.x;
            const dy = point.y - drawing.origin.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Check if click is within the cone's area
            if (distance <= drawing.length + radius) {
              const clickAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
              const angleDiff = Math.abs(
                ((clickAngle - drawing.direction + 180) % 360) - 180,
              );
              const halfConeAngle = drawing.angle / 2;
              intersects = angleDiff <= halfConeAngle + 30; // Add 30° tolerance
            }
            break;
          }
          case 'spell-circle': {
            intersects = isPointInCircle(
              point,
              drawing.center,
              drawing.radius + radius,
            );
            break;
          }
          case 'spell-ring': {
            const inOuter = isPointInCircle(
              point,
              drawing.center,
              drawing.outerRadius + radius,
            );
            const innerRadius = Math.max(0, drawing.innerRadius - radius);
            const inInner = isPointInCircle(point, drawing.center, innerRadius);
            intersects = inOuter && !inInner;
            break;
          }
          case 'spell-cone': {
            const dx = point.x - drawing.origin.x;
            const dy = point.y - drawing.origin.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= drawing.length + radius) {
              const clickAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
              const angleDiff = Math.abs(
                ((clickAngle - drawing.direction + 180) % 360) - 180,
              );
              const halfConeAngle = drawing.angle / 2;
              intersects = angleDiff <= halfConeAngle + 5;
            }
            break;
          }
          case 'spell-line': {
            intersects = isPointNearLine(
              point,
              drawing.start,
              drawing.end,
              drawing.width / 2 + radius,
            );
            break;
          }
          case 'spell-square': {
            const rotation = drawing.rotation || 0;
            const adjustedPoint =
              rotation !== 0
                ? rotatePoint(point, drawing.origin, -rotation)
                : point;
            const halfSize = drawing.size / 2;
            intersects = isPointInRectangle(
              adjustedPoint,
              {
                x: drawing.origin.x - halfSize,
                y: drawing.origin.y - halfSize,
                width: drawing.size,
                height: drawing.size,
              },
              radius,
            );
            break;
          }
          case 'spell-triangle': {
            const angleRad = (drawing.direction * Math.PI) / 180;
            const baseCenterX =
              drawing.origin.x + Math.cos(angleRad) * drawing.length;
            const baseCenterY =
              drawing.origin.y + Math.sin(angleRad) * drawing.length;
            const halfWidth = drawing.width / 2;
            const perpAngle = angleRad + Math.PI / 2;
            const cos = Math.cos(perpAngle);
            const sin = Math.sin(perpAngle);
            const baseLeft = {
              x: baseCenterX + cos * halfWidth,
              y: baseCenterY + sin * halfWidth,
            };
            const baseRight = {
              x: baseCenterX - cos * halfWidth,
              y: baseCenterY - sin * halfWidth,
            };
            const trianglePoints = [drawing.origin, baseLeft, baseRight];
            intersects =
              isPointInPolygon(point, trianglePoints) ||
              trianglePoints.some((p) => isPointInCircle(point, p, radius));
            break;
          }
          case 'text':
          case 'ping': {
            // Check if point is near the text/ping position
            intersects = isPointInCircle(point, drawing.position, radius + 15);
            break;
          }
          case 'fog-of-war': {
            intersects =
              isPointInPolygon(point, drawing.area) ||
              drawing.area.some((p) => isPointInCircle(point, p, radius));
            break;
          }
          default:
            break;
        }

        if (intersects) {
          intersectedDrawings.push(drawing.id);
        }
      });

      return intersectedDrawings;
    },
    [activeScene, isHost, user.id],
  );

  const getTokensAtPoint = useCallback(
    (point: Point, radius: number = 5): string[] => {
      const intersectedTokens: string[] = [];
      placedTokens.forEach((token) => {
        const tokenData = tokenAssetManager.getTokenById(token.tokenId);
        if (!tokenData) return;
        const tokenSize =
          getTokenPixelSize(tokenData.size, _gridSize) * token.scale;
        const tokenRadius = tokenSize / 2;
        if (
          isPointInCircle(
            point,
            { x: token.x, y: token.y },
            tokenRadius + radius,
          )
        ) {
          intersectedTokens.push(token.id);
        }
      });
      return intersectedTokens;
    },
    [placedTokens, _gridSize],
  );
  const getPropsAtPoint = useCallback(
    (point: Point, radius: number = 5): string[] => {
      const intersectedProps: string[] = [];
      placedProps.forEach((prop) => {
        const propWidth = (prop.width || 1) * _gridSize * prop.scale;
        const propHeight = (prop.height || 1) * _gridSize * prop.scale;
        const topLeft = {
          x: prop.x - propWidth / 2,
          y: prop.y - propHeight / 2,
        };
        if (
          isPointInRectangle(
            point,
            {
              x: topLeft.x,
              y: topLeft.y,
              width: propWidth,
              height: propHeight,
            },
            radius,
          )
        ) {
          intersectedProps.push(prop.id);
        }
      });
      return intersectedProps;
    },
    [placedProps, _gridSize],
  );

  const eraseEntitiesAtPoint = useCallback(
    (point: Point) => {
      if (!activeScene) return;

      const drawingsToErase = getDrawingsAtPoint(point, eraserRadius);
      drawingsToErase.forEach((id) => deleteAndSyncDrawing(id));

      const tokensToErase = getTokensAtPoint(point, eraserRadius);
      tokensToErase.forEach((tokenId) => {
        const token = placedTokens.find((t) => t.id === tokenId);
        const canEditToken = isHost || (token && token.placedBy === user.id);
        if (canEditToken) {
          deleteToken(activeScene.id, tokenId);
        }
      });

      const propsToErase = getPropsAtPoint(point, eraserRadius);
      propsToErase.forEach((propId) => {
        const prop = placedProps.find((p) => p.id === propId);
        const canEditProp = isHost || (prop && prop.placedBy === user.id);
        if (canEditProp) {
          deleteProp(activeScene.id, propId);
        }
      });
    },
    [
      activeScene,
      deleteAndSyncDrawing,
      deleteProp,
      deleteToken,
      eraserRadius,
      getDrawingsAtPoint,
      getPropsAtPoint,
      getTokensAtPoint,
      isHost,
      placedProps,
      placedTokens,
      user.id,
    ],
  );

  // Get drawings in selection box
  const getDrawingsInSelection = useCallback(
    (start: Point, end: Point): string[] => {
      if (!activeScene) return [];

      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);

      return activeScene.drawings
        .filter((drawing) => {
          switch (drawing.type) {
            case 'line':
              return (
                (drawing.start.x >= minX &&
                  drawing.start.x <= maxX &&
                  drawing.start.y >= minY &&
                  drawing.start.y <= maxY) ||
                (drawing.end.x >= minX &&
                  drawing.end.x <= maxX &&
                  drawing.end.y >= minY &&
                  drawing.end.y <= maxY)
              );
            case 'rectangle':
              return !(
                drawing.x + drawing.width < minX ||
                drawing.x > maxX ||
                drawing.y + drawing.height < minY ||
                drawing.y > maxY
              );
            case 'circle':
              return (
                drawing.center.x >= minX &&
                drawing.center.x <= maxX &&
                drawing.center.y >= minY &&
                drawing.center.y <= maxY
              );
            case 'pencil':
              return drawing.points.some(
                (p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY,
              );
            case 'polygon':
              return drawing.points.some(
                (p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY,
              );
            case 'cone': {
              // Check if cone origin is in selection box
              const originInBox =
                drawing.origin.x >= minX &&
                drawing.origin.x <= maxX &&
                drawing.origin.y >= minY &&
                drawing.origin.y <= maxY;

              // Also check if cone's end point is in selection box
              const directionRad = (drawing.direction * Math.PI) / 180;
              const endX =
                drawing.origin.x + Math.cos(directionRad) * drawing.length;
              const endY =
                drawing.origin.y + Math.sin(directionRad) * drawing.length;
              const endInBox =
                endX >= minX && endX <= maxX && endY >= minY && endY <= maxY;

              return originInBox || endInBox;
            }
            case 'spell-circle':
              return (
                drawing.center.x >= minX &&
                drawing.center.x <= maxX &&
                drawing.center.y >= minY &&
                drawing.center.y <= maxY
              );
            case 'spell-ring':
              return (
                drawing.center.x >= minX &&
                drawing.center.x <= maxX &&
                drawing.center.y >= minY &&
                drawing.center.y <= maxY
              );
            case 'spell-cone': {
              const originInBox =
                drawing.origin.x >= minX &&
                drawing.origin.x <= maxX &&
                drawing.origin.y >= minY &&
                drawing.origin.y <= maxY;
              const directionRad = (drawing.direction * Math.PI) / 180;
              const endX =
                drawing.origin.x + Math.cos(directionRad) * drawing.length;
              const endY =
                drawing.origin.y + Math.sin(directionRad) * drawing.length;
              const endInBox =
                endX >= minX && endX <= maxX && endY >= minY && endY <= maxY;
              return originInBox || endInBox;
            }
            case 'spell-line': {
              return (
                (drawing.start.x >= minX &&
                  drawing.start.x <= maxX &&
                  drawing.start.y >= minY &&
                  drawing.start.y <= maxY) ||
                (drawing.end.x >= minX &&
                  drawing.end.x <= maxX &&
                  drawing.end.y >= minY &&
                  drawing.end.y <= maxY)
              );
            }
            case 'spell-square':
              return !(
                drawing.origin.x + drawing.size / 2 < minX ||
                drawing.origin.x - drawing.size / 2 > maxX ||
                drawing.origin.y + drawing.size / 2 < minY ||
                drawing.origin.y - drawing.size / 2 > maxY
              );
            case 'spell-triangle': {
              const originInBox =
                drawing.origin.x >= minX &&
                drawing.origin.x <= maxX &&
                drawing.origin.y >= minY &&
                drawing.origin.y <= maxY;
              const directionRad = (drawing.direction * Math.PI) / 180;
              const endX =
                drawing.origin.x + Math.cos(directionRad) * drawing.length;
              const endY =
                drawing.origin.y + Math.sin(directionRad) * drawing.length;
              const endInBox =
                endX >= minX && endX <= maxX && endY >= minY && endY <= maxY;
              return originInBox || endInBox;
            }
            case 'text':
            case 'ping':
              return (
                drawing.position.x >= minX &&
                drawing.position.x <= maxX &&
                drawing.position.y >= minY &&
                drawing.position.y <= maxY
              );
            default:
              return false;
          }
        })
        .map((d) => d.id);
    },
    [activeScene],
  );

  // Handle mouse down for all tools
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;

      // Disable snap for smooth drawing - only snap if Ctrl/Cmd key is held
      const shouldSnap = e.ctrlKey || e.metaKey;
      const point = screenToScene(e.clientX, e.clientY, shouldSnap);

      // Tools that don't interact with mousedown can be handled with an early return.
      if (activeTool === 'pan' || activeTool === 'move') {
        return;
      }

      // Measure tool - start measuring
      if (activeTool === 'measure') {
        setStartPoint(point);
        setCurrentPoint(point);
        setIsDrawing(true);
        return;
      }

      const defaultHandler = () => {
        setStartPoint(point);
        setCurrentPoint(point);
        setIsDrawing(true);
      };

      const mouseDownHandlers: {
        [key: string]: (event: React.MouseEvent) => void;
      } = {
        select: (event) => {
          const drawingsAtPoint = getDrawingsAtPoint(point, 25);
          const tokensAtPoint = getTokensAtPoint(point, 5);
          const propsAtPoint = getPropsAtPoint(point, 5);
          const isMultiSelectModifier =
            event.shiftKey || event.metaKey || event.ctrlKey;

          const objectToSelect =
            drawingsAtPoint[0] || tokensAtPoint[0] || propsAtPoint[0];
          const tokenId = tokensAtPoint[0];
          const propId = propsAtPoint[0];

          if (objectToSelect) {
            if (isMultiSelectModifier) {
              const newSelection = selectedObjectIds.includes(objectToSelect)
                ? selectedObjectIds.filter((id) => id !== objectToSelect)
                : [...selectedObjectIds, objectToSelect];
              setSelection(newSelection);
            } else {
              // Single selection - gameStore will show toolbar if it's a token
              setSelection([objectToSelect]);
            }

            if (activeScene && tokenId && tokenId === objectToSelect) {
              const token = placedTokens.find((t) => t.id === tokenId);
              const canEditToken =
                isHost || (token && token.placedBy === user.id);
              const canDrag =
                !isMultiSelectModifier ||
                selectedObjectIds.includes(tokenId);
              if (canEditToken && canDrag) {
                dragEntityRef.current = {
                  type: 'token',
                  id: tokenId,
                  lastPoint: point,
                };
              }
            } else if (activeScene && propId && propId === objectToSelect) {
              const prop = placedProps.find((p) => p.id === propId);
              const canEditProp =
                isHost || (prop && prop.placedBy === user.id);
              const canDrag =
                !isMultiSelectModifier ||
                selectedObjectIds.includes(propId);
              if (canEditProp && canDrag) {
                dragEntityRef.current = {
                  type: 'prop',
                  id: propId,
                  lastPoint: point,
                };
              }
            }
          } else {
            // Clicking on empty space
            if (event.shiftKey) {
              // Start selection box
              setSelectionBox({ start: point, end: point });
              setIsDrawing(true);
              setStartPoint(point);
              setCurrentPoint(point);
            } else {
              // Clear all selections
              clearSelection();
            }
          }
        },
        ping: () => {
          // Create a ping that auto-fades after 3 seconds
          const now = Date.now();
          const ping: Drawing = {
            id: `ping-${now}-${Math.random()}`,
            type: 'ping',
            position: point,
            playerId: user.id,
            playerName: user.name,
            timestamp: now,
            duration: 3000,
            style: drawingStyle,
            layer: 'overlay',
            roomCode: roomCode || '',
            createdAt: now,
            updatedAt: now,
            createdBy: user.id,
          };

          createAndSyncDrawing(ping);

          // Auto-remove after duration (3000ms)
          setTimeout(() => {
            if (activeScene) {
              deleteDrawing(activeScene.id, ping.id);
              // Sync deletion
              webSocketService.sendEvent({
                type: 'drawing/delete',
                data: {
                  sceneId: activeScene.id,
                  drawingId: ping.id,
                },
              });
            }
          }, 3000);
        },
        note: () => {
          // For now, create a text drawing prompt
          const noteText = prompt('Enter note text:');
          if (noteText && noteText.trim()) {
            const now = Date.now();
            const note: Drawing = {
              id: `note-${now}-${Math.random()}`,
              type: 'text',
              position: point,
              text: noteText.trim(),
              fontSize: 16,
              fontFamily: 'Arial, sans-serif',
              style: drawingStyle,
              layer: 'overlay',
              roomCode: roomCode || '',
              createdAt: now,
              updatedAt: now,
              createdBy: user.id,
            };
            createAndSyncDrawing(note);
          }
        },
        eraser: () => {
          setIsErasing(true);
          eraseEntitiesAtPoint(point);
          setStartPoint(point);
        },
        polygon: () => {
          setPolygonPoints((prev) => [...prev, point]);
        },
        pencil: () => {
          setPencilPath([point]);
          setIsDrawing(true);
        },
        'mask-create': () => {
          // Mask-create works like polygon - click to add points, double-click or Escape to finish
          setPolygonPoints((prev) => [...prev, point]);
        },
        'mask-toggle': () => {
          // Toggle the revealed state of the clicked fog mask
          const drawingsAtPoint = getDrawingsAtPoint(point, 25);
          const fogMask = activeScene?.drawings.find(
            (d) => d.type === 'fog-of-war' && drawingsAtPoint.includes(d.id),
          );

          if (fogMask && fogMask.type === 'fog-of-war' && activeScene) {
            const newRevealed = !fogMask.revealed;
            updateDrawing(activeScene.id, fogMask.id, {
              revealed: newRevealed,
            });

            // Sync the update
            webSocketService.sendEvent({
              type: 'drawing/update',
              data: {
                sceneId: activeScene.id,
                drawingId: fogMask.id,
                updates: { revealed: newRevealed },
              },
            });
          }
        },
        'mask-remove': () => {
          // Remove the clicked fog mask
          const drawingsAtPoint = getDrawingsAtPoint(point, 25);
          const fogMask = activeScene?.drawings.find(
            (d) => d.type === 'fog-of-war' && drawingsAtPoint.includes(d.id),
          );

          if (fogMask && activeScene) {
            if (window.confirm('Remove this fog mask?')) {
              deleteAndSyncDrawing(fogMask.id);
            }
          }
        },
        'mask-show': () => {
          // Reveal all fog masks on the scene
          if (!activeScene) return;

          const fogMasks = activeScene.drawings.filter(
            (d) => d.type === 'fog-of-war',
          );

          if (fogMasks.length === 0) {
            alert('No fog masks found on this scene.');
            return;
          }

          fogMasks.forEach((mask) => {
            if (mask.type === 'fog-of-war' && !mask.revealed) {
              updateDrawing(activeScene.id, mask.id, { revealed: true });

              // Sync the update
              webSocketService.sendEvent({
                type: 'drawing/update',
                data: {
                  sceneId: activeScene.id,
                  drawingId: mask.id,
                  updates: { revealed: true },
                },
              });
            }
          });
        },
        'mask-hide': () => {
          // Hide all fog masks on the scene
          if (!activeScene) return;

          const fogMasks = activeScene.drawings.filter(
            (d) => d.type === 'fog-of-war',
          );

          if (fogMasks.length === 0) {
            alert('No fog masks found on this scene.');
            return;
          }

          fogMasks.forEach((mask) => {
            if (mask.type === 'fog-of-war' && mask.revealed) {
              updateDrawing(activeScene.id, mask.id, { revealed: false });

              // Sync the update
              webSocketService.sendEvent({
                type: 'drawing/update',
                data: {
                  sceneId: activeScene.id,
                  drawingId: mask.id,
                  updates: { revealed: false },
                },
              });
            }
          });
        },
        'grid-align': () => {
          if (!activeScene) return;

          if (!activeScene.gridSettings?.enabled) {
            alert(
              'Please enable the grid first in Scene Settings before aligning it.',
            );
            return;
          }

          // Two-point alignment mode
          if (gridAlignMode === 'waiting-first') {
            // First click - mark the first corner
            setGridAlignPoints([point]);
            setGridAlignMode('waiting-second');

            // Show notification
            const notification = document.createElement('div');
            notification.textContent =
              '📍 First point marked. Click the opposite corner of a grid square.';
            notification.style.cssText = `
              position: fixed;
              top: 20px;
              left: 50%;
              transform: translateX(-50%);
              background: rgba(0, 188, 212, 0.9);
              color: white;
              padding: 12px 24px;
              border-radius: 8px;
              font-weight: bold;
              z-index: 10000;
              pointer-events: none;
            `;
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
          } else if (gridAlignMode === 'waiting-second' && gridAlignPoints.length === 1) {
            // Second click - calculate grid size and offset
            const firstPoint = gridAlignPoints[0];
            const secondPoint = point;

            // Ask user how many grid squares are between the two points
            const numSquares = prompt(
              'How many grid squares are between these two points?\n(Enter 1 if these are adjacent corners, 2 if there is one square between them, etc.)',
              '1',
            );

            if (!numSquares || isNaN(parseInt(numSquares))) {
              // Cancel alignment
              setGridAlignMode('waiting-first');
              setGridAlignPoints([]);
              return;
            }

            const squares = parseInt(numSquares);
            if (squares <= 0) {
              alert('Please enter a positive number of grid squares.');
              return;
            }

            // Calculate distance between points
            const dx = secondPoint.x - firstPoint.x;
            const dy = secondPoint.y - firstPoint.y;
            const distanceX = Math.abs(dx);
            const distanceY = Math.abs(dy);

            // Calculate grid size (use the larger dimension)
            const calculatedGridSize = Math.max(distanceX, distanceY) / squares;

            // Calculate offset - make first point a grid intersection
            const offsetX = firstPoint.x % calculatedGridSize;
            const offsetY = firstPoint.y % calculatedGridSize;

            // Update scene grid settings
            const newGridSettings = {
              ...activeScene.gridSettings,
              size: Math.round(calculatedGridSize),
              offsetX,
              offsetY,
            };

            updateScene(activeScene.id, {
              gridSettings: newGridSettings,
            });

            // Sync the update
            webSocketService.sendEvent({
              type: 'scene/update',
              data: {
                sceneId: activeScene.id,
                updates: {
                  gridSettings: newGridSettings,
                },
              },
            });

            // Enter fine-tuning mode
            setFineTuningOffset({ x: offsetX, y: offsetY });
            setGridAlignMode('fine-tuning');

            // Show notification
            const notification = document.createElement('div');
            notification.innerHTML = `
              ✓ Grid aligned! Size: ${Math.round(calculatedGridSize)}px<br/>
              <small>Use arrow keys to fine-tune. Press Enter to finish, Escape to cancel.</small>
            `;
            notification.style.cssText = `
              position: fixed;
              top: 20px;
              left: 50%;
              transform: translateX(-50%);
              background: rgba(0, 188, 212, 0.9);
              color: white;
              padding: 12px 24px;
              border-radius: 8px;
              font-weight: bold;
              z-index: 10000;
              pointer-events: none;
              text-align: center;
            `;
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 5000);
          }
        },
        // Spell overlay tools
        'spell-circle': () => {
          const snapPoint = spellGridSnap ? gridSnap(point, _gridSize) : point;
          setStartPoint(snapPoint);
          setCurrentPoint(snapPoint);
          setIsDrawing(true);
        },
        'spell-ring': () => {
          const snapPoint = spellGridSnap ? gridSnap(point, _gridSize) : point;
          setStartPoint(snapPoint);
          setCurrentPoint(snapPoint);
          setIsDrawing(true);
        },
        'spell-cone': () => {
          const snapPoint = spellGridSnap ? gridSnap(point, _gridSize) : point;
          setStartPoint(snapPoint);
          setCurrentPoint(snapPoint);
          setIsDrawing(true);
        },
        'spell-line': () => {
          const snapPoint = spellGridSnap ? gridSnap(point, _gridSize) : point;
          setStartPoint(snapPoint);
          setCurrentPoint(snapPoint);
          setIsDrawing(true);
        },
        'spell-square': () => {
          const snapPoint = spellGridSnap ? gridSnap(point, _gridSize) : point;
          setStartPoint(snapPoint);
          setCurrentPoint(snapPoint);
          setIsDrawing(true);
        },
        'spell-triangle': () => {
          const snapPoint = spellGridSnap ? gridSnap(point, _gridSize) : point;
          setStartPoint(snapPoint);
          setCurrentPoint(snapPoint);
          setIsDrawing(true);
        },
      };

      const handler = mouseDownHandlers[activeTool] || defaultHandler;
      handler(e);

      e.stopPropagation();
    },
    [
      activeTool,
      screenToScene,
      isHost,
      selectedObjectIds,
      setSelection,
      clearSelection,
      getDrawingsAtPoint,
      getTokensAtPoint,
      getPropsAtPoint,
      eraseEntitiesAtPoint,
      deleteAndSyncDrawing,
      activeScene,
      createAndSyncDrawing,
      deleteDrawing,
      drawingStyle,
      placedProps,
      placedTokens,
      user.id,
      user.name,
      updateDrawing,
      updateScene,
      roomCode,
      gridAlignMode,
      gridAlignPoints,
    ],
  );

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool === 'pan') return;

      // Disable snap for smooth drawing - only snap if Ctrl/Cmd key is held
      const shouldSnap = e.ctrlKey || e.metaKey;
      const point = screenToScene(e.clientX, e.clientY, shouldSnap);

      const dragEntity = dragEntityRef.current;
      if (dragEntity && activeScene) {
        const dx = point.x - dragEntity.lastPoint.x;
        const dy = point.y - dragEntity.lastPoint.y;
        if (dragEntity.type === 'token') {
          const token = getSceneTokens(activeScene.id).find(
            (item) => item.id === dragEntity.id,
          );
          if (token) {
            moveTokenOptimistic(activeScene.id, dragEntity.id, {
              x: token.x + dx,
              y: token.y + dy,
            });
          }
        } else {
          const prop = getSceneProps(activeScene.id).find(
            (item) => item.id === dragEntity.id,
          );
          if (prop) {
            movePropOptimistic(activeScene.id, dragEntity.id, {
              x: prop.x + dx,
              y: prop.y + dy,
            });
          }
        }
        dragEntityRef.current = { ...dragEntity, lastPoint: point };
        e.stopPropagation();
        return;
      }

      // Measure tool - update measurement line
      if (activeTool === 'measure' && isDrawing && startPoint) {
        setCurrentPoint(point);
        return;
      }

      const defaultHandler = () => {
        if (isDrawing) {
          setCurrentPoint(point);
        }
      };

      const mouseMoveHandlers: { [key: string]: () => void } = {
        select: () => {
          if (isDrawing && selectionBox) {
            setSelectionBox({ start: selectionBox.start, end: point });
            setCurrentPoint(point);
          }
        },
        eraser: () => {
          if (isErasing) {
            eraseEntitiesAtPoint(point);
          }
        },
        pencil: () => {
          if (isDrawing) {
            setPencilPath((prev) => [...prev, point]);
          }
        },
        polygon: () => {
          setCurrentPoint(point);
        },
        'mask-create': () => {
          setCurrentPoint(point);
        },
        'grid-align': () => {
          // Track mouse position for preview line
          setCurrentPoint(point);
        },
      };

      const handler = mouseMoveHandlers[activeTool] || defaultHandler;
      handler();

      e.stopPropagation();
    },
    [
      activeTool,
      screenToScene,
      isDrawing,
      startPoint,
      isErasing,
      selectionBox,
      eraseEntitiesAtPoint,
      activeScene,
      getSceneTokens,
      getSceneProps,
      moveTokenOptimistic,
      movePropOptimistic,
    ],
  );

  // Handle mouse up with drawing creation logic
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      // Disable snap for smooth drawing - only snap if Ctrl/Cmd key is held
      const shouldSnap = e.ctrlKey || e.metaKey;
      const endPoint = screenToScene(e.clientX, e.clientY, shouldSnap);

      const dragEntity = dragEntityRef.current;
      if (dragEntity && activeScene) {
        if (shouldSnapToGrid && _gridSize > 0) {
          if (dragEntity.type === 'token') {
            const token = getSceneTokens(activeScene.id).find(
              (item) => item.id === dragEntity.id,
            );
            if (token) {
              const snappedX = Math.round(token.x / _gridSize) * _gridSize;
              const snappedY = Math.round(token.y / _gridSize) * _gridSize;
              if (snappedX !== token.x || snappedY !== token.y) {
                moveTokenOptimistic(activeScene.id, dragEntity.id, {
                  x: snappedX,
                  y: snappedY,
                });
              }
            }
          } else {
            const prop = getSceneProps(activeScene.id).find(
              (item) => item.id === dragEntity.id,
            );
            if (prop) {
              const snappedX = Math.round(prop.x / _gridSize) * _gridSize;
              const snappedY = Math.round(prop.y / _gridSize) * _gridSize;
              if (snappedX !== prop.x || snappedY !== prop.y) {
                movePropOptimistic(activeScene.id, dragEntity.id, {
                  x: snappedX,
                  y: snappedY,
                });
              }
            }
          }
        }
        dragEntityRef.current = null;
        setIsDrawing(false);
        e.stopPropagation();
        return;
      }

      switch (activeTool) {
        case 'select': {
          if (selectionBox) {
            const drawingIds = getDrawingsInSelection(
              selectionBox.start,
              selectionBox.end,
            );

            const minX = Math.min(selectionBox.start.x, selectionBox.end.x);
            const maxX = Math.max(selectionBox.start.x, selectionBox.end.x);
            const minY = Math.min(selectionBox.start.y, selectionBox.end.y);
            const maxY = Math.max(selectionBox.start.y, selectionBox.end.y);

            const tokenIds = placedTokens
              .filter(
                (token) =>
                  token.x >= minX &&
                  token.x <= maxX &&
                  token.y >= minY &&
                  token.y <= maxY,
              )
              .map((token) => token.id);
            const propIds = placedProps
              .filter(
                (prop) =>
                  prop.x >= minX &&
                  prop.x <= maxX &&
                  prop.y >= minY &&
                  prop.y <= maxY,
              )
              .map((prop) => prop.id);

            setSelection([...drawingIds, ...tokenIds, ...propIds]);
            setSelectionBox(null);
          }
          setIsDrawing(false);
          break;
        }

        case 'eraser': {
          setIsErasing(false);
          break;
        }

        default: {
          if (!isDrawing || !startPoint || activeTool === 'polygon') {
            return;
          }

          const baseDrawing = {
            id: `drawing-${Date.now()}-${user.id}`,
            style: drawingStyle,
            layer:
              drawingStyle.dmNotesOnly || !drawingStyle.visibleToPlayers
                ? 'dm-only'
                : 'effects',
            roomCode: roomCode || '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            createdBy: user.id,
          } as const;

          // A dispatch table is a cleaner and more scalable alternative to a large switch statement.
          const drawingCreators: { [key in DrawingTool]?: () => Drawing } = {
            line: () => ({
              ...baseDrawing,
              type: 'line',
              start: startPoint,
              end: endPoint,
            }),
            rectangle: () => ({
              ...baseDrawing,
              type: 'rectangle',
              x: Math.min(startPoint.x, endPoint.x),
              y: Math.min(startPoint.y, endPoint.y),
              width: Math.abs(endPoint.x - startPoint.x),
              height: Math.abs(endPoint.y - startPoint.y),
            }),
            circle: () => {
              const radius = distance(startPoint, endPoint);
              return {
                ...baseDrawing,
                type: 'circle',
                center: startPoint,
                radius,
              };
            },
            cone: () => {
              const length = distance(startPoint, endPoint);
              // No automatic snapping - draw smoothly

              const direction =
                (Math.atan2(
                  endPoint.y - startPoint.y,
                  endPoint.x - startPoint.x,
                ) *
                  180) /
                Math.PI;
              return {
                ...baseDrawing,
                type: 'cone',
                origin: startPoint,
                direction,
                length,
                angle: 53.13, // D&D 5e cone: equilateral triangle, width = distance from origin
              };
            },
            pencil: () => ({
              ...baseDrawing,
              type: 'pencil',
              points: pencilPath,
            }),
            'spell-circle': () => {
              const radius = distance(startPoint, endPoint);
              const theme = ELEMENT_THEMES[spellElementType];
              return {
                ...baseDrawing,
                type: 'spell-circle',
                center: startPoint,
                radius,
                style: {
                  ...drawingStyle,
                  elementType: spellElementType,
                  edgeGlow: theme.edgeGlow,
                  blendMode: theme.blendMode,
                  animationSpeed: theme.animationSpeed,
                  pulseIntensity: theme.pulseIntensity,
                  gridSnap: spellGridSnap,
                } as any,
              };
            },
            'spell-ring': () => {
              const outerRadius = distance(startPoint, endPoint);
              // Ring thickness stays fairly constant, only growing slightly with size
              // Base thickness of 15px + small scaling (10% of radius), capped at 60px
              const thickness = Math.max(15, Math.min(60, 15 + outerRadius * 0.1));
              const innerRadius = Math.max(0, outerRadius - thickness);
              const theme = ELEMENT_THEMES[spellElementType];
              return {
                ...baseDrawing,
                type: 'spell-ring',
                center: startPoint,
                outerRadius,
                innerRadius,
                style: {
                  ...drawingStyle,
                  elementType: spellElementType,
                  edgeGlow: theme.edgeGlow,
                  blendMode: theme.blendMode,
                  animationSpeed: theme.animationSpeed,
                  pulseIntensity: theme.pulseIntensity,
                  gridSnap: spellGridSnap,
                } as any,
              };
            },
            'spell-cone': () => {
              const length = distance(startPoint, endPoint);
              const direction =
                (Math.atan2(
                  endPoint.y - startPoint.y,
                  endPoint.x - startPoint.x,
                ) *
                  180) /
                Math.PI;
              const theme = ELEMENT_THEMES[spellElementType];
              return {
                ...baseDrawing,
                type: 'spell-cone',
                origin: startPoint,
                direction,
                length,
                angle: 90, // Standard 90-degree cone
                style: {
                  ...drawingStyle,
                  elementType: spellElementType,
                  edgeGlow: theme.edgeGlow,
                  blendMode: theme.blendMode,
                  animationSpeed: theme.animationSpeed,
                  pulseIntensity: theme.pulseIntensity,
                  gridSnap: spellGridSnap,
                } as any,
              };
            },
            'spell-line': () => {
              const theme = ELEMENT_THEMES[spellElementType];
              // Default width of 5ft (approximately 1 grid square)
              const width = _gridSize || 50;
              return {
                ...baseDrawing,
                type: 'spell-line',
                start: startPoint,
                end: endPoint,
                width,
                style: {
                  ...drawingStyle,
                  elementType: spellElementType,
                  edgeGlow: theme.edgeGlow,
                  blendMode: theme.blendMode,
                  animationSpeed: theme.animationSpeed,
                  pulseIntensity: theme.pulseIntensity,
                  gridSnap: spellGridSnap,
                } as any,
              };
            },
            'spell-square': () => {
              const size = distance(startPoint, endPoint);
              const theme = ELEMENT_THEMES[spellElementType];
              return {
                ...baseDrawing,
                type: 'spell-square',
                origin: startPoint,
                size,
                rotation: 0,
                style: {
                  ...drawingStyle,
                  elementType: spellElementType,
                  edgeGlow: theme.edgeGlow,
                  blendMode: theme.blendMode,
                  animationSpeed: theme.animationSpeed,
                  pulseIntensity: theme.pulseIntensity,
                  gridSnap: spellGridSnap,
                } as any,
              };
            },
            'spell-triangle': () => {
              const length = distance(startPoint, endPoint);
              const direction =
                (Math.atan2(
                  endPoint.y - startPoint.y,
                  endPoint.x - startPoint.x,
                ) *
                  180) /
                Math.PI;
              const width = length * 0.8; // Base width is 80% of length
              const theme = ELEMENT_THEMES[spellElementType];
              return {
                ...baseDrawing,
                type: 'spell-triangle',
                origin: startPoint,
                direction,
                length,
                width,
                style: {
                  ...drawingStyle,
                  elementType: spellElementType,
                  edgeGlow: theme.edgeGlow,
                  blendMode: theme.blendMode,
                  animationSpeed: theme.animationSpeed,
                  pulseIntensity: theme.pulseIntensity,
                  gridSnap: spellGridSnap,
                } as any,
              };
            },
          };

          const createDrawingFunc = drawingCreators[activeTool as DrawingTool];

          if (createDrawingFunc) {
            const drawing = createDrawingFunc();
            createAndSyncDrawing(drawing);

            // Switch back to select tool after drawing a shape
            const shapeTools = [
              'line',
              'rectangle',
              'circle',
              'cone',
              'pencil',
              'spell-circle',
              'spell-ring',
              'spell-cone',
              'spell-line',
              'spell-square',
              'spell-triangle',
            ];
            if (shapeTools.includes(activeTool)) {
              useGameStore.getState().setActiveTool('select');
            }
          } else {
            // If no creator function is found for the active tool, do nothing.
            console.warn(`No drawing creator found for tool: ${activeTool}`);
          }
          break;
        }
      }

      setIsDrawing(false);
      setStartPoint(null);
      setCurrentPoint(null);
      setPencilPath([]);

      e.stopPropagation();
    },
    [
      activeTool,
      screenToScene,
      isDrawing,
      startPoint,
      selectionBox,
      getDrawingsInSelection,
      setSelection,
      drawingStyle,
      placedProps,
      placedTokens,
      user.id,
      createAndSyncDrawing,
      pencilPath,
      roomCode,
      _gridSize,
      shouldSnapToGrid,
      activeScene,
      getSceneTokens,
      getSceneProps,
      moveTokenOptimistic,
      movePropOptimistic,
    ],
  );

  // Handle polygon completion (also used for mask-create)
  const handlePolygonComplete = useCallback(
    (e: React.MouseEvent) => {
      if (
        (activeTool !== 'polygon' && activeTool !== 'mask-create') ||
        polygonPoints.length < 3
      )
        return;

      if (e.type === 'dblclick' || e.button === 2) {
        if (activeTool === 'mask-create') {
          // Create fog-of-war drawing
          const drawing: Drawing = {
            id: `fog-${Date.now()}-${user.id}`,
            type: 'fog-of-war',
            style: {
              ...drawingStyle,
              fillColor: '#000000',
              fillOpacity: 0.8,
              strokeColor: '#666666',
              strokeWidth: 2,
            },
            layer: 'dm-only',
            roomCode: roomCode || '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            createdBy: user.id,
            area: polygonPoints,
            density: 0.8,
            revealed: false,
          };

          createAndSyncDrawing(drawing);
          setPolygonPoints([]);
          useGameStore.getState().setActiveTool('select');
          e.preventDefault();
        } else {
          // Regular polygon
          const drawing: Drawing = {
            id: `drawing-${Date.now()}-${user.id}`,
            type: 'polygon',
            style: drawingStyle,
            layer:
              drawingStyle.dmNotesOnly || !drawingStyle.visibleToPlayers
                ? 'dm-only'
                : 'effects',
            roomCode: roomCode || '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            createdBy: user.id,
            points: polygonPoints,
          };

          createAndSyncDrawing(drawing);
          setPolygonPoints([]);
          useGameStore.getState().setActiveTool('select');
          e.preventDefault();
        }
      }
    },
    [
      activeTool,
      polygonPoints,
      drawingStyle,
      user.id,
      createAndSyncDrawing,
      roomCode,
    ],
  );

  // Delete selected drawings
  const deleteSelection = useCallback(() => {
    selectedObjectIds.forEach((id) => deleteAndSyncDrawing(id));
    clearSelection();
  }, [selectedObjectIds, deleteAndSyncDrawing, clearSelection]);

  // Handle keyboard events for selection tool and polygon/mask tools
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTool === 'select' && selectedObjectIds.length > 0) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          deleteSelection();
          e.preventDefault();
        }
      }

      // Handle polygon and mask-create keyboard shortcuts
      if (
        (activeTool === 'polygon' || activeTool === 'mask-create') &&
        polygonPoints.length >= 3
      ) {
        if (e.key === 'Enter') {
          // Complete the polygon/mask
          if (activeTool === 'mask-create') {
            const drawing: Drawing = {
              id: `fog-${Date.now()}-${user.id}`,
              type: 'fog-of-war',
              style: {
                ...drawingStyle,
                fillColor: '#000000',
                fillOpacity: 0.8,
                strokeColor: '#666666',
                strokeWidth: 2,
              },
              layer: 'dm-only',
              roomCode: roomCode || '',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              createdBy: user.id,
              area: polygonPoints,
              density: 0.8,
              revealed: false,
            };
            createAndSyncDrawing(drawing);
          } else {
            const drawing: Drawing = {
              id: `drawing-${Date.now()}-${user.id}`,
              type: 'polygon',
              style: drawingStyle,
              layer:
                drawingStyle.dmNotesOnly || !drawingStyle.visibleToPlayers
                  ? 'dm-only'
                  : 'effects',
              roomCode: roomCode || '',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              createdBy: user.id,
              points: polygonPoints,
            };
            createAndSyncDrawing(drawing);
          }
          setPolygonPoints([]);
          e.preventDefault();
        } else if (e.key === 'Escape') {
          // Cancel the polygon/mask
          setPolygonPoints([]);
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTool,
    selectedObjectIds,
    deleteSelection,
    polygonPoints,
    drawingStyle,
    user.id,
    createAndSyncDrawing,
    roomCode,
  ]);

  // Handle arrow key fine-tuning for grid alignment
  React.useEffect(() => {
    if (gridAlignMode !== 'fine-tuning' || !activeScene || !fineTuningOffset) {
      return;
    }

    const handleFineTuningKeyDown = (e: KeyboardEvent) => {
      const gridSize = activeScene.gridSettings?.size || 50;
      let newOffsetX = fineTuningOffset.x;
      let newOffsetY = fineTuningOffset.y;
      let handled = false;

      switch (e.key) {
        case 'ArrowLeft': {
          newOffsetX = (newOffsetX - 1 + gridSize) % gridSize;
          handled = true;
          break;
        }
        case 'ArrowRight': {
          newOffsetX = (newOffsetX + 1) % gridSize;
          handled = true;
          break;
        }
        case 'ArrowUp': {
          newOffsetY = (newOffsetY - 1 + gridSize) % gridSize;
          handled = true;
          break;
        }
        case 'ArrowDown': {
          newOffsetY = (newOffsetY + 1) % gridSize;
          handled = true;
          break;
        }
        case 'Enter': {
          // Confirm and exit fine-tuning mode
          setGridAlignMode(null);
          setGridAlignPoints([]);
          setFineTuningOffset(null);
          useGameStore.getState().setActiveTool('select');

          const confirmNotification = document.createElement('div');
          confirmNotification.textContent = '✓ Grid alignment confirmed!';
          confirmNotification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(76, 175, 80, 0.9);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: bold;
            z-index: 10000;
            pointer-events: none;
          `;
          document.body.appendChild(confirmNotification);
          setTimeout(() => confirmNotification.remove(), 2000);
          handled = true;
          break;
        }
        case 'Escape': {
          // Cancel and revert changes
          if (activeScene.gridSettings) {
            const revertedSettings = {
              ...activeScene.gridSettings,
              offsetX: gridAlignPoints[0]?.x % gridSize || 0,
              offsetY: gridAlignPoints[0]?.y % gridSize || 0,
            };
            updateScene(activeScene.id, { gridSettings: revertedSettings });
            webSocketService.sendEvent({
              type: 'scene/update',
              data: {
                sceneId: activeScene.id,
                updates: { gridSettings: revertedSettings },
              },
            });
          }
          setGridAlignMode(null);
          setGridAlignPoints([]);
          setFineTuningOffset(null);
          useGameStore.getState().setActiveTool('select');

          const cancelNotification = document.createElement('div');
          cancelNotification.textContent = '✗ Grid alignment cancelled';
          cancelNotification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(244, 67, 54, 0.9);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: bold;
            z-index: 10000;
            pointer-events: none;
          `;
          document.body.appendChild(cancelNotification);
          setTimeout(() => cancelNotification.remove(), 2000);
          handled = true;
          break;
        }
      }

      if (handled) {
        e.preventDefault();

        // Update offset if arrow key was pressed
        if (
          e.key.startsWith('Arrow') &&
          (newOffsetX !== fineTuningOffset.x || newOffsetY !== fineTuningOffset.y)
        ) {
          setFineTuningOffset({ x: newOffsetX, y: newOffsetY });

          // Apply the change immediately
          const newGridSettings = {
            ...activeScene.gridSettings,
            offsetX: newOffsetX,
            offsetY: newOffsetY,
          };

          updateScene(activeScene.id, { gridSettings: newGridSettings });
          webSocketService.sendEvent({
            type: 'scene/update',
            data: {
              sceneId: activeScene.id,
              updates: { gridSettings: newGridSettings },
            },
          });
        }
      }
    };

    window.addEventListener('keydown', handleFineTuningKeyDown);
    return () => window.removeEventListener('keydown', handleFineTuningKeyDown);
  }, [
    gridAlignMode,
    activeScene,
    fineTuningOffset,
    gridAlignPoints,
    updateScene,
  ]);

  if (activeTool === 'pan') {
    return null;
  }

  // Render preview shapes while drawing
  const renderPreview = () => {
    if (!isDrawing || !startPoint || !currentPoint) return null;

    const previewStyle = {
      fill: drawingStyle.fillColor,
      fillOpacity: drawingStyle.fillOpacity * 0.5, // Make preview semi-transparent
      stroke: drawingStyle.strokeColor,
      strokeWidth: drawingStyle.strokeWidth / camera.zoom,
      strokeDasharray: '5,5', // Dashed preview
      pointerEvents: 'none' as const,
    };

    // Calculate distance for measurement label
    const distanceInPixels = distance(startPoint, currentPoint);
    const distanceInFeet = (distanceInPixels / _gridSize) * 5; // Assuming 5ft per grid square
    const midX = (startPoint.x + currentPoint.x) / 2;
    const midY = (startPoint.y + currentPoint.y) / 2;

    switch (activeTool) {
      case 'measure':
        return (
          <>
            <line
              x1={startPoint.x}
              y1={startPoint.y}
              x2={currentPoint.x}
              y2={currentPoint.y}
              stroke="#00bcd4"
              strokeWidth={3 / camera.zoom}
              fill="none"
              pointerEvents="none"
            />
            {/* Distance indicator */}
            <text
              x={midX}
              y={midY - 15 / camera.zoom}
              fill="#00bcd4"
              fontSize={16 / camera.zoom}
              fontWeight="bold"
              textAnchor="middle"
              pointerEvents="none"
              style={{
                textShadow:
                  '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,188,212,0.5)',
              }}
            >
              📏 {distanceInFeet.toFixed(1)} ft ({distanceInPixels.toFixed(0)}
              px)
            </text>
            {/* Start point marker */}
            <circle
              cx={startPoint.x}
              cy={startPoint.y}
              r={5 / camera.zoom}
              fill="#00ff00"
              stroke="#ffffff"
              strokeWidth={2 / camera.zoom}
              pointerEvents="none"
            />
            {/* End point marker */}
            <circle
              cx={currentPoint.x}
              cy={currentPoint.y}
              r={5 / camera.zoom}
              fill="#ff0000"
              stroke="#ffffff"
              strokeWidth={2 / camera.zoom}
              pointerEvents="none"
            />
          </>
        );

      case 'line':
        return (
          <>
            <line
              x1={startPoint.x}
              y1={startPoint.y}
              x2={currentPoint.x}
              y2={currentPoint.y}
              {...previewStyle}
              fill="none"
            />
            {/* Distance indicator */}
            <text
              x={midX}
              y={midY - 10 / camera.zoom}
              fill="#00bcd4"
              fontSize={14 / camera.zoom}
              fontWeight="bold"
              textAnchor="middle"
              pointerEvents="none"
              style={{
                textShadow:
                  '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,188,212,0.5)',
              }}
            >
              {distanceInFeet.toFixed(1)} ft
            </text>
          </>
        );

      case 'rectangle': {
        const width = Math.abs(currentPoint.x - startPoint.x);
        const height = Math.abs(currentPoint.y - startPoint.y);
        const widthFeet = (width / _gridSize) * 5;
        const heightFeet = (height / _gridSize) * 5;
        const rectMidX = Math.min(startPoint.x, currentPoint.x) + width / 2;
        const rectMidY = Math.min(startPoint.y, currentPoint.y) + height / 2;

        return (
          <>
            <rect
              x={Math.min(startPoint.x, currentPoint.x)}
              y={Math.min(startPoint.y, currentPoint.y)}
              width={width}
              height={height}
              {...previewStyle}
            />
            {/* Dimension indicator */}
            <text
              x={rectMidX}
              y={rectMidY - 10 / camera.zoom}
              fill="#00bcd4"
              fontSize={14 / camera.zoom}
              fontWeight="bold"
              textAnchor="middle"
              pointerEvents="none"
              style={{
                textShadow:
                  '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,188,212,0.5)',
              }}
            >
              {widthFeet.toFixed(1)} × {heightFeet.toFixed(1)} ft
            </text>
          </>
        );
      }

      case 'circle': {
        const radius = distance(startPoint, currentPoint);
        const radiusFeet = (radius / _gridSize) * 5;

        return (
          <>
            <circle
              cx={startPoint.x}
              cy={startPoint.y}
              r={radius}
              {...previewStyle}
            />
            {/* Radius indicator */}
            <text
              x={startPoint.x}
              y={startPoint.y - radius - 15 / camera.zoom}
              fill="#00bcd4"
              fontSize={14 / camera.zoom}
              fontWeight="bold"
              textAnchor="middle"
              pointerEvents="none"
              style={{
                textShadow:
                  '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,188,212,0.5)',
              }}
            >
              r: {radiusFeet.toFixed(1)} ft
            </text>
          </>
        );
      }

      case 'cone': {
        const length = distance(startPoint, currentPoint);
        // No automatic snapping - draw smoothly
        const lengthFeet = (length / _gridSize) * 5;

        const direction =
          (Math.atan2(
            currentPoint.y - startPoint.y,
            currentPoint.x - startPoint.x,
          ) *
            180) /
          Math.PI;
        const angleRad = (direction * Math.PI) / 180;
        // D&D 5e cone: 53.13 degrees (equilateral triangle, width = distance)
        const coneAngleRad = (53.13 * Math.PI) / 180;

        const leftX =
          startPoint.x + Math.cos(angleRad - coneAngleRad / 2) * length;
        const leftY =
          startPoint.y + Math.sin(angleRad - coneAngleRad / 2) * length;
        const rightX =
          startPoint.x + Math.cos(angleRad + coneAngleRad / 2) * length;
        const rightY =
          startPoint.y + Math.sin(angleRad + coneAngleRad / 2) * length;

        const pathData = `M ${startPoint.x} ${startPoint.y} L ${leftX} ${leftY} A ${length} ${length} 0 0 1 ${rightX} ${rightY} Z`;

        // Calculate label position at the end of the cone
        const labelX = startPoint.x + Math.cos(angleRad) * length;
        const labelY = startPoint.y + Math.sin(angleRad) * length;

        return (
          <>
            <path d={pathData} {...previewStyle} />
            {/* Length indicator */}
            <text
              x={labelX}
              y={labelY - 15 / camera.zoom}
              fill="#00bcd4"
              fontSize={14 / camera.zoom}
              fontWeight="bold"
              textAnchor="middle"
              pointerEvents="none"
              style={{
                textShadow:
                  '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,188,212,0.5)',
              }}
            >
              {lengthFeet.toFixed(0)} ft
            </text>
          </>
        );
      }

      // Spell overlay previews
      case 'spell-circle': {
        const radius = distance(startPoint, currentPoint);
        const radiusFeet = (radius / _gridSize) * 5;

        return (
          <>
            <circle
              cx={startPoint.x}
              cy={startPoint.y}
              r={radius}
              fill="none"
              stroke="#000000"
              strokeWidth={2 / camera.zoom}
              strokeDasharray="8,4"
              opacity={0.8}
              pointerEvents="none"
            />
            <text
              x={startPoint.x}
              y={startPoint.y - radius - 15 / camera.zoom}
              fill="#00bcd4"
              fontSize={14 / camera.zoom}
              fontWeight="bold"
              textAnchor="middle"
              pointerEvents="none"
              style={{
                textShadow: '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,188,212,0.5)',
              }}
            >
              {radiusFeet.toFixed(0)} ft radius
            </text>
          </>
        );
      }

      case 'spell-ring': {
        const outerRadius = distance(startPoint, currentPoint);
        // Ring thickness stays fairly constant, matching the drawing creator
        const thickness = Math.max(15, Math.min(60, 15 + outerRadius * 0.1));
        const innerRadius = Math.max(0, outerRadius - thickness);
        const radiusFeet = (outerRadius / _gridSize) * 5;
        const thicknessFeet = (thickness / _gridSize) * 5;

        return (
          <>
            {/* Outer circle */}
            <circle
              cx={startPoint.x}
              cy={startPoint.y}
              r={outerRadius}
              fill="none"
              stroke="#000000"
              strokeWidth={3 / camera.zoom}
              strokeDasharray="8,4"
              opacity={0.9}
              pointerEvents="none"
            />
            {/* Inner circle - only show if visible */}
            {innerRadius > 5 && (
              <circle
                cx={startPoint.x}
                cy={startPoint.y}
                r={innerRadius}
                fill="none"
                stroke="#000000"
                strokeWidth={3 / camera.zoom}
                strokeDasharray="8,4"
                opacity={0.9}
                pointerEvents="none"
              />
            )}
            {/* Fill the ring area with semi-transparent color to make it more visible */}
            <circle
              cx={startPoint.x}
              cy={startPoint.y}
              r={outerRadius}
              fill="rgba(0, 188, 212, 0.15)"
              pointerEvents="none"
            />
            {innerRadius > 5 && (
              <circle
                cx={startPoint.x}
                cy={startPoint.y}
                r={innerRadius}
                fill="rgba(0, 0, 0, 0.3)"
                pointerEvents="none"
              />
            )}
            <text
              x={startPoint.x}
              y={startPoint.y - outerRadius - 15 / camera.zoom}
              fill="#00bcd4"
              fontSize={14 / camera.zoom}
              fontWeight="bold"
              textAnchor="middle"
              pointerEvents="none"
              style={{
                textShadow: '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,188,212,0.5)',
              }}
            >
              {radiusFeet.toFixed(0)} ft ring ({thicknessFeet.toFixed(0)} ft thick)
            </text>
          </>
        );
      }

      case 'spell-cone': {
        const length = distance(startPoint, currentPoint);
        const lengthFeet = (length / _gridSize) * 5;
        const direction = (Math.atan2(currentPoint.y - startPoint.y, currentPoint.x - startPoint.x) * 180) / Math.PI;
        const angleRad = (direction * Math.PI) / 180;
        const coneAngleRad = (90 * Math.PI) / 180; // 90-degree cone

        const leftX = startPoint.x + Math.cos(angleRad - coneAngleRad / 2) * length;
        const leftY = startPoint.y + Math.sin(angleRad - coneAngleRad / 2) * length;
        const rightX = startPoint.x + Math.cos(angleRad + coneAngleRad / 2) * length;
        const rightY = startPoint.y + Math.sin(angleRad + coneAngleRad / 2) * length;

        const pathData = `M ${startPoint.x} ${startPoint.y} L ${leftX} ${leftY} A ${length} ${length} 0 0 1 ${rightX} ${rightY} Z`;
        const labelX = startPoint.x + Math.cos(angleRad) * length;
        const labelY = startPoint.y + Math.sin(angleRad) * length;

        return (
          <>
            <path
              d={pathData}
              fill="none"
              stroke="#000000"
              strokeWidth={2 / camera.zoom}
              strokeDasharray="8,4"
              opacity={0.8}
              pointerEvents="none"
            />
            <text
              x={labelX}
              y={labelY - 15 / camera.zoom}
              fill="#00bcd4"
              fontSize={14 / camera.zoom}
              fontWeight="bold"
              textAnchor="middle"
              pointerEvents="none"
              style={{
                textShadow: '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,188,212,0.5)',
              }}
            >
              {lengthFeet.toFixed(0)} ft cone
            </text>
          </>
        );
      }

      case 'spell-line': {
        const angle = Math.atan2(currentPoint.y - startPoint.y, currentPoint.x - startPoint.x);
        const width = _gridSize || 50; // 5ft width
        const halfWidth = width / 2;
        const cos = Math.cos(angle + Math.PI / 2);
        const sin = Math.sin(angle + Math.PI / 2);

        const p1 = { x: startPoint.x + cos * halfWidth, y: startPoint.y + sin * halfWidth };
        const p2 = { x: startPoint.x - cos * halfWidth, y: startPoint.y - sin * halfWidth };
        const p3 = { x: currentPoint.x - cos * halfWidth, y: currentPoint.y - sin * halfWidth };
        const p4 = { x: currentPoint.x + cos * halfWidth, y: currentPoint.y + sin * halfWidth };

        const pathData = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${p4.x} ${p4.y} Z`;
        const lengthFeet = (distance(startPoint, currentPoint) / _gridSize) * 5;
        const midX = (startPoint.x + currentPoint.x) / 2;
        const midY = (startPoint.y + currentPoint.y) / 2;

        return (
          <>
            <path
              d={pathData}
              fill="none"
              stroke="#000000"
              strokeWidth={2 / camera.zoom}
              strokeDasharray="8,4"
              opacity={0.8}
              pointerEvents="none"
            />
            <text
              x={midX}
              y={midY - 15 / camera.zoom}
              fill="#00bcd4"
              fontSize={14 / camera.zoom}
              fontWeight="bold"
              textAnchor="middle"
              pointerEvents="none"
              style={{
                textShadow: '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,188,212,0.5)',
              }}
            >
              {lengthFeet.toFixed(0)} ft × 5 ft
            </text>
          </>
        );
      }

      case 'spell-square': {
        const size = distance(startPoint, currentPoint);
        const sizeFeet = (size / _gridSize) * 5;
        const halfSize = size / 2;

        return (
          <>
            <rect
              x={startPoint.x - halfSize}
              y={startPoint.y - halfSize}
              width={size}
              height={size}
              fill="none"
              stroke="#000000"
              strokeWidth={2 / camera.zoom}
              strokeDasharray="8,4"
              opacity={0.8}
              pointerEvents="none"
            />
            <text
              x={startPoint.x}
              y={startPoint.y - halfSize - 15 / camera.zoom}
              fill="#00bcd4"
              fontSize={14 / camera.zoom}
              fontWeight="bold"
              textAnchor="middle"
              pointerEvents="none"
              style={{
                textShadow: '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,188,212,0.5)',
              }}
            >
              {sizeFeet.toFixed(0)} ft cube
            </text>
          </>
        );
      }

      case 'spell-triangle': {
        const length = distance(startPoint, currentPoint);
        const lengthFeet = (length / _gridSize) * 5;
        const direction = (Math.atan2(currentPoint.y - startPoint.y, currentPoint.x - startPoint.x) * 180) / Math.PI;
        const angleRad = (direction * Math.PI) / 180;
        const width = length * 0.8;
        const halfWidth = width / 2;

        const baseCenterX = startPoint.x + Math.cos(angleRad) * length;
        const baseCenterY = startPoint.y + Math.sin(angleRad) * length;
        const perpAngle = angleRad + Math.PI / 2;
        const cos = Math.cos(perpAngle);
        const sin = Math.sin(perpAngle);

        const baseLeft = { x: baseCenterX + cos * halfWidth, y: baseCenterY + sin * halfWidth };
        const baseRight = { x: baseCenterX - cos * halfWidth, y: baseCenterY - sin * halfWidth };

        const pathData = `M ${startPoint.x} ${startPoint.y} L ${baseLeft.x} ${baseLeft.y} L ${baseRight.x} ${baseRight.y} Z`;
        const labelX = startPoint.x + Math.cos(angleRad) * (length * 0.6);
        const labelY = startPoint.y + Math.sin(angleRad) * (length * 0.6);

        return (
          <>
            <path
              d={pathData}
              fill="none"
              stroke="#000000"
              strokeWidth={2 / camera.zoom}
              strokeDasharray="8,4"
              opacity={0.8}
              pointerEvents="none"
            />
            <text
              x={labelX}
              y={labelY - 15 / camera.zoom}
              fill="#00bcd4"
              fontSize={14 / camera.zoom}
              fontWeight="bold"
              textAnchor="middle"
              pointerEvents="none"
              style={{
                textShadow: '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,188,212,0.5)',
              }}
            >
              {lengthFeet.toFixed(0)} ft wedge
            </text>
          </>
        );
      }

      default:
        return null;
    }
  };

  // Render polygon preview lines (also used for mask-create)
  const renderPolygonPreview = () => {
    if (
      (activeTool !== 'polygon' && activeTool !== 'mask-create') ||
      polygonPoints.length === 0
    )
      return null;

    const isMask = activeTool === 'mask-create';
    const previewStyle = {
      stroke: isMask ? '#666666' : drawingStyle.strokeColor,
      strokeWidth: (isMask ? 2 : drawingStyle.strokeWidth) / camera.zoom,
      fill: 'none',
      strokeDasharray: '5,5',
      pointerEvents: 'none' as const,
    };

    return (
      <>
        {/* Draw lines between polygon points */}
        {polygonPoints.map((point, index) => {
          if (index === 0) return null;
          const prevPoint = polygonPoints[index - 1];
          return (
            <line
              key={`polygon-line-${index}`}
              x1={prevPoint.x}
              y1={prevPoint.y}
              x2={point.x}
              y2={point.y}
              {...previewStyle}
            />
          );
        })}

        {/* Draw line from last point to current cursor position */}
        {currentPoint && (
          <line
            x1={polygonPoints[polygonPoints.length - 1].x}
            y1={polygonPoints[polygonPoints.length - 1].y}
            x2={currentPoint.x}
            y2={currentPoint.y}
            {...previewStyle}
          />
        )}

        {/* Draw points as small circles */}
        {polygonPoints.map((point, index) => (
          <circle
            key={`polygon-point-${index}`}
            cx={point.x}
            cy={point.y}
            r={3 / camera.zoom}
            fill={isMask ? '#666666' : drawingStyle.strokeColor}
            pointerEvents="none"
          />
        ))}
      </>
    );
  };

  // Render selection box
  const renderSelectionBox = () => {
    if (!selectionBox) return null;

    const x = Math.min(selectionBox.start.x, selectionBox.end.x);
    const y = Math.min(selectionBox.start.y, selectionBox.end.y);
    const width = Math.abs(selectionBox.end.x - selectionBox.start.x);
    const height = Math.abs(selectionBox.end.y - selectionBox.start.y);

    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="rgba(0, 120, 255, 0.1)"
        stroke="rgba(0, 120, 255, 0.5)"
        strokeWidth={1 / camera.zoom}
        strokeDasharray="5,5"
        pointerEvents="none"
      />
    );
  };

  // Render grid alignment helpers
  const renderGridAlignmentHelpers = () => {
    if (activeTool !== 'grid-align' || !activeScene?.gridSettings?.enabled) {
      return null;
    }

    const gridSize = activeScene.gridSettings.size || 50;
    const offsetX = fineTuningOffset?.x ?? activeScene.gridSettings.offsetX ?? 0;
    const offsetY = fineTuningOffset?.y ?? activeScene.gridSettings.offsetY ?? 0;

    // Calculate visible grid intersections based on current viewport
    // Use fallback values if ref not yet initialized
    const worldWidth = (svgRef.current?.clientWidth || 800) / camera.zoom;
    const worldHeight = (svgRef.current?.clientHeight || 600) / camera.zoom;
    const worldLeft = camera.x - worldWidth / 2;
    const worldTop = camera.y - worldHeight / 2;
    const worldRight = camera.x + worldWidth / 2;
    const worldBottom = camera.y + worldHeight / 2;

    // Calculate grid intersection points in viewport
    const gridIntersections: Point[] = [];
    const gridLeft = Math.floor((worldLeft - offsetX) / gridSize) * gridSize + offsetX;
    const gridTop = Math.floor((worldTop - offsetY) / gridSize) * gridSize + offsetY;
    const gridRight = Math.ceil((worldRight - offsetX) / gridSize) * gridSize + offsetX;
    const gridBottom = Math.ceil((worldBottom - offsetY) / gridSize) * gridSize + offsetY;

    // Limit the number of crosshairs to avoid performance issues
    const maxCrosshairs = 100;
    let count = 0;

    for (let x = gridLeft; x <= gridRight && count < maxCrosshairs; x += gridSize) {
      for (let y = gridTop; y <= gridBottom && count < maxCrosshairs; y += gridSize) {
        gridIntersections.push({ x, y });
        count++;
      }
    }

    const crosshairSize = 8 / camera.zoom;
    const markerSize = 10 / camera.zoom;

    return (
      <>
        {/* Render crosshairs at grid intersections (only when waiting for click) */}
        {(gridAlignMode === 'waiting-first' || gridAlignMode === 'waiting-second') &&
          gridIntersections.map((point, index) => (
            <g key={`crosshair-${index}`} opacity={0.4}>
              {/* Horizontal line */}
              <line
                x1={point.x - crosshairSize}
                y1={point.y}
                x2={point.x + crosshairSize}
                y2={point.y}
                stroke="#00bcd4"
                strokeWidth={1 / camera.zoom}
                pointerEvents="none"
              />
              {/* Vertical line */}
              <line
                x1={point.x}
                y1={point.y - crosshairSize}
                x2={point.x}
                y2={point.y + crosshairSize}
                stroke="#00bcd4"
                strokeWidth={1 / camera.zoom}
                pointerEvents="none"
              />
            </g>
          ))}

        {/* Render markers for clicked points */}
        {gridAlignPoints.map((point, index) => (
          <g key={`marker-${index}`}>
            {/* Outer circle */}
            <circle
              cx={point.x}
              cy={point.y}
              r={markerSize}
              fill="rgba(0, 188, 212, 0.3)"
              stroke="#00bcd4"
              strokeWidth={2 / camera.zoom}
              pointerEvents="none"
            />
            {/* Inner circle */}
            <circle
              cx={point.x}
              cy={point.y}
              r={markerSize / 3}
              fill="#00bcd4"
              pointerEvents="none"
            />
            {/* Label */}
            <text
              x={point.x}
              y={point.y - markerSize - 5 / camera.zoom}
              fill="#00bcd4"
              fontSize={12 / camera.zoom}
              fontWeight="bold"
              textAnchor="middle"
              pointerEvents="none"
              style={{
                textShadow: '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,188,212,0.5)',
              }}
            >
              Point {index + 1}
            </text>
          </g>
        ))}

        {/* Render preview line between two points */}
        {gridAlignMode === 'waiting-second' &&
          gridAlignPoints.length === 1 &&
          currentPoint && (
            <>
              <line
                x1={gridAlignPoints[0].x}
                y1={gridAlignPoints[0].y}
                x2={currentPoint.x}
                y2={currentPoint.y}
                stroke="#00bcd4"
                strokeWidth={2 / camera.zoom}
                strokeDasharray="5,5"
                pointerEvents="none"
              />
              {/* Distance label */}
              <text
                x={(gridAlignPoints[0].x + currentPoint.x) / 2}
                y={(gridAlignPoints[0].y + currentPoint.y) / 2 - 10 / camera.zoom}
                fill="#00bcd4"
                fontSize={12 / camera.zoom}
                fontWeight="bold"
                textAnchor="middle"
                pointerEvents="none"
                style={{
                  textShadow: '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,188,212,0.5)',
                }}
              >
                {distance(gridAlignPoints[0], currentPoint).toFixed(0)}px
              </text>
            </>
          )}

        {/* Fine-tuning mode indicator */}
        {gridAlignMode === 'fine-tuning' && (
          <text
            x={camera.x}
            y={camera.y - worldHeight / 2 + 30 / camera.zoom}
            fill="#4CAF50"
            fontSize={16 / camera.zoom}
            fontWeight="bold"
            textAnchor="middle"
            pointerEvents="none"
            style={{
              textShadow: '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(76,175,80,0.5)',
            }}
          >
            ⌨️ Fine-Tuning Mode - Use arrow keys to adjust (Enter to confirm, Esc to
            cancel)
          </text>
        )}
      </>
    );
  };

  const shouldRenderInteractionLayer = !['pan' as const, 'move' as const].includes(activeTool as 'pan' | 'move');

  return (
    <g className="drawing-tools">
      {/* Interaction layer - for drawing tools and select tool (not pan or move) */}
      {shouldRenderInteractionLayer && (
        <rect
          x={-10000}
          y={-10000}
          width={20000}
          height={20000}
          fill="transparent"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDoubleClick={handlePolygonComplete}
          onContextMenu={handlePolygonComplete}
          style={{
            cursor:
              activeTool === 'eraser'
                ? 'crosshair'
                : activeTool === 'select'
                  ? 'default'
                  : 'crosshair',
            pointerEvents: 'auto',
          }}
        />
      )}

      {/* Render preview shapes */}
      <g className="drawing-preview">
        {renderPreview()}
        {renderPolygonPreview()}
        {renderSelectionBox()}
        {/* Grid alignment needs ref for viewport calculations during render */}
        {/* eslint-disable-next-line react-hooks/refs -- Grid alignment needs viewport dimensions */}
        {renderGridAlignmentHelpers()}
      </g>
    </g>
  );
};

// Memoize to prevent unnecessary rerenders
export const DrawingTools = React.memo(DrawingToolsComponent);
