import React, { useEffect, useState } from 'react';
import { useGameStore, useCamera } from '@/stores/gameStore';
import { sceneUtils } from '@/utils/sceneUtils';
import { Portal } from '@/components/Portal';
import styles from './TokenContextMenu.module.css';

interface TokenContextMenuProps {
  tokenId: string;
  worldX: number;
  worldY: number;
  isDragging: boolean;
  onEdit: () => void;
}

export const TokenContextMenu: React.FC<TokenContextMenuProps> = ({
  tokenId,
  worldX,
  worldY,
  isDragging,
  onEdit,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const camera = useCamera();
  const deleteToken = useGameStore(s => s.deleteToken);
  const activeSceneId = useGameStore(s => s.sceneState.activeSceneId);
  const updateToken = useGameStore(s => s.updateToken);
  const token = useGameStore(s => 
    activeSceneId ? s.sceneState.scenes.find(sc => sc.id === activeSceneId)?.placedTokens.find(t => t.id === tokenId) : undefined
  );
  const isHost = useGameStore(s => s.user.type === 'host');

  if (isDragging && isVisible) {
    setIsVisible(false);
  }

  // Debounce appearance to avoid flicker during drag-select
  useEffect(() => {
    if (isDragging) return;
    
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 120);
    
    return () => clearTimeout(timer);
  }, [isDragging]);

  if (!isVisible || isDragging || !token || !activeSceneId || !camera) {
    return null;
  }

  // Calculate screen position
  const canvasRoot = document.querySelector('[data-role="scene-canvas-root"]');
  if (!canvasRoot) return null;
  const rect = canvasRoot.getBoundingClientRect();
  const screenPos = sceneUtils.worldToScreen(worldX, worldY, camera, rect.width, rect.height);
  
  // Position above the token (assuming 1 grid unit size approximately)
  const menuTop = rect.top + screenPos.y - 40;
  const menuLeft = rect.left + screenPos.x;

  const handleDelete = () => {
    deleteToken(activeSceneId, tokenId);
  };

  const handleToggleVisibility = () => {
    if (!isHost) return;
    updateToken(activeSceneId, tokenId, { visibleToPlayers: !token.visibleToPlayers });
  };

  const handleToggleInitiative = () => {
    updateToken(activeSceneId, tokenId, { isInInitiative: !token.isInInitiative });
  };

  const handleRotate = () => {
    updateToken(activeSceneId, tokenId, { rotation: (token.rotation + 45) % 360 });
  };

  return (
    <Portal>
      <div 
        className={styles.contextMenuWrapper}
        style={{
          top: menuTop,
          left: menuLeft,
        }}
        onPointerDown={(e) => e.stopPropagation()} // Prevent deselection
      >
        {isHost && (
          <button 
            className={`${styles.actionBtn} ${!token.visibleToPlayers ? styles.active : ''}`}
            onClick={handleToggleVisibility}
            title={token.visibleToPlayers ? 'Hide from players' : 'Show to players'}
          >
            {token.visibleToPlayers ? '👁️' : '🔒'}
          </button>
        )}
        
        <button 
          className={`${styles.actionBtn} ${token.isInInitiative ? styles.active : ''}`}
          onClick={handleToggleInitiative}
          title={token.isInInitiative ? 'Remove from initiative' : 'Add to initiative'}
        >
          ⚔️
        </button>

        <button 
          className={styles.actionBtn}
          onClick={handleRotate}
          title="Rotate"
        >
          ↻
        </button>

        <div className={styles.divider} />
        
        <button 
          className={styles.actionBtn}
          onClick={onEdit}
          title="Edit Details..."
        >
          ⚙️
        </button>

        <div className={styles.divider} />

        <button 
          className={`${styles.actionBtn} ${styles.danger}`}
          onClick={handleDelete}
          title="Delete"
        >
          🗑️
        </button>
      </div>
    </Portal>
  );
};
