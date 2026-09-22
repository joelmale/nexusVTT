import React, { useCallback, useEffect, useRef, useState } from 'react';
import Pin from 'lucide-react/dist/esm/icons/pin';
import PinOff from 'lucide-react/dist/esm/icons/pin-off';
import { Tooltip } from './Tooltip';
import styles from './PanelDock.module.css';
import { WorkspaceMenu } from './WorkspaceMenu';

import { useDraggablePanel } from '@/hooks/useDraggablePanel';
import {
  useUIStackStore,
  useStackZIndex,
  useFocusMode,
  topmostPanel,
} from '@/stores/uiStackStore';

export interface PanelDockPanel<T extends string = string> {
  id: T;
  icon: string;
  label: string;
}

interface PanelDockProps<T extends string = string> {
  panels: PanelDockPanel<T>[];
  /** Array of currently open panel IDs. */
  activePanels: T[];
  onSelect: (panel: T) => void;
}

/** Shares the nexus-ui- prefix so "Reset UI Layout" also un-pins the dock. */
const PINNED_STORAGE_KEY = 'nexus-ui-panelDock-pinned';

const loadPinned = (): boolean => {
  try {
    return localStorage.getItem(PINNED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

/**
 * Top-right floating panel selector dock.
 *
 * Expands on hover to reveal the full icon row, or permanently when pinned
 * via the pin icon. Click icons to toggle floating panels on/off.
 */
export function PanelDock<T extends string = string>({
  panels,
  activePanels,
  onSelect,
}: PanelDockProps<T>) {
  const [isHoverExpanded, setIsHoverExpanded] = useState(false);
  const [isPinned, setIsPinned] = useState(loadPinned);
  const isExpanded = isHoverExpanded || isPinned;
  const hoverTimeoutRef = useRef<number | undefined>(undefined);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [focusedId, setFocusedId] = useState<T>(panels[0]?.id);

  const togglePinned = useCallback(() => {
    setIsPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PINNED_STORAGE_KEY, String(next));
      } catch {
        // Ignore quota errors
      }
      return next;
    });
  }, []);

  const { onPointerDown, panelRef } = useDraggablePanel({
    id: 'panelDock',
    defaultPosition: { x: window.innerWidth - 300, y: 16 },
    resizeAnchor: 'right',
  });

  const zIndex = useStackZIndex('panelDock');
  const focusMode = useFocusMode();
  const bringToFront = useUIStackStore((state) => state.bringToFront);
  const panelStack = useUIStackStore((state) => state.panelStack);
  const activePanelsList = useUIStackStore((state) => state.activePanels);
  const topmostId = topmostPanel(panelStack, activePanelsList);

  // ── Hover expand / collapse ──
  const handleMouseEnter = useCallback(() => {
    window.clearTimeout(hoverTimeoutRef.current);
    setIsHoverExpanded(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsHoverExpanded(false);
    }, 400);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(hoverTimeoutRef.current);
  }, []);

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
      data-chrome
      inert={focusMode || undefined}
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

      {/* Compact view: label + pin toggle */}
      <div className={styles.compactView}>
        <span className={styles.label}>
          📋 Panels
        </span>
        <button
          type="button"
          className={styles.pinButton}
          data-pinned={isPinned ? 'true' : undefined}
          aria-pressed={isPinned}
          aria-label={isPinned ? 'Unpin panel dock' : 'Pin panel dock open'}
          title={isPinned ? 'Unpin panel dock' : 'Keep panel dock expanded'}
          onClick={(e) => {
            e.stopPropagation();
            togglePinned();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {isPinned ? (
            <PinOff size={14} aria-hidden="true" />
          ) : (
            <Pin size={14} aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Separator */}
      <div className={styles.separator} />

      {/* Expanded: icon buttons */}
      <div className={styles.expandedView}>
        {panels.map((panel, index) => {
          const isActive = activePanels.includes(panel.id);
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
                data-topmost={isActive && panel.id === topmostId ? 'true' : undefined}
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

        {/* Layout workspaces live with the panel controls, not in Settings. */}
        <WorkspaceMenu />
      </div>
    </div>
  );
}
