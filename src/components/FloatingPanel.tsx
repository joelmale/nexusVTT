import React, { useEffect, useRef } from 'react';
import { Portal } from './Portal';
import styles from './FloatingPanel.module.css';
import { useDraggablePanel } from '@/hooks/useDraggablePanel';
import { useResizablePanel } from '@/hooks/useResizablePanel';
import { useUIStackStore, useStackZIndex } from '@/stores/uiStackStore';

interface FloatingPanelProps {
  /** Whether the panel is currently open. Controls data-state + focus mgmt. */
  isOpen: boolean;
  /** Called when the panel should close (Escape key). */
  onClose: () => void;
  /** Accessible name for the dialog (role="dialog" aria-label). */
  label: string;
  children: React.ReactNode;
}

/**
 * Portal-mounted floating panel shell. Draggable via title bar, resizable
 * by dragging edges/corners. Size and position are persisted to localStorage.
 *
 * Accessibility:
 *  - role="dialog", aria-modal="false" (non-modal — map stays interactive).
 *  - Escape closes the panel.
 *  - Focus returns to the previously focused element on close.
 */
export const FloatingPanel: React.FC<FloatingPanelProps> = ({
  isOpen,
  onClose,
  label,
  children,
}) => {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const {
    onPointerDown,
    isCollapsed,
    toggleCollapsed,
    shiftPosition,
    panelRef,
  } = useDraggablePanel({
    id: 'floatingPanel',
    defaultPosition: { x: window.innerWidth - 320 - 16, y: 84 },
  });

  const { size, onResizeStart, edgeCursor } = useResizablePanel({
    id: 'floatingPanel',
    defaultSize: { width: 320, height: 600 },
    minWidth: 260,
    minHeight: 200,
    maxWidth: 800,
    maxHeight: 900,
    onPositionChange: shiftPosition,
  });

  const zIndex = useStackZIndex('floatingPanel');
  const bringToFront = useUIStackStore((state) => state.bringToFront);

  // Capture the opener's focus when opening, and restore it on close.
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      const id = window.requestAnimationFrame(() => {
        panelRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(id);
    }

    previouslyFocusedRef.current?.focus();
    previouslyFocusedRef.current = null;
    return undefined;
  }, [isOpen, panelRef]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <Portal>
      <div
        ref={panelRef}
        className={styles.panel}
        data-state={isOpen ? 'open' : 'closed'}
        role="dialog"
        aria-modal="false"
        aria-label={label}
        aria-hidden={!isOpen}
        tabIndex={-1}
        inert={isOpen ? undefined : true}
        style={{
          zIndex,
          width: size.width,
          height: isCollapsed ? 'auto' : size.height,
        }}
        onPointerDownCapture={() => bringToFront('floatingPanel')}
      >
        {/* ── Resize handles (edges + corners) ── */}
        <div
          className={styles.resizeLeft}
          style={{ cursor: edgeCursor('left') }}
          onPointerDown={onResizeStart('left')}
        />
        <div
          className={styles.resizeRight}
          style={{ cursor: edgeCursor('right') }}
          onPointerDown={onResizeStart('right')}
        />
        <div
          className={styles.resizeTop}
          style={{ cursor: edgeCursor('top') }}
          onPointerDown={onResizeStart('top')}
        />
        <div
          className={styles.resizeBottom}
          style={{ cursor: edgeCursor('bottom') }}
          onPointerDown={onResizeStart('bottom')}
        />
        <div
          className={styles.resizeTopLeft}
          style={{ cursor: edgeCursor('top-left') }}
          onPointerDown={onResizeStart('top-left')}
        />
        <div
          className={styles.resizeTopRight}
          style={{ cursor: edgeCursor('top-right') }}
          onPointerDown={onResizeStart('top-right')}
        />
        <div
          className={styles.resizeBottomLeft}
          style={{ cursor: edgeCursor('bottom-left') }}
          onPointerDown={onResizeStart('bottom-left')}
        />
        <div
          className={styles.resizeBottomRight}
          style={{ cursor: edgeCursor('bottom-right') }}
          onPointerDown={onResizeStart('bottom-right')}
        />

        {/* ── Title bar (drag handle) ── */}
        <div className={styles.titleBar} onPointerDown={onPointerDown}>
          <div className={styles.dragHandle} aria-hidden="true">
            ⠿
          </div>
          <span className={styles.titleLabel}>{label}</span>
          <div className={styles.titleActions}>
            <button
              className={styles.actionButton}
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapsed();
              }}
              title={isCollapsed ? 'Expand panel' : 'Roll up panel'}
              aria-label={isCollapsed ? 'Expand panel' : 'Roll up panel'}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {isCollapsed ? '＋' : '−'}
            </button>
            <button
              className={styles.actionButton}
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              title="Close panel"
              aria-label="Close panel"
              onPointerDown={(e) => e.stopPropagation()}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className={styles.bodyWrapper} data-collapsed={isCollapsed}>
          <div className={styles.body}>{children}</div>
        </div>
      </div>
    </Portal>
  );
};
