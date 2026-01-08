import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useLayoutEffect,
} from 'react';
import {
  useGameStore,
  useCamera,
  useFollowDM,
  useIsHost,
  useActiveTool,
  useSceneState,
  useSceneDrawings,
  useServerRoomCode,
  useUser,
  usePlacedTokens,
  usePlacedProps,
  useDrawingActions,
} from '@/stores/gameStore';
import { SceneGrid } from './SceneGrid';
import { SceneBackground } from './SceneBackground';
import { DrawingTools } from './DrawingTools';
import { RemoteCursors } from './RemoteCursors';
import { DrawingRenderer } from './DrawingRenderer';
import { SelectionOverlay } from './SelectionOverlay';
import { DrawingPropertiesPanel } from './DrawingPropertiesPanel';
import { SpellOverlayPropertiesPanel } from './SpellOverlayPropertiesPanel';
import { SpellOverlayPatterns } from './SpellOverlayPatterns';
import { TokenDropZone } from './TokenDropZone';
import { TokenRenderer } from './TokenRenderer';
import { PropRenderer } from './PropRenderer';
import { TokenToolbar } from '../Tokens/TokenToolbar';
import { PropToolbar } from '../Props/PropToolbar';
import { CanvasErrorBoundary, TokenErrorBoundary } from '../ErrorBoundary';
import { webSocketService } from '@/utils/websocket';
import { tokenAssetManager } from '@/services/tokenAssets';
import { propAssetManager } from '@/services/propAssets';
import { createPlacedToken, getTokenPixelSize } from '@/types/token';
import { createPlacedProp } from '@/types/prop';
import {
  useSelectedPlacedToken,
  useSelectedPlacedProp,
} from '@/stores/gameStore';
import type { Scene, WebSocketMessage } from '@/types/game';
import type { Token } from '@/types/token';
import type {
  DrawingTool,
  DrawingStyle,
  MeasurementTool,
  SpellOverlayDrawing,
} from '@/types/drawing';

interface SceneCanvasProps {
  scene: Scene;
}

const SceneCanvasComponent: React.FC<SceneCanvasProps> = ({ scene }) => {
  // Actions from store (don't cause rerenders)
  const {
    updateCamera,
    placeToken,
    moveTokenOptimistic,
    placeProp,
    movePropOptimistic,
    deleteProp,
    setSelection,
    addToSelection,
    clearSelection,
  } = useGameStore();

  // Specific selectors for state (cause rerenders only when relevant data changes)
  const user = useUser();
  const placedTokens = usePlacedTokens(scene.id);
  const placedProps = usePlacedProps(scene.id);
  const selectedPlacedToken = useSelectedPlacedToken();
  const selectedPlacedProp = useSelectedPlacedProp();
  const { selectedObjectIds } = useSceneState();
  const { updateDrawing } = useDrawingActions();

  // Debug logging for selected token
  React.useEffect(() => {
    console.log('🎯 SceneCanvas selectedPlacedToken changed:', {
      selectedPlacedToken,
      selectedObjectIds,
      tokensInScene: scene.placedTokens?.length || 0,
    });
  }, [selectedPlacedToken, selectedObjectIds, scene.placedTokens]);
  const camera = useCamera();
  const followDM = useFollowDM();
  const isHost = useIsHost();
  const activeTool = useActiveTool() as
    | DrawingTool
    | MeasurementTool
    | 'pan'
    | 'move'
    | 'select'
    | 'eraser'
    | 'ping'
    | 'polygon'
    | 'pencil'
    | 'mask-create'
    | 'mask-toggle'
    | 'mask-remove'
    | 'mask-show'
    | 'mask-hide'
    | 'grid-align';

  const roomCode = useServerRoomCode();

  // Debug log for background image
  useEffect(() => {}, [scene.id, scene.name, scene.backgroundImage]);

  // Safe access to scene properties with defaults
  const safeGridSettings = useMemo(
    () =>
      scene.gridSettings || {
        enabled: true,
        size: 50,
        color: '#ffffff',
        opacity: 0.3,
        snapToGrid: true,
        showToPlayers: true,
      },
    [scene.gridSettings],
  );
  const svgRef = useRef<SVGSVGElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 });
  const [assetsReady, setAssetsReady] = useState(false);
  const [drawingStyle] = useState<DrawingStyle>({
    fillColor: '#ff0000',
    fillOpacity: 0.5,
    strokeColor: '#000000',
    strokeWidth: 5,
    strokeDashArray: undefined,
    visibleToPlayers: true,
    dmNotesOnly: false,
    aoeRadius: 20,
    coneLength: 15,
    dndSpellLevel: 1,
  });

  const drawings = useSceneDrawings(scene.id);

  const selectedDrawingIds = useMemo(() => {
    const drawingIds = new Set(drawings.map((d) => d.id));
    const filtered = selectedObjectIds.filter((id) => drawingIds.has(id));
    console.log('🎨 SceneCanvas selectedDrawingIds:', {
      selectedObjectIds,
      drawingIds: Array.from(drawingIds),
      filtered,
    });
    return filtered;
  }, [selectedObjectIds, drawings]);

  // Filter for spell overlay drawings specifically
  const selectedSpellOverlay = useMemo(() => {
    if (selectedDrawingIds.length !== 1) return null;
    const drawing = drawings.find((d) => d.id === selectedDrawingIds[0]);
    if (!drawing) return null;

    const spellTypes = [
      'spell-circle',
      'spell-ring',
      'spell-cone',
      'spell-line',
      'spell-square',
      'spell-triangle',
    ];
    if (spellTypes.includes(drawing.type)) {
      return drawing as SpellOverlayDrawing;
    }
    return null;
  }, [selectedDrawingIds, drawings]);

  // Update viewport size when container resizes
  useEffect(() => {
    const updateViewportSize = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setViewportSize({ width: rect.width, height: rect.height });
      }
    };

    updateViewportSize();
    window.addEventListener('resize', updateViewportSize);
    return () => window.removeEventListener('resize', updateViewportSize);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const initializeAssets = async () => {
      try {
        await tokenAssetManager.initialize();
        await tokenAssetManager.refreshCustomizations();
        await propAssetManager.initialize();
        await propAssetManager.refreshCustomLibraries();
      } catch (error) {
        console.warn('Failed to initialize scene assets:', error);
      } finally {
        if (isMounted) {
          setAssetsReady(true);
        }
      }
    };

    initializeAssets();

    return () => {
      isMounted = false;
    };
  }, []);

  // WebSocket event handling for incoming drawings and camera sync
  useEffect(() => {
    const handleWebSocketMessage = (event: Event) => {
      const customEvent = event as CustomEvent<WebSocketMessage>;
      const message = customEvent.detail;

      // Handle drawing synchronization events
      if (
        message.type === 'event' &&
        message.data.name?.startsWith('drawing/')
      ) {
        if (message.data.sceneId === scene.id) {
          // The event has already been processed by the game store
          // This is just for additional UI updates if needed
        }
      }

      // Handle camera synchronization for players following DM
      if (message.type === 'event' && message.data.name === 'camera/update') {
        if (message.data.sceneId === scene.id && !isHost && followDM) {
          // Camera update is handled by the game store
        }
      }
    };

    // Listen for WebSocket events
    webSocketService.addEventListener('message', handleWebSocketMessage);

    return () => {
      webSocketService.removeEventListener('message', handleWebSocketMessage);
    };
  }, [scene.id, isHost, followDM]);

  // Keyboard shortcuts for props
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        (e.target as HTMLElement).tagName === 'INPUT' ||
        (e.target as HTMLElement).tagName === 'TEXTAREA'
      ) {
        return;
      }

      // Delete key - delete selected props
      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.repeat) {
        const selectedPropIds = selectedObjectIds.filter((id) => {
          const props = placedProps;
          return props.some((p) => p.id === id);
        });

        if (selectedPropIds.length > 0 && isHost) {
          e.preventDefault();
          selectedPropIds.forEach((propId) => {
            deleteProp(scene.id, propId);
          });
          console.log(
            `🎭 Props: Deleted ${selectedPropIds.length} prop(s) via keyboard`,
          );
        }
      }

      // D key - duplicate selected prop
      if ((e.key === 'd' || e.key === 'D') && !e.repeat && isHost) {
        const selectedPropIds = selectedObjectIds.filter((id) => {
          const props = placedProps;
          return props.some((p) => p.id === id);
        });

        if (selectedPropIds.length === 1) {
          e.preventDefault();
          const props = placedProps;
          const propToDuplicate = props.find(
            (p) => p.id === selectedPropIds[0],
          );
          if (propToDuplicate) {
            const prop = propAssetManager.getPropById(propToDuplicate.propId);
            if (prop) {
              const duplicated = createPlacedProp(
                propToDuplicate.propId,
                scene.id,
                { x: propToDuplicate.x + 20, y: propToDuplicate.y + 20 },
                user.id,
              );
              duplicated.rotation = propToDuplicate.rotation;
              duplicated.scale = propToDuplicate.scale;
              duplicated.layer = propToDuplicate.layer;
              duplicated.visibleToPlayers = propToDuplicate.visibleToPlayers;
              duplicated.dmNotesOnly = propToDuplicate.dmNotesOnly;
              duplicated.currentStats = propToDuplicate.currentStats
                ? { ...propToDuplicate.currentStats }
                : undefined;

              placeProp(scene.id, duplicated);
              setSelection([duplicated.id]);
              console.log('🎭 Props: Duplicated prop via keyboard');
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    scene.id,
    selectedObjectIds,
    isHost,
    placedProps,
    deleteProp,
    placeProp,
    setSelection,
    user.id,
  ]);

  // Camera controls
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (activeTool !== 'pan' && activeTool !== 'select') return; // Only zoom when in pan/select mode
      if (!isHost && followDM) return; // Players can't zoom when following DM

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(5.0, camera.zoom * zoomFactor));

      updateCamera({ zoom: newZoom });

      // Send camera update to other players if host
      if (isHost) {
        webSocketService.sendEvent({
          type: 'camera/update',
          data: {
            sceneId: scene.id,
            camera: { ...camera, zoom: newZoom },
          },
        });
      }
    },
    [camera, updateCamera, isHost, followDM, activeTool, scene.id],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        // Left mouse button
        if (activeTool === 'pan' || (activeTool === 'select' && e.altKey)) {
          if (!isHost && followDM) return; // Players can't pan when following DM

          setIsPanning(true);
          setLastMousePos({ x: e.clientX, y: e.clientY });
          e.stopPropagation();
        } else if (activeTool === 'select') {
          // Handle selection tool clicks on empty space
          // This only fires if nothing else (token/drawing) handled the click
          console.log('🖱️ SceneCanvas mouseDown (empty space)', {
            shiftKey: e.shiftKey,
            target: (e.target as SVGElement)?.tagName,
          });

          if (!e.shiftKey) {
            // Click on empty space without shift -> deselect all
            clearSelection();
          }
          // Note: shift+drag selection box is handled by DrawingTools when it has pointer events
        }
      }
    },
    [isHost, followDM, activeTool, clearSelection],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        const deltaX = e.clientX - lastMousePos.x;
        const deltaY = e.clientY - lastMousePos.y;

        // Apply zoom scaling to movement
        const scaledDeltaX = deltaX / camera.zoom;
        const scaledDeltaY = deltaY / camera.zoom;

        updateCamera({
          x: camera.x - scaledDeltaX,
          y: camera.y - scaledDeltaY,
        });

        setLastMousePos({ x: e.clientX, y: e.clientY });

        // Send camera update to other players if host
        if (isHost) {
          webSocketService.sendEvent({
            type: 'camera/update',
            data: {
              sceneId: scene.id,
              camera: {
                x: camera.x - scaledDeltaX,
                y: camera.y - scaledDeltaY,
                zoom: camera.zoom,
              },
            },
          });
        }
      }
    },
    [isPanning, lastMousePos, camera, updateCamera, isHost, scene.id],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Tokens and props are now obtained from selectors above

  const handleClosePropertiesPanel = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const handleUpdateSpellOverlay = useCallback(
    (updates: Partial<SpellOverlayDrawing>) => {
      if (!selectedSpellOverlay) return;
      updateDrawing(scene.id, selectedSpellOverlay.id, updates);

      // Sync the update via WebSocket
      webSocketService.sendEvent({
        type: 'event',
        data: {
          name: 'drawing/update',
          sceneId: scene.id,
          drawingId: selectedSpellOverlay.id,
          updates,
        },
      });
    },
    [selectedSpellOverlay, scene.id, updateDrawing],
  );

  const handleDrawingClick = useCallback(
    (drawingId: string, event: React.MouseEvent) => {
      console.log('🎨 handleDrawingClick:', {
        drawingId,
        shiftKey: event.shiftKey,
      });

      if (event.shiftKey || event.metaKey || event.ctrlKey) {
        // Multi-select: toggle this drawing in selection
        if (selectedObjectIds.includes(drawingId)) {
          setSelection(selectedObjectIds.filter((id) => id !== drawingId));
        } else {
          setSelection([...selectedObjectIds, drawingId]);
        }
      } else {
        // Single select: select only this drawing
        setSelection([drawingId]);
      }
    },
    [selectedObjectIds, setSelection],
  );

  // Token handlers
  const handleTokenDrop = useCallback(
    (token: Token, x: number, y: number) => {
      // Check if token is exclusive and already exists in this scene
      if (token.exclusive) {
        const alreadyPlaced = placedTokens.some(
          (pt) => pt.tokenId === token.id,
        );
        if (alreadyPlaced) {
          alert(
            `${token.name} is marked as exclusive and can only be placed once per scene. Remove the existing instance first.`,
          );
          return;
        }
      }

      const placedToken = createPlacedToken(
        token,
        { x, y },
        scene.id,
        roomCode || '',
        user.id,
        {
          visibleToPlayers: token.isPublic !== false,
        },
      );

      placeToken(scene.id, placedToken);

      // Broadcast over WebSocket
      webSocketService.sendEvent({
        type: 'token/place',
        data: {
          sceneId: scene.id,
          token: placedToken,
        },
      });
    },
    [scene.id, user.id, placeToken, roomCode, placedTokens],
  );

  const handleTokenSelect = useCallback(
    (tokenId: string, multi: boolean) => {
      console.log('🎯 handleTokenSelect called:', { tokenId, multi });
      if (multi) {
        console.log('📝 Multi-select: calling addToSelection with:', [tokenId]);
        addToSelection([tokenId]);
        console.log('✅ addToSelection completed');
      } else {
        console.log('📝 Single-select: calling setSelection with:', [tokenId]);
        setSelection([tokenId]);
        console.log('✅ setSelection completed');
      }

      // Debug: Check if selection was actually updated
      setTimeout(() => {
        console.log('🔍 Selection check after handleTokenSelect');
      }, 0);
    },
    [addToSelection, setSelection],
  );

  const handleTokenMove = useCallback(
    (tokenId: string, deltaX: number, deltaY: number) => {
      // Get fresh token position from store to avoid dependency on placedTokens
      const tokens = useGameStore.getState().getSceneTokens(scene.id);
      const token = tokens.find((t) => t.id === tokenId);
      if (!token) return;

      const newX = token.x + deltaX / camera.zoom;
      const newY = token.y + deltaY / camera.zoom;

      // Optimistic update - move locally first, then send to server
      moveTokenOptimistic(scene.id, tokenId, { x: newX, y: newY });
    },
    [scene.id, camera.zoom, moveTokenOptimistic],
  );

  const handleTokenMoveEnd = useCallback(
    (tokenId: string) => {
      // Apply grid snapping when drag ends
      if (safeGridSettings.snapToGrid && safeGridSettings.size > 0) {
        // Get fresh token position from store to avoid dependency on placedTokens
        const tokens = useGameStore.getState().getSceneTokens(scene.id);
        const token = tokens.find((t) => t.id === tokenId);
        if (!token) return;

        const snappedX =
          Math.round(token.x / safeGridSettings.size) * safeGridSettings.size;
        const snappedY =
          Math.round(token.y / safeGridSettings.size) * safeGridSettings.size;

        // Only update if position changed after snapping
        if (snappedX !== token.x || snappedY !== token.y) {
          moveTokenOptimistic(scene.id, tokenId, { x: snappedX, y: snappedY });
        }
      }
    },
    [scene.id, safeGridSettings, moveTokenOptimistic],
  );

  // Prop handlers (mirror token handlers)
  const handlePropSelect = useCallback(
    (propId: string, multi: boolean) => {
      console.log('🎭 Props: handlePropSelect called:', { propId, multi });
      if (multi) {
        console.log('📝 Props: Multi-select: calling addToSelection with:', [
          propId,
        ]);
        addToSelection([propId]);
        console.log('✅ Props: addToSelection completed');
      } else {
        console.log('📝 Props: Single-select: calling setSelection with:', [
          propId,
        ]);
        setSelection([propId]);
        console.log('✅ Props: setSelection completed');
      }
    },
    [addToSelection, setSelection],
  );

  const handlePropMove = useCallback(
    (propId: string, deltaX: number, deltaY: number) => {
      const props = placedProps;
      const prop = props.find((p) => p.id === propId);
      if (!prop) return;

      const newX = prop.x + deltaX / camera.zoom;
      const newY = prop.y + deltaY / camera.zoom;

      // Optimistic update - move locally first, then send to server
      movePropOptimistic(scene.id, propId, { x: newX, y: newY });
    },
    [scene.id, camera.zoom, placedProps, movePropOptimistic],
  );

  const handlePropMoveEnd = useCallback(
    (propId: string) => {
      // Apply grid snapping when drag ends
      if (safeGridSettings.snapToGrid && safeGridSettings.size > 0) {
        const props = placedProps;
        const prop = props.find((p) => p.id === propId);
        if (!prop) return;

        const snappedX =
          Math.round(prop.x / safeGridSettings.size) * safeGridSettings.size;
        const snappedY =
          Math.round(prop.y / safeGridSettings.size) * safeGridSettings.size;

        // Only update if position changed after snapping
        if (snappedX !== prop.x || snappedY !== prop.y) {
          movePropOptimistic(scene.id, propId, { x: snappedX, y: snappedY });
        }
      }
    },
    [scene.id, safeGridSettings, placedProps, movePropOptimistic],
  );

  const [isDraggingProp, setIsDraggingProp] = useState(false);
  const [svgSize, setSvgSize] = useState(() => ({
    width: viewportSize.width,
    height: viewportSize.height,
  }));

  // Keep svgSize in sync with actual rendered SVG dimensions
  useLayoutEffect(() => {
    if (!svgRef.current) return;

    const updateSize = () => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        setSvgSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();

    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(updateSize);
      observer.observe(svgRef.current);
      return () => observer.disconnect();
    } else {
      (window as Window).addEventListener('resize', updateSize);
      return () => (window as Window).removeEventListener('resize', updateSize);
    }
  }, [viewportSize.width, viewportSize.height]);

  // Handle prop drop from PropPanel
  const handlePropDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingProp(false);

      // Check if this is a prop being dragged
      const propData = e.dataTransfer.getData('application/prop');
      if (!propData) return;

      try {
        const prop = JSON.parse(propData);

        // Get the SVG element and its bounding box
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();

        // Calculate position relative to SVG
        const relativeX = e.clientX - rect.left;
        const relativeY = e.clientY - rect.top;

        // Convert screen coordinates to scene coordinates
        const sceneX = (relativeX - rect.width / 2) / camera.zoom + camera.x;
        const sceneY = (relativeY - rect.height / 2) / camera.zoom + camera.y;

        // Apply grid snapping if enabled
        let finalX = sceneX;
        let finalY = sceneY;

        if (safeGridSettings.snapToGrid && safeGridSettings.size > 0) {
          finalX =
            Math.round(sceneX / safeGridSettings.size) * safeGridSettings.size;
          finalY =
            Math.round(sceneY / safeGridSettings.size) * safeGridSettings.size;
        }

        // Create placed prop with correct arguments
        const placedProp = createPlacedProp(
          prop.id, // propId (string)
          scene.id, // sceneId (string)
          { x: finalX, y: finalY }, // position (Point)
          user.id, // placedBy (string)
        );

        // Place the prop
        placeProp(scene.id, placedProp);

        // Broadcast over WebSocket (similar to token placement)
        webSocketService.sendEvent({
          type: 'prop/place',
          data: {
            sceneId: scene.id,
            prop: placedProp,
          },
        });

        console.log('🎭 Props: Dropped prop:', {
          propName: prop.name,
          position: { x: finalX, y: finalY },
        });
      } catch (error) {
        console.error('❌ Props: Failed to parse dropped prop data:', error);
      }
    },
    [scene.id, camera, safeGridSettings, placeProp, user.id],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    // Must prevent default to allow drop
    e.preventDefault();

    // Check if dragging a prop
    const types = e.dataTransfer.types;
    if (types.includes('application/prop')) {
      e.dataTransfer.dropEffect = 'copy';
      setIsDraggingProp(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the canvas entirely
    if (e.currentTarget === e.target) {
      setIsDraggingProp(false);
    }
  }, []);

  // Determine cursor based on active tool and state
  const getCursor = () => {
    if (isPanning) return 'grabbing';
    if (activeTool === 'pan') return 'grab';
    if (activeTool === 'select') return 'default';
    if (activeTool === 'move') return 'move';
    return 'crosshair';
  };

  // Calculate transform for the scene content
  const transform = `translate(${svgSize.width / 2 - camera.x * camera.zoom}, ${svgSize.height / 2 - camera.y * camera.zoom}) scale(${camera.zoom})`;

  // Calculate toolbar position for selected token
  const getToolbarPosition = useCallback(() => {
    if (!selectedPlacedToken) return { x: 0, y: 0 };

    // Calculate screen position: apply camera transform to token position
    const screenX =
      svgSize.width / 2 + (selectedPlacedToken.x - camera.x) * camera.zoom;
    const screenY =
      svgSize.height / 2 + (selectedPlacedToken.y - camera.y) * camera.zoom;

    // Position toolbar above and to the right of the token
    const tokenSize =
      getTokenPixelSize(
        tokenAssetManager.getTokenById(selectedPlacedToken.tokenId)?.size ||
          'medium',
        safeGridSettings.size,
      ) *
      selectedPlacedToken.scale *
      camera.zoom;

    // Estimate toolbar dimensions (approximate)
    const toolbarWidth = 400; // Approximate width when panel is open
    const toolbarHeight = 60; // Approximate height of main toolbar
    const toolbarOffset = 10; // Spacing from token

    // Default: right of token
    let x = screenX + tokenSize / 2 + toolbarOffset;
    let y = screenY - tokenSize / 2 - toolbarOffset;

    // Check if toolbar would go off right edge of screen
    if (x + toolbarWidth > svgSize.width) {
      // Position to left of token instead
      x = screenX - tokenSize / 2 - toolbarWidth - toolbarOffset;
    }

    // Ensure toolbar doesn't go off left edge
    if (x < 0) {
      x = toolbarOffset;
    }

    // Check if toolbar would go off top edge
    if (y < 0) {
      // Position below token instead
      y = screenY + tokenSize / 2 + toolbarOffset;
    }

    // Check if toolbar would go off bottom edge
    if (y + toolbarHeight > svgSize.height) {
      y = svgSize.height - toolbarHeight - toolbarOffset;
    }

    return { x, y };
  }, [selectedPlacedToken, camera, svgSize, safeGridSettings.size]);

  // Calculate toolbar position for selected prop
  const getPropToolbarPosition = useCallback(() => {
    if (!selectedPlacedProp) return { x: 0, y: 0 };

    // Calculate screen position: apply camera transform to prop position
    const screenX =
      svgSize.width / 2 + (selectedPlacedProp.x - camera.x) * camera.zoom;
    const screenY =
      svgSize.height / 2 + (selectedPlacedProp.y - camera.y) * camera.zoom;

    // Calculate prop size in pixels
    const propWidth =
      (selectedPlacedProp.width || 1) *
      safeGridSettings.size *
      selectedPlacedProp.scale *
      camera.zoom;
    const propHeight =
      (selectedPlacedProp.height || 1) *
      safeGridSettings.size *
      selectedPlacedProp.scale *
      camera.zoom;

    // Estimate toolbar dimensions (approximate)
    const toolbarWidth = 400; // Approximate width when panel is open
    const toolbarHeight = 60; // Approximate height of main toolbar
    const toolbarOffset = 10; // Spacing from prop

    // Default: right of prop
    let x = screenX + propWidth / 2 + toolbarOffset;
    let y = screenY - propHeight / 2 - toolbarOffset;

    // Check if toolbar would go off right edge of screen
    if (x + toolbarWidth > svgSize.width) {
      // Position to left of prop instead
      x = screenX - propWidth / 2 - toolbarWidth - toolbarOffset;
    }

    // Ensure toolbar doesn't go off left edge
    if (x < 0) {
      x = toolbarOffset;
    }

    // Check if toolbar would go off top edge
    if (y < 0) {
      // Position below prop instead
      y = screenY + propHeight / 2 + toolbarOffset;
    }

    // Check if toolbar would go off bottom edge
    if (y + toolbarHeight > svgSize.height) {
      y = svgSize.height - toolbarHeight - toolbarOffset;
    }

    return { x, y };
  }, [selectedPlacedProp, camera, svgSize, safeGridSettings.size]);

  return (
    <CanvasErrorBoundary>
      <div className="scene-canvas-container">
        {/* Spell Overlay Properties Panel */}
        {selectedSpellOverlay && (
          <SpellOverlayPropertiesPanel
            drawing={selectedSpellOverlay}
            onUpdate={handleUpdateSpellOverlay}
            onClose={handleClosePropertiesPanel}
            gridSize={safeGridSettings.size}
          />
        )}

        {/* Drawing Properties Panel (for non-spell overlays) */}
        {selectedDrawingIds.length > 0 && !selectedSpellOverlay && (
          <DrawingPropertiesPanel
            selectedDrawingIds={selectedDrawingIds}
            sceneId={scene.id}
            onClose={handleClosePropertiesPanel}
          />
        )}

        {/* Token Toolbar */}
        {selectedPlacedToken && (
          <TokenToolbar position={getToolbarPosition()} />
        )}

        {/* Prop Toolbar */}
        {selectedPlacedProp && (
          <PropToolbar
            position={getPropToolbarPosition()}
            placedProp={selectedPlacedProp}
          />
        )}

        <TokenDropZone
          sceneId={scene.id}
          camera={camera}
          gridSettings={safeGridSettings}
          onTokenDrop={handleTokenDrop}
        >
          <svg
            ref={svgRef}
            className="scene-canvas"
            width="100%"
            height="100%"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onDrop={handlePropDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            style={{ cursor: getCursor() }}
          >
            <defs>
              {/* Define patterns and gradients here */}
              <pattern
                id={`grid-${scene.id}`}
                width={safeGridSettings.size}
                height={safeGridSettings.size}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${safeGridSettings.size} 0 L 0 0 0 ${safeGridSettings.size}`}
                  fill="none"
                  stroke={safeGridSettings.color}
                  strokeWidth="1"
                  opacity={safeGridSettings.opacity}
                />
              </pattern>

              {/* Light source gradient */}
              <radialGradient id="light-gradient">
                <stop offset="0%" stopColor="#FFD700" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#FFD700" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
              </radialGradient>

              {/* Spell overlay patterns, gradients, and filters */}
              <SpellOverlayPatterns />
            </defs>

            <g className="scene-content" transform={transform}>
              {/* Background layer */}
              {scene.backgroundImage && (
                <SceneBackground
                  backgroundImage={scene.backgroundImage}
                  sceneId={scene.id}
                />
              )}

              {/* Grid layer */}
              {safeGridSettings.enabled && (
                <SceneGrid
                  scene={scene}
                  viewportSize={viewportSize}
                  camera={camera}
                />
              )}

              {/* Drawings layer */}
              <DrawingRenderer
                sceneId={scene.id}
                camera={camera}
                isHost={isHost}
                activeTool={activeTool}
                selectedObjectIds={selectedObjectIds}
                onDrawingClick={handleDrawingClick}
              />

              {/* Tokens layer */}
              <TokenErrorBoundary>
                <g id="tokens-layer">
                  {assetsReady &&
                    placedTokens.map((placedToken) => {
                      const token = tokenAssetManager.getTokenById(
                        placedToken.tokenId,
                      );
                      if (!token) return null;

                      // Filter by visibility
                      if (!isHost && !placedToken.visibleToPlayers) return null;

                      return (
                        <TokenRenderer
                          key={placedToken.id}
                          placedToken={placedToken}
                          token={token}
                          gridSize={safeGridSettings.size}
                          isSelected={selectedObjectIds.includes(
                            placedToken.id,
                          )}
                          onSelect={handleTokenSelect}
                          onMove={handleTokenMove}
                          onMoveEnd={handleTokenMoveEnd}
                          canEdit={isHost || placedToken.placedBy === user.id}
                        />
                      );
                    })}
                </g>
              </TokenErrorBoundary>

              {/* Props layer */}
              <TokenErrorBoundary>
                <g id="props-layer">
                  {assetsReady &&
                    placedProps.map((placedProp) => {
                      const prop = propAssetManager.getPropById(
                        placedProp.propId,
                      );
                      // PropAssetManager now returns a placeholder for missing props, so this check is no longer needed

                      // Filter by visibility
                      if (!isHost && !placedProp.visibleToPlayers) return null;

                      return (
                        <PropRenderer
                          key={placedProp.id}
                          placedProp={placedProp}
                          prop={prop}
                          gridSize={safeGridSettings.size}
                          isSelected={selectedObjectIds.includes(placedProp.id)}
                          onSelect={handlePropSelect}
                          onMove={handlePropMove}
                          onMoveEnd={handlePropMoveEnd}
                          canEdit={isHost || placedProp.placedBy === user.id}
                          sceneId={scene.id}
                        />
                      );
                    })}
                </g>
              </TokenErrorBoundary>

              {/* Drawing tools layer (interactive) */}
              <DrawingTools
                activeTool={activeTool}
                drawingStyle={drawingStyle}
                camera={camera}
                _gridSize={safeGridSettings.size}
                svgRef={svgRef as React.RefObject<SVGSVGElement>}
                snapToGrid={safeGridSettings.snapToGrid}
                selectedObjectIds={selectedObjectIds}
                setSelection={setSelection}
                clearSelection={clearSelection}
                placedTokens={placedTokens}
                placedProps={placedProps}
              />

              {/* Selection overlay */}
              <SelectionOverlay
                selectedDrawings={selectedObjectIds}
                sceneId={scene.id}
                camera={camera}
                onClearSelection={clearSelection}
              />

              {/* Content layers will be added here (tokens, etc.) */}
            </g>

            {/* UI overlay elements (not affected by camera transform) */}
            <g className="ui-overlay">
              {/* Coordinate display for debugging */}
              {process.env.NODE_ENV === 'development' && (
                <text x="10" y="20" fill="white" fontSize="12">
                  Camera: ({Math.round(camera.x)}, {Math.round(camera.y)}) Zoom:{' '}
                  {camera.zoom.toFixed(2)}
                </text>
              )}
            </g>
          </svg>
        </TokenDropZone>

        {/* Prop drop zone indicator */}
        {isDraggingProp && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              border: '3px dashed var(--color-primary, #4A9EFF)',
              borderRadius: '8px',
              backgroundColor: 'rgba(74, 158, 255, 0.1)',
              pointerEvents: 'none',
              zIndex: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                padding: '1rem 2rem',
                background: 'var(--surface-primary)',
                border: '2px solid var(--color-primary)',
                borderRadius: '8px',
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: 'var(--text-primary)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              📦 Drop prop here
            </div>
          </div>
        )}

        {/* Remote cursors overlay */}
        <RemoteCursors sceneId={scene.id} />
      </div>
    </CanvasErrorBoundary>
  );
};

// Memoize to prevent unnecessary rerenders on game state changes
export const SceneCanvas = React.memo(SceneCanvasComponent);
