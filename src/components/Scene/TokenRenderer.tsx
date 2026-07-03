import React, { useState, useEffect, useRef } from 'react';
import type { PlacedToken, Token } from '@/types/token';
import { getTokenPixelSize, getEffectiveTokenName } from '@/types/token';
import { useActiveTool } from '@/stores/gameStore';
import { useTransientDrag } from '@/hooks/useTransientDrag';

interface TokenRendererProps {
  placedToken: PlacedToken;
  token: Token;
  gridSize: number;
  isSelected: boolean;
  onSelect: (id: string, multi: boolean) => void;
  /** Called exactly once, on gesture release, with the final world position. */
  onMoveEnd: (id: string, position: { x: number; y: number }) => void;
  onRotate?: (id: string, rotation: number) => void;
  canEdit: boolean;
}

/**
 * Renders a placed token on the scene canvas
 */
export const TokenRenderer: React.FC<TokenRendererProps> = React.memo(
  ({
    placedToken,
    token,
    gridSize,
    isSelected,
    onSelect,
    onMoveEnd,
    canEdit,
  }) => {
    const activeTool = useActiveTool();
    const [isDragging, setIsDragging] = useState(false);
    const imageRef = useRef<SVGImageElement>(null);

    // Calculate token size in pixels
    const tokenSize =
      getTokenPixelSize(token.size, gridSize) * placedToken.scale;

    // Only handle interactions when select tool is active (select tool combines select + move)
    const canInteract = canEdit && activeTool === 'select';

    // Debug logging for selected tokens
    useEffect(() => {
      if (isSelected) {
        console.log(`🎯 Token ${placedToken.id} selected:`, {
          tokenName: token.name,
          canEdit,
          activeTool,
          canInteract,
          isSelected,
        });
      }
    }, [isSelected, canEdit, activeTool, canInteract, placedToken.id, token.name]);

    // Transient drag: imperative rAF-batched `transform` writes during the
    // gesture (no setState/store writes), exactly one commit on release.
    const { onPointerDown: onDragPointerDown } = useTransientDrag({
      getStartPosition: () => ({ x: placedToken.x, y: placedToken.y }),
      rotation: placedToken.rotation,
      disabled: !canInteract,
      onCommit: (position) => {
        setIsDragging(false);
        if (imageRef.current) {
          imageRef.current.style.opacity = '1';
        }
        onMoveEnd(placedToken.id, position);
      },
    });

    const handlePointerDown = (e: React.PointerEvent<SVGGElement>) => {
      console.log('🖱️ Token pointerDown:', {
        canInteract,
        tokenId: placedToken.id,
        activeTool,
        canEdit,
        isSelected,
        button: e.button,
      });
      if (!canInteract) {
        console.log('❌ canInteract is false, returning early');
        return;
      }

      // Only handle left-click
      if (e.button !== 0) {
        console.log('❌ Not left-click, ignoring');
        return;
      }

      e.stopPropagation();
      console.log('✅ stopPropagation called, event won\'t reach DrawingTools');

      // Select this token (or add to multi-select with Shift/Cmd/Ctrl)
      const isMultiSelect = e.shiftKey || e.metaKey || e.ctrlKey;
      console.log('🎯 Calling onSelect:', {
        tokenId: placedToken.id,
        isMultiSelect,
        isSelected,
      });
      onSelect(placedToken.id, isMultiSelect);

      // Start dragging if already selected or just selected
      if (isSelected || !isMultiSelect) {
        console.log('🚀 Starting drag for token:', placedToken.id);
        setIsDragging(true);
        if (imageRef.current) {
          imageRef.current.style.opacity = '0.7';
        }
        onDragPointerDown(e);
      }
    };

    return (
      <g
        transform={`translate(${placedToken.x}, ${placedToken.y}) rotate(${placedToken.rotation})`}
        onPointerDown={handlePointerDown}
        style={{
          cursor: canInteract ? (isDragging ? 'grabbing' : 'grab') : 'default',
          pointerEvents: canInteract ? 'auto' : 'none',
          touchAction: canInteract ? 'none' : undefined,
        }}
      >
        {/* Token Image */}
        <image
          ref={imageRef}
          href={token.image}
          x={-tokenSize / 2}
          y={-tokenSize / 2}
          width={tokenSize}
          height={tokenSize}
          style={{
            opacity: 1,
            filter: placedToken.isDead ? 'grayscale(100%)' : 'none',
          }}
        />

        {/* Dead indicator - Black X */}
        {placedToken.isDead && (
          <g>
            {/* X mark */}
            <line
              x1={-tokenSize / 3}
              y1={-tokenSize / 3}
              x2={tokenSize / 3}
              y2={tokenSize / 3}
              stroke="#000"
              strokeWidth={4}
              strokeLinecap="round"
            />
            <line
              x1={tokenSize / 3}
              y1={-tokenSize / 3}
              x2={-tokenSize / 3}
              y2={tokenSize / 3}
              stroke="#000"
              strokeWidth={4}
              strokeLinecap="round"
            />
            {/* White outline for visibility */}
            <line
              x1={-tokenSize / 3}
              y1={-tokenSize / 3}
              x2={tokenSize / 3}
              y2={tokenSize / 3}
              stroke="#fff"
              strokeWidth={6}
              strokeLinecap="round"
              opacity={0.3}
            />
            <line
              x1={tokenSize / 3}
              y1={-tokenSize / 3}
              x2={-tokenSize / 3}
              y2={tokenSize / 3}
              stroke="#fff"
              strokeWidth={6}
              strokeLinecap="round"
              opacity={0.3}
            />
          </g>
        )}

        {/* Selection indicator */}
        {isSelected && (
          <circle
            cx={0}
            cy={0}
            r={tokenSize / 2 + 5}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={3}
            strokeDasharray="5,5"
          />
        )}

        {/* Token border */}
        <circle
          cx={0}
          cy={0}
          r={tokenSize / 2}
          fill="none"
          stroke={placedToken.dmNotesOnly ? '#ff0000' : '#333'}
          strokeWidth={2}
          opacity={0.8}
        />

        {/* Conditions/status indicators */}
        {placedToken.conditions.length > 0 && (
          <g transform={`translate(${tokenSize / 2}, ${-tokenSize / 2})`}>
            {placedToken.conditions.slice(0, 3).map((condition, index) => (
              <g key={condition.id}>
                <circle
                  cx={-10 * index}
                  cy={0}
                  r={8}
                  fill={condition.color || '#ffc107'}
                  stroke="#000"
                  strokeWidth={1}
                />
                <title>{condition.name}</title>
              </g>
            ))}
          </g>
        )}

        {/* Token label */}
        {(() => {
          const effectiveName = getEffectiveTokenName(placedToken, token);
          return effectiveName ? (
            <text
              x={0}
              y={tokenSize / 2 + 15}
              textAnchor="middle"
              fill="#fff"
              stroke="#000"
              strokeWidth={2}
              paintOrder="stroke"
              fontSize={12}
              fontWeight="bold"
            >
              {effectiveName}
            </text>
          ) : null;
        })()}
      </g>
    );
  },
);
