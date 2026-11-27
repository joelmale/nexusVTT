import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { webSocketService } from '@/services/websocket';
import { useGameStore } from '@/stores/gameStore';
import type { Drawing, Point } from '@/types/drawing';
import { cameraRef } from '@/utils/cameraRef';
import { sceneUtils } from '@/utils/sceneUtils';
import { canEditDrawing } from './drawingHitTesting';
import type { DrawingPreview } from './drawingTransforms';

type DrawingEdit = (drawing: Drawing, delta: Point) => Partial<Drawing>;

export function useDrawingGesture(
  sceneId: string,
  svgRef: React.RefObject<SVGSVGElement | null>,
  enabled: boolean,
  mode: string,
) {
  const cancelRef = useRef<(() => void) | null>(null);
  const [preview, setPreview] = useState<DrawingPreview>();

  useLayoutEffect(() => () => cancelRef.current?.(), [sceneId, enabled, mode]);

  const start = useCallback(
    (
      event: React.MouseEvent,
      drawings: readonly Drawing[],
      edit: DrawingEdit,
    ) => {
      const svg = svgRef.current;
      if (!enabled || !svg || !drawings.length || event.button !== 0) return;

      cancelRef.current?.();
      event.preventDefault();
      event.stopPropagation();
      const clientToWorld = (e: MouseEvent) =>
        sceneUtils.clientToWorld(e.clientX, e.clientY, cameraRef.get(), svg);
      const startPoint = clientToWorld(event.nativeEvent);
      const { clientX, clientY } = event;
      let dragging = false;
      const getDelta = (e: MouseEvent): Point | null => {
        dragging ||= Math.hypot(e.clientX - clientX, e.clientY - clientY) >= 2;
        if (!dragging) return null;
        const point = clientToWorld(e);
        return { x: point.x - startPoint.x, y: point.y - startPoint.y };
      };

      function move(e: MouseEvent) {
        const delta = getDelta(e);
        if (!delta) return;
        setPreview(
          new Map(
            drawings.map((drawing) => [
              drawing.id,
              { ...drawing, ...edit(drawing, delta) } as Drawing,
            ]),
          ),
        );
      }

      function commit(e: MouseEvent) {
        if (e.button !== 0) return;
        const delta = getDelta(e);
        cancel();
        if (!delta || (delta.x === 0 && delta.y === 0)) return;

        const state = useGameStore.getState();
        const current = state.sceneState.scenes.find(
          (scene) => scene.id === sceneId,
        );
        for (const original of drawings) {
          const drawing = current?.drawings.find(
            ({ id }) => id === original.id,
          );
          if (
            !drawing ||
            drawing.type !== original.type ||
            !canEditDrawing(drawing, {
              isHost: state.user.type === 'host',
              userId: state.user.id,
            })
          )
            continue;

          const updates = edit(original, delta);
          state.updateDrawing(sceneId, drawing.id, updates);
          webSocketService.sendEvent({
            type: 'drawing/update',
            data: { sceneId, drawingId: drawing.id, updates },
          });
        }
      }

      function cancel() {
        window.removeEventListener('mousemove', move, true);
        window.removeEventListener('mouseup', commit, true);
        window.removeEventListener('blur', cancel);
        cancelRef.current = null;
        setPreview(undefined);
      }

      cancelRef.current = cancel;
      // The drawing tool surface stops these events during bubbling.
      window.addEventListener('mousemove', move, true);
      window.addEventListener('mouseup', commit, true);
      window.addEventListener('blur', cancel);
    },
    [enabled, sceneId, svgRef],
  );

  return { start, preview };
}
