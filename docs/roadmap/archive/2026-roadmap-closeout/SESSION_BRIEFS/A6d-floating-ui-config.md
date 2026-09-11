# A6d — Floating UI config (draggable chrome + focus stacking) [RETRO-BRIEF]

track: A · risk: Med · gate: **blocking 🔍** (user-facing UX change) · depends_on: [A6b] · unblocks: []
status-note: This packet emerged unbriefed during S7 as a substitution for A6c and was
formalized retroactively in S8 (T3 review + hardening). A6c's ORIGINAL scope (scene pill +
generator modal hygiene) was restored to `todo` — this packet does NOT cover it.

## Objective
Make the floating chrome (GameToolbar, PlayerCluster, PanelDock, FloatingPanel, AtlasDock)
user-configurable: draggable via pointer with edge-clamping and soft snap, positions persisted
per panel, click-to-front focus stacking, collapse toggles, and a Settings "Reset UI Layout"
action.

## What landed (S7 code + S8 hardening, verified @ this packet's commit)
- `src/stores/uiStackStore.ts` — stack-order store; **ADR-0004 band clamp** (S8): z is
  computed ONLY via `useStackZIndex(id)` / `stackZIndex()` = `CHROME_Z_BASE(60) + stackIndex`,
  clamped to `CHROME_Z_MAX(78)` — floating chrome can NEVER cover modals (80+), tooltips (85),
  dice (90), or character sheets (100+). Unit-tested incl. a 50-panel clamp proof.
- `src/hooks/useDraggablePanel.ts` — transient-pattern drag (rAF imperative transforms,
  persist-on-release; consistent with A2/A3 conventions), viewport clamping + resize re-clamp,
  soft edge snap, collapse state. Keys: `nexus-ui-<id>-pos` / `-collapsed` (S8: renamed from
  legacy `nexus_ui_*`; legacy keys read as fallback once).
- `src/components/PlayerClusterFloating.tsx` — extracted floating wrapper.
- Integrations: GameToolbar/PanelDock/FloatingPanel/AtlasDock consume `useStackZIndex` +
  `bringToFront` on pointerdown-capture; Settings gains "Reset UI Layout" (sweeps both key
  prefixes; store `resetLayout()` is the canonical sweep).

## Exit criteria
- `uiStackStore.test.ts` green (ordering, no-op top, persistence, reset sweep, z clamp).
- No raw `100 + index` / `1000` z math anywhere: `rg "100 \+ index|Math.max\(1000" src` → 0.
- type-check / lint / full suite green.
- Gate (Joel): drag each panel, click-to-front behaves, positions survive reload, Reset
  restores defaults, and an open modal/character sheet always covers raised chrome.

## Rollback
Positions/stack are localStorage prefs; revert commit + users' saved prefs are ignored.
