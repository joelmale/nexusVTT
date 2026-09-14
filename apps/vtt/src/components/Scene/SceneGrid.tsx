import React from 'react';
import type { Camera } from '@/types/game';
import { useGridSettings } from '@/stores/scene';
import { getHexesInViewport, hexToPixel, hexVertices } from '@/utils/hexMath';

interface SceneGridProps {
  viewportSize: { width: number; height: number };
  camera: Camera;
}

/**
 * Grid layer.
 *
 * A5: self-subscribes to the active scene's grid settings via the narrow
 * `useGridSettings` slice instead of receiving the whole `Scene` object as
 * a prop (which got a new reference on ANY scene mutation, including token
 * moves). Combined with `React.memo` and the remaining stable props
 * (`viewportSize` is component state in SceneCanvas; `camera` keeps its
 * identity under Immer unless the camera itself is written), a token move
 * never re-renders this component: the parent may re-render, but the props
 * here stay reference-equal and the subscription output is unchanged, so
 * React bails out.
 */
export const SceneGrid: React.FC<SceneGridProps> = React.memo(
  ({ viewportSize, camera }) => {
    // Narrow subscription: only fires when the active scene's gridSettings
    // object identity changes (see stores/scene/gridSlice.ts).
    const gridSettingsSlice = useGridSettings();

    // Safe access with defaults (same defaults as before A5)
    const gridSettings = gridSettingsSlice || {
      enabled: true,
      type: 'square' as const,
      size: 50,
      color: '#ffffff',
      opacity: 0.3,
      snapToGrid: true,
      showToPlayers: true,
    };

    if (!gridSettings.enabled) return null;

    const gridType = gridSettings.type || 'square';
    const gridSize = gridSettings.size;
    const zoom = camera.zoom;
    const offsetX = gridSettings.offsetX || 0;
    const offsetY = gridSettings.offsetY || 0;
    const hexScale = gridSettings.hexScale || 1.0;
    const difficultTerrain = gridSettings.difficultTerrain || [];

    // Calculate visible area in world coordinates
    const worldWidth = viewportSize.width / zoom;
    const worldHeight = viewportSize.height / zoom;
    const center = { x: camera.x, y: camera.y };

    if (gridType === 'hex') {
      // Render hexagonal grid
      const hexes = getHexesInViewport(
        center,
        { width: worldWidth, height: worldHeight },
        gridSize,
        offsetX,
        offsetY,
        hexScale,
      );

      const hexElements = hexes.map((hex) => {
        const center = hexToPixel(hex, gridSize, offsetX, offsetY, hexScale);
        const vertices = hexVertices(center, gridSize, hexScale);

        // Check if this hex is difficult terrain
        const isDifficult = difficultTerrain.some(
          (dt) => dt.q === hex.q && dt.r === hex.r,
        );

        // Create hexagon path
        const pathData =
          vertices.reduce((path, vertex, index) => {
            const command = index === 0 ? 'M' : 'L';
            return `${path}${command}${vertex.x},${vertex.y}`;
          }, '') + 'Z';

        // Show coordinates when zoomed in close enough
        const showCoords = zoom > 0.8;
        const coordLabel = showCoords ? `${hex.q},${hex.r}` : '';

        return (
          <g key={`hex-${hex.q}-${hex.r}`}>
            {/* Hexagon outline */}
            <path
              d={pathData}
              fill="none"
              stroke={gridSettings.color}
              strokeWidth={1 / zoom}
              opacity={gridSettings.opacity}
            />

            {/* Difficult terrain overlay */}
            {isDifficult && (
              <path
                d={pathData}
                fill="rgba(255, 0, 0, 0.3)"
                stroke="rgba(255, 0, 0, 0.6)"
                strokeWidth={2 / zoom}
              />
            )}

            {/* Coordinate label */}
            {showCoords && (
              <text
                x={center.x}
                y={center.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={gridSettings.color}
                fontSize={10 / zoom}
                fontFamily="Arial, sans-serif"
                opacity={gridSettings.opacity * 0.7}
              >
                {coordLabel}
              </text>
            )}

            {/* Difficult terrain indicator */}
            {isDifficult && (
              <text
                x={center.x}
                y={center.y - gridSize * hexScale * 0.3}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ff4444"
                fontSize={12 / zoom}
                fontFamily="Arial, sans-serif"
                fontWeight="bold"
              >
                ⚠️
              </text>
            )}
          </g>
        );
      });

      return <g className="scene-grid scene-grid--hex">{hexElements}</g>;
    } else {
      // Render square grid (original implementation)
      const worldLeft = camera.x - worldWidth / 2;
      const worldTop = camera.y - worldHeight / 2;
      const worldRight = camera.x + worldWidth / 2;
      const worldBottom = camera.y + worldHeight / 2;

      // Extend the grid slightly beyond visible area for smooth panning
      const padding = gridSize * 2;
      const gridLeft =
        Math.floor((worldLeft - padding - offsetX) / gridSize) * gridSize +
        offsetX;
      const gridTop =
        Math.floor((worldTop - padding - offsetY) / gridSize) * gridSize +
        offsetY;
      const gridRight =
        Math.ceil((worldRight + padding - offsetX) / gridSize) * gridSize +
        offsetX;
      const gridBottom =
        Math.ceil((worldBottom + padding - offsetY) / gridSize) * gridSize +
        offsetY;

      // Generate grid lines
      const verticalLines = [];
      const horizontalLines = [];

      // Vertical lines
      for (let x = gridLeft; x <= gridRight; x += gridSize) {
        verticalLines.push(
          <line
            key={`v-${x}`}
            x1={x}
            y1={gridTop}
            x2={x}
            y2={gridBottom}
            stroke={gridSettings.color}
            strokeWidth={1 / zoom} // Scale line width with zoom
            opacity={gridSettings.opacity}
          />,
        );
      }

      // Horizontal lines
      for (let y = gridTop; y <= gridBottom; y += gridSize) {
        horizontalLines.push(
          <line
            key={`h-${y}`}
            x1={gridLeft}
            y1={y}
            x2={gridRight}
            y2={y}
            stroke={gridSettings.color}
            strokeWidth={1 / zoom} // Scale line width with zoom
            opacity={gridSettings.opacity}
          />,
        );
      }

      return (
        <g className="scene-grid scene-grid--square">
          {verticalLines}
          {horizontalLines}
        </g>
      );
    }
  },
);
