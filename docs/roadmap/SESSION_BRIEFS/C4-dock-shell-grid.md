# C4 — Atlas dock shell + virtualized grid

track: C · risk: Med · gate: none · depends_on: [C3, A1] · unblocks: [C5, C6]
budget_cap: 150k tokens (T2 ~90k / T3 ~30k)

## Objective
"The Atlas" frontend shell: a bottom slide-up dock (closed pill / peek / open ≤52vh),
portal-mounted so it overlays and never reflows the map (ADR-0007), hosting a virtualized
thumbnail grid fed by C3's `useAtlasAssets`. No drag-drop yet (C5).

## Ground truth (verified @ e29131b, 2026-07-02)
- Bottom viewport edge is free (no bottom bar exists in the layout).
- Dock states animate via `translateY` transforms only (never height); `inert` attribute on the panel when not open; Escape + outside-click close; focus returns to trigger.
- z: `var(--z-panel)` (70, from A1). The pre-existing AssetBrowser overlay (z:1100 pre-A1) is superseded — dock replaces its browsing role eventually; do NOT delete AssetBrowser in this packet.
- Virtualization (ADR-0008): hand-rolled — `content-visibility: auto` cards + IntersectionObserver sentinel for infinite scroll (`loadMore` from C3). No react-window/react-virtual (React 19 peer-range risk, uniform cards make manual math trivial).
- Fetch policy: lazy (ADR-0009) — C3's hook must not fire until dock first opens; peek shows only instant local sources.
- Primitives: `Portal.tsx` → `#portal-root`. Styles: CSS Modules per ADR-0006, tokens from `design-tokens.css`. Mount once at app root (survives scene switches).
- React 19.2.7 — `inert` is a proper boolean prop.

## Drift check
```bash
rg -n "useAtlasAssets" src/hooks/ -l          # C3 landed?
rg -n "z-panel|--z-" src/utils/z-scale.ts src/styles/design-tokens.css | head -4   # A1 landed?
rg -n "portal-root" src/components/Portal.tsx | head -2
```

## Delegation plan
- T2 #1: `AtlasDock` state machine + shell (trigger pill "The Atlas", toolbar with search input + source tabs incl. offline badges from `sourceAvailability`).
- T2 #2: `AtlasVirtualGrid` + `AtlasCard` (thumbnail, name, source badge; skeleton loading states).
- T3: interaction review — peek-on-hover vs click-only (recommend click-only + keyboard; hover-peek is an enhancement flag), a11y (`role="region"`, `aria-expanded`, roving tabindex in grid).

## Exit criteria
- Dock opens/closes via pill + keyboard; map never reflows (assert canvas element's rect unchanged across dock states).
- Grid scrolls 1000+ federated items smoothly (test with mock adapter injecting 5k fake assets); sentinel pagination fires; search filters live with debounce.
- Codex offline → source tab badged, no error banner. Reduced-motion respected.
- No fetch before first open (network tab proof). type-check / lint / test pass; screen recording attached.

## Rollback
Additive component tree; branch revert.

Handoff & close-out: RESUME_PROTOCOL.md §4–5.
