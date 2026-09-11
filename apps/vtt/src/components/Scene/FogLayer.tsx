import React, { useEffect, useRef } from 'react';
import { useSceneFog } from '@/stores/scene';
import type { Camera } from '@/types/game';

interface FogLayerProps {
  sceneId: string;
  isHost: boolean;
  camera: Camera;
  viewportWidth: number;
  viewportHeight: number;
}

// Opaque for players; the DM sees fog at ~50% so hidden content stays
// visible underneath (SESSION_BRIEFS/A9-paintable-fog.md).
const PLAYER_CONCEAL_COLOR = 'rgba(10, 10, 14, 1)';
const HOST_CONCEAL_COLOR = 'rgba(10, 10, 14, 0.5)';

/**
 * Canvas 2D fog-of-war layer (A9). Mirrors CanvasInkLayer's mounting, dpr,
 * and camera-transform-inside-a-`<foreignObject>` approach exactly (see
 * SceneCanvas's `canvasInk` block) so the two layers share one set of
 * coordinate conventions.
 *
 * Subscription surface is deliberately narrow (A5 discipline extended to
 * fog): ONLY `useSceneFog(sceneId)` + the `isHost` prop already threaded by
 * SceneCanvas. A token or prop move must not re-render this component -
 * fog reads the fogSlice only.
 *
 * Paint model (conceal-all + reveal shapes, ADR-0009 / Owlbear model):
 *   1. If fog is disabled or has no shapes recorded yet, render nothing.
 *   2. Fill the full scene/viewport bounds with the conceal color (opaque
 *      for players, 50% for the host).
 *   3. Punch each reveal shape out with `globalCompositeOperation =
 *      'destination-out'`: rects from their two corner points, brush
 *      strokes as a round-capped polyline of width `brushSize`.
 *
 * Layer-level invalidation: the redraw effect's dependency array is the
 * `fog` object identity (plus camera/viewport/isHost, which affect the
 * paint but not the store) - it does NOT run on an animation loop the way
 * CanvasInkLayer's rAF-driven render does, since fog has no continuous
 * animation and redrawing every frame would be wasted work for a layer
 * that changes only on host paint actions.
 */
export const FogLayer: React.FC<FogLayerProps> = ({
  sceneId,
  isHost,
  camera,
  viewportWidth,
  viewportHeight,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fog = useSceneFog(sceneId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = viewportWidth * dpr;
    canvas.height = viewportHeight * dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!fog || !fog.enabled) {
      return;
    }

    ctx.scale(dpr, dpr);

    // World-to-screen transform (viewport-centered — matches
    // CanvasInkLayer/sceneUtils.screenToWorld's inverse formula).
    ctx.save();
    ctx.translate(viewportWidth / 2, viewportHeight / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // Conceal the entire scene. Bounds are expressed in world units large
    // enough to cover the visible viewport regardless of pan/zoom - using
    // the same oversized-rect convention as DrawingTools' interaction
    // layer (-10000..10000).
    ctx.fillStyle = isHost ? HOST_CONCEAL_COLOR : PLAYER_CONCEAL_COLOR;
    ctx.fillRect(-10000, -10000, 20000, 20000);

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
  }, [fog, isHost, camera, viewportWidth, viewportHeight]);

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
