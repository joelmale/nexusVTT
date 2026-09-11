# A4 — Store slice split (sceneState → per-layer slices)

track: A · risk: Med · gate: none · depends_on: [] · unblocks: [A5, A8a, A9]
budget_cap: 180k tokens (T2 ~90k / T1 ~15k / T3 ~40k)

## Objective
Split gameStore's monolithic `sceneState` into per-layer slices mapping 1:1 onto render layers
(ADR-0005): `backgroundSlice`, `gridSlice`, `drawingsSlice`, `tokensSlice`, `propsSlice`,
`cameraSlice` (+ reserved `fogSlice` shape, populated in A9). Existing selector hooks become thin
compatibility wrappers — **no consuming component changes in this packet**.

## Ground truth (verified @ e29131b, 2026-07-02)
- `src/stores/gameStore.ts` (~97KB): slices = user, session, diceRolls, activeTab, **sceneState**, settings, chat, voice, connection, isRecovering, entityVersions. Zustand 5.0.14 + Immer middleware.
- sceneState contains: `scenes[]` (each with `placedTokens[]`, `placedProps[]`, drawings, grid settings, background), `activeSceneId`, `camera`, `activeTool`, plus selection state.
- Public selector hooks to preserve as wrappers (grep `export const use` in gameStore.ts): `useCamera, useActiveScene, useSceneState, useScenes, useSceneDrawings, useVisibleDrawings, usePlacedTokens, usePlacedProps, useActiveTool, useFollowDM, useSelectedPlacedToken, useSelectedPlacedProp` (+ ~10 non-scene hooks untouched).
- Token storage becomes keyed: `tokens: Record<id, PlacedToken>` + `tokenOrder: string[]` (O(1) updates, stable render order). Same for props.
- Event handler registry (`'token/place'` at gameStore.ts:683, `'token/move'`, etc.) and actions (`placeToken` decl :201, impl ~:2809) must be rewired to the new slices — wire protocol unchanged.
- Existing tests: `src/stores/gameStore.test.ts`, `gameStore.persistence.test.ts` — must stay green; they are the compat contract.

## Drift check
```bash
rg -n "sceneState" src/stores/gameStore.ts | head -5
rg -c "export const use" src/stores/gameStore.ts
npm run test -- gameStore 2>&1 | tail -5
```

## Delegation plan
- T1: enumerate every consumer of each scene selector hook (`rg -l` per hook) → risk map.
- T2 (one slice per handoff, in order: camera → grid → background → drawings → tokens → props): create `src/stores/scene/<slice>.ts`, move state + actions, wrap old hook. Each slice lands as its own commit; tests green between commits.
- T3: review the tokens slice (highest blast radius: optimistic updates + entityVersions interplay) and the persistence path (session recovery serializes sceneState — the persisted JSON shape must remain stable or a migration shim added; check `gameStore.persistence.test.ts`).

## Exit criteria
- All existing tests pass unmodified (wrappers make the split invisible).
- Persisted-state round-trip: create session → place token → draw → refresh page → state restores (manual two-minute smoke via preview + `gameStore.persistence.test.ts`).
- New fine-grained selectors exist and are exported: `useTokenPosition(id)`, `useGridSettings()`, `useBackgroundImage()` — each provably narrow (unit test: writing a token position does not notify a `useGridSettings` subscriber; use `store.subscribe` listener counts).
- Multiplayer smoke: token place/move/delete round-trips between two tabs.

## Rollback
Slice-by-slice commits allow partial revert. Persisted JSON shape unchanged → no data migration to undo.

Handoff & close-out: RESUME_PROTOCOL.md §4–5. If budget hits 80% mid-slice: land completed slices, re-packet the remainder (§6).
