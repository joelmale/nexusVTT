# A1 — z-scale constants + codemod

track: A · risk: Low · gate: **blocking 🔍** (wide mechanical diff) · depends_on: [] · unblocks: [A6a, C4]
budget_cap: 80k tokens (T0 codemod + T1 verify ~10k / T3 ~30k)

## Objective
Replace all ad-hoc z-index values (~40 declarations, 15+ distinct values from 1 to 10102) with a
single authoritative scale: `src/utils/z-scale.ts` (TS source of truth) emitting `--z-*` CSS custom
properties. Pure refactor; zero visual change.

## Ground truth (verified @ e29131b, 2026-07-02)
- Target scale (ratified, ADR-0004): `Z = { BACKGROUND:0, GRID:10, DRAWING:20, TOKEN:30, SELECTION:35, FOG:40, CURSORS:50, TOOL_UI:60, PANEL:70, MODAL:80, DICE_3D:90, DRAG_GHOST:95, TOP_MODAL:100 }` — each band reserves ±9 for local stacking.
- Known offenders (z-index census): `src/styles/layout-consolidated.css` (1×3), `scenes.css` (5,10,100,1000,1100), `generator-panel.css` (30,31 + explanatory comment), `welcome-page.css` (20), `Tooltip.css` (50), `chat.css` (10), `linear-flow.css` (100), `player-panel.css` (1001), `character.css` (2000), `dice.css` (9999), `character-sheet-parchment.css` (10100–10102). Inline: `src/components/DiceBox3D.tsx` (10000), `src/components/Scene/DrawingTools.tsx` (10000), `src/components/Tokens/TokenConfigPanel.tsx` (10000).
- `--z-cursors` is referenced at `src/styles/scenes.css:1994` but **defined nowhere** — must be defined (→ 50).
- A partial token scale exists in `src/styles/design-tokens.css` (`--z-sticky`, `--z-modal`, `--z-toolbar`) — subsume into the new scale, don't leave two.
- Verify commands: `npm run type-check`, `npm run lint`, `npm run test` (vitest).

## Drift check (run first)
```bash
rg -c "z-index" src/styles/*.css | sort -t: -k2 -rn | head
rg -n "zIndex|z-index" src/components/DiceBox3D.tsx src/components/Scene/DrawingTools.tsx src/components/Tokens/TokenConfigPanel.tsx
rg -n "z-cursors" src/styles/design-tokens.css src/styles/scenes.css
```
Any new offender files → extend the codemod list; missing offenders → skip them.

## Delegation plan
- T0: script the census (`rg`-based) and mechanical replacements where 1:1.
- T1 (haiku): map each old value → band (mechanical table from ADR-0004 mapping in this brief).
- T3: judgment calls on ambiguous values (e.g. generator 30/31 → MODAL band; player-panel 1001 → PANEL+1), final review.

## Work spec
1. Create `src/utils/z-scale.ts` exporting `Z` + a `zVars()` helper (or static block in `design-tokens.css`) defining `--z-background`…`--z-top-modal`.
2. Map: 1→auto/remove where decorative; 5,10→GRID/TOOL bands per context; 20,30,31→per-context; 50→CURSORS; 100→TOOL_UI/PANEL; 999–1001→PANEL; 1000–1100 modals→MODAL; 2000→MODAL+band; 9999/10000→DICE_3D; 10100+→TOP_MODAL. Inline styles import `Z`.
3. Define `--z-cursors: 50`. Remove the superseded `--z-sticky/--z-modal/--z-toolbar` or alias them.
4. Update the generator-panel.css comment to reference the scale.

## Exit criteria
- `rg -n "z-index:\s*-?[0-9]" src --glob '*.css' --glob '*.tsx'` returns **zero** raw numeric values outside `design-tokens.css`/`z-scale.ts` (band math like `calc(var(--z-token) + 1)` allowed).
- `npm run type-check && npm run lint && npm run test` pass.
- Visual smoke via preview: open a scene, open a modal, roll 3D dice, open character sheet — stacking unchanged.

## Rollback
Single revert of branch `packet/A1-z-scale`. No data or schema impact.

Handoff & close-out: standard contract + state update per RESUME_PROTOCOL.md §4–5. **Blocking gate: pause for Joel's diff review before A6a/C4 dispatch.**
