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

export interface PanelSize {
  width: number;
  height: number;
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
 * Optimal opening dimensions per panel type and layout.
 *
 * Sized so specific panels (e.g. Settings with wider options, Dice with full
 * builder and initial history, Chat with messages and input) do not wrap text
 * awkwardly or present a default scrollbar on initial opening.
 */
export const PANEL_DEFAULT_DIMENSIONS: Record<
  string,
  Record<PanelLayout, PanelSize>
> = {
  settings: {
    original: { width: 500, height: 650 },
    compact: { width: 440, height: 580 },
    widescreen: { width: 560, height: 700 },
  },
  dice: {
    original: { width: 380, height: 720 },
    compact: { width: 340, height: 640 },
    widescreen: { width: 640, height: 660 },
  },
  chat: {
    original: { width: 420, height: 680 },
    compact: { width: 360, height: 600 },
    widescreen: { width: 540, height: 720 },
  },
  initiative: {
    original: { width: 420, height: 600 },
    compact: { width: 360, height: 540 },
    widescreen: { width: 640, height: 640 },
  },
  scene: {
    original: { width: 400, height: 620 },
    compact: { width: 340, height: 560 },
    widescreen: { width: 480, height: 660 },
  },
  props: {
    original: { width: 350, height: 600 },
    compact: { width: 300, height: 540 },
    widescreen: { width: 460, height: 640 },
  },
  characters: {
    original: { width: 400, height: 620 },
    compact: { width: 340, height: 560 },
    widescreen: { width: 500, height: 660 },
  },
  documents: {
    original: { width: 400, height: 620 },
    compact: { width: 340, height: 560 },
    widescreen: { width: 500, height: 660 },
  },
  tokens: {
    original: { width: 320, height: 600 },
    compact: { width: 280, height: 520 },
    widescreen: { width: 460, height: 640 },
  },
  lobby: {
    original: { width: 340, height: 560 },
    compact: { width: 290, height: 500 },
    widescreen: { width: 460, height: 600 },
  },
};

/** Get the default size for a specific panel in the active layout. */
export function getPanelDefaultSize(
  panelId: string,
  layout: PanelLayout,
): PanelSize {
  const panelCustom = PANEL_DEFAULT_DIMENSIONS[panelId]?.[layout];
  if (panelCustom) {
    return panelCustom;
  }
  const generic = PANEL_LAYOUT_GEOMETRY[layout];
  return {
    width: generic.defaultWidth,
    height: generic.defaultHeight,
  };
}

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

/**
 * The layout that should actually be applied.
 *
 * Anything unrecognised falls back to Original: `settings` comes back from
 * localStorage, so a rolled-back deploy or a hand-edited blob can hand us a
 * layout name this build has never heard of.
 */
export function resolvePanelLayout(preference: unknown): PanelLayout {
  if (
    preference !== 'original' &&
    preference !== 'compact' &&
    preference !== 'widescreen'
  ) {
    return 'original';
  }
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
  const preference = useGameStore((state) => state.settings?.panelLayout);

  useEffect(() => {
    const root = document.documentElement;
    const layout = resolvePanelLayout(preference);

    if (layout === 'original') {
      root.removeAttribute(PANEL_LAYOUT_ATTRIBUTE);
    } else {
      root.setAttribute(PANEL_LAYOUT_ATTRIBUTE, layout);
    }
  }, [preference]);
}

/** Subscribe to the resolved layout. For components that need the geometry. */
export function usePanelLayout(): PanelLayout {
  const preference = useGameStore((state) => state.settings?.panelLayout);
  return resolvePanelLayout(preference);
}

/** Read the resolved layout outside React. */
export function getPanelLayout(): PanelLayout {
  return resolvePanelLayout(useGameStore.getState().settings?.panelLayout);
}

/**
 * Suffix for layout-scoped localStorage keys.
 *
 * Panel *size* is namespaced per layout: without this, a user who had ever
 * resized a panel would switch layout and see nothing move, because the saved
 * pixel size beats the new default. Original keeps the bare key, so existing
 * installs are untouched and every other layout gets its own slot.
 *
 * Position and collapsed state are deliberately NOT namespaced - where you put
 * a panel is your choice, not a property of the density.
 */
export function layoutKeySuffix(layout: PanelLayout): string {
  return layout === 'original' ? '' : `--${layout}`;
}
