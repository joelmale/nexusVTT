import React from 'react';
import { PlayerBar, PlayerActions } from './PlayerBar';
import ConnectionStatus from './ConnectionStatus';
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
          <ConnectionStatus showDetails={false} />
          <div 
            style={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              paddingLeft: '8px', 
              marginLeft: '8px',
              borderLeft: '1px solid rgba(255,255,255,0.1)',
              minWidth: '40px'
            }}
          >
            <div 
              style={{ 
                fontSize: '9px', 
                color: 'rgba(255,255,255,0.6)', 
                textTransform: 'uppercase', 
                marginBottom: '4px', 
                paddingBottom: '2px', 
                borderBottom: '1px solid rgba(255,255,255,0.2)', 
                width: '100%', 
                textAlign: 'center',
                letterSpacing: '0.5px'
              }}
            >
              Layout
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => {
                  alert('Layout saved to browser session.');
                }}
                className="glass-button secondary small"
                title="Save UI Layout"
                style={{ padding: '2px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                💾
              </button>
              <button
                onClick={() => {
                  if (confirm('Reset UI layout to defaults?')) {
                    const keysToRemove: string[] = [];
                    for (let i = 0; i < localStorage.length; i++) {
                      const key = localStorage.key(i);
                      if (key?.startsWith('nexus_ui_') || key?.startsWith('nexus-ui-')) {
                        keysToRemove.push(key);
                      }
                    }
                    keysToRemove.forEach(k => localStorage.removeItem(k));
                    window.location.reload();
                  }
                }}
                className="glass-button secondary small"
                title="Reset UI Layout"
                style={{ padding: '2px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                🔄
              </button>
            </div>
          </div>

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
