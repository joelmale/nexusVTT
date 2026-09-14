/**
 * Single authoritative z-index scale (ADR-0004).
 *
 * The runtime definitions live in src/styles/design-tokens.css as --z-* custom
 * properties; this module mirrors them for TypeScript consumers (inline styles,
 * canvas layer ordering). z-scale.test.ts enforces that the two never drift.
 *
 * Each band reserves +/-9 for local stacking (e.g. Z.TOKEN + 1 for a dragged
 * token). CSS should use var(--z-band) or calc(var(--z-band) + n); TSX inline
 * styles should use zVar('BAND') or Z.BAND. Raw numeric z-index values are a
 * defect outside this file and design-tokens.css.
 */
export const Z = {
  BACKGROUND: 0,
  GRID: 10,
  DRAWING: 20,
  TOKEN: 30,
  SELECTION: 35,
  FOG: 40,
  CURSORS: 50,
  TOOL_UI: 60,
  PANEL: 70,
  POPOVER: 75,
  MODAL_BACKDROP: 79,
  MODAL: 80,
  TOOLTIP: 85,
  DICE_3D: 90,
  DRAG_GHOST: 95,
  TOP_MODAL: 100,
} as const;

export type ZBand = keyof typeof Z;

/** CSS custom-property reference for a band, e.g. zVar('TOOL_UI') → "var(--z-tool-ui)". */
export const zVar = (band: ZBand): string =>
  `var(--z-${band.toLowerCase().replace(/_/g, '-')})`;
