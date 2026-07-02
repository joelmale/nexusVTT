# C5 — Dock→canvas drag-and-drop

track: C · risk: Med · gate: **advisory** (UX-feel review; dependents may proceed) · depends_on: [C4] · unblocks: [] (C6 does not require it, but it completes the dock)
budget_cap: 130k tokens (T2 ~70k / T3 ~40k)

## Objective
Drag an AtlasCard onto the map: pointer-event drag (ADR-0008, NOT HTML5 DnD) with a custom ghost,
drop converts to world space via the coordinate authority, snaps to grid, and places through the
EXISTING placement path.

## Ground truth (verified @ e29131b, 2026-07-02)
- **Coordinate authority (ADR-0002):** `sceneUtils.screenToWorld(screenX, screenY, camera, viewportWidth, viewportHeight)` at `src/utils/sceneUtils.ts` ~285, where screenX/Y are relative to the SVG rect and camera is viewport-centered. `sceneUtils.snapToGrid` sits directly above it. NEVER hand-roll the inverse; NEVER read the SVG transform attribute.
- **Placement path (ADR-0003):** factory `createPlacedToken` (`src/types/token.ts`); store action `placeToken(sceneId, token)` (gameStore.ts decl :201, impl ~:2809); wire event `token/place` (UNVERSIONED — no updateId/expectedVersion; relay-only). Props: `prop/place`. Reference implementation: SceneCanvas.tsx ~:488-499 already does exactly this flow for its own placement.
- **Restriction:** `token/place` is in `DM_OFFLINE_RESTRICTED_EVENTS` (EntitySyncHandler ~line 55) — players' placements are rejected while the host is disconnected. Drop UX must surface the rejection (toast + remove optimistic token), not silently desync.
- Grid snap settings: `scene.grid.snapToGrid` (src/types/game.ts:228), grid size on the scene's grid settings.
- Canvas root locator: whatever A5/A3 established (drift-check it); fallback: the master `<svg>` rendered by SceneCanvas — add `data-role="scene-canvas-root"` if no locator exists yet (tiny, allowed).
- Ghost: portal-rendered `<img>` at `var(--z-drag-ghost)` (95), follows pointer via rAF (transient pattern from A2 — no React state per move), opacity/outline signals over-canvas state. Asset kind routing: tokens/props place as tokens/props; maps/documents drop = out of scope (record as open_question for a future packet — scene-background-set and handout-share flows).

## Drift check
```bash
rg -n "screenToWorld|snapToGrid" src/utils/sceneUtils.ts | head -4
rg -n "'token/place'" src/components/Scene/SceneCanvas.tsx src/stores/gameStore.ts | head -4
rg -n "DM_OFFLINE_RESTRICTED" server/socket/handlers/EntitySyncHandler.ts | head -2
rg -n "scene-canvas-root|data-role" src/components/Scene/SceneCanvas.tsx | head -2
```

## Delegation plan
- T2: `useDockToCanvasDrag` (pointer capture on card, rAF ghost, hit-test canvas bounds, drop → resolveFullAsset → screenToWorld → snapToGrid → placeToken + sendEvent), kind-routing tokens vs props.
- T3: verify coordinate correctness at zoom 0.3/1.0/3.0 and panned viewports (the classic off-by-center bug is why ADR-0002 exists); review rejection UX.

## Exit criteria
- Drop lands the token exactly under the cursor at zoom 0.3 / 1.0 / 3.0 and with a heavily panned camera (visual grid-cell assertion, both snap on/off).
- Second tab sees the placed token (relay smoke). Drop outside canvas = clean no-op.
- Host-offline test: player drop → rejection surfaced, no ghost token remains.
- Escape mid-drag cancels. type-check / lint / test pass. **Advisory:** screen recording in PR.

## Rollback
Additive; branch revert.

Handoff & close-out: RESUME_PROTOCOL.md §4–5.
