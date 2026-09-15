import React, { useEffect, useRef } from 'react';
import { Portal } from './Portal';
import { WindowPortal } from './WindowPortal';
import styles from './FloatingPanel.module.css';
import { useDraggablePanel } from '@/hooks/useDraggablePanel';
import { useResizablePanel } from '@/hooks/useResizablePanel';
import { useUIStackStore, useStackZIndex, PanelId } from '@/stores/uiStackStore';

interface FloatingPanelProps {
  panelId: PanelId;
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
 * Now supports popping out into a separate window.
 */
export const FloatingPanel: React.FC<FloatingPanelProps> = ({
  panelId,
  isOpen,
  onClose,
  label,
  children,
}) => {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const isPoppedOut = useUIStackStore((state) => state.poppedOutPanels.includes(panelId));
  const popOutPanel = useUIStackStore((state) => state.popOutPanel);
  const restorePanel = useUIStackStore((state) => state.restorePanel);

  const {
    onPointerDown,
    isCollapsed,
    toggleCollapsed,
    shiftPosition,
    panelRef,
  } = useDraggablePanel({
    id: panelId,
    defaultPosition: { x: window.innerWidth - 320 - 16, y: 84 },
  });

  const { size, onResizeStart, edgeCursor } = useResizablePanel({
    id: panelId,
    defaultSize: { width: 320, height: 600 },
    minWidth: 260,
    minHeight: 200,
    maxWidth: 800,
    maxHeight: 900,
    onPositionChange: shiftPosition,
  });

  const zIndex = useStackZIndex(panelId);
  const bringToFront = useUIStackStore((state) => state.bringToFront);

  // Capture the opener's focus when opening, and restore it on close.
  useEffect(() => {
    if (isOpen && !isPoppedOut) {
      previouslyFocusedRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      const id = window.requestAnimationFrame(() => {
        panelRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(id);
    }

    if (!isOpen) {
      previouslyFocusedRef.current?.focus();
      previouslyFocusedRef.current = null;
    }
    return undefined;
  }, [isOpen, isPoppedOut, panelRef]);

  useEffect(() => {
    if (!isOpen || isPoppedOut) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPoppedOut, onClose]);

  if (isPoppedOut) {
    if (!isOpen) return null;
    
    return (
      <WindowPortal
        title={label}
        width={size.width}
        height={size.height}
        onClose={() => {
          restorePanel(panelId);
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
          <div className={styles.bodyWrapper} data-collapsed={false} style={{ flexGrow: 1, minHeight: 0 }}>
            <div className={styles.body}>{children}</div>
          </div>
        </div>
      </WindowPortal>
    );
  }

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
        onPointerDownCapture={() => bringToFront(panelId)}
      >
        {/* ── Resize handles (edges + corners) ── */}
        <div className={styles.resizeLeft} style={{ cursor: edgeCursor('left') }} onPointerDown={onResizeStart('left')} />
        <div className={styles.resizeRight} style={{ cursor: edgeCursor('right') }} onPointerDown={onResizeStart('right')} />
        <div className={styles.resizeTop} style={{ cursor: edgeCursor('top') }} onPointerDown={onResizeStart('top')} />
        <div className={styles.resizeBottom} style={{ cursor: edgeCursor('bottom') }} onPointerDown={onResizeStart('bottom')} />
        <div className={styles.resizeTopLeft} style={{ cursor: edgeCursor('top-left') }} onPointerDown={onResizeStart('top-left')} />
        <div className={styles.resizeTopRight} style={{ cursor: edgeCursor('top-right') }} onPointerDown={onResizeStart('top-right')} />
        <div className={styles.resizeBottomLeft} style={{ cursor: edgeCursor('bottom-left') }} onPointerDown={onResizeStart('bottom-left')} />
        <div className={styles.resizeBottomRight} style={{ cursor: edgeCursor('bottom-right') }} onPointerDown={onResizeStart('bottom-right')} />

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
                popOutPanel(panelId);
              }}
              title="Pop out panel"
              aria-label="Pop out panel"
              onPointerDown={(e) => e.stopPropagation()}
            >
              ⧉
            </button>
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
