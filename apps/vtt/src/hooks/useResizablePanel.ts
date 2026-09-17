import { useCallback, useEffect, useRef, useState } from 'react';

export interface PanelSize {
  width: number;
  height: number;
}

interface UseResizablePanelOptions {
  /** Unique id for localStorage persistence */
  id: string;
  /**
   * Overrides `id` for the localStorage key only.
   *
   * FloatingPanel appends the active panel layout, so each layout remembers
   * its own size. Without that, a user who had ever resized a panel would
   * switch layout and see nothing move: the saved pixel size beats the new
   * default. Original keeps the bare key, so existing installs are untouched.
   */
  storageId?: string;
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

type Edge =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

interface UseResizablePanelResult {
  /** Current size state */
  size: PanelSize;
  /** Set the size directly, clamped (layout workspace restore). */
  setSizeClamped: (size: PanelSize) => void;
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

/** The saved size under a key, or null when absent/corrupt. */
function readSavedSize(key: string): PanelSize | null {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved) as PanelSize;
  } catch {
    /* fallback */
  }
  return null;
}

export function useResizablePanel({
  id,
  storageId,
  defaultSize,
  minWidth = 260,
  minHeight = 200,
  maxWidth = 800,
  maxHeight = 900,
  onPositionChange,
}: UseResizablePanelOptions): UseResizablePanelResult {
  const storageKey = `nexus-ui-${storageId ?? id}-size`;

  const [size, setSize] = useState<PanelSize>(
    () => readSavedSize(storageKey) ?? { ...defaultSize },
  );

  // defaultSize is an object literal at every call site, so it cannot be an
  // effect dep. The re-key effect below only needs its latest value.
  const defaultSizeRef = useRef(defaultSize);
  useEffect(() => {
    defaultSizeRef.current = defaultSize;
  }, [defaultSize]);

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

  // Re-key: the panel layout changed, so adopt that layout's saved size (or
  // its default). Declared BEFORE the persist effect and paired with the
  // `rekeying` flag, because on the commit where the key changes `size` is
  // still the old layout's value - persisting it would stamp the old size onto
  // the new layout's slot and the new default would never apply.
  const lastKeyRef = useRef(storageKey);
  const rekeying = useRef(false);

  useEffect(() => {
    if (lastKeyRef.current === storageKey) return;
    lastKeyRef.current = storageKey;
    rekeying.current = true;
    setSize(clamp(readSavedSize(storageKey) ?? { ...defaultSizeRef.current }));
  }, [storageKey, clamp]);

  // Persist on change
  useEffect(() => {
    if (rekeying.current) {
      rekeying.current = false;
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(size));
    } catch {
      /* quota */
    }
  }, [storageKey, size]);

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
    [clamp, onPositionChange],
  );

  const edgeCursor = useCallback((edge: Edge) => EDGE_CURSORS[edge], []);

  // Size is already React state and the effect above persists every change,
  // so restoring a workspace only needs a clamped setter.
  const setSizeClamped = useCallback(
    (next: PanelSize) => setSize(clamp(next)),
    [clamp],
  );

  return { size, setSizeClamped, onResizeStart, edgeCursor };
}
