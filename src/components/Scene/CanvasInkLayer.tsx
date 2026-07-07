import React, { useEffect, useRef } from 'react';
import { useVisibleDrawingsSlice } from '@/stores/scene';
import { getCachedPath, isHitTestable } from './inkHitTest';
import type { Camera } from '@/types/game';
import type { Drawing } from '@/types/drawing';

interface CanvasInkLayerProps {
  sceneId: string;
  camera: Camera;
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * A8b cutover: this layer is now the ONLY committed-stroke renderer for the
 * 5 basic shape types (pencil/line/rectangle/circle/polygon) — the SVG path
 * for these has been deleted from DrawingRenderer, and the feature flag that
 * used to gate this layer has been removed entirely (it is unconditionally
 * mounted now). Everything else (spell overlays, AoE shapes, cone, text,
 * ping, fog-of-war, dm-notes, etc.) is untouched and still renders as SVG in
 * DrawingRenderer; this layer never painted those types even under the old
 * flag.
 *
 * Geometry: reuses `getCachedPath` from inkHitTest.ts so the SAME Path2D
 * instances back both rendering (ctx.stroke/fill(path)) and hit-testing
 * (ctx.isPointInPath/isPointInStroke) — this guarantees "what you see is
 * what you can click" by construction, rather than keeping two independent
 * geometry builders in sync by hand.
 */
export const CanvasInkLayer: React.FC<CanvasInkLayerProps> = ({
  sceneId,
  camera,
  viewportWidth,
  viewportHeight,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawings = useVisibleDrawingsSlice(sceneId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;

    const render = () => {
      // Scale canvas for high DPI displays if needed, but here we assume 1:1 mapping
      // based on the foreignObject math
      canvas.width = viewportWidth;
      canvas.height = viewportHeight;

      ctx.clearRect(0, 0, viewportWidth, viewportHeight);

      // The canvas CSS size is W/z, H/z. SVG scales it by z.
      // Internal buffer is W, H.
      // So drawing 1 unit in canvas buffer = 1 pixel on screen.
      // To draw world coordinates, we need to apply the world-to-screen transform.

      // world-to-screen transform:
      // screenX = (worldX - camera.x) * camera.zoom + viewportWidth / 2

      ctx.save();
      ctx.translate(viewportWidth / 2, viewportHeight / 2);
      ctx.scale(camera.zoom, camera.zoom);
      ctx.translate(-camera.x, -camera.y);

      for (const drawing of drawings as Drawing[]) {
        if (!isHitTestable(drawing)) continue;
        paintDrawing(ctx, drawing);
      }

      ctx.restore();
      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(frameId);
  }, [drawings, camera, viewportWidth, viewportHeight]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  );
};

function paintDrawing(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<
    Drawing,
    { type: 'pencil' | 'line' | 'rectangle' | 'circle' | 'polygon' }
  >,
): void {
  const path = getCachedPath(drawing);
  const { style } = drawing;

  // NOTE: ctx is already under `ctx.scale(camera.zoom, camera.zoom)` (see the
  // caller's render()), so a world-space lineWidth scales with zoom for free
  // via the transform - unlike DrawingRenderer's SVG path, which divides by
  // zoom manually because its <g transform> there does NOT auto-scale
  // stroke-width the way this canvas transform does for ctx.stroke().
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = style.strokeWidth;
  ctx.strokeStyle = style.strokeColor;

  const isFilled =
    drawing.type === 'rectangle' ||
    drawing.type === 'circle' ||
    drawing.type === 'polygon';

  if (isFilled && style.fillColor && style.fillColor !== 'transparent') {
    ctx.globalAlpha = style.fillOpacity ?? 1;
    ctx.fillStyle = style.fillColor;
    ctx.fill(path);
    ctx.globalAlpha = 1;
  }

  ctx.stroke(path);
}
