# A6a — Floating panels (ContextPanel exodus)

track: A · risk: Med · gate: **blocking 🔍** (user-facing visual change) · depends_on: [A1] · unblocks: [A6b, A7]
budget_cap: 150k tokens (T2 ~80k / T3 ~35k)

## Objective
Kill the reserved sidebar column: `.game-layout` goes to a single grid column behind a layout
flag; ContextPanel content renders in a floating, portal-mounted panel (top-right, 320px,
transform/opacity animated). The map gains its first taste of full width.

## Ground truth (verified @ e29131b, 2026-07-02)
- `.game-layout` at `src/styles/layout-consolidated.css:15-31`: `grid-template-columns: 1fr var(--sidebar-width, 300px)`, areas `'header header' 'scene panel'`.
- Sidebar mount: `src/components/GameUI.tsx:386-408` (`.layout-panel`, `sidebar-resize-handle` with drag state ~:100-200, `data-panel-expanded`; collapsed still reserves 60px).
- `src/components/ContextPanel.tsx` renders the active panel of 12 (Tokens, Scene, Props, Generator, Initiative, Characters, Dice, Documents, Chat, Sounds, Lobby, Settings); Chat requests 800px at ContextPanel.tsx:117.
- Overlay primitives: `src/components/Portal.tsx` (createPortal → `#portal-root`), `PopoverMenu.tsx`, `Tooltip.tsx` (HTML Popover API), `DataModal.tsx` (Escape/focus-trap conventions to copy).
- Z bands from A1: panel = `var(--z-panel)` (70). Design tokens: `src/styles/design-tokens.css` (`--spacing-*`, `--radius-*`, `--shadow-*`, `--duration-*`/`--transition-*`).
- **No feature-flag infrastructure exists** — this packet introduces the minimal one (see Work spec 1); A8a reuses it.
- CSS strategy (ADR-0006): the new FloatingPanel is net-new → **CSS Module** (`FloatingPanel.module.css`) consuming `var(--token)` values. First CSS Module in the codebase — sets the precedent.

## Drift check
```bash
sed -n '15,31p' src/styles/layout-consolidated.css
rg -n "layout-panel|sidebar-resize" src/components/GameUI.tsx | head -6
rg -n "width" src/components/ContextPanel.tsx | head -5
ls src/components/Portal.tsx src/styles/design-tokens.css
```

## Delegation plan
- T2 (one objective: the shell): flag util (`src/utils/featureFlags.ts` — localStorage-backed `nexus-flags` + `useFlag(name)` hook, default off), `FloatingPanel` component + module CSS (open/closed via `data-state`, `translateX` + opacity, `prefers-reduced-motion` respected, Escape closes, focus returns to opener), flag-switched layout in GameUI (`flag off` = current grid, `flag on` = single column + portal panel).
- T3: review a11y (role="dialog", focus management), flag-off parity, and the review packet.

## Work spec ordering
1. Flag util → 2. FloatingPanel shell rendering existing ContextPanel children unchanged → 3. flagged `.game-layout` single-column variant → 4. remove resize-handle path under flag (obsolete — panel has fixed width; resize deferred).

## Exit criteria
- Flag OFF: pixel-identical to today (screenshot compare of default view).
- Flag ON: map canvas occupies 100% viewport width (inspect `.layout-scene` computed width == window.innerWidth); each of the 12 panels opens/closes in the floating shell; Chat/Character panels scroll correctly at 320px (note overflow issues honestly — full per-panel redesign is NOT this packet).
- Escape closes panel and restores focus; transitions disabled under `prefers-reduced-motion`.
- type-check / lint / test pass.

## Rollback
Flag off (instant, runtime). Branch revert removes code.

Handoff & close-out: RESUME_PROTOCOL.md §4–5. **Blocking gate: Joel reviews flag-ON UX before A6b/A7.**
