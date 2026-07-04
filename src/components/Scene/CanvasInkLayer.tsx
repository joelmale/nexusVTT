import React, { useEffect, useRef } from 'react';
import { useSceneDrawingsSlice } from '@/stores/scene';
import type { Camera } from '@/types/game';

interface CanvasInkLayerProps {
  sceneId: string;
  camera: Camera;
  viewportWidth: number;
  viewportHeight: number;
}

export const CanvasInkLayer: React.FC<CanvasInkLayerProps> = ({
  sceneId,
  camera,
  viewportWidth,
  viewportHeight,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawings = useSceneDrawingsSlice(sceneId);

  // Use requestAnimationFrame for rendering
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

      // Draw all pencil drawings
      for (const drawing of drawings) {
        if (drawing.type === 'pencil' && drawing.points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(drawing.points[0].x, drawing.points[0].y);
          for (let i = 1; i < drawing.points.length; i++) {
            ctx.lineTo(drawing.points[i].x, drawing.points[i].y);
          }
          
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.lineWidth = drawing.style.strokeWidth;
          ctx.strokeStyle = drawing.style.strokeColor;
          
          // Optionally apply fill if needed, but pencil is usually just stroke
          if (drawing.style.fillColor && drawing.style.fillColor !== 'transparent') {
            ctx.fillStyle = drawing.style.fillColor;
            ctx.fill();
          }
          
          ctx.stroke();
        }
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
