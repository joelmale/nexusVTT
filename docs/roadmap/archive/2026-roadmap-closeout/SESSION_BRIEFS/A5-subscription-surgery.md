# A5 — SceneCanvas subscription surgery

track: A · risk: Med · gate: **blocking 🔍** (perf claims need Joel's review) · depends_on: [A4] (A3 soft — cleaner profiling) · unblocks: [A9, A10]
budget_cap: 160k tokens (T2 ~80k / T3 ~50k)

## Objective
Land the core guarantee: **a token move never re-renders the grid or background.** Narrow
SceneCanvas to orchestrator-only subscriptions; push per-layer subscriptions down into layer
components using A4's fine-grained selectors.

## Ground truth (verified @ e29131b, 2026-07-02 — re-verify against A4's landed shape)
- `src/components/Scene/SceneCanvas.tsx` subscribes to 9+ selectors: `useGameStore, useCamera, useFollowDM, useIsHost, useActiveTool, useSceneState, useSceneDrawings, usePlacedTokens, usePlacedProps, useSelectedPlacedToken, useSelectedPlacedProp` — so ANY scene write re-renders the master component and cascades.
- Layer children (inside the master SVG, bottom→top): SceneBackground → SceneGrid → DrawingRenderer → TokenRenderer(s) (DOM img in `g#tokens-layer`) → PropRenderer(s) → DrawingTools → SelectionOverlay.
- After A4, narrow selectors exist: `useTokenPosition(id)`, `useGridSettings()`, `useBackgroundImage()` etc. After A3, camera is imperative (ref-driven) during gestures.
- Target: SceneCanvas keeps only `activeSceneId`, `activeTool`, `isHost`; each layer component subscribes to exactly its slice. Token list rendering iterates `tokenOrder` with per-token memoized components subscribing to their own token record.

## Drift check
```bash
rg -n "use[A-Z][a-zA-Z]*\(\)" src/components/Scene/SceneCanvas.tsx | head -15
ls src/stores/scene/ 2>/dev/null
rg -n "useTokenPosition|useGridSettings" src/stores src/components -l | head
```
If `src/stores/scene/` doesn't exist, A4 hasn't landed — STOP, packet is blocked.

## Delegation plan
- T2: component-by-component rewiring (SceneBackground, SceneGrid, DrawingRenderer, token/prop mapping layer), `React.memo` per-token wrapper keyed by id, remove dead prop-drilling from SceneCanvas.
- T3: profiler verification and the review packet for Joel (this is the gate: the claims must be demonstrated, not asserted).

## Exit criteria (the gate evidence — attach all three to the PR)
1. **React Profiler trace** (DevTools export or screenshot): drag a token for 3s in a scene with grid + background + 5 drawings → `SceneGrid` and `SceneBackground` show **0 renders**; only the dragged token's component renders (≤1 commit, at drop, per A2).
2. **Render-spy unit test**: mount grid component with a spy; dispatch `token/move` through the store; assert spy not called. Inverse control: dispatch grid-settings change; assert called once.
3. Interaction smoke at 60fps: pan + drag simultaneously in preview with 50 tokens placed (use mock data generator) — no visible hitching (subjective, note observations honestly).
- type-check / lint / test pass.

## Rollback
Revert branch. A4 wrappers still exist, so reverting A5 alone restores the old subscription graph without touching stores.

Handoff & close-out: RESUME_PROTOCOL.md §4–5. **Blocking gate: A9 must not dispatch until gate_status=approved.**
