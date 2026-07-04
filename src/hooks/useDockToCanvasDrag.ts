import { useState, useRef, useEffect, useCallback } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { sceneUtils } from '@/utils/sceneUtils';

interface UseDockToCanvasDragOptions {
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export interface DragPayload {
  category: 'tokens' | 'props';
  id: string;
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

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    const canvasRoot = document.querySelector('[data-role="scene-canvas-root"]');
    if (canvasRoot && overCanvas && dragPayload.current) {
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
        
        const rect = canvasRoot.getBoundingClientRect();
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
        
        const payload = dragPayload.current;
        const roomCode = state.session?.roomCode || '';
        if (payload.category === 'props') {
          import('@/types/prop').then(({ createPlacedProp }) => {
            const placedProp = createPlacedProp(payload.id, scene.id, { x: finalX, y: finalY }, user.id);
            state.placeProp(scene.id, placedProp);
          });
        } else if (payload.category === 'tokens') {
          import('@/types/token').then(({ createPlacedToken }) => {
            import('@/services/tokenAssets').then(({ tokenAssetManager }) => {
              const baseToken = tokenAssetManager.getTokenById(payload.id);
              if (baseToken) {
                const placedToken = createPlacedToken(baseToken, { x: finalX, y: finalY }, scene.id, roomCode, user.id, {
                  visibleToPlayers: true,
                });
                state.placeToken(scene.id, placedToken);
                // Dispatch unversioned event manually as token/place is relay-only
                import('@/services/websocket').then(({ webSocketService }) => {
                  webSocketService.sendEvent({
                    type: 'token/place',
                    data: {
                      sceneId: scene.id,
                      token: placedToken,
                    },
                  });
                });
              }
            });
          });
        }
      }
    }
    
    setIsDragging(false);
    setGhostPosition(null);
    setGhostImage(null);
    setOverCanvas(false);
    dragPayload.current = null;
    options?.onDragEnd?.();
  }, [isDragging, overCanvas, options]);
  
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
