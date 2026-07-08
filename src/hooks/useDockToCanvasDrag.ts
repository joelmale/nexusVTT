import { useState, useRef, useEffect, useCallback } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { sceneUtils } from '@/utils/sceneUtils';
import type { Token } from '@/types/token';

interface UseDockToCanvasDragOptions {
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export interface DragPayload {
  category: 'tokens' | 'props';
  id: string;
  name?: string;
  thumbnailUrl?: string;
  tags?: string[];
  resolveFullAsset?: () => Promise<string>;
}

let atlasTokenLibraryId: string | null = null;

function stripAtlasSourcePrefix(id: string): string {
  const separatorIndex = id.indexOf(':');
  return separatorIndex >= 0 ? id.slice(separatorIndex + 1) : id;
}

async function resolveDroppedToken(payload: DragPayload): Promise<Token | null> {
  const { tokenAssetManager } = await import('@/services/tokenAssets');
  await tokenAssetManager.initialize();

  const assetId = stripAtlasSourcePrefix(payload.id);
  const existingToken =
    tokenAssetManager.getTokenById(assetId) ||
    tokenAssetManager.getTokenById(payload.id);
  if (existingToken) return existingToken;

  const imageUrl =
    (payload.resolveFullAsset
      ? await payload.resolveFullAsset().catch(() => payload.thumbnailUrl)
      : payload.thumbnailUrl) || '';
  if (!imageUrl) return null;

  const now = Date.now();
  const token: Token = {
    id: payload.id,
    name: payload.name || 'Atlas Token',
    image: imageUrl,
    thumbnailImage: payload.thumbnailUrl,
    size: 'medium',
    category: 'monster',
    tags: payload.tags,
    isCustom: true,
    isPublic: true,
    createdAt: now,
    updatedAt: now,
  };

  try {
    if (!atlasTokenLibraryId) {
      atlasTokenLibraryId = tokenAssetManager.createCustomLibrary(
        'Atlas Library',
        'Tokens placed from Atlas assets',
      ).id;
    }
    return tokenAssetManager.addCustomTokenWithId(atlasTokenLibraryId, token);
  } catch {
    atlasTokenLibraryId = tokenAssetManager.createCustomLibrary(
      'Atlas Library',
      'Tokens placed from Atlas assets',
    ).id;
    return tokenAssetManager.addCustomTokenWithId(atlasTokenLibraryId, token);
  }
}

export const useDockToCanvasDrag = (options?: UseDockToCanvasDragOptions) => {
  const [isDragging, setIsDragging] = useState(false);
  const [ghostPosition, setGhostPosition] = useState<{ x: number; y: number } | null>(null);
  const [ghostImage, setGhostImage] = useState<string | null>(null);
  const [overCanvas, setOverCanvas] = useState(false);
  const dragPayload = useRef<DragPayload | null>(null);
  
  const handlePointerDown = useCallback((e: React.PointerEvent, payload: DragPayload, thumbnailUrl: string) => {
    // Only capture on left click
    if (e.button !== 0) return;
    e.preventDefault(); 
    e.currentTarget.setPointerCapture(e.pointerId);
    dragPayload.current = payload;
    setIsDragging(true);
    setGhostImage(thumbnailUrl);
    setGhostPosition({ x: e.clientX, y: e.clientY });
    options?.onDragStart?.();
  }, [options]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    
    // Use rAF for ghost positioning in the actual rendering, but here we track coordinates
    setGhostPosition({ x: e.clientX, y: e.clientY });
    
    const canvasRoot = document.querySelector('[data-role="scene-canvas-root"]');
    if (canvasRoot) {
      const rect = canvasRoot.getBoundingClientRect();
      const isOver = e.clientX >= rect.left && e.clientX <= rect.right &&
                     e.clientY >= rect.top && e.clientY <= rect.bottom;
      setOverCanvas(isOver);
    }
  }, [isDragging]);

  const handlePointerUp = useCallback(async (e: React.PointerEvent) => {
    if (!isDragging) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    const payload = dragPayload.current;
    const canvasRoot = document.querySelector('[data-role="scene-canvas-root"]');
    const rect = canvasRoot?.getBoundingClientRect();
    const isOverCanvas = Boolean(
      rect &&
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom,
    );

    if (canvasRoot && rect && isOverCanvas && payload) {
      const state = useGameStore.getState();
      const activeSceneId = state.sceneState.activeSceneId;
      const scene = activeSceneId ? state.sceneState.scenes.find(s => s.id === activeSceneId) : undefined;
      const camera = state.sceneState.camera;
      
      if (scene && camera) {
        const { user, session } = state;
        
        // Host-offline rejection:
        const isHost = user.type === 'host';
        if (!isHost && session?.status === 'disconnected') {
           setIsDragging(false);
           setGhostPosition(null);
           setGhostImage(null);
           setOverCanvas(false);
           dragPayload.current = null;
           options?.onDragEnd?.();
           return;
        }
        
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        
        const worldPos = sceneUtils.screenToWorld(screenX, screenY, camera, rect.width, rect.height);
        
        let finalX = worldPos.x;
        let finalY = worldPos.y;
        
        if (scene.gridSettings?.snapToGrid && scene.gridSettings.size > 0) {
          const snapped = sceneUtils.snapToGrid(worldPos.x, worldPos.y, scene.gridSettings.size, true);
          finalX = snapped.x;
          finalY = snapped.y;
        }
        
        const roomCode = state.session?.roomCode || '';
        if (payload.category === 'props') {
          const { createPlacedProp } = await import('@/types/prop');
          const placedProp = createPlacedProp(
            stripAtlasSourcePrefix(payload.id),
            scene.id,
            { x: finalX, y: finalY },
            user.id,
          );
          state.placeProp(scene.id, placedProp);
        } else if (payload.category === 'tokens') {
          const { createPlacedToken } = await import('@/types/token');
          const baseToken = await resolveDroppedToken(payload);
          if (baseToken) {
            const placedToken = createPlacedToken(baseToken, { x: finalX, y: finalY }, scene.id, roomCode, user.id, {
              visibleToPlayers: true,
            });
            state.placeToken(scene.id, placedToken);
            // Dispatch unversioned event manually as token/place is relay-only
            const { webSocketService } = await import('@/services/websocket');
            webSocketService.sendEvent({
              type: 'token/place',
              data: {
                sceneId: scene.id,
                token: placedToken,
              },
            });
          } else {
            console.warn(`Dropped token asset could not be resolved: ${payload.id}`);
          }
        }
      }
    }
    
    setIsDragging(false);
    setGhostPosition(null);
    setGhostImage(null);
    setOverCanvas(false);
    dragPayload.current = null;
    options?.onDragEnd?.();
  }, [isDragging, options]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDragging) {
        setIsDragging(false);
        setGhostPosition(null);
        setGhostImage(null);
        setOverCanvas(false);
        dragPayload.current = null;
        options?.onDragEnd?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDragging, options]);

  return {
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    ghostImage,
    ghostPosition,
    overCanvas
  };
};
