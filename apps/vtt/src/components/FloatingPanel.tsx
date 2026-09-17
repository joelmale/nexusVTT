import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Portal } from './Portal';
import { WindowPortal } from './WindowPortal';
import styles from './FloatingPanel.module.css';
import { useDraggablePanel } from '@/hooks/useDraggablePanel';
import { useResizablePanel } from '@/hooks/useResizablePanel';
import { useLayoutWorkspaceStore } from '@/stores/layoutWorkspaceStore';
import { DockZoneOverlay } from './DockZoneOverlay';
import { useDockDrag, useDockHost } from '@/hooks/useDocking';
import {
  layoutKeySuffix,
  usePanelLayout,
  PANEL_LAYOUT_GEOMETRY,
  getPanelDefaultSize,
} from '@/hooks/usePanelLayout';
import {
  useUIStackStore,
  useStackZIndex,
  useIsTopmostPanel,
  useFocusMode,
  useDockZone,
  PanelId,
} from '@/stores/uiStackStore';

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
  const activePanels = useUIStackStore((state) => state.activePanels);
  const bringToFront = useUIStackStore((state) => state.bringToFront);
  const dockZone = useDockZone(panelId);
  // Registered by GameUI via a callback ref - see useDockHostRef on why this
  // is not a document.querySelector during render.
  const dockHost = useDockHost(dockZone);
  const undockPanel = useUIStackStore((state) => state.undockPanel);
  const { onDragMove, onDragEnd, isDragging, activeZone } = useDockDrag(panelId);

  const cascadeIndex = Math.max(0, activePanels.indexOf(panelId));
  const cascadeOffset = (cascadeIndex % 8) * 28;

  // Panel geometry follows the active layout: compact panels start narrower,
  // widescreen ones much wider and allowed to grow past the old 800px cap.
  // Each panel type also has an optimal default size to prevent text wrapping or scrollbars.
  const panelLayout = usePanelLayout();
  const geometry = PANEL_LAYOUT_GEOMETRY[panelLayout];
  const defaultSize = getPanelDefaultSize(panelId, panelLayout);

  const {
    onPointerDown,
    isCollapsed,
    toggleCollapsed,
    shiftPosition,
    setPosition,
    setCollapsed,
    panelRef,
  } = useDraggablePanel({
    id: panelId,
    defaultPosition: {
      x: Math.max(
        16,
        window.innerWidth - defaultSize.width - 16 - cascadeOffset,
      ),
      y: Math.max(16, 84 + cascadeOffset),
    },
    onDragMove,
    onDragEnd,
  });

  const { size, setSizeClamped, onResizeStart, edgeCursor } = useResizablePanel({
    id: panelId,
    // Each layout remembers its own size; Original keeps the bare key.
    storageId: `${panelId}${layoutKeySuffix(panelLayout)}`,
    defaultSize: {
      width: defaultSize.width,
      height: defaultSize.height,
    },
    minWidth: geometry.minWidth,
    minHeight: 200,
    maxWidth: geometry.maxWidth,
    maxHeight: 900,
    onPositionChange: shiftPosition,
  });

  const zIndex = useStackZIndex(panelId);
  const isTopmost = useIsTopmostPanel(panelId);
  const focusMode = useFocusMode();

  useEffect(() => {
    bringToFront(panelId);
  }, [bringToFront, panelId]);

  // Apply a restored layout workspace to an already-mounted panel.
  //
  // Panels that mount *after* the apply pick their geometry up from
  // localStorage in the drag/resize hooks' own mount effects; this covers the
  // ones already on screen, imperatively, so nothing remounts and no panel
  // loses its scroll position or in-progress input.
  useEffect(() => {
    let seen = useLayoutWorkspaceStore.getState().applySeq;
    return useLayoutWorkspaceStore.subscribe((state) => {
      if (state.applySeq === seen) return;
      seen = state.applySeq;

      const geometry = state.pendingGeometry[panelId];
      if (!geometry) return;

      // Size first, then position on the next frame: useDraggablePanel's
      // ResizeObserver compensates x for width changes on right-anchored
      // panels, and would otherwise shift the panel after we placed it.
      if (geometry.size) setSizeClamped(geometry.size);
      if (typeof geometry.collapsed === 'boolean') {
        setCollapsed(geometry.collapsed);
      }
      requestAnimationFrame(() => setPosition(geometry.position));
    });
  }, [panelId, setPosition, setSizeClamped, setCollapsed]);

  // Capture the opener's focus on mount and restore it on unmount.
  //
  // Panels are mounted/unmounted by GameUI as `activePanels` changes rather
  // than toggling `isOpen`, so the restore has to hang off unmount - keying it
  // on `isOpen` flipping to false would never run.
  useEffect(() => {
    if (isPoppedOut) return undefined;

    // Capture the node now: by cleanup time React has already detached the
    // ref, so `panelRef.current` would be null.
    const panelNode = panelRef.current;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const id = window.requestAnimationFrame(() => {
      panelRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(id);
      const opener = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      // Only pull focus back if it is still inside this panel - otherwise the
      // user has already moved on and we would be stealing it.
      if (opener && opener.isConnected) {
        const active = document.activeElement;
        if (!active || active === document.body || panelNode?.contains(active)) {
          opener.focus();
        }
      }
    };
  }, [isPoppedOut, panelRef]);

  // Escape closes only the topmost panel.
  //
  // Every mounted FloatingPanel registers its own window listener, and
  // `stopPropagation` does nothing between listeners bound to the same target -
  // without this guard a single Escape would close every open panel at once.
  useEffect(() => {
    if (!isOpen || isPoppedOut || !isTopmost || focusMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPoppedOut, isTopmost, focusMode, onClose]);

  const handlePopOutClose = useCallback(() => {
    restorePanel(panelId);
  }, [restorePanel, panelId]);


  if (isPoppedOut) {
    if (!isOpen) return null;

    return (
      <WindowPortal
        title={label}
        width={size.width}
        height={size.height}
        onClose={handlePopOutClose}
      >
        <div className={styles.poppedOutRoot}>
          <div
            className={styles.bodyWrapper}
            data-collapsed={false}
            style={{ flexGrow: 1, minHeight: 0 }}
          >
            <div className={styles.body}>{children}</div>
          </div>
        </div>
      </WindowPortal>
    );
  }

  if (dockZone) {
    if (!dockHost) return null;

    return createPortal(
      <div
        className={styles.dockedPanel}
        data-chrome
        inert={focusMode || undefined}
        role="dialog"
        aria-modal="false"
        aria-label={label}
      >
        <div className={styles.titleBar}>
          <span className={styles.titleLabel}>{label}</span>
          <div className={styles.titleActions}>
            <button
              className={styles.actionButton}
              onClick={() => undockPanel(panelId)}
              title="Undock panel"
              aria-label="Undock panel"
            >
              ⇱
            </button>
            <button
              className={styles.actionButton}
              onClick={onClose}
              title="Close panel"
              aria-label="Close panel"
            >
              ✕
            </button>
          </div>
        </div>
        <div className={styles.bodyWrapper} data-collapsed={false}>
          <div className={styles.body}>{children}</div>
        </div>
      </div>,
      dockHost,
    );
  }

  return (
    <>
      <DockZoneOverlay isDragging={isDragging} activeZone={activeZone} />
    <Portal>
      <div
        ref={panelRef}
        className={styles.panel}
        data-chrome
        data-state={isOpen ? 'open' : 'closed'}
        role="dialog"
        aria-modal="false"
        aria-label={label}
        aria-hidden={!isOpen}
        tabIndex={-1}
        inert={!isOpen || focusMode || undefined}
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
    </>
  );
};
