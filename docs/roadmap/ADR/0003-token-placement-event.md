# ADR-0003 — Token placement uses existing `token/place` (unversioned)

Status: **Accepted** (Joel, 2026-07-02)

## Context
An agent designed dock-drop dispatching an invented `token/create` event with optimistic
updateId/expectedVersion machinery. Verification showed the placement path already exists.

## Decision
Placement = `createPlacedToken` factory (`src/types/token.ts`) → `placeToken(sceneId, token)`
store action (gameStore.ts) → `token/place` wire event (`prop/place` for props). These are
RELAY_EVENTS, **not** VERSIONED_EVENTS (`server/socket/handlers/EntitySyncHandler.ts`): no
updateId, no expectedVersion, no rollback machinery for placement. New entities can't version-conflict.

## Consequences
- C5's drop handler is small — it plugs into the SceneCanvas ~:488-499 pattern.
- `token/place` is in DM_OFFLINE_RESTRICTED_EVENTS: player placements are rejected while the
  host is offline; any placement UI must surface that rejection.
- Moves/updates/deletes remain versioned; only creation is relay-only.
