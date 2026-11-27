import React from 'react';
import { useDrop } from 'react-dnd';
import type { Token } from '@/types/token';
import { cameraRef } from '@/utils/cameraRef';
import { snapToGrid } from '@/utils/mathUtils';
import { sceneUtils } from '@/utils/sceneUtils';

interface TokenDropZoneProps {
  sceneId: string;
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

        const point = sceneUtils.clientToWorld(
          offset.x,
          offset.y,
          cameraRef.get(),
          dropZoneElement,
        );
        const { x, y } = snapToGrid(point, gridSettings);
        onTokenDrop(item.token, x, y);
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
    }),
    [gridSettings, onTokenDrop, dropZoneElement],
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
