# Backend Architecture

The `server/` runtime is an Express 5 API and WebSocket collaboration service.
It authenticates requests, validates realtime envelopes, enforces host/co-host
authority, serializes durable work in PostgreSQL, and coordinates backend
replicas through Redis.

## Structure

```text
server/
├── index.ts                    # Process, HTTP, and room lifecycle
├── database.ts                 # Repository composition
├── schema.sql                  # New-database schema
├── migrations/                # Existing-database upgrades
├── routes/                    # REST and document routes
├── repositories/              # PostgreSQL transactions and queries
├── services/                  # Redis coordination and external adapters
└── socket/
    ├── SocketManager.ts       # Validation, dispatch, fanout, replay
    └── handlers/              # Feature-specific realtime handlers
```

## Realtime responsibilities

- Maintain local socket connections and a projection of each active room.
- Publish committed/transient messages across replicas with Redis.
- Persist idempotent ordered actions in `room_events` before delivery.
- Fence the active host with a renewable Redis lease.
- Recover ordered gaps and canonical state from PostgreSQL.
- Validate permissions, payload size, content hashes, and JSON Patch operations.

Redis is coordination, not storage of record. PostgreSQL owns accounts,
campaigns, game sessions, Express sessions, canonical state, and ordered event
history.

## Canonical game-state commit

Hosts send either a full `SyncableGameState` or an RFC 6902 patch with a base
content hash. `SessionRepository.commitGameState()` performs one transaction:

1. Compare `sessions.stateVersion` and `sessions.syncToken` with the observed
   anchors.
2. Write `sessions.gameState`, the new token, and increment the version only
   when canonical content changes. An identical reconnect snapshot is
   version-neutral.
3. Write `campaigns.scenes` in the same transaction.
4. Commit.
5. Only then update room memory, send `game-state-ack`, and publish the peer
   patch.

If the compare-and-swap loses, the server returns
`game-state-resync-required` with the committed snapshot, token, and version.
The browser rebases onto that tuple rather than overwriting the winner. An ACK
therefore remains valid after immediate process death.

## Ordered actions

Durable chat, dice, scene, token, drawing, character, fog, and prop events use
stable event IDs. PostgreSQL assigns one `serverSequence` per room and rejects a
duplicate `(sessionId, eventId)` as a retry. Reconnecting clients provide their
last cursor, replay the retained journal, then transition to live Redis fanout.
See [Ordered Event Delivery](./ordered-event-delivery.md).

## Verification

Run `npm run test:ci` for static and Vitest coverage. Run `npm run test:e2e` for
the managed two-replica browser suite, including concurrent writer conflict
recovery and a backend `SIGKILL` immediately after a durable state ACK.
Run `npm run test:soak:chaos` for multi-room cross-replica load, database-backed
entity conflict serialization, rolling backend restarts, Redis interruption,
PostgreSQL latency, and final event/state convergence. Metrics and SLOs are in
[Multiplayer Reliability Operations](./operations/multiplayer-observability.md).
