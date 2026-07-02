import React from 'react';
import { useDrop } from 'react-dnd';
import type { Token } from '@/types/token';
import { pixelToHex, hexToPixel } from '@/utils/hexMath';

interface TokenDropZoneProps {
  sceneId: string;
  camera: { x: number; y: number; zoom: number };
  gridSettings: {
    type?: 'square' | 'hex';
    size: number;
    snapToGrid: boolean;
    offsetX?: number;
    offsetY?: number;
    hexScale?: number;
  };
  onTokenDrop: (token: Token, x: number, y: number) => void;
  children: React.ReactNode;
}

/**
 * Drop zone for placing tokens on the scene canvas
 * Converts screen coordinates to scene coordinates
 */
export const TokenDropZone: React.FC<TokenDropZoneProps> = ({
  camera,
  gridSettings,
  onTokenDrop,
  children,
}) => {
  const [dropZoneElement, setDropZoneElement] =
    React.useState<HTMLDivElement | null>(null);

  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: 'TOKEN',
      drop: (item: { token: Token }, monitor) => {
        const offset = monitor.getClientOffset();
        if (!offset || !dropZoneElement) return;

        // Get the bounding rect of the drop zone
        const rect = dropZoneElement.getBoundingClientRect();

        // Calculate position relative to drop zone
        const relativeX = offset.x - rect.left;
        const relativeY = offset.y - rect.top;

        // Convert screen coordinates to scene coordinates
        const sceneX = (relativeX - rect.width / 2) / camera.zoom + camera.x;
        const sceneY = (relativeY - rect.height / 2) / camera.zoom + camera.y;

        // Apply grid snapping if enabled
        let finalX = sceneX;
        let finalY = sceneY;

        if (gridSettings.snapToGrid && gridSettings.size > 0) {
          const gridType = gridSettings.type || 'square';
          const gridSize = gridSettings.size;
          const offsetX = gridSettings.offsetX || 0;
          const offsetY = gridSettings.offsetY || 0;
          const hexScale = gridSettings.hexScale || 1.0;

          if (gridType === 'hex') {
            // Convert pixel coordinates to hex coordinates and back
            const hexCoord = pixelToHex(
              { x: sceneX, y: sceneY },
              gridSize,
              offsetX,
              offsetY,
              hexScale,
            );
            const snappedPoint = hexToPixel(
              hexCoord,
              gridSize,
              offsetX,
              offsetY,
              hexScale,
            );
            finalX = snappedPoint.x;
            finalY = snappedPoint.y;
          } else {
            // Square grid snapping
            finalX =
              Math.round((sceneX - offsetX) / gridSize) * gridSize + offsetX;
            finalY =
              Math.round((sceneY - offsetY) / gridSize) * gridSize + offsetY;
          }
        }

        // Call the drop handler
        onTokenDrop(item.token, finalX, finalY);
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
    }),
    [camera, gridSettings, onTokenDrop, dropZoneElement],
  );

  // Combine refs
  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      setDropZoneElement(node);
      drop(node);
    },
    [drop],
  );

  return (
    <div
      ref={setRefs}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        outline: isOver && canDrop ? '3px dashed var(--color-primary)' : 'none',
        outlineOffset: '-3px',
        transition: 'outline 0.2s',
      }}
    >
      {children}
      {isOver && canDrop && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(var(--color-primary-rgb), 0.1)',
            pointerEvents: 'none',
            zIndex: 'var(--z-tool-ui)',
          }}
        />
      )}
    </div>
  );
};
