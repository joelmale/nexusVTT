import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Tooltip } from './Tooltip';
import ConnectionStatus from './ConnectionStatus';
import styles from './PanelDock.module.css';

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
 * A6b: top-right floating icon dock replacing the removed header's
 * horizontal panel tabs. One 36px round button per panel, keyboard
 * navigable via roving tabindex (ArrowLeft/ArrowRight/Home/End), with
 * Tooltip-provided labels and `aria-pressed` reflecting the
 * active+open panel. ConnectionStatus is appended as the rightmost,
 * non-interactive cluster member.
 *
 * Idle-fade: after 3s with no pointer activity over the dock, it fades to
 * ~40% opacity; pointerenter restores it immediately. Disabled entirely
 * under `prefers-reduced-motion` (the dock simply stays fully visible).
 */
export function PanelDock<T extends string = string>({
  panels,
  activePanel,
  isOpen,
  onSelect,
}: PanelDockProps<T>) {
  const [idle, setIdle] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [focusedId, setFocusedId] = useState<T>(activePanel);

  const prefersReducedMotion =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? (window.matchMedia('(prefers-reduced-motion: reduce)')?.matches ?? false)
      : false;

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const scheduleIdle = useCallback(() => {
    if (prefersReducedMotion) return;
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => setIdle(true), 3000);
  }, [clearIdleTimer, prefersReducedMotion]);

  useEffect(() => {
    scheduleIdle();
    return clearIdleTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePointerEnter = useCallback(() => {
    setIdle(false);
    clearIdleTimer();
  }, [clearIdleTimer]);

  const handlePointerLeave = useCallback(() => {
    scheduleIdle();
  }, [scheduleIdle]);

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
      className={styles.dock}
      data-idle={idle ? 'true' : undefined}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      role="tablist"
      aria-label="Panels"
    >
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
      <div className={styles.connectionStatus}>
        <ConnectionStatus showDetails={false} />
      </div>
    </div>
  );
}
