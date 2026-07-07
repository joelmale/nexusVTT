import React, { useEffect, useRef, useState } from 'react';
import { useIsHost } from '@/stores/gameStore';
import { SceneTabs } from './SceneTabs';
import type { Scene } from '@/types/game';
import styles from './ScenePill.module.css';

interface ScenePillProps {
  scenes: Scene[];
  activeSceneId: string;
}

/**
 * A6c: floating replacement for the permanent `.scene-tab-bar` row, mounted
 * under the `floating-panels` flag only (see GameUI.tsx). Host-only - a
 * player following the DM's active scene has no scene control at all, so
 * they get no pill (verified: SceneTabs' onClick calls setActiveScene
 * unconditionally, but the tab list itself is host-gated in practice via
 * this component - non-hosts never render ScenePill and therefore never
 * reach a scene tab to click).
 *
 * Renders a compact button showing the active scene's name; clicking it
 * opens a popover containing the existing SceneTabs UI (unmodified) so all
 * scene CRUD (switch/add/rename/delete/reorder) stays reachable through one
 * code path instead of forking the logic. This is the least-risk reuse
 * strategy: SceneTabs already reads all its actions from useGameStore, so
 * rendering it verbatim inside a popover requires no changes to SceneTabs.
 *
 * Positioned below PlayerClusterFloating's default top-left slot (16,16) so
 * the two floating clusters don't overlap out of the box; both remain
 * independently draggable via useDraggablePanel elsewhere, so this is a
 * default-position concern only, not a hard constraint.
 */
export const ScenePill: React.FC<ScenePillProps> = ({
  scenes,
  activeSceneId,
}) => {
  const isHost = useIsHost();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const activeScene = scenes.find((s) => s.id === activeSceneId) || null;

  // Close on outside click.
  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (e: PointerEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  // Escape closes; focus captured on open and restored on close.
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      return undefined;
    }

    previouslyFocusedRef.current?.focus();
    previouslyFocusedRef.current = null;
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Players never get a pill at all - they follow the DM's active scene and
  // have no local scene-switching affordance under the flag.
  if (!isHost) return null;

  return (
    <div ref={containerRef} className={styles.container}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Switch scene"
        title="Switch scene"
      >
        <span className={styles.icon} aria-hidden="true">
          🗺️
        </span>
        <span className={styles.sceneName}>
          {activeScene?.name || 'No scene'}
        </span>
      </button>

      {isOpen && (
        <div
          className={styles.popover}
          role="dialog"
          aria-label="Scene switcher"
        >
          <SceneTabs scenes={scenes} activeSceneId={activeSceneId} />
        </div>
      )}
    </div>
  );
};
