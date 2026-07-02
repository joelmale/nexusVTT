# A6b — Header demolition → corner icon dock

track: A · risk: Med · gate: **blocking 🔍** (user-facing visual change) · depends_on: [A6a] · unblocks: [A6c]
budget_cap: 130k tokens (T2 ~70k / T3 ~30k)

## Objective
Behind the A6a layout flag: remove the permanent 60px header row. The 12 panel tabs become a
top-right floating icon dock (36px round buttons) that opens A6a's FloatingPanel; PlayerBar
becomes a top-left floating cluster; ConnectionStatus moves into the dock.

## Ground truth (verified @ e29131b, 2026-07-02)
- Header markup: `src/components/GameUI.tsx:286-338` (`.layout-header`; PlayerBar left; `.header-right` holds `.horizontal-panel-tabs` at :292-314 — 12 emoji radio-tabs with `role="tablist"` — plus collapse button + ConnectionStatus).
- Grid rows: `layout-consolidated.css` `grid-template-rows: 60px 1fr` (`--header-height: 60px`).
- `src/components/PlayerBar.tsx`: connected player avatars, current-user highlight, DM badges, PlayerActions/Leave Room.
- Existing focus-ring precedent: `.horizontal-panel-tab:focus-visible` at `layout-consolidated.css:1268` — extend this pattern to dock buttons.
- Polish spec (ratified): hover `scale(1.05)` + `var(--surface-hover)`; `aria-pressed` on active; idle fade to ~40% opacity after 3s, restore on pointer proximity; all transitions transform/opacity via `--duration-200`.
- New components are CSS Modules per ADR-0006. Dock z = `var(--z-tool-ui)` (60).

## Drift check
```bash
sed -n '286,340p' src/components/GameUI.tsx | head -30
rg -n "header-height" src/styles/*.css | head -4
rg -n "focus-visible" src/styles/layout-consolidated.css | head -3
```
Confirm A6a's flag util + FloatingPanel landed (`ls src/utils/featureFlags.ts src/components/FloatingPanel* 2>/dev/null` — adjust paths to what A6a actually shipped, per its SESSION_STATE entry).

## Delegation plan
- T2: `PanelDock` component (icon-only buttons, tooltip labels via existing Tooltip.tsx, keyboard navigable — arrow keys within dock, Enter opens), floating PlayerBar wrapper, flagged removal of the header grid row (`grid-template-rows: 1fr` under flag).
- T3: a11y review (the tablist semantics must survive the visual change), icon legibility judgment (emoji vs. proper icons — if emoji reads poorly at 36px, note as open_question; do NOT freelance an icon library in).

## Exit criteria
- Flag ON: no header row; map gains 60px vertical; all 12 panels reachable via dock (mouse + keyboard); PlayerBar cluster shows avatars/DM badges; Leave Room reachable.
- Flag OFF: unchanged (screenshot compare).
- Dock idle-fade works and is disabled under `prefers-reduced-motion`.
- type-check / lint / test pass; visual proof: before/after screenshots at 1280×800 attached to PR.

## Rollback
Flag off. Branch revert.

Handoff & close-out: RESUME_PROTOCOL.md §4–5. **Blocking gate before A6c.**
