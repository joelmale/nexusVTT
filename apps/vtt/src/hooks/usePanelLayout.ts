import { useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';
import type { PanelLayout } from '@/types/game';

export const PANEL_LAYOUT_ATTRIBUTE = 'data-panel-layout';

/**
 * Panel geometry per layout.
 *
 * CSS carries the same numbers as `--panel-default-w`, `--dock-size-side` and
 * friends in design-tokens.css, but `useResizablePanel` and `useDocking` need
 * them as numbers, and a custom property cannot be read reliably before the
 * stylesheet has applied. These two must be kept in step; the unit test in
 * tests/unit/panelLayout.test.ts enforces it.
 */
export interface PanelLayoutGeometry {
  /** Default floating-panel size when nothing is saved. */
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  maxWidth: number;
  /** Width of the left/right dock tracks. */
  dockSide: number;
  /** Height of the bottom dock track. */
  dockBottom: number;
}

export const PANEL_LAYOUT_GEOMETRY: Record<PanelLayout, PanelLayoutGeometry> = {
  original: {
    defaultWidth: 320,
    defaultHeight: 600,
    minWidth: 260,
    maxWidth: 800,
    dockSide: 320,
    dockBottom: 240,
  },
  compact: {
    defaultWidth: 280,
    defaultHeight: 520,
    minWidth: 220,
    maxWidth: 800,
    dockSide: 280,
    dockBottom: 190,
  },
  widescreen: {
    defaultWidth: 460,
    defaultHeight: 640,
    minWidth: 300,
    maxWidth: 1100,
    dockSide: 440,
    dockBottom: 300,
  },
};

/**
 * True when the primary pointer is coarse (finger/stylus).
 *
 * Compact shrinks controls below the 44px touch target the rest of the panel
 * chrome honours (see `.dragHandle` in FloatingPanel.module.css), so we refuse
 * to apply it on a touch device even if the setting says otherwise.
 */
export function isCoarsePointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(pointer: coarse)').matches;
}

/** The layout that should actually be applied, after the touch guard. */
export function resolvePanelLayout(preference: PanelLayout): PanelLayout {
  if (preference === 'compact' && isCoarsePointer()) return 'original';
  return preference;
}

/**
 * Mirror `settings.panelLayout` onto `<html>` so CSS can key off it.
 *
 * Same shape as `useReducedMotionSync` in hooks/useReducedMotion.ts - a store
 * field, an attribute on the document element, and CSS that matches it. The
 * default layout removes the attribute rather than setting `original`, so the
 * bare `:root` token block stays the one that applies.
 */
export function usePanelLayoutSync(): void {
  const preference = useGameStore((state) => state.settings.panelLayout);

  useEffect(() => {
    const root = document.documentElement;
    const layout = resolvePanelLayout(preference ?? 'original');

    if (layout === 'original') {
      root.removeAttribute(PANEL_LAYOUT_ATTRIBUTE);
    } else {
      root.setAttribute(PANEL_LAYOUT_ATTRIBUTE, layout);
    }
  }, [preference]);
}

/** Subscribe to the resolved layout. For components that need the geometry. */
export function usePanelLayout(): PanelLayout {
  const preference = useGameStore((state) => state.settings.panelLayout);
  return resolvePanelLayout(preference ?? 'original');
}

/** Read the resolved layout outside React. */
export function getPanelLayout(): PanelLayout {
  return resolvePanelLayout(
    useGameStore.getState().settings.panelLayout ?? 'original',
  );
}

/** Geometry for the currently resolved layout. */
export function usePanelLayoutGeometry(): PanelLayoutGeometry {
  return PANEL_LAYOUT_GEOMETRY[usePanelLayout()];
}

/**
 * Suffix for layout-scoped localStorage keys.
 *
 * Panel position and size are persisted per panel id. Without a suffix a user
 * who had ever resized a panel would switch layout and see nothing move, since
 * the saved pixel size wins over the new default. Original keeps the bare key
 * so existing installs are untouched; the other layouts get their own slot and
 * therefore remember their own geometry.
 */
export function layoutKeySuffix(layout: PanelLayout): string {
  return layout === 'original' ? '' : `--${layout}`;
}
