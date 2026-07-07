# A10b — GameToolbar design overhaul [SPLIT from A10, Joel 2026-07-07]

track: A · risk: Med (pure presentation, high visibility) · gate: **blocking 🔍** (Joel visual review) · depends_on: [A8b(approved), A9(approved)] · unblocks: [] (Track A terminal with A10a)
budget_cap: 140k tokens (T2 ~90k / T3 ~35k)

## Objective (Joel's words, binding)
"The tools and icons themselves are fine and I like the glow on selection as well as the hover
effects, but the layout is very inefficient and the padding is ugly. Review the style, design,
and layout of the toolbar and make improvements based on award-winning designs and inspirations."

## KEEP (do not regress)
- The tool set, icons, and their behaviors (incl. A9's Fog group actions).
- Selection glow + hover effects (the *feel* — exact values may be tuned, character preserved).
- Draggable behavior (useDraggablePanel), uiStackStore z-clamp participation, host-only groups.

## FIX
- Layout efficiency: the toolbar consumes far more area than its content needs; groups sprawl.
- Padding rhythm: inconsistent/oversized padding ("ugly" per gate review).
- Legacy 'dm-mask' group: overlapping vocabulary with the new Fog group (ADR-0009 note) —
  REMOVE the group from the toolbar UI (leave underlying mask code paths; deeper removal is
  A10a/backlog territory). Confirm with a grep that no other UI entry point is lost.

## Design direction (award-caliber references, adapted to the existing token system)
- Compact segmented groups: 2-4px intra-group gaps, hairline separators (1px, low-alpha border
  token) BETWEEN groups instead of boxed sub-containers; one continuous pill/rounded-rect shell.
- Consistent hit targets: uniform button size (~32-36px), icon optically centered; spacing on a
  4/8px rhythm ONLY (tokens: --spacing-1/2); kill ad-hoc pixel values.
- Restraint: single elevation (existing glass tokens), no double borders/nested backgrounds;
  active state = the existing glow; hover = existing effect; nothing new competing.
- Match the visual language of Joel's fresh hover-dock redesign (src/components/PanelDock.tsx +
  PanelDock.module.css, commit 772f7b3) — that is the in-house reference aesthetic now; the
  toolbar should read as its sibling. Consider whether a collapsed/expand-on-hover affordance
  mirroring PanelDock suits the toolbar's vertical/horizontal modes (propose, don't force).
- Overflow strategy: if groups exceed comfortable length, prefer collapsible group headers or
  an overflow popover over shrinking hit targets.

## Ground truth (verified @ 772f7b3, 2026-07-07)
- `src/components/GameToolbar.tsx` (~large): ToolbarGroup structures incl. legacy 'dm-mask'
  group (label 'Fog of War', ~line 261) and new 'Fog' group (dmFogGroup ~line 337); tooltips
  are name-prefixed (93cd99f); dead freehand tool already removed.
- Styles: `src/styles/toolbar-unified.css` (global). Per ADR-0006 you MAY migrate to
  `GameToolbar.module.css` (touched-file modularization) — if you do, migrate completely and
  delete replaced rules from toolbar-unified.css; verify zero other consumers of removed
  classes (`rg` each class name).
- z: participates via useStackZIndex('gameToolbar') — leave the mechanism intact.

## YOUR DOMAIN (exclusive): GameToolbar.tsx, toolbar-unified.css, optional new
GameToolbar.module.css, GameToolbar tests. A sibling (A10a) concurrently owns CLAUDE.md,
src/types, src/styles dead-file removal (NOT toolbar-unified.css), SceneCanvas/DrawingTools —
do not touch its files.

## Exit criteria
- Every existing tool reachable and functional (existing GameToolbar tests green + extend for
  the dm-mask group removal).
- No raw z-index / no off-rhythm spacing values in the final CSS (tokens only).
- Flag-off AND flag-on layouts both correct; vertical + horizontal orientations both handled.
- type-check / lint / full suite green.
- Gate: Joel's visual review (before/after screenshots to be captured by T3 in preview).

## Rollback
Presentation-only; revert the commit. No wire/store changes permitted in this packet.

Handoff: standard contract per RESUME_PROTOCOL.md §4.
