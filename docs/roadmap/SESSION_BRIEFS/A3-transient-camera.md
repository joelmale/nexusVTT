# A3 — Transient camera pan/zoom

track: A · risk: Low · gate: none · depends_on: [A2] · unblocks: [A5 (soft)]
budget_cap: 100k tokens (T2 ~50k / T3 ~25k)

## Objective
Apply the A2 transient pattern to camera pan/zoom: a module-level mutable camera ref drives one
imperative transform write on the scene-content group per frame; the Zustand `camera` state is
synced only on gesture-end plus a throttled interval for "Follow DM" viewers.

## Ground truth (verified @ e29131b, 2026-07-02)
- Camera state lives in gameStore `sceneState`; selector `useCamera()`. SceneCanvas currently re-renders on every camera store write (it subscribes to `useCamera` among 9+ selectors).
- Transform construction: `src/components/Scene/SceneCanvas.tsx` ~line 745 (template string), applied at ~line 941 to `<g className="scene-content">`. Formula: `translate(${w/2 - cam.x*zoom}, ${h/2 - cam.y*zoom}) scale(${zoom})`.
- Host camera broadcasts to players over WebSocket (`camera/*` family relayed by `server/socket/handlers/EntitySyncHandler.ts` RELAY_EVENTS includes `camera/update`-style events — confirm exact name via drift check). Players with "Follow DM" (`useFollowDM()`) apply it.
- A2 delivered `src/hooks/useTransientDrag.ts` and the pattern conventions — reuse its rAF/commit discipline. If A2's artifacts differ, follow what landed, not this brief.

## Drift check
```bash
rg -n "transform = |scene-content" src/components/Scene/SceneCanvas.tsx | head -5
rg -n "camera/" src/stores/gameStore.ts server/socket/handlers/EntitySyncHandler.ts | head -8
rg -n "useTransientDrag|transient" src/hooks/ -l
```

## Delegation plan
- T2: implement `src/utils/cameraRef.ts` (module-level `{x,y,zoom}` + subscribe for imperative consumers), rewire wheel-zoom/pan handlers in SceneCanvas to write the ref + imperative transform; store sync on gesture end + `~150ms` throttle while a gesture is live (for followers); `screenToWorldLive()` variant in sceneUtils reading the ref (extends ADR-0002 — the live variant is for mid-gesture only; one-shot conversions keep using store camera).
- T3: review the two-source-of-truth boundary (ref vs store) — the ONLY readers of the live ref are: the transform writer, `screenToWorldLive`, and the throttled broadcaster. Everything else reads the store.

## Exit criteria
- Profiler: continuous 3s pan records 0 React commits from camera changes (store writes only at end/throttle ticks).
- Two-tab smoke: follower tab tracks host pan smoothly (throttle ≤200ms lag); non-follower unaffected.
- Zoom-at-cursor still anchors correctly (viewport-centered math — verify at zoom 0.3 and 3.0).
- type-check / lint / test pass.

## Rollback
Revert branch. Store remains authoritative; ref is additive.

Handoff & close-out: RESUME_PROTOCOL.md §4–5.
