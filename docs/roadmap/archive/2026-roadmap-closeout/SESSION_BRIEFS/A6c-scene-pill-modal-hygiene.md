# A6c — Scene pill + generator modal hygiene

track: A · risk: Low · gate: none · depends_on: [A6b] · unblocks: [A10]
budget_cap: 100k tokens (T2 ~50k / T3 ~25k)

## Objective
Two small demolitions behind the layout flag: (1) the permanent ~48px scene tab bar becomes a
DM-only corner pill that expands a scene-switcher popover — players reclaim the strip entirely;
(2) GeneratorPanel gets modal hygiene: Portal-mounted, token z-index, Escape, focus trap.

## Ground truth (verified @ e29131b, 2026-07-02)
- Scene tab bar: `src/components/GameUI.tsx:343-346`, styles `layout-consolidated.css:133-143` (~48px, browser-style tabs 120–200px each). Scene switching is host-only in effect (players follow the active scene) — verify with drift check whether players can switch locally.
- Host check: `useIsHost()` selector from gameStore.
- Generator overlay: `src/components/GameUI.tsx:410-433` (conditional on `activePanel==='generator'`, manual ✕ close, no Escape/focus-trap); `src/styles/generator-panel.css:11-25` (`position:fixed; top:var(--header-height,60px)`, hardcoded `z-index:30/31` with manual-ordering comment).
- After A1: use `var(--z-modal)` / `var(--z-modal-backdrop)` band. After A6b: header may be gone under flag → overlay becomes `inset:0`.
- Escape/focus-trap conventions: copy `src/components/DataModal.tsx`.
- Popover primitives: `PopoverMenu.tsx`; new pill styles as CSS Module.

## Drift check
```bash
sed -n '343,346p' src/components/GameUI.tsx
sed -n '410,433p' src/components/GameUI.tsx | head -12
sed -n '11,25p' src/styles/generator-panel.css
rg -n "useIsHost" src/components/Scene/ | head -4
```

## Delegation plan
- T2: `ScenePill` (top-left under PlayerBar cluster; shows active scene name; click → popover listing scenes with add/rename/delete for host; hidden entirely for non-hosts under flag), GeneratorPanel hygiene refactor.
- T3: confirm player-side scene-follow behavior is untouched (players never switched scenes via tabs anyway — verify, don't assume).

## Exit criteria
- Flag ON as player: no scene strip anywhere; as host: pill present, all scene CRUD reachable via popover.
- Generator: Escape closes, focus trapped while open, focus restored on close, backdrop uses token z-index (no numeric z in generator-panel.css).
- Flag OFF: unchanged. type-check / lint / test pass.

## Rollback
Flag off. Branch revert.

Handoff & close-out: RESUME_PROTOCOL.md §4–5.
