# A7 — Token context menu

track: A · risk: Low-Med · gate: **advisory** (UX-feel review in PR; dependents may proceed) · depends_on: [A6a] · unblocks: [A10]
budget_cap: 110k tokens (T2 ~60k / T3 ~25k)

## Objective
The Owlbear signature moment: selecting a token summons a compact context menu anchored near the
token — rotate, resize, show/hide (host), add to initiative, delete, and "Edit…" opening the full
TokenPanel in A6a's FloatingPanel. Coexistence ruling (ADR-0009): the menu owns frequent actions;
TokenPanel remains the advanced escape hatch.

## Ground truth (verified @ e29131b, 2026-07-02)
- Selection: token click selects (`useSelectedPlacedToken` selector); a `TokenToolbar` (absolute, z:999 pre-A1) already appears — study it, replace or absorb it, don't stack a second menu on top.
- Anchor math: token world position → screen via `sceneUtils.worldToScreen(worldX, worldY, camera, viewportW, viewportH)` (`src/utils/sceneUtils.ts`); position relative to the SVG rect. Menu must reposition on camera change (subscribe to camera store OR reposition on gesture-end only — simpler; menus may hide during pan).
- Mutations: `token/update` (rotation/scale/visibility) and `token/delete` are **VERSIONED** events (updateId + expectedVersion, see EntitySyncHandler VERSIONED_EVENTS). Initiative: `src/stores/initiativeStore.ts` (`entries`, add action — inspect exact name).
- Host-only visibility toggle: gate on `useIsHost()`.
- Primitives: `PopoverMenu.tsx` + `Portal.tsx`; new styles = CSS Module; z = `var(--z-tool-ui)`.
- Polish: appear 120ms after selection settles (avoid flicker during drag-select); hide during token drag; focus-visible rings; Escape dismisses without deselecting.

## Drift check
```bash
rg -n "TokenToolbar" src/components -l
rg -n "useSelectedPlacedToken" src/stores/gameStore.ts src/components -l | head
rg -n "worldToScreen" src/utils/sceneUtils.ts
rg -n "addEntry|addToInitiative" src/stores/initiativeStore.ts | head -3
```

## Delegation plan
- T2: `TokenContextMenu` component + integration (selection → anchored menu; action handlers dispatch existing store actions/events; drag-hide behavior).
- T3: UX judgment on menu contents order and the TokenToolbar absorb-vs-replace call; verify versioned-event correctness.

## Exit criteria
- Select token → menu appears anchored within 16px of token bounds; every action round-trips to a second browser tab (multiplayer smoke).
- Menu hides during drag and pan; reappears at new anchor.
- Keyboard: menu focusable, arrow-navigable, Escape dismisses. Old TokenToolbar either gone or demonstrably non-overlapping.
- type-check / lint / test pass. **Advisory review**: screen recording of select→act flow attached to PR.

## Rollback
Branch revert; no protocol/schema change.

Handoff & close-out: RESUME_PROTOCOL.md §4–5.
