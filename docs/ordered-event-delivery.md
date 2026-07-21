# Ordered Event Delivery

Nexus VTT gives durable multiplayer actions one room-wide order and makes
client retries idempotent. The protocol complements the canonical game-state
snapshot and delta-sync flow; it does not replace them.

The two durability protocols share PostgreSQL but serve different purposes.
Canonical state commits atomically compare-and-swap
`sessions.(gameState, syncToken, stateVersion)` before ACK. Ordered actions
atomically append `room_events` while advancing `sessions.eventSequence`.
Redis distributes both after commit but is not the record of either.

Versioned token/prop actions add a third anchor: the backend compare-and-swaps
`room_entity_versions` inside the event-journal transaction. This database
check is required because process-local entity maps can race across replicas.

## Delivery contract

Before sending a durable action, the browser adds:

- `eventId`: stable UUID retained across retries.
- `actorId`: the client identity. The server replaces this with the
  authenticated connection identity before committing.
- `clientSequence`: monotonic sequence for that actor.
- `occurredAt`: client creation time in epoch milliseconds.

The backend serializes acceptance per room, commits the envelope to
`room_events`, and assigns `serverSequence` by incrementing
`sessions.eventSequence` in the same database transaction. A unique
`(sessionId, eventId)` constraint makes a repeated frame a duplicate rather
than a second action. The sender receives an `event-ack` containing the
committed sequence and duplicate status.

Clients apply ordered events only when the preceding `serverSequence` has been
applied. Out-of-order frames wait in a bounded buffer. A client's last applied
cursor and up to 100 unacknowledged outbound events are stored in localStorage,
so a reconnect retries the original event IDs rather than creating new actions.

These rules provide one committed order per room and exactly-once application
for retained events, even though transport delivery and client submission may
occur more than once.

## Reconnect and recovery

The reconnect URL includes `lastSeenSequence`. After the normal session
confirmation and canonical state snapshot, the backend sends an `event-cursor`
followed by every retained event after that cursor. Live room membership is
installed after the replay window is captured, then a second catch-up query
closes the handoff to live delivery. Sequence-based deduplication makes overlap
between the catch-up and live stream harmless.

The journal is bounded by `EVENT_JOURNAL_MAX_EVENTS` (default `1000`, minimum
`100`). If the cursor is older than the retained window, the server sends a new
baseline at the oldest available event. The canonical session snapshot restores
current scene/entity state; retained events then restore the available ordered
tail. Historical chat or dice entries older than the cap are intentionally not
reconstructed.

## Durable and transient traffic

Durable traffic includes chat plus character, dice, drawing, fog, prop, scene,
and token mutations listed in `shared/events/contracts.ts`. Presence, typing,
cursor, heartbeat, targeted UI messages, and canonical snapshot/delta traffic
remain outside the journal because they are transient or already have a
separate integrity protocol.

When adding a new shared mutation:

1. Add its event name to `DURABLE_EVENT_NAMES`.
2. Route server acceptance through `SocketManager.publishOrderedEvent`.
3. Decide whether the optimistic sender needs the committed event echoed or
   should advance its cursor from the acknowledgement.
4. Add duplicate, ordering, and reconnect-replay coverage.

## Operations and scaling

Before deploying to an existing database, apply these migrations in order:
`2026-07-19-add-room-event-journal.sql`,
`2026-07-19-add-durable-game-state-commits.sql`, then
`2026-07-19-add-room-entity-versions.sql`. New databases receive the same
schema from `server/schema.sql`; startup also creates missing journal/version
objects and state-anchor columns defensively.
Runtime counters for commits, duplicates, failures, replay volume, and
truncated replay windows are available from `GET /api/metrics/ordered-events`.

Database transactions remain the ordering authority across backend processes.
When `REDIS_URL` is configured, each process also starts a realtime coordinator
that publishes committed envelopes and transient room traffic to a versioned
Redis channel. A replica detects any jump in `serverSequence`, reads the missing
range from PostgreSQL, and only then delivers the live event. A Redis subscriber
reconnect performs the same journal catch-up for every active room. Without a
`REDIS_URL`, the coordinator keeps the exact same API in single-instance mode.

Redis sorted sets hold renewable room presence with a 45-second expiry. The
primary host also owns a renewable lease; a replacement connection fences the
old connection and lease ownership is released during graceful shutdown.
PostgreSQL remains the source of truth for sessions, snapshots, and event
history, so Redis is never the durable record.

`GET /api/metrics/realtime` exposes instance identity, connectivity, fanout,
gap-repair, reconnect, publish-failure, presence, and host-lease counters. When
Redis is configured, `/health` does not report ready until both the database and
realtime coordinator are available.

The smoke suite exercises exact duplicate submission, four concurrent clients,
an isolated connection outage with replay, two backend replicas, an abrupt
`SIGKILL` immediately after a game-state ACK, asymmetric replica restarts with
journal recovery, and stale-base authoritative resynchronization. Run it with
`npm run test:e2e`.

For multi-room load, cross-replica conflict probes, rolling restarts, Redis
interruption, and PostgreSQL latency, run `npm run test:soak:chaos`. Operational
SLOs and alerts are documented in
`docs/operations/multiplayer-observability.md`.
