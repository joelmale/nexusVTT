# ADR-0004 — Single z-index scale, TS source of truth emitting CSS vars

Status: **Accepted** (Joel, 2026-07-02)

## Context
~40 z-index declarations across 15+ files and inline styles, values 1–10102, some with comments
manually negotiating order; `--z-cursors` referenced but never defined.

## Decision
One scale in `src/utils/z-scale.ts`:
`BACKGROUND:0, GRID:10, DRAWING:20, TOKEN:30, SELECTION:35, FOG:40, CURSORS:50, TOOL_UI:60,
PANEL:70, MODAL:80, DICE_3D:90, DRAG_GHOST:95, TOP_MODAL:100`. Each band reserves ±9 for local
stacking. CSS custom properties (`--z-*`) are generated/mirrored from the TS constants —
TS is the source of truth. Raw numeric z-index outside the scale definition is a lint-able defect.

## Consequences
- Landed by packet A1 (codemod). All new components (dock, panels, menus, fog) cite bands.
- "Why is X under Y" bugs become scale questions, not archaeology.
