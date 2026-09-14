# WebSocket protocol

The VTT WebSocket carries transient presence, durable ordered room events, and
canonical game-state synchronization. These paths have different guarantees;
an event broadcast is not automatically a durable state commit.

## Envelope and encoding

Messages use `TransportEnvelope` from `shared/transport.ts`:

```typescript
interface TransportEnvelope {
  type: string;
  data: unknown;
  timestamp: number;
  src?: string;
  dst?: string;
  eventId?: string;
  actorId?: string;
  clientSequence?: number;
  serverSequence?: number;
  occurredAt?: number;
  roomCode?: string;
  echoToActor?: boolean;
}
```

Application events use `type: "event"` and put the event name in
`data.name`; payload fields are flattened beside it. `webSocketService.sendEvent`
performs that conversion from the client `GameEvent` shape. The connection uses
JSON unless `USE_MESSAGEPACK=true`.

Durable clients attach `eventId`, `actorId`, `clientSequence`, and `occurredAt`.
The server transaction assigns a room-global `serverSequence`, sends an
`event-ack`, and publishes the stored envelope. Reusing an event ID returns the
original acknowledgement without broadcasting a duplicate. `event-cursor`
establishes a baseline or resume window during reconnect.

`src/types/events.ts` defines the small DOM `WebSocketCustomEvent` bridge. The
wire unions live in `src/types/game.ts`, `server/types.ts`, and the shared
contracts; do not treat the DOM bridge as the protocol catalogue.

## Handler catalogue

The following names are registered by the eight handlers under
`server/socket/handlers/`.

| Handler               | Incoming name/type                                         | Payload summary                                  | Authority and delivery                                          |
| --------------------- | ---------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------- |
| `SceneHandler`        | `scene/create`                                             | `scene`                                          | host/co-host; ordered; excludes sender                          |
|                       | `scene/update`                                             | `sceneId`, `updates`                             | host/co-host; ordered; excludes sender                          |
|                       | `scene/delete`                                             | `sceneId`                                        | host/co-host; ordered; excludes sender                          |
|                       | `scene/reorder`                                            | producer-defined                                 | host/co-host; ordered; no normal UI producer/consumer currently |
|                       | `scene/change`                                             | `sceneId`                                        | host/co-host; ordered; excludes sender                          |
|                       | `camera/update`                                            | `sceneId`, partial `camera`                      | host/co-host; transient; excludes sender                        |
| `EntitySyncHandler`   | `token/place`, `token/add-custom`                          | `sceneId` + token, or token asset                | ordered; placement/addition unversioned                         |
|                       | `token/move`, `token/update`, `token/delete`               | entity ID, mutation, optional version/update ID  | ordered; SQL entity CAS when `expectedVersion` is supplied      |
|                       | `prop/place`                                               | `sceneId`, `prop`                                | ordered; unversioned                                            |
|                       | `prop/move`, `prop/update`, `prop/delete`, `prop/interact` | entity ID and mutation/action                    | ordered; SQL entity CAS when version supplied                   |
|                       | `drawing/create`, `drawing/update`, `drawing/delete`       | scene/drawing IDs and record or updates          | ordered; players blocked while host is offline                  |
|                       | `drawing/clear`                                            | `sceneId`, optional `layer`                      | host/co-host; ordered                                           |
|                       | `fog/update`, `fog/clear`                                  | complete fog state, or `sceneId`                 | host/co-host; ordered; unversioned                              |
|                       | `cursor/update`                                            | user, scene, world position                      | transient; excludes sender                                      |
| `DiceHandler`         | `dice/roll-request`                                        | expression, private/advantage/disadvantage flags | server rolls; ordered `dice/roll-result` echoes to everyone     |
| `ChatHandler`         | outer type `chat-message`                                  | full client chat record                          | ordered; echoes to sender and peers                             |
| `CharacterHandler`    | `character/create`, `update`, `delete`, `sync`, `roll`     | not narrowed by server types                     | ordered; excludes sender; no current normal client producer     |
| `CombatHandler`       | `combat/add-character`, `combat/sync-hp`                   | stat snapshot or HP update                       | ordered; excludes sender; see authorization caveat below        |
| `DocumentSyncHandler` | `document/sync-session`                                    | document/session/presenter IDs                   | transient; excludes sender                                      |
| `HostHandler`         | `session/kickPlayer`                                       | `targetUserId`                                   | host/co-host side effect; transient notifications               |
|                       | `host/add-cohost`, `host/remove-cohost`                    | `targetUserId`                                   | primary host only; role is persisted before broadcast           |

Host-only enforcement counts repeated violations for handlers using
`enforceHostOnly` and terminates the socket after three attempts. Entity move,
update, delete, and interaction conflicts return an `error` with code 409.
Successful optimistic mutations can also receive `update-confirmed` after the
ordered transaction commits.

## Canonical game-state protocol

`game-state-update` is registered in `server/index.ts`, outside the eight
handlers, because it owns the PostgreSQL durability boundary. Only a host or
co-host may upload. The payload is either a legacy full snapshot or a tagged
full/patch upload:

- full: complete `SyncableGameState` plus its SHA-256 token;
- patch: RFC 6902 operations plus base and new tokens.

The server validates the hash chain and calls
`SessionRepository.commitGameState` with compare-and-swap on both the observed
token and version. Only after that transaction commits does it send
`game-state-ack` to the sender and `game-state-patch` to peers. A conflict or
invalid chain produces `game-state-resync-required` with the full committed
snapshot, token, version, and reason.

`SyncableGameState` contains scenes, active scene ID, characters, and
initiative. Redis distributes ordered events, transient fanout, presence, and
host leases across replicas; it is not the durable authority.

## Known contract gaps

- `host/transfer` exists in client types and actions but `HostHandler` does not
  register it.
- `camera/move` exists in the TypeScript event union, while the implemented
  realtime name is `camera/update`.
- `scene/reorder` is accepted by the server but is absent from the main incoming
  `eventHandlers` registry and is not emitted by `reorderScenes`.
- Character events are relayed without server-side owner validation.
- Combat authorization checks top-level `type` and `ownerId`, but current
  producers send `entry.type` and omit `ownerId`.
- A `dst` on an entity event takes the direct-send branch and bypasses the
  ordered journal; do not use directed delivery for durable mutations.

## Adding or changing an event

Update the shared/client payload type, client producer, server registration and
authorization, durability classification, receiving store handler, and tests
together. Durable entity changes must commit before acknowledgement and must
not replace the SQL version check with the room's in-memory cache.

Relevant tests and references are in
`tests/unit/server/socket/SocketManager.ordered-events.test.ts`,
`tests/unit/server/socket/EntitySyncHandler.test.ts`,
`tests/integration/database.test.ts`, `docs/ordered-event-delivery.md`, and
`docs/delta-sync-rollout.md`.
