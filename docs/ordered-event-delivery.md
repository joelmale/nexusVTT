# Ordered Event Delivery

Nexus VTT gives durable multiplayer actions one room-wide order and makes
client retries idempotent. The protocol complements the canonical game-state
snapshot and delta-sync flow; it does not replace them.

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

Apply `server/migrations/2026-07-19-add-room-event-journal.sql` before deploying
code to an existing database. New databases receive the same schema from
`server/schema.sql`; startup also creates missing journal objects defensively.
Runtime counters for commits, duplicates, failures, replay volume, and
truncated replay windows are available from `GET /api/metrics/ordered-events`.

Database transactions coordinate ordering across backend processes, but live
WebSocket rooms are still process-local. Multiple backend replicas therefore
require sticky routing for a room or a shared pub/sub fan-out layer. The event
journal prevents duplicate commits across replicas; by itself it does not
broadcast a live event between replicas.

The smoke suite exercises exact duplicate submission, four concurrent clients,
an isolated connection outage with replay, backend restart, and stale-base
delta resynchronization. Run it with `npm run test:e2e`.
