import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useLayoutEffect,
} from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  useGameStore,
  useCamera,
  useFollowDM,
  useIsHost,
  useActiveTool,
  useServerRoomCode,
  useUser,
  useDrawingActions,
  useSelectedPlacedProp,
  useSceneDrawings,
} from '@/stores/gameStore';
import {
  useGridSettings,
  useTokenIdsSlice,
  usePropIdsSlice,
} from '@/stores/scene';
import { SceneGrid } from './SceneGrid';
import { SceneBackground } from './SceneBackground';
import { DrawingTools } from './DrawingTools';
import { RemoteCursors } from './RemoteCursors';
import { DrawingRenderer } from './DrawingRenderer';
import { SelectionOverlay } from './SelectionOverlay';
import { DrawingPropertiesPanel } from './DrawingPropertiesPanel';
import { SpellOverlayPropertiesPanel } from './SpellOverlayPropertiesPanel';
import { SpellOverlayPatterns } from './SpellOverlayPatterns';
import { CanvasInkLayer } from './CanvasInkLayer';
import { FogLayer } from './FogLayer';
import { type ElementType, ELEMENT_THEMES } from '@/types/drawing';
import { TokenDropZone } from './TokenDropZone';
import { TokenRenderer } from './TokenRenderer';
import { PropRenderer } from './PropRenderer';
import { PropToolbar } from '../Props/PropToolbar';
import { CanvasErrorBoundary, TokenErrorBoundary } from '../ErrorBoundary';
import { webSocketService } from '@/services/websocket';
import { tokenAssetManager } from '@/services/tokenAssets';
import { propAssetManager } from '@/services/propAssets';
import { createPlacedToken } from '@/types/token';
import { createPlacedProp } from '@/types/prop';
import { CameraGestureEngine } from '@/utils/cameraGestureEngine';
import { FogGestureEngine } from '@/utils/fogGestureEngine';
import { sceneUtils } from '@/utils/sceneUtils';
import { hitTestDrawings, createHitTestContext } from './inkHitTest';
import type { Scene, WebSocketMessage } from '@/types/game';
import type { Token } from '@/types/token';
import type {
  DrawingStyle,
  SceneCanvasActiveTool,
  SpellOverlayDrawing,
} from '@/types/drawing';

interface SceneCanvasProps {
  scene: Scene;
}

const SPELL_TYPES = new Set([
  'spell-circle',
  'spell-ring',
  'spell-cone',
  'spell-line',
  'spell-square',
  'spell-triangle',
]);

// Fixed brush stroke width (world units) for the fog-reveal brush tool (A9).
// No size UI is specced in the brief - a single sensible default matches
// the toolbar's other single-purpose tools (e.g. eraser's fixed radius).
const FOG_BRUSH_SIZE = 60;

const SceneCanvasComponent: React.FC<SceneCanvasProps> = ({ scene }) => {
  // Actions from store. A5 fix: the old `useGameStore()` call (no selector)
  // subscribed to the ENTIRE store, so every set() — including every token
  // move — re-rendered SceneCanvas. Action functions have stable identity
  // (created once at store init), so a useShallow selector over them never
  // triggers a re-render.
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
  } = useGameStore(
    useShallow((state) => ({
      updateCamera: state.updateCamera,
      placeToken: state.placeToken,
      moveTokenOptimistic: state.moveTokenOptimistic,
      placeProp: state.placeProp,
      movePropOptimistic: state.movePropOptimistic,
      deleteProp: state.deleteProp,
      setSelection: state.setSelection,
      addToSelection: state.addToSelection,
      clearSelection: state.clearSelection,
    })),
  );

  // A5: SceneCanvas is the orchestrator - it keeps only what it structurally
  // needs to lay out the SVG tree and drive shared handlers/overlays:
  // - identity/auth: user, isHost, roomCode
  // - id lists (NOT full records) for tokens/props, to key the .map() below;
  //   each TokenRenderer/PropRenderer self-subscribes to its own record via
  //   useTokenRenderData/usePropRenderData (stores/scene), so a position
  //   write to token A does not change token B's, the grid's, or the
  //   background's selector output and does not re-render this component.
  // - selection ids + the single selected token/prop (for the toolbar
  //   overlays, which must track selection regardless of layer isolation)
  // - camera: declarative subscription for Follow-DM/scene-switch
  //   reconciliation only (A3 already made pan/zoom gestures imperative -
  //   this subscription does not fire during a drag gesture)
  // - activeTool: drives cursor/tool-gated interaction across all layers
  // Grid settings, background image, and the full drawings array (used only
  // by the interior DrawingRenderer's own render, not here) are NOT
  // subscribed at this level anymore - see SceneGrid/SceneBackground/
  // DrawingRenderer, which each own their narrow slice now.
  const user = useUser();
  const tokenIds = useTokenIdsSlice(scene.id);
  const propIds = usePropIdsSlice(scene.id);
  const selectedPlacedProp = useSelectedPlacedProp();
  // A5 fix: the old `useSceneState()` selected the whole sceneState object,
  // whose reference changes on EVERY scene mutation (token moves included).
  // Select just the selection array - identity preserved across token moves.
  const selectedObjectIds = useGameStore(
    (state) => state.sceneState.selectedObjectIds,
  );
  const { updateDrawing } = useDrawingActions();
  const camera = useCamera();
  const followDM = useFollowDM();
  const isHost = useIsHost();
  const activeTool = useActiveTool() as SceneCanvasActiveTool;

  const roomCode = useServerRoomCode();

  // Grid settings via the narrow store slice (A5) rather than the `scene`
  // prop: SceneCanvas's caller (GameUI/SceneManager) passes the whole
  // `Scene` object from `useActiveScene()`, which gets a new reference on
  // ANY scene mutation (token move, drawing update, etc). Reading grid
  // settings from `useGridSettings()` instead means this value only changes
  // identity when grid settings themselves change, independent of whatever
  // caused the parent to re-render.
  const gridSettingsSlice = useGridSettings();
  const safeGridSettings = useMemo(
    () =>
      gridSettingsSlice || {
        enabled: true,
        size: 50,
        color: '#ffffff',
        opacity: 0.3,
        snapToGrid: true,
        showToPlayers: true,
      },
    [gridSettingsSlice],
  );
  const svgRef = useRef<SVGSVGElement>(null);
  // Plain DOM element ref for the camera-transformed `<g>` - imperative
  // transform writes during pan/zoom gestures target this directly (A3).
  const sceneContentRef = useRef<SVGGElement>(null);
  const [isPanning, setIsPanning] = useState(false);

  // Imperative pan/zoom engine singleton for this component instance (A3),
  // mirroring useTransientDrag's TransientDragEngine pattern: constructed
  // once via useState's lazy initializer (not useRef - see
  // useTransientDrag.ts for why), latest values pushed in post-render via
  // sync() in a useEffect below.
  const [cameraGestureEngine] = useState(() => new CameraGestureEngine());
  // Imperative fog-reveal gesture engine (A9), same construction pattern as
  // cameraGestureEngine/useTransientDrag: built once, synced post-render.
  const [fogGestureEngine] = useState(() => new FogGestureEngine());
  const fogPreviewRef = useRef<SVGRectElement | SVGPolylineElement | null>(
    null,
  );
  // A8b: detached (never attached to the DOM, never rendered) 2D context
  // used purely as a Path2D geometry oracle for ink hit-testing. Built once
  // per component instance, same construction pattern as
  // cameraGestureEngine/fogGestureEngine above.
  const [inkHitTestCtx] = useState(() => createHitTestContext());
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

  const [spellElementType, setSpellElementType] =
    useState<ElementType>('arcane');
  const [spellGridSnap, setSpellGridSnap] = useState(true);

  const drawings = useSceneDrawings(scene.id);

  const selectedDrawingIds = useMemo(() => {
    const drawingIds = new Set(drawings.map((d) => d.id));
    return selectedObjectIds.filter((id) => drawingIds.has(id));
  }, [selectedObjectIds, drawings]);

  // Filter for spell overlay drawings specifically
  const selectedSpellOverlay = useMemo(() => {
    if (selectedDrawingIds.length !== 1) return null;
    const drawing = drawings.find((d) => d.id === selectedDrawingIds[0]);
    if (!drawing || !SPELL_TYPES.has(drawing.type)) return null;
    return drawing as SpellOverlayDrawing;
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

      // A5: props are looked up imperatively (getState) - this handler runs
      // on user keystrokes, not during render, so holding a subscription to
      // the full props array here (and re-rendering SceneCanvas on every
      // prop write) is unnecessary.
      const sceneProps =
        useGameStore.getState().sceneState.scenes.find((s) => s.id === scene.id)
          ?.placedProps || [];

      // Delete key - delete selected props
      if ((e.key === 'Delete' || e.key === 'Backspace') && !e.repeat) {
        const selectedPropIds = selectedObjectIds.filter((id) =>
          sceneProps.some((p) => p.id === id),
        );

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
        const selectedPropIds = selectedObjectIds.filter((id) =>
          sceneProps.some((p) => p.id === id),
        );

        if (selectedPropIds.length === 1) {
          e.preventDefault();
          const propToDuplicate = sceneProps.find(
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
    deleteProp,
    placeProp,
    setSelection,
    user.id,
  ]);

  // Camera controls (A3 - transient: gestures drive cameraRef + an
  // imperative transform write on sceneContentRef via CameraGestureEngine;
  // the store is only written once at gesture end, via onCommit below).
  // The engine's `sync()` effect (pushing the latest closures, including
  // `svgSize`) lives further down, after `svgSize` is declared.
  useEffect(() => {
    return () => cameraGestureEngine.dispose();
  }, [cameraGestureEngine]);

  useEffect(() => {
    return () => fogGestureEngine.dispose();
  }, [fogGestureEngine]);

  // Fog-reveal gesture (A9): imperative preview during the pointer gesture
  // (rAF-batched, writes the preview <rect>/<polyline> element's attributes
  // directly - no store writes mid-gesture), ONE addFogShape(...) commit on
  // pointerup. Coordinates come from FogGestureEngine, which itself uses
  // sceneUtils.screenToWorldLive (ADR-0002) - never hand-rolled math.
  const handleFogPreview = useCallback(
    (points: { x: number; y: number }[] | null) => {
      const el = fogPreviewRef.current;
      if (!el) return;

      if (!points || points.length === 0) {
        el.setAttribute('visibility', 'hidden');
        return;
      }

      el.setAttribute('visibility', 'visible');

      if (activeTool === 'fog-reveal-rect' && points.length >= 2) {
        const [a, b] = points;
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        const width = Math.abs(b.x - a.x);
        const height = Math.abs(b.y - a.y);
        (el as unknown as SVGRectElement).setAttribute('x', String(x));
        (el as unknown as SVGRectElement).setAttribute('y', String(y));
        (el as unknown as SVGRectElement).setAttribute('width', String(width));
        (el as unknown as SVGRectElement).setAttribute(
          'height',
          String(height),
        );
      } else if (activeTool === 'fog-reveal-brush') {
        const pointsAttr = points.map((p) => `${p.x},${p.y}`).join(' ');
        (el as unknown as SVGPolylineElement).setAttribute(
          'points',
          pointsAttr,
        );
      }
    },
    [activeTool],
  );

  const handleFogCommit = useCallback(
    (points: { x: number; y: number }[]) => {
      if (!isHost) return;

      const { addFogShape } = useGameStore.getState();

      if (activeTool === 'fog-reveal-rect') {
        if (points.length < 2) return;
        addFogShape(scene.id, {
          id: `fog-shape-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          kind: 'reveal',
          shape: 'rect',
          points: [points[0], points[points.length - 1]],
          createdAt: Date.now(),
        });
      } else if (activeTool === 'fog-reveal-brush') {
        if (points.length === 0) return;
        addFogShape(scene.id, {
          id: `fog-shape-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          kind: 'reveal',
          shape: 'brush',
          points,
          brushSize: FOG_BRUSH_SIZE,
          createdAt: Date.now(),
        });
      }
    },
    [activeTool, isHost, scene.id],
  );

  useEffect(() => {
    fogGestureEngine.sync({
      kind: activeTool === 'fog-reveal-brush' ? 'brush' : 'rect',
      brushSize: FOG_BRUSH_SIZE,
      disabled:
        !isHost ||
        (activeTool !== 'fog-reveal-rect' && activeTool !== 'fog-reveal-brush'),
      onCommit: handleFogCommit,
      onPreview: handleFogPreview,
    });
  });

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (activeTool !== 'pan' && activeTool !== 'select') return; // Only zoom when in pan/select mode
      if (!isHost && followDM) return; // Players can't zoom when following DM

      cameraGestureEngine.wheelZoom(e.deltaY);
    },
    [isHost, followDM, activeTool, cameraGestureEngine],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        // Left mouse button
        if (activeTool === 'pan' || (activeTool === 'select' && e.altKey)) {
          if (!isHost && followDM) return; // Players can't pan when following DM

          setIsPanning(true);
          cameraGestureEngine.startPan(e.clientX, e.clientY);
          e.stopPropagation();
        } else if (activeTool === 'select') {
          // Handle selection tool clicks on empty space
          // This only fires if nothing else (token/drawing) handled the click.
          // A8b: committed drawing strokes (pencil/line/rectangle/circle/
          // polygon) paint on a pointerEvents:none <canvas> (CanvasInkLayer),
          // so native SVG hit-testing can never find them - this handler IS
          // the "nothing else handled it" fallback for tokens/props, but for
          // these 5 drawing types it's the ONLY path, hence the explicit ink
          // hit-test consult below before falling through to the
          // empty-space deselect behavior. Fog tools take precedence over
          // selection entirely (activeTool is never 'select' while a fog
          // tool is active - see the fog capture <rect> above, mounted only
          // for fog-reveal-rect/brush), so no fog-precedence check is
          // needed here.
          const worldPoint = sceneUtils.screenToWorld(
            e.clientX - (svgRef.current?.getBoundingClientRect().left ?? 0),
            e.clientY - (svgRef.current?.getBoundingClientRect().top ?? 0),
            camera,
            viewportSize.width,
            viewportSize.height,
          );
          const hitId = hitTestDrawings(
            drawings,
            worldPoint,
            camera.zoom,
            inkHitTestCtx,
          );
          if (hitId) {
            if (e.shiftKey || e.metaKey || e.ctrlKey) {
              if (selectedObjectIds.includes(hitId)) {
                setSelection(selectedObjectIds.filter((id) => id !== hitId));
              } else {
                setSelection([...selectedObjectIds, hitId]);
              }
            } else {
              setSelection([hitId]);
            }
            return;
          }

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
    [
      isHost,
      followDM,
      activeTool,
      clearSelection,
      cameraGestureEngine,
      camera,
      viewportSize,
      drawings,
      selectedObjectIds,
      setSelection,
      inkHitTestCtx,
    ],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        cameraGestureEngine.movePan(e.clientX, e.clientY);
      }
    },
    [isPanning, cameraGestureEngine],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    cameraGestureEngine.endPan();
  }, [cameraGestureEngine]);

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    cameraGestureEngine.endPan();
  }, [cameraGestureEngine]);

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
      // (imperative read - drop handlers don't need a render subscription)
      if (token.exclusive) {
        const sceneTokens =
          useGameStore
            .getState()
            .sceneState.scenes.find((s) => s.id === scene.id)?.placedTokens ||
          [];
        const alreadyPlaced = sceneTokens.some((pt) => pt.tokenId === token.id);
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
    [scene.id, user.id, placeToken, roomCode],
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

  // Called exactly once per drag gesture (on pointerup) by TokenRenderer's
  // transient drag hook, with the final world-space position already
  // computed client-side during the gesture (no store writes mid-drag).
  const handleTokenMoveEnd = useCallback(
    (tokenId: string, position: { x: number; y: number }) => {
      let finalPosition = position;

      // Apply grid snapping when drag ends (identical behavior to pre-A2)
      if (safeGridSettings.snapToGrid && safeGridSettings.size > 0) {
        finalPosition = {
          x:
            Math.round(position.x / safeGridSettings.size) *
            safeGridSettings.size,
          y:
            Math.round(position.y / safeGridSettings.size) *
            safeGridSettings.size,
        };
      }

      // Single optimistic update - commits to store and sends versioned
      // token/move WebSocket event exactly once for this gesture.
      moveTokenOptimistic(scene.id, tokenId, finalPosition);
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

  // A5: prop lookups inside these gesture handlers read the store
  // imperatively - they run on pointer events, not render, so SceneCanvas
  // doesn't need (and no longer holds) a subscription to the props array.
  const findSceneProp = useCallback(
    (propId: string) =>
      useGameStore
        .getState()
        .sceneState.scenes.find((s) => s.id === scene.id)
        ?.placedProps?.find((p) => p.id === propId),
    [scene.id],
  );

  const handlePropMove = useCallback(
    (propId: string, deltaX: number, deltaY: number) => {
      const prop = findSceneProp(propId);
      if (!prop) return;

      const newX = prop.x + deltaX / camera.zoom;
      const newY = prop.y + deltaY / camera.zoom;

      // Optimistic update - move locally first, then send to server
      movePropOptimistic(scene.id, propId, { x: newX, y: newY });
    },
    [scene.id, camera.zoom, findSceneProp, movePropOptimistic],
  );

  const handlePropMoveEnd = useCallback(
    (propId: string) => {
      // Apply grid snapping when drag ends
      if (safeGridSettings.snapToGrid && safeGridSettings.size > 0) {
        const prop = findSceneProp(propId);
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
    [scene.id, safeGridSettings, findSceneProp, movePropOptimistic],
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

  // Push the latest closures into the camera gesture engine after each
  // render (never during render). `applyTransform` writes the exact same
  // formula as the `transform` template used for declarative renders,
  // directly to the DOM `<g>` via sceneContentRef - no React re-render.
  useEffect(() => {
    cameraGestureEngine.sync({
      getStoreCamera: () => useGameStore.getState().sceneState.camera,
      onCommit: (finalCamera) => {
        updateCamera(finalCamera);
      },
      onBroadcast: (liveCamera) => {
        if (!isHost) return; // Only the host drives Follow DM viewers.
        webSocketService.sendEvent({
          type: 'camera/update',
          data: {
            sceneId: scene.id,
            camera: liveCamera,
          },
        });
      },
      applyTransform: (liveCamera) => {
        const el = sceneContentRef.current;
        if (!el) return;
        el.setAttribute(
          'transform',
          sceneUtils.cameraTransform(liveCamera, svgSize.width, svgSize.height),
        );
      },
      minZoom: 0.1,
      maxZoom: 5.0,
    });
  });

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

        if (!svgRef.current) return;
        const scenePoint = sceneUtils.clientToWorld(
          e.clientX,
          e.clientY,
          camera,
          svgRef.current,
        );

        // Apply grid snapping if enabled
        let finalX = scenePoint.x;
        let finalY = scenePoint.y;

        if (safeGridSettings.snapToGrid && safeGridSettings.size > 0) {
          finalX =
            Math.round(scenePoint.x / safeGridSettings.size) *
            safeGridSettings.size;
          finalY =
            Math.round(scenePoint.y / safeGridSettings.size) *
            safeGridSettings.size;
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
  const transform = sceneUtils.cameraTransform(
    camera,
    svgSize.width,
    svgSize.height,
  );
  const viewportWorldRect = sceneUtils.viewportWorldRect(
    camera,
    viewportSize.width,
    viewportSize.height,
  );

  // Calculate toolbar position for selected prop
  const getPropToolbarPosition = useCallback(() => {
    if (!selectedPlacedProp) return { x: 0, y: 0 };

    // Calculate screen position: apply camera transform to prop position
    const { x: screenX, y: screenY } = sceneUtils.worldToScreen(
      selectedPlacedProp.x,
      selectedPlacedProp.y,
      camera,
      svgSize.width,
      svgSize.height,
    );

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
            key={selectedDrawingIds.join(':')}
            selectedDrawingIds={selectedDrawingIds}
            sceneId={scene.id}
            onClose={handleClosePropertiesPanel}
          />
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
            data-role="scene-canvas-root"
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

            <g
              ref={sceneContentRef}
              className="scene-content"
              transform={transform}
            >
              {/* Background layer - self-subscribes to useBackgroundImage
                  (A5); renders nothing when the scene has no background. */}
              <SceneBackground sceneId={scene.id} />

              {/* Grid layer - self-subscribes to useGridSettings (A5);
                  renders nothing when the grid is disabled. */}
              <SceneGrid viewportSize={viewportSize} camera={camera} />

              {/* A8b cutover: CanvasInkLayer is now the unconditional,
                  sole renderer for committed pencil/line/rectangle/circle/
                  polygon strokes (flag removed - see inkHitTest.ts for the
                  hit-testing half of this cutover). pointerEvents="none"
                  because clicks are resolved in JS by SceneCanvas's
                  handleMouseDown consulting inkHitTest, not by native
                  hit-testing on this element. */}
              <foreignObject
                x={viewportWorldRect.x}
                y={viewportWorldRect.y}
                width={viewportWorldRect.width}
                height={viewportWorldRect.height}
                pointerEvents="none"
              >
                <CanvasInkLayer
                  sceneId={scene.id}
                  camera={camera}
                  viewportWidth={viewportSize.width}
                  viewportHeight={viewportSize.height}
                />
              </foreignObject>

              {/* Drawings layer - self-subscribes to its drawings slice
                  (A5); memoized, so token moves don't reach it. */}
              <DrawingRenderer
                sceneId={scene.id}
                camera={camera}
                isHost={isHost}
                activeTool={activeTool}
                selectedObjectIds={selectedObjectIds}
                onDrawingClick={handleDrawingClick}
              />

              {/* Tokens layer - iterate the STABLE id list (A5); each
                  TokenRenderer self-subscribes to its own record, so a move
                  of token A re-renders only token A's component. */}
              <TokenErrorBoundary>
                <g id="tokens-layer">
                  {assetsReady &&
                    tokenIds.map((tokenId) => (
                      <TokenRenderer
                        key={tokenId}
                        placedTokenId={tokenId}
                        gridSize={safeGridSettings.size}
                        isSelected={selectedObjectIds.includes(tokenId)}
                        onSelect={handleTokenSelect}
                        onMoveEnd={handleTokenMoveEnd}
                        isHost={isHost}
                        currentUserId={user.id}
                      />
                    ))}
                </g>
              </TokenErrorBoundary>

              {/* Props layer - same id-list pattern as tokens (A5). */}
              <TokenErrorBoundary>
                <g id="props-layer">
                  {assetsReady &&
                    propIds.map((propId) => (
                      <PropRenderer
                        key={propId}
                        placedPropId={propId}
                        gridSize={safeGridSettings.size}
                        isSelected={selectedObjectIds.includes(propId)}
                        onSelect={handlePropSelect}
                        onMove={handlePropMove}
                        onMoveEnd={handlePropMoveEnd}
                        currentUserId={user.id}
                        sceneId={scene.id}
                      />
                    ))}
                </g>
              </TokenErrorBoundary>

              {/* Fog-of-war layer (A9) - Canvas 2D at var(--z-fog) (40),
                  ABOVE tokens/props, below UI overlays/cursors. Mounted the
                  same way as CanvasInkLayer: a <foreignObject> sized to the
                  current viewport-in-world-units, inside the
                  camera-transformed scene-content group so it never needs
                  its own camera math beyond what FogLayer does internally.
                  pointerEvents="none" here - the fog-reveal tools capture
                  pointer events via the dedicated rect below, not this
                  layer itself. */}
              <foreignObject
                x={viewportWorldRect.x}
                y={viewportWorldRect.y}
                width={viewportWorldRect.width}
                height={viewportWorldRect.height}
                pointerEvents="none"
                style={{ zIndex: 'var(--z-fog)' } as React.CSSProperties}
              >
                <FogLayer
                  sceneId={scene.id}
                  isHost={isHost}
                  camera={camera}
                  viewportWidth={viewportSize.width}
                  viewportHeight={viewportSize.height}
                />
              </foreignObject>

              {/* Drawing tools layer (interactive) - self-subscribes to the
                  token/prop arrays it needs for select-box hit testing
                  (A5: no longer prop-drilled from here). The two fog-reveal
                  tools are outside DrawingTools' own activeTool union (it
                  has no dispatch entry for them); map them to 'pan' so
                  DrawingTools returns null and cedes its interaction-layer
                  <rect> to the dedicated fog capture rect below instead of
                  double-handling pointer events on the same gesture. */}
              <DrawingTools
                key={activeTool}
                activeTool={
                  activeTool === 'fog-reveal-rect' ||
                  activeTool === 'fog-reveal-brush'
                    ? 'pan'
                    : activeTool
                }
                drawingStyle={drawingStyle}
                camera={camera}
                _gridSize={safeGridSettings.size}
                svgRef={svgRef as React.RefObject<SVGSVGElement>}
                snapToGrid={safeGridSettings.snapToGrid}
                selectedObjectIds={selectedObjectIds}
                setSelection={setSelection}
                clearSelection={clearSelection}
                sceneId={scene.id}
                spellElementType={spellElementType}
                spellGridSnap={spellGridSnap}
              />

              {/* Fog-reveal tool interaction layer (A9, host only): mirrors
                  DrawingTools' own oversized invisible capture <rect>
                  convention so pointer routing follows the same pattern as
                  every other drawing tool in this file. Active only while a
                  fog-reveal tool is selected - FogGestureEngine itself is
                  the no-op guard for non-host/non-fog-tool states. */}
              {isHost &&
                (activeTool === 'fog-reveal-rect' ||
                  activeTool === 'fog-reveal-brush') && (
                  <g className="fog-tool-layer">
                    <rect
                      x={-10000}
                      y={-10000}
                      width={20000}
                      height={20000}
                      fill="transparent"
                      onPointerDown={fogGestureEngine.handlePointerDown}
                      style={{ cursor: 'crosshair', pointerEvents: 'auto' }}
                    />
                    {activeTool === 'fog-reveal-rect' ? (
                      <rect
                        ref={fogPreviewRef as React.RefObject<SVGRectElement>}
                        visibility="hidden"
                        fill="rgba(74, 158, 255, 0.25)"
                        stroke="#4A9EFF"
                        strokeWidth={2 / camera.zoom}
                        strokeDasharray="5,5"
                        pointerEvents="none"
                      />
                    ) : (
                      <polyline
                        ref={
                          fogPreviewRef as React.RefObject<SVGPolylineElement>
                        }
                        visibility="hidden"
                        fill="none"
                        stroke="#4A9EFF"
                        // WORLD units, NOT / camera.zoom: this stroke previews the
                        // exact reveal FogLayer will paint (lineWidth = brushSize in
                        // world space). Screen-constant division belongs only to
                        // hairline outlines like the rect marquee above (WYSIWYG bug
                        // caught in Joel's A9 gate review).
                        strokeWidth={FOG_BRUSH_SIZE}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={0.4}
                        pointerEvents="none"
                      />
                    )}
                  </g>
                )}

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
              zIndex: 'var(--z-tool-ui)',
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

        {/* Spell element picker — shown when a spell tool is active */}
        {activeTool && activeTool.startsWith('spell-') && (
          <div
            style={{
              position: 'absolute',
              bottom: '1rem',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: '6px',
              padding: '6px 10px',
              background: 'var(--surface-secondary, rgba(0,0,0,0.75))',
              borderRadius: '8px',
              border: '1px solid var(--border-primary, rgba(255,255,255,0.15))',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 'var(--z-tool-ui)',
              alignItems: 'center',
            }}
          >
            {(Object.keys(ELEMENT_THEMES) as ElementType[]).map((el) => {
              const theme = ELEMENT_THEMES[el];
              const isActive = spellElementType === el;
              return (
                <button
                  key={el}
                  title={el.charAt(0).toUpperCase() + el.slice(1)}
                  onClick={() => setSpellElementType(el)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: isActive
                      ? '2px solid white'
                      : '2px solid transparent',
                    background: theme.baseColor,
                    cursor: 'pointer',
                    outline: isActive ? `0 0 0 2px ${theme.edgeGlow}` : 'none',
                    boxShadow: isActive ? `0 0 8px ${theme.edgeGlow}` : 'none',
                    padding: 0,
                    flexShrink: 0,
                  }}
                  aria-pressed={isActive}
                  aria-label={`${el} element`}
                />
              );
            })}
            <div
              style={{
                width: 1,
                height: 20,
                background: 'var(--border-primary, rgba(255,255,255,0.2))',
                margin: '0 4px',
              }}
            />
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                color: 'var(--text-secondary, #aaa)',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={spellGridSnap}
                onChange={(e) => setSpellGridSnap(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Snap
            </label>
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
