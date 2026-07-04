import React from 'react';
import { PlayerBar, PlayerActions } from './PlayerBar';
import { useDraggablePanel } from '@/hooks/useDraggablePanel';
import { useUIStackStore, useStackZIndex } from '@/stores/uiStackStore';

interface PlayerClusterFloatingProps {
  leaveRoom: () => void;
}

export const PlayerClusterFloating: React.FC<PlayerClusterFloatingProps> = ({ leaveRoom }) => {
  const {
    onPointerDown,
    isCollapsed,
    toggleCollapsed,
    panelRef,
  } = useDraggablePanel({
    id: 'playerCluster',
    defaultPosition: { x: 16, y: 16 },
  });

  const zIndex = useStackZIndex('playerCluster');
  const bringToFront = useUIStackStore((state) => state.bringToFront);

  return (
    <div
      ref={panelRef}
      className="player-cluster-floating"
      data-collapsed={isCollapsed ? 'true' : undefined}
      onPointerDownCapture={() => bringToFront('playerCluster')}
      style={{ zIndex }}
    >
      <div
        className="drag-handle"
        aria-hidden="true"
        onPointerDown={(e) => {
          if (isCollapsed) {
            e.stopPropagation();
            toggleCollapsed();
          } else {
            onPointerDown(e);
          }
        }}
        onClick={(e) => {
          if (isCollapsed) {
            e.stopPropagation();
            toggleCollapsed();
          }
        }}
        title={isCollapsed ? "Expand Player Cluster" : "Drag Player Cluster"}
      >
        {isCollapsed ? "👤" : "⠿"}
      </div>

      {!isCollapsed && (
        <>
          <PlayerBar />
          <PlayerActions />
          <button
            onClick={leaveRoom}
            className="glass-button secondary small"
            title="Leave Room"
          >
            🚪
          </button>
          <button
            onClick={() => toggleCollapsed()}
            className="glass-button secondary small"
            title="Minimize Cluster"
            style={{ padding: '0 8px', fontSize: '12px' }}
          >
            −
          </button>
        </>
      )}
    </div>
  );
};
