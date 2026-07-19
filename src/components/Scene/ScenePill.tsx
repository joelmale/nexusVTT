import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useGameStore, useIsHost, useSession } from '@/stores/gameStore';
import type { Scene } from '@/types/game';
import { sceneUtils } from '@/utils/sceneUtils';
import styles from './ScenePill.module.css';
import { useDraggablePanel } from '@/hooks/useDraggablePanel';
import { useUIStackStore, useStackZIndex } from '@/stores/uiStackStore';

interface ScenePillProps {
  scenes: Scene[];
  activeSceneId: string;
}

/**
 * A6c: Floating scene dock for hosts.
 *
 * Renders a compact pill showing the active scene name.
 * On hover it smoothly expands to reveal all scene chips and a "+" button.
 * Draggable via the ⠿ handle, identical interaction model to PlayerClusterFloating.
 *
 * Key design decisions:
 * - Renders its own scene chips instead of delegating to SceneTabs so we avoid
 *   inheriting the complex `.scene-tab` CSS from layout-consolidated.css.
 * - The drag handle has a 44×44 touch target matching WCAG / player cluster.
 */
export const ScenePill: React.FC<ScenePillProps> = ({
  scenes,
  activeSceneId,
}) => {
  const isHost = useIsHost();
  const session = useSession();
  const { setActiveScene, createScene, deleteScene } = useGameStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const { onPointerDown, panelRef } = useDraggablePanel({
    // Fresh id — ensures no stale localStorage position
    id: 'sceneDock_v5',
    defaultPosition: { x: 550, y: 84 },
  });

  const zIndex = useStackZIndex('scenePill');
  const bringToFront = useUIStackStore((state) => state.bringToFront);

  const activeScene = scenes.find((s) => s.id === activeSceneId) || null;
  const hoverTimeoutRef = useRef<number | undefined>(undefined);

  const handleMouseEnter = useCallback(() => {
    window.clearTimeout(hoverTimeoutRef.current);
    setIsExpanded(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsExpanded(false);
    }, 400);
  }, []);

  const handleCreateScene = useCallback(() => {
    const sceneNumber = scenes.length + 1;
    const defaultScene = sceneUtils.createDefaultScene(
      `Scene ${sceneNumber}`,
      session?.hostId || 'unknown',
    );
    const newScene = createScene(defaultScene);
    setActiveScene(newScene.id);
  }, [scenes.length, session?.hostId, createScene, setActiveScene]);

  const handleDeleteScene = useCallback(
    (sceneId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (
        scenes.length > 1 &&
        window.confirm('Delete this scene? This cannot be undone.')
      ) {
        deleteScene(sceneId);
      }
    },
    [scenes.length, deleteScene],
  );

  useEffect(() => {
    return () => window.clearTimeout(hoverTimeoutRef.current);
  }, []);

  if (!isHost) return null;

  return (
    <div
      ref={panelRef}
      className={`${styles.container} ${isExpanded ? styles.expanded : ''}`}
      onPointerDownCapture={() => bringToFront('scenePill')}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ zIndex }}
      aria-expanded={isExpanded}
      role="region"
      aria-label="Scene Manager"
    >
      {/* Drag handle — exactly like PlayerClusterFloating */}
      <div
        className={styles.dragHandle}
        aria-hidden="true"
        title="Drag Scene Dock"
        onPointerDown={(e) => {
          e.stopPropagation();
          onPointerDown(e);
        }}
      >
        ⠿
      </div>

      {/* Compact: active scene name */}
      <div className={styles.compactView}>
        <span className={styles.icon} aria-hidden="true">🗺️</span>
        <span className={styles.sceneName}>
          {activeScene?.name || 'No scene'}
        </span>
      </div>

      {/* Divider between compact and expanded */}
      <div className={styles.separator} />

      {/* Expanded: scene chips + add button */}
      <div className={styles.expandedView}>
        {scenes.map((scene) => (
          <button
            key={scene.id}
            type="button"
            className={
              scene.id === activeSceneId
                ? styles.sceneChipActive
                : styles.sceneChip
            }
            onClick={() => setActiveScene(scene.id)}
            title={scene.description || scene.name}
          >
            {scene.name}
            {scenes.length > 1 && (
              <span
                className={styles.deleteBtn}
                role="button"
                tabIndex={0}
                onClick={(e) => handleDeleteScene(scene.id, e)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleDeleteScene(scene.id, e as unknown as React.MouseEvent);
                  }
                }}
                title="Delete scene"
                aria-label={`Delete ${scene.name}`}
              >
                ×
              </span>
            )}
          </button>
        ))}

        {/* Add new scene */}
        <button
          type="button"
          className={styles.addButton}
          onClick={handleCreateScene}
          title="Create new scene"
          aria-label="Create new scene"
        >
          +
        </button>
      </div>
    </div>
  );
};
