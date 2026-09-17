import { useCallback, useEffect, useState } from 'react';
import { create } from 'zustand';
import {
  useUIStackStore,
  dockZoneForPoint,
  type DockZone,
  type PanelId,
} from '@/stores/uiStackStore';
import {
  PANEL_LAYOUT_GEOMETRY,
  usePanelLayout,
} from '@/hooks/usePanelLayout';
import type { PanelLayout } from '@/types/game';

/**
 * Registry of the live dock region elements, populated by GameUI through
 * callback refs.
 *
 * Docked panels portal into these hosts. Looking the host up with
 * `document.querySelector` during render does not work: the regions are
 * rendered by GameUI in the same commit as the panels, so on a first mount
 * (a reload with a persisted dock) the query returns null, the panel renders
 * nothing, and nothing ever triggers a retry. A callback ref fires as the node
 * is attached, which both removes the race and avoids a setState-in-effect.
 */
interface DockHostState {
  hosts: Partial<Record<DockZone, HTMLElement | null>>;
  setHost: (zone: DockZone, el: HTMLElement | null) => void;
}

const useDockHostStore = create<DockHostState>((set) => ({
  hosts: {},
  setHost: (zone, el) =>
    set((state) =>
      state.hosts[zone] === el
        ? state
        : { hosts: { ...state.hosts, [zone]: el } },
    ),
}));

/** Callback ref for a dock region element. */
export function useDockHostRef(zone: DockZone) {
  const setHost = useDockHostStore((s) => s.setHost);
  return useCallback(
    (el: HTMLElement | null) => setHost(zone, el),
    [setHost, zone],
  );
}

/** The live dock region element for a zone, or null before it mounts. */
export function useDockHost(zone: DockZone | null): HTMLElement | null {
  return useDockHostStore((s) => (zone ? s.hosts[zone] ?? null : null));
}

interface DockSizes {
  left: number;
  right: number;
  bottom: number;
}

/**
 * Extents of a dock region for a given panel layout.
 *
 * The same numbers live in design-tokens.css as `--dock-size-side` /
 * `--dock-size-bottom`; PANEL_LAYOUT_GEOMETRY is the single JS source and a
 * unit test keeps the two in step.
 */
export function dockSizesFor(layout: PanelLayout): DockSizes {
  const { dockSide, dockBottom } = PANEL_LAYOUT_GEOMETRY[layout];
  return { left: dockSide, right: dockSide, bottom: dockBottom };
}

/** Default extents of a dock region. Kept in one place for the CSS vars. */
export const DOCK_SIZES: DockSizes = dockSizesFor('original');

interface DockDragState {
  panelId: PanelId | null;
  zone: DockZone | null;
}

/**
 * Drives the dock drag interaction for one floating panel.
 *
 * Returns drag callbacks to hand to `useDraggablePanel`, plus the currently
 * hovered zone so the panel can render the drop-zone overlay.
 */
export function useDockDrag(panelId: PanelId) {
  const dockPanel = useUIStackStore((s) => s.dockPanel);
  const [state, setState] = useState<DockDragState>({
    panelId: null,
    zone: null,
  });

  const onDragMove = useCallback(
    (clientX: number, clientY: number) => {
      const zone = dockZoneForPoint(
        clientX,
        clientY,
        window.innerWidth,
        window.innerHeight,
      );
      setState((prev) =>
        prev.panelId === panelId && prev.zone === zone
          ? prev
          : { panelId, zone },
      );
    },
    [panelId],
  );

  const onDragEnd = useCallback(
    (clientX: number, clientY: number) => {
      const zone = dockZoneForPoint(
        clientX,
        clientY,
        window.innerWidth,
        window.innerHeight,
      );
      if (zone) dockPanel(panelId, zone);
      setState({ panelId: null, zone: null });
    },
    [panelId, dockPanel],
  );

  return {
    onDragMove,
    onDragEnd,
    isDragging: state.panelId === panelId,
    activeZone: state.zone,
  };
}

/**
 * Mirrors the docked-panel set onto the `.game-layout` grid as CSS custom
 * properties, so an occupied edge opens a real layout track and the scene
 * cell shrinks.
 *
 * SceneCanvas observes its own <svg> with a ResizeObserver, so the reflow
 * feeds straight back into `svgSize` - which is what the cursor-anchored zoom
 * from item 1 measures against. Without that, zoom would keep anchoring on
 * pre-dock canvas dimensions.
 */
export function useDockLayoutSync(): void {
  const dockedPanels = useUIStackStore((s) => s.dockedPanels);
  const layout = usePanelLayout();

  useEffect(() => {
    const zones = new Set(Object.values(dockedPanels));
    const root = document.documentElement;
    const sizes = dockSizesFor(layout);

    root.style.setProperty(
      '--dock-left-width',
      zones.has('left') ? `${sizes.left}px` : '0px',
    );
    root.style.setProperty(
      '--dock-right-width',
      zones.has('right') ? `${sizes.right}px` : '0px',
    );
    root.style.setProperty(
      '--dock-bottom-height',
      zones.has('bottom') ? `${sizes.bottom}px` : '0px',
    );

    return () => {
      root.style.removeProperty('--dock-left-width');
      root.style.removeProperty('--dock-right-width');
      root.style.removeProperty('--dock-bottom-height');
    };
  }, [dockedPanels, layout]);
}
