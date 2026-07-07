import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Tooltip } from './Tooltip';
import styles from './PanelDock.module.css';

import { useDraggablePanel } from '@/hooks/useDraggablePanel';
import { useUIStackStore, useStackZIndex } from '@/stores/uiStackStore';

export interface PanelDockPanel<T extends string = string> {
  id: T;
  icon: string;
  label: string;
}

interface PanelDockProps<T extends string = string> {
  panels: PanelDockPanel<T>[];
  /** Currently selected panel id (may or may not be open - see `isOpen`). */
  activePanel: T;
  /** Whether the FloatingPanel is currently open (drives aria-pressed). */
  isOpen: boolean;
  onSelect: (panel: T) => void;
}

/**
 * A6b: Top-right floating panel selector dock.
 *
 * Defaults to a compact pill showing "Panels" with the active panel icon.
 * Expands on hover to reveal the full icon row.
 */
export function PanelDock<T extends string = string>({
  panels,
  activePanel,
  isOpen,
  onSelect,
}: PanelDockProps<T>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hoverTimeoutRef = useRef<number | undefined>(undefined);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [focusedId, setFocusedId] = useState<T>(activePanel);

  const {
    onPointerDown,
    panelRef,
  } = useDraggablePanel({
    id: 'panelDock',
    defaultPosition: { x: window.innerWidth - 300, y: 16 },
  });

  const zIndex = useStackZIndex('panelDock');
  const bringToFront = useUIStackStore((state) => state.bringToFront);

  // ── Hover expand / collapse ──
  const handleMouseEnter = useCallback(() => {
    window.clearTimeout(hoverTimeoutRef.current);
    setIsExpanded(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsExpanded(false);
    }, 400);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(hoverTimeoutRef.current);
  }, []);

  // ── Active panel info ──
  const activePanelData = panels.find((p) => p.id === activePanel);

  // ── Roving tabindex ──
  const focusButton = (id: T) => {
    const el = buttonRefs.current.get(id);
    el?.focus();
    setFocusedId(id);
  };

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    let nextIndex: number;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (index + 1) % panels.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (index - 1 + panels.length) % panels.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = panels.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    focusButton(panels[nextIndex].id);
  };

  return (
    <div
      ref={panelRef}
      className={`${styles.dock} ${isExpanded ? styles.expanded : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onPointerDownCapture={() => bringToFront('panelDock')}
      style={{ zIndex }}
      role="tablist"
      aria-label="Panels"
      aria-expanded={isExpanded}
    >
      {/* Drag handle */}
      <div
        className={styles.dragHandle}
        aria-hidden="true"
        onPointerDown={(e) => {
          e.stopPropagation();
          onPointerDown(e);
        }}
        title="Drag Panel Dock"
      >
        ⠿
      </div>

      {/* Compact view: label + active panel icon */}
      <div className={styles.compactView}>
        <span className={styles.label}>
          {activePanelData?.icon || '📋'} Panels
        </span>
      </div>

      {/* Separator */}
      <div className={styles.separator} />

      {/* Expanded: icon buttons */}
      <div className={styles.expandedView}>
        {panels.map((panel, index) => {
          const isActive = panel.id === activePanel && isOpen;
          const isRovingTarget = panel.id === focusedId;

          return (
            <Tooltip key={panel.id} text={panel.label}>
              <button
                ref={(el) => {
                  if (el) buttonRefs.current.set(panel.id, el);
                  else buttonRefs.current.delete(panel.id);
                }}
                type="button"
                role="tab"
                className={styles.iconButton}
                data-active={isActive ? 'true' : undefined}
                aria-pressed={isActive}
                aria-selected={isActive}
                aria-label={panel.label}
                tabIndex={isRovingTarget ? 0 : -1}
                onClick={() => {
                  setFocusedId(panel.id);
                  onSelect(panel.id);
                }}
                onFocus={() => setFocusedId(panel.id)}
                onKeyDown={(e) => handleKeyDown(e, index)}
              >
                <span className={styles.icon} aria-hidden="true">
                  {panel.icon}
                </span>
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
