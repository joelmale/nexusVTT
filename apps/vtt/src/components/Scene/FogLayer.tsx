import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react';
import { useSceneFog } from '@/stores/scene';
import type { Camera } from '@/types/game';

interface FogLayerProps {
  ref?: React.Ref<FogLayerHandle>;
  sceneId: string;
  isHost: boolean;
  camera: Camera;
  viewportWidth: number;
  viewportHeight: number;
}

export interface FogLayerHandle {
  paint: (camera: Camera) => void;
}

// Opaque for players; the DM sees fog at ~50% so hidden content stays
// visible underneath (SESSION_BRIEFS/A9-paintable-fog.md).
const PLAYER_CONCEAL_COLOR = 'rgba(10, 10, 14, 1)';
const HOST_CONCEAL_COLOR = 'rgba(10, 10, 14, 0.5)';

/**
 * Paints a viewport-sized cover and removes world-space reveal shapes.
 * SceneCanvas keeps its SVG container aligned with the viewport on each
 * camera frame. The live frame and committed renders share the same painter.
 */
export const FogLayer: React.FC<FogLayerProps> = ({
  ref,
  sceneId,
  isHost,
  camera,
  viewportWidth,
  viewportHeight,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const displayedCamera = useRef(camera);
  const fog = useSceneFog(sceneId);

  const paint = useCallback(
    (frameCamera: Camera) => {
      displayedCamera.current = frameCamera;
      const canvas = canvasRef.current;
      if (!canvas || viewportWidth <= 0 || viewportHeight <= 0) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = Math.ceil(viewportWidth * dpr);
      const height = Math.ceil(viewportHeight * dpr);
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!fog || !fog.enabled) {
        return;
      }

      // Paint the cover in backing pixels, independent of the camera position.
      ctx.fillStyle = isHost ? HOST_CONCEAL_COLOR : PLAYER_CONCEAL_COLOR;
      ctx.fillRect(0, 0, width, height);
      if (fog.shapes.length === 0) return;

      ctx.save();
      ctx.scale(width / viewportWidth, height / viewportHeight);
      ctx.translate(viewportWidth / 2, viewportHeight / 2);
      ctx.scale(frameCamera.zoom, frameCamera.zoom);
      ctx.translate(-frameCamera.x, -frameCamera.y);

      // Punch reveal shapes out of the conceal layer.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000000';
      ctx.strokeStyle = '#000000';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const shape of fog.shapes) {
        if (shape.shape === 'rect') {
          if (shape.points.length < 2) continue;
          const [a, b] = shape.points;
          const x = Math.min(a.x, b.x);
          const y = Math.min(a.y, b.y);
          const width = Math.abs(b.x - a.x);
          const height = Math.abs(b.y - a.y);
          ctx.fillRect(x, y, width, height);
        } else if (shape.shape === 'brush') {
          if (shape.points.length === 0) continue;
          ctx.beginPath();
          ctx.moveTo(shape.points[0].x, shape.points[0].y);
          for (let i = 1; i < shape.points.length; i++) {
            ctx.lineTo(shape.points[i].x, shape.points[i].y);
          }
          ctx.lineWidth = shape.brushSize ?? 40;
          // A single point (click without drag) still needs to punch a dot -
          // stroke a degenerate zero-length path so lineCap='round' draws a
          // circle of radius lineWidth/2.
          if (shape.points.length === 1) {
            ctx.lineTo(shape.points[0].x, shape.points[0].y);
          }
          ctx.stroke();
        }
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    },
    [fog, isHost, viewportWidth, viewportHeight],
  );

  useImperativeHandle(ref, () => ({ paint }), [paint]);

  useLayoutEffect(() => {
    displayedCamera.current = camera;
  }, [camera, sceneId, viewportWidth, viewportHeight]);

  // Fog edits can arrive during a local gesture. Paint using the camera that
  // was actually drawn, which may be ahead of the committed store value.
  useLayoutEffect(() => {
    paint(displayedCamera.current);
  }, [camera, paint, sceneId]);

  useEffect(() => {
    if (!window.matchMedia) return;
    let resolution = window.matchMedia(
      `(resolution: ${window.devicePixelRatio}dppx)`,
    );
    const resizeBuffer = () => {
      resolution.removeEventListener('change', resizeBuffer);
      resolution = window.matchMedia(
        `(resolution: ${window.devicePixelRatio}dppx)`,
      );
      resolution.addEventListener('change', resizeBuffer);
      paint(displayedCamera.current);
    };
    resolution.addEventListener('change', resizeBuffer);
    return () => resolution.removeEventListener('change', resizeBuffer);
  }, [paint]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="fog-layer-canvas"
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  );
};
