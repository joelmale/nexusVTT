import { useCallback, useEffect, useRef, useState } from 'react';

export interface PanelSize {
  width: number;
  height: number;
}

interface UseResizablePanelOptions {
  /** Unique id for localStorage persistence */
  id: string;
  /** Default size if nothing saved */
  defaultSize: PanelSize;
  /** Minimum dimensions */
  minWidth?: number;
  minHeight?: number;
  /** Maximum dimensions */
  maxWidth?: number;
  maxHeight?: number;
  /** Callback fired when the panel's top/left edge is dragged, requiring a coordinate shift */
  onPositionChange?: (dx: number, dy: number) => void;
}

type Edge = 'left' | 'right' | 'top' | 'bottom'
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface UseResizablePanelResult {
  /** Current size state */
  size: PanelSize;
  /** Pointer-down handler factory — call with the edge name, attach to the resize handle */
  onResizeStart: (edge: Edge) => (e: React.PointerEvent) => void;
  /** CSS cursor for a given edge */
  edgeCursor: (edge: Edge) => string;
}

const EDGE_CURSORS: Record<Edge, string> = {
  left: 'ew-resize',
  right: 'ew-resize',
  top: 'ns-resize',
  bottom: 'ns-resize',
  'top-left': 'nwse-resize',
  'top-right': 'nesw-resize',
  'bottom-left': 'nesw-resize',
  'bottom-right': 'nwse-resize',
};

export function useResizablePanel({
  id,
  defaultSize,
  minWidth = 260,
  minHeight = 200,
  maxWidth = 800,
  maxHeight = 900,
  onPositionChange,
}: UseResizablePanelOptions): UseResizablePanelResult {
  const [size, setSize] = useState<PanelSize>(() => {
    try {
      const saved = localStorage.getItem(`nexus-ui-${id}-size`);
      if (saved) return JSON.parse(saved);
    } catch { /* fallback */ }
    return { ...defaultSize };
  });

  const sizeRef = useRef(size);
  // Sync via effect, not during render — the strict react-hooks/refs rule
  // forbids render-time ref writes (same effect-sync convention as
  // AtlasDock's loadMoreRef). Pointer handlers only read this post-render.
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  const clamp = useCallback(
    (s: PanelSize): PanelSize => ({
      width: Math.max(minWidth, Math.min(s.width, maxWidth)),
      height: Math.max(minHeight, Math.min(s.height, maxHeight)),
    }),
    [minWidth, minHeight, maxWidth, maxHeight],
  );

  // Persist on change
  useEffect(() => {
    try {
      localStorage.setItem(`nexus-ui-${id}-size`, JSON.stringify(size));
    } catch { /* quota */ }
  }, [id, size]);

  const onResizeStart = useCallback(
    (edge: Edge) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      const startSize = { ...sizeRef.current };
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const handleMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        let newWidth = startSize.width;
        let newHeight = startSize.height;

        // Horizontal
        if (edge.includes('right')) newWidth = startSize.width + dx;
        if (edge.includes('left')) newWidth = startSize.width - dx;

        // Vertical
        if (edge.includes('bottom')) newHeight = startSize.height + dy;
        if (edge.includes('top')) newHeight = startSize.height - dy;

        const clamped = clamp({ width: newWidth, height: newHeight });

        // Calculate the actual change in dimensions (taking clamping into account)
        const actualWidthDelta = clamped.width - sizeRef.current.width;
        const actualHeightDelta = clamped.height - sizeRef.current.height;

        sizeRef.current = clamped;
        setSize(clamped);

        // If dragging from left or top, we need to shift the panel's X/Y position
        // inversely to the growth of the panel.
        let shiftX = 0;
        let shiftY = 0;
        if (edge.includes('left') && actualWidthDelta !== 0) {
          shiftX = -actualWidthDelta;
        }
        if (edge.includes('top') && actualHeightDelta !== 0) {
          shiftY = -actualHeightDelta;
        }

        if ((shiftX !== 0 || shiftY !== 0) && onPositionChange) {
          onPositionChange(shiftX, shiftY);
        }
      };

      const handleUp = (upEvent: PointerEvent) => {
        target.releasePointerCapture(upEvent.pointerId);
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        window.removeEventListener('pointercancel', handleUp);
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleUp);
    },
    [clamp],
  );

  const edgeCursor = useCallback((edge: Edge) => EDGE_CURSORS[edge], []);

  return { size, onResizeStart, edgeCursor };
}
