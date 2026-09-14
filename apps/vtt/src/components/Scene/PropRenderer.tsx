import React, { useState, useEffect, useRef } from 'react';
import type { Prop } from '@/types/prop';
import { useActiveTool, useIsHost, useGameStore } from '@/stores/gameStore';
import { usePropRenderData } from '@/stores/scene';
import { propAssetManager } from '@/services/propAssets';
import { safeImageUrl } from '@/utils/safeUrl';
import { ContainerModal } from '../Props/ContainerModal';

interface PropRendererProps {
  placedPropId: string;
  gridSize: number;
  isSelected: boolean;
  onSelect: (id: string, multi: boolean) => void;
  onMove: (id: string, deltaX: number, deltaY: number) => void;
  onMoveEnd?: (id: string) => void;
  currentUserId: string;
  sceneId: string;
}

/**
 * Renders a placed prop on the scene canvas
 * Follows the same interaction patterns as TokenRenderer
 *
 * A5: self-subscribes to its own prop record via `usePropRenderData`
 * instead of receiving the full `PlacedProp` object as a prop, mirroring
 * TokenRenderer's isolation guarantee. Base `Prop` asset lookup and the
 * visibility/canEdit checks (previously in the parent's map) live here now.
 */
export const PropRenderer: React.FC<PropRendererProps> = React.memo(
  ({
    placedPropId,
    gridSize,
    isSelected,
    onSelect,
    onMove,
    onMoveEnd,
    currentUserId,
    sceneId,
  }) => {
    const activeTool = useActiveTool();
    const isHost = useIsHost();
    const setActiveTool = useGameStore((state) => state.setActiveTool);
    const placedProp = usePropRenderData(placedPropId);

    // Resolve the base prop asset (PropAssetManager returns a placeholder
    // for missing props, so no null check is needed - same as before A5).
    const prop: Prop = propAssetManager.getPropById(placedProp?.propId ?? '');

    const canEdit = isHost || placedProp?.placedBy === currentUserId;
    const [isDragging, setIsDragging] = useState(false);
    const [showContainerModal, setShowContainerModal] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });

    // Calculate prop size in pixels
    // Props store explicit width/height in grid cells
    const propWidth = placedProp ? (placedProp.width || 1) * gridSize * placedProp.scale : 0;
    const propHeight = placedProp ? (placedProp.height || 1) * gridSize * placedProp.scale : 0;

    // Allow interactions for hosts/owners; auto-switch to select if needed
    const canInteract = canEdit;

    // Debug logging for selected props
    useEffect(() => {
      if (isSelected) {
        console.log(`🎭 Props: Prop ${placedPropId} selected:`, {
          propName: prop.name,
          canEdit,
          activeTool,
          canInteract,
          isSelected,
        });
      }
    }, [isSelected, canEdit, activeTool, canInteract, placedPropId, prop.name]);

    // Global mouse handlers for dragging
    useEffect(() => {
      if (!isDragging) return;

      const handleMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;

        onMove(placedPropId, deltaX, deltaY);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        // Apply grid snapping when drag ends
        if (onMoveEnd) {
          onMoveEnd(placedPropId);
        }
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }, [isDragging, onMove, placedPropId, onMoveEnd]);

    const handleMouseDown = (e: React.MouseEvent) => {
      console.log('🎭 Props: Prop mouseDown:', {
        canInteract,
        propId: placedPropId,
        activeTool,
        canEdit,
        isSelected,
        button: e.button,
      });

      if (!canInteract) {
        console.log('❌ Props: canInteract is false, returning early');
        return;
      }

      // If not on select tool, switch to select to enable manipulation
      if (activeTool !== 'select') {
        setActiveTool('select');
      }

      // Only handle left-click
      if (e.button !== 0) {
        console.log('❌ Props: Not left-click, ignoring');
        return;
      }

      // CRITICAL: Stop event propagation to prevent DrawingTools from handling this
      e.stopPropagation();
      console.log("✅ Props: stopPropagation called, event won't reach DrawingTools");

      // Select this prop (or add to multi-select with Shift/Cmd/Ctrl)
      const isMultiSelect = e.shiftKey || e.metaKey || e.ctrlKey;
      console.log('🎯 Props: Calling onSelect:', {
        propId: placedPropId,
        isMultiSelect,
        isSelected,
      });
      onSelect(placedPropId, isMultiSelect);

      // Start dragging if already selected or just selected
      if (isSelected || !isMultiSelect) {
        console.log('🚀 Props: Starting drag for prop:', placedPropId);
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      }
    };

  // Handle double-click for containers
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!prop.interactive || prop.category !== 'container') return;

    e.stopPropagation();
    console.log('🎭 Props: Opening container modal:', placedPropId);
    setShowContainerModal(true);
  };

    // Prop was removed from the store (deleted) between the id list and
    // this subscription resolving - render nothing rather than crash.
    if (!placedProp) return null;

    // Visibility filter (previously in the parent's map): players don't
    // see hidden props.
    if (!isHost && !placedProp.visibleToPlayers) return null;

    // Determine prop state for visual indicators
    const currentState = placedProp.currentStats?.state || 'closed';
    const isLocked = currentState === 'locked';
    const isOpen = currentState === 'open';
    const isContainer = prop.category === 'container';
    const hasLight = prop.lightRadius && prop.lightRadius > 0;
    const lightRadius = hasLight ? (prop.lightRadius || 0) * gridSize : 0;

    return (
      <>
        <g
          transform={`translate(${placedProp.x}, ${placedProp.y}) rotate(${placedProp.rotation})`}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          style={{
            cursor: canInteract ? (isDragging ? 'grabbing' : 'grab') : 'default',
            pointerEvents: canInteract ? 'auto' : 'none',
          }}
        >
        {/* Light Source Visualization */}
        {hasLight && (
          <g>
            {/* Outer glow */}
            <circle
              cx={0}
              cy={0}
              r={lightRadius}
              fill="url(#light-gradient)"
              opacity={0.3}
              pointerEvents="none"
            />
            {/* Inner glow */}
            <circle
              cx={0}
              cy={0}
              r={lightRadius * 0.5}
              fill={prop.lightColor || '#FFD700'}
              opacity={0.15}
              pointerEvents="none"
            />
            {/* Light indicator icon (top right) */}
            <g transform={`translate(${propWidth / 3}, ${-propHeight / 3})`}>
              <circle cx={0} cy={0} r={10} fill="#FFD700" opacity={0.9} />
              <text
                x={0}
                y={0}
                fontSize={14}
                fill="#000"
                textAnchor="middle"
                dominantBaseline="central"
              >
                💡
              </text>
            </g>
          </g>
        )}

        {/* Prop Image */}
        <image
          href={safeImageUrl(prop.image)}
          x={-propWidth / 2}
          y={-propHeight / 2}
          width={propWidth}
          height={propHeight}
          style={{
            opacity: isDragging ? 0.7 : placedProp.revealed === false ? 0.5 : 1,
            filter: 'none',
          }}
        />

        {/* Selection Indicator */}
        {isSelected && (
          <rect
            x={-propWidth / 2 - 2}
            y={-propHeight / 2 - 2}
            width={propWidth + 4}
            height={propHeight + 4}
            fill="none"
            stroke="#4A9EFF"
            strokeWidth={3}
            strokeDasharray="5,5"
            style={{
              animation: 'dash 0.5s linear infinite',
            }}
          />
        )}

        {/* Interactive State Indicators */}
        {isLocked && (
          <g transform={`translate(${propWidth / 3}, ${-propHeight / 3})`}>
            {/* Lock icon background */}
            <circle cx={0} cy={0} r={12} fill="#000" opacity={0.7} />
            {/* Lock icon */}
            <text
              x={0}
              y={0}
              fontSize={16}
              fill="#FFD700"
              textAnchor="middle"
              dominantBaseline="central"
            >
              🔒
            </text>
          </g>
        )}

        {isOpen && (
          <g transform={`translate(${propWidth / 3}, ${-propHeight / 3})`}>
            {/* Open icon background */}
            <circle cx={0} cy={0} r={12} fill="#000" opacity={0.7} />
            {/* Open icon */}
            <text
              x={0}
              y={0}
              fontSize={16}
              fill="#90EE90"
              textAnchor="middle"
              dominantBaseline="central"
            >
              🔓
            </text>
          </g>
        )}

        {/* DM Notes Only indicator */}
        {placedProp.dmNotesOnly && (
          <g transform={`translate(${-propWidth / 3}, ${-propHeight / 3})`}>
            <circle cx={0} cy={0} r={10} fill="#FF6B6B" opacity={0.9} />
            <text
              x={0}
              y={0}
              fontSize={12}
              fill="#FFF"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="central"
            >
              DM
            </text>
          </g>
        )}

        {/* Hidden from players indicator */}
        {!placedProp.visibleToPlayers && !placedProp.dmNotesOnly && (
          <g transform={`translate(${-propWidth / 3}, ${-propHeight / 3})`}>
            <circle cx={0} cy={0} r={10} fill="#9B59B6" opacity={0.9} />
            <text
              x={0}
              y={0}
              fontSize={14}
              fill="#FFF"
              textAnchor="middle"
              dominantBaseline="central"
            >
              👁
            </text>
          </g>
        )}

        {/* Container indicator (bottom center) */}
        {isContainer && (
          <g transform={`translate(0, ${propHeight / 2 - 8})`}>
            <circle cx={0} cy={0} r={10} fill="#4A9EFF" opacity={0.9} />
            <text
              x={0}
              y={0}
              fontSize={14}
              fill="#FFF"
              textAnchor="middle"
              dominantBaseline="central"
            >
              📦
            </text>
          </g>
        )}
      </g>

      {/* Container Modal - reads the full PlacedProp record (name, id,
          currentStats) only while open; this is a rare, user-initiated
          interaction, not part of the per-frame render-isolation guarantee
          this packet targets, so a scoped full-record read here is fine. */}
      {showContainerModal && (
        <ContainerModalGate
          sceneId={sceneId}
          placedPropId={placedPropId}
          isHost={isHost}
          onClose={() => setShowContainerModal(false)}
        />
      )}
    </>
    );
  },
);

/**
 * Small indirection so the (rare) full-record subscription for
 * ContainerModal only exists while the modal is actually mounted, instead
 * of being held by PropRenderer on every render.
 */
const ContainerModalGate: React.FC<{
  sceneId: string;
  placedPropId: string;
  isHost: boolean;
  onClose: () => void;
}> = ({ sceneId, placedPropId, isHost, onClose }) => {
  const placedProp = useGameStore((state) => {
    const scene = state.sceneState.scenes.find((s) => s.id === sceneId);
    return scene?.placedProps?.find((p) => p.id === placedPropId) ?? null;
  });

  if (!placedProp) return null;

  return (
    <ContainerModal
      placedProp={placedProp}
      sceneId={sceneId}
      onClose={onClose}
      isHost={isHost}
    />
  );
};

PropRenderer.displayName = 'PropRenderer';
