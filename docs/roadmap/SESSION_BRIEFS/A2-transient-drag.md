# A2 — Transient token drag

track: A · risk: Low · gate: none · depends_on: [] · unblocks: [A3]
budget_cap: 120k tokens (T2 ~60k / T3 ~30k)

## Objective
Replace TokenRenderer's React-state-per-mousemove drag with the transient pattern: imperative
`ref.style.transform` writes batched by rAF during the gesture, exactly **one** store commit +
one WebSocket event on release. This is the single biggest perceived-perf win in the program.

## Ground truth (verified @ e29131b, 2026-07-02)
- `src/components/Scene/TokenRenderer.tsx`: tokens are DOM `<img>` elements nested inside SVG `<g id="tokens-layer">`; drag currently uses **global window mousemove/mouseup listeners** that update React state per move.
- Camera transform (`src/components/Scene/SceneCanvas.tsx` ~line 745, applied to `<g class="scene-content">` ~line 941): `translate(w/2 − cam.x·zoom, h/2 − cam.y·zoom) scale(zoom)` — **viewport-centered**; `camera.x/y` = world point at viewport center.
- Coordinate authority (ADR-0002): `sceneUtils.screenToWorld/worldToScreen/snapToGrid` at `src/utils/sceneUtils.ts` (~line 285). Signature: `screenToWorld(screenX, screenY, camera, viewportWidth, viewportHeight)` where screenX/Y are **relative to the SVG element**, viewport = SVG rect size. Do NOT write new conversion math.
- Commit path: `token/move` is a **VERSIONED** event (`server/socket/handlers/EntitySyncHandler.ts` VERSIONED_EVENTS) — must carry `updateId` + `expectedVersion`; gameStore tracks `entityVersions` and has optimistic confirm/rollback (`confirmUpdate`/`rollbackUpdate`).
- WebSocket client: `src/services/websocket.ts` (NOT utils/ — CLAUDE.md is stale). Send shape: `sendEvent({ type:'event', data:{ name:'token/move', ... } })` — inspect existing TokenRenderer send call for the exact envelope before reusing.
- Existing template for "transient, bypasses store": `SelectionOverlay.tsx` keeps selection drag state local. Copy the philosophy, not the code.
- The existing per-move store path (`moveTokenOptimistic` or equivalent) must survive for remote-echo application; only the *local gesture* path changes.

## Drift check
```bash
rg -n "mousemove|pointermove|addEventListener" src/components/Scene/TokenRenderer.tsx | head
rg -n "screenToWorld" src/utils/sceneUtils.ts
rg -n "'token/move'" src/stores/gameStore.ts src/components/Scene/TokenRenderer.tsx server/socket/handlers/EntitySyncHandler.ts | head
```

## Delegation plan
- T2 (sonnet): implement `src/hooks/useTransientDrag.ts` + TokenRenderer integration. Spec: pointer capture (`setPointerCapture`), rAF-batched `translate3d` writes, no setState/store writes during gesture, single commit on pointerup (store action + versioned `token/move` send).
- T3: review the commit-path integration (updateId/expectedVersion correctness), verify exit criteria.

## Exit criteria
- Instrumented check: a temporary `useGameStore.subscribe` counter logs **exactly 1** store write per drag gesture (was: 1 per mousemove). Remove instrumentation before merge.
- React DevTools Profiler: during a 3-second drag, `SceneGrid`/`SceneBackground`/`DrawingRenderer` record **0 renders** attributable to the drag (pre-A5, other noise may exist — attribute carefully).
- Multiplayer smoke (two browser tabs): remote tab sees final position; version conflicts still rejected (drag same token in both tabs).
- `npm run type-check && npm run lint && npm run test` pass.

## Rollback
Revert branch `packet/A2-transient-drag`. Wire protocol unchanged (same `token/move` event), so no server or remote-client impact.

Handoff & close-out: RESUME_PROTOCOL.md §4–5.
