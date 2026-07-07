import { useCallback, useEffect, useState, useRef } from 'react';
import { PanelId } from '@/stores/uiStackStore';

export interface PanelPosition {
  x: number;
  y: number;
}

export interface UseDraggablePanelOptions {
  /** Unique ID for localStorage persistence */
  id: PanelId;
  /** Initial position if no saved state exists */
  defaultPosition?: PanelPosition;
  /** Boundary margin (pixels) to keep the panel inside the viewport */
  edgeMargin?: number;
  /** Snap distance (pixels) */
  snapThreshold?: number;
}

export interface UseDraggablePanelResult {
  /** Attach to the drag handle's onPointerDown */
  onPointerDown: (e: React.PointerEvent<Element>) => void;
  /** React state for whether the panel is collapsed (controlled by user) */
  isCollapsed: boolean;
  /** Toggle the collapsed state */
  toggleCollapsed: () => void;
  /** Shift the panel's position by a delta (useful for resizing from top/left) */
  shiftPosition: (dx: number, dy: number) => void;
  /** Ref to attach to the main panel container that gets moved */
  panelRef: React.RefObject<HTMLDivElement | null>;
}

export function useDraggablePanel({
  id,
  defaultPosition = { x: 0, y: 0 },
  edgeMargin = 20,
  snapThreshold = 15,
}: UseDraggablePanelOptions): UseDraggablePanelResult {
  const panelRef = useRef<HTMLDivElement>(null);

  // Initialize state from localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem(`nexus-ui-${id}-collapsed`) ?? localStorage.getItem(`nexus_ui_${id}_collapsed`);
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const positionRef = useRef<PanelPosition>({ ...defaultPosition });

  const clampPosition = useCallback((pos: PanelPosition, rect: DOMRect) => {
    const maxX = Math.max(0, window.innerWidth - rect.width - edgeMargin);
    const maxY = Math.max(0, window.innerHeight - rect.height - edgeMargin);
    return {
      x: Math.max(edgeMargin, Math.min(pos.x, maxX)),
      y: Math.max(edgeMargin, Math.min(pos.y, maxY)),
    };
  }, [edgeMargin]);

  // On mount, read saved position and apply it synchronously to the DOM
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`nexus-ui-${id}-pos`) ?? localStorage.getItem(`nexus_ui_${id}_pos`);
      if (saved) {
        positionRef.current = JSON.parse(saved);
      }
    } catch {
      // fallback to default
    }
    
    const clampAndApply = () => {
      if (panelRef.current) {
        const rect = panelRef.current.getBoundingClientRect();
        const clampedPos = clampPosition(positionRef.current, rect);
        
        if (clampedPos.x !== positionRef.current.x || clampedPos.y !== positionRef.current.y) {
          positionRef.current = clampedPos;
          localStorage.setItem(`nexus-ui-${id}-pos`, JSON.stringify(positionRef.current));
        }

        panelRef.current.style.transform = `translate3d(${positionRef.current.x}px, ${positionRef.current.y}px, 0)`;
      }
    };

    // Run on mount
    clampAndApply();

    // Run on resize
    window.addEventListener('resize', clampAndApply);
    return () => window.removeEventListener('resize', clampAndApply);
  }, [id, clampPosition]);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev: boolean) => {
      const next = !prev;
      localStorage.setItem(`nexus-ui-${id}-collapsed`, JSON.stringify(next));
      return next;
    });
  }, [id]);

  // Dragging logic
  const isDragging = useRef(false);
  const pointerStart = useRef({ x: 0, y: 0 });
  const panelStart = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);

  const applyPosition = useCallback((x: number, y: number) => {
    if (panelRef.current) {
      panelRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  }, []);

  const shiftPosition = useCallback((dx: number, dy: number) => {
    const newX = positionRef.current.x + dx;
    const newY = positionRef.current.y + dy;
    positionRef.current = { x: newX, y: newY };
    applyPosition(newX, newY);
    localStorage.setItem(`nexus-ui-${id}-pos`, JSON.stringify(positionRef.current));
  }, [id, applyPosition]);

  const handlePointerDown = useCallback((e: React.PointerEvent<Element>) => {
    if (e.button !== undefined && e.button !== 0) return;
    const target = e.currentTarget as HTMLElement;

    isDragging.current = true;
    target.setPointerCapture(e.pointerId);

    pointerStart.current = { x: e.clientX, y: e.clientY };
    panelStart.current = { ...positionRef.current };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isDragging.current) return;

      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }

      rafId.current = requestAnimationFrame(() => {
        if (!isDragging.current) return;

        const dx = moveEvent.clientX - pointerStart.current.x;
        const dy = moveEvent.clientY - pointerStart.current.y;

        let newX = panelStart.current.x + dx;
        let newY = panelStart.current.y + dy;

        // Apply clamping and soft snapping during drag
        if (panelRef.current) {
          const rect = panelRef.current.getBoundingClientRect();
          const maxX = Math.max(0, window.innerWidth - rect.width - edgeMargin);
          const maxY = Math.max(0, window.innerHeight - rect.height - edgeMargin);

          newX = Math.max(edgeMargin, Math.min(newX, maxX));
          newY = Math.max(edgeMargin, Math.min(newY, maxY));

          // Soft Snap to edges
          if (Math.abs(newX - edgeMargin) < snapThreshold) newX = edgeMargin;
          if (Math.abs(newX - maxX) < snapThreshold) newX = maxX;
          if (Math.abs(newY - edgeMargin) < snapThreshold) newY = edgeMargin;
          if (Math.abs(newY - maxY) < snapThreshold) newY = maxY;
        }

        positionRef.current = { x: newX, y: newY };
        applyPosition(newX, newY);
      });
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;

      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }

      target.releasePointerCapture(upEvent.pointerId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);

      // Save final position
      localStorage.setItem(`nexus-ui-${id}-pos`, JSON.stringify(positionRef.current));
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, [id, edgeMargin, snapThreshold, applyPosition]);

  return {
    onPointerDown: handlePointerDown,
    isCollapsed,
    toggleCollapsed,
    shiftPosition,
    panelRef,
  };
}
