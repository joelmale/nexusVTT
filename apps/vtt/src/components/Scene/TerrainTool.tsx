import React, { useCallback, useState } from 'react';
import type { Point } from '@/types/drawing';
import type { Camera } from '@/types/game';
import { pixelToHex, type HexCoord } from '@/utils/hexMath';
import { sceneUtils } from '@/utils/sceneUtils';

interface TerrainToolProps {
  isActive: boolean;
  camera: Camera;
  gridSettings: {
    type?: 'square' | 'hex';
    size: number;
    offsetX?: number;
    offsetY?: number;
    hexScale?: number;
    difficultTerrain?: HexCoord[];
  };
  onTerrainUpdate: (terrain: HexCoord[]) => void;
  svgRef: React.RefObject<SVGSVGElement>;
}

/**
 * Terrain tool for marking difficult terrain hexes
 * Only works with hex grids
 */
export const TerrainTool: React.FC<TerrainToolProps> = ({
  isActive,
  camera,
  gridSettings,
  onTerrainUpdate,
  svgRef,
}) => {
  const [isPainting, setIsPainting] = useState(false);
  const [paintMode, setPaintMode] = useState<'add' | 'remove'>('add'); // Add or remove terrain

  const clientToScene = useCallback(
    (screenX: number, screenY: number): Point => {
      return sceneUtils.clientToWorld(screenX, screenY, camera, svgRef.current);
    },
    [camera, svgRef],
  );

  const getHexAtPoint = useCallback(
    (point: Point): HexCoord | null => {
      if (gridSettings.type !== 'hex') return null;

      return pixelToHex(
        point,
        gridSettings.size,
        gridSettings.offsetX || 0,
        gridSettings.offsetY || 0,
        gridSettings.hexScale || 1.0,
      );
    },
    [gridSettings],
  );

  const isHexMarked = useCallback(
    (hex: HexCoord): boolean => {
      return (gridSettings.difficultTerrain || []).some(
        (terrainHex) => terrainHex.q === hex.q && terrainHex.r === hex.r,
      );
    },
    [gridSettings.difficultTerrain],
  );

  const toggleTerrainAtHex = useCallback(
    (hex: HexCoord) => {
      const currentTerrain = gridSettings.difficultTerrain || [];
      const isCurrentlyMarked = isHexMarked(hex);

      let newTerrain: HexCoord[];

      if (paintMode === 'add' && !isCurrentlyMarked) {
        // Add terrain
        newTerrain = [...currentTerrain, hex];
      } else if (paintMode === 'remove' && isCurrentlyMarked) {
        // Remove terrain
        newTerrain = currentTerrain.filter(
          (terrainHex) => !(terrainHex.q === hex.q && terrainHex.r === hex.r),
        );
      } else {
        // No change needed
        return;
      }

      onTerrainUpdate(newTerrain);
    },
    [gridSettings.difficultTerrain, paintMode, isHexMarked, onTerrainUpdate],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isActive || gridSettings.type !== 'hex') return;

      const scenePoint = clientToScene(e.clientX, e.clientY);
      const hex = getHexAtPoint(scenePoint);

      if (hex) {
        setIsPainting(true);
        toggleTerrainAtHex(hex);
      }

      e.stopPropagation();
    },
    [
      isActive,
      gridSettings.type,
      clientToScene,
      getHexAtPoint,
      toggleTerrainAtHex,
    ],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPainting || !isActive || gridSettings.type !== 'hex') return;

      const scenePoint = clientToScene(e.clientX, e.clientY);
      const hex = getHexAtPoint(scenePoint);

      if (hex) {
        toggleTerrainAtHex(hex);
      }

      e.stopPropagation();
    },
    [
      isPainting,
      isActive,
      gridSettings.type,
      clientToScene,
      getHexAtPoint,
      toggleTerrainAtHex,
    ],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (isPainting) {
        setIsPainting(false);
        e.stopPropagation();
      }
    },
    [isPainting],
  );

  if (!isActive || gridSettings.type !== 'hex') {
    return null;
  }

  return (
    <g className="terrain-tool">
      {/* Tool instructions */}
      <g className="terrain-instructions">
        <text
          x={10}
          y={30}
          fill="white"
          fontSize={14}
          fontFamily="Arial, sans-serif"
        >
          🌿 Terrain Tool - {paintMode === 'add' ? 'Adding' : 'Removing'}{' '}
          difficult terrain
        </text>
        <text
          x={10}
          y={50}
          fill="#cccccc"
          fontSize={12}
          fontFamily="Arial, sans-serif"
        >
          Click and drag to paint terrain. Right-click to toggle mode.
        </text>
        <text
          x={10}
          y={65}
          fill="#cccccc"
          fontSize={11}
          fontFamily="Arial, sans-serif"
        >
          Current:{' '}
          {paintMode === 'add' ? '🟥 Add Terrain' : '⬜ Remove Terrain'}
        </text>
      </g>

      {/* Invisible overlay for mouse events */}
      <rect
        x={-10000}
        y={-10000}
        width={20000}
        height={20000}
        fill="transparent"
        style={{ cursor: isActive ? 'crosshair' : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={(e) => {
          e.preventDefault();
          setPaintMode(paintMode === 'add' ? 'remove' : 'add');
        }}
      />
    </g>
  );
};
