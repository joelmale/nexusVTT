import { BaseHandler } from './BaseHandler.js';
import { ServerEventMessage, Connection, Room } from '../../types.js';

/**
 * Real-time relay for scene-entity mutations: tokens, props, freehand drawings,
 * and remote cursors. These are the highest-frequency events in a session and
 * were left unwired when message routing moved to the SocketManager pattern
 * (the authoritative logic still lived in the now-dead `routeMessage`).
 *
 * Authority model: clients hold optimistic authority and apply changes locally
 * first; the server validates (host permissions + optimistic-concurrency
 * version checks), then relays the canonical event to the other peers. The
 * sender is never echoed its own event — it already applied it — and instead
 * receives a lightweight `update-confirmed` so its rollback timer can clear.
 */

/** Every entity event this handler relays. */
const RELAY_EVENTS = [
  'token/place',
  'token/move',
  'token/update',
  'token/delete',
  'token/add-custom',
  'prop/place',
  'prop/move',
  'prop/update',
  'prop/delete',
  'prop/interact',
  'drawing/create',
  'drawing/update',
  'drawing/delete',
  'drawing/clear',
  'cursor/update',
] as const;

/**
 * Events that participate in the optimistic-update lifecycle: they carry an
 * `expectedVersion` for conflict detection and an `updateId` to confirm.
 */
const VERSIONED_EVENTS = new Set<string>([
  'token/move',
  'token/update',
  'token/delete',
  'prop/move',
  'prop/update',
  'prop/delete',
  'prop/interact',
]);

/** Mutations only the host (or a co-host) may perform. */
const DM_ONLY_EVENTS = new Set<string>(['drawing/clear']);

/** Player mutations that are blocked while the host is disconnected. */
const DM_OFFLINE_RESTRICTED_EVENTS = new Set<string>([
  'drawing/create',
  'drawing/update',
  'drawing/delete',
  'token/place',
  'token/move',
  'token/update',
  'token/delete',
  'prop/place',
  'prop/move',
  'prop/update',
  'prop/delete',
  'prop/interact',
]);

/** Fire-and-forget events that must never wait on a confirmation. */
const UNCONFIRMED_EVENTS = new Set<string>(['cursor/update']);

interface VersionedPayload {
  tokenId?: string;
  propId?: string;
  expectedVersion?: number;
  updateId?: string;
}

export class EntitySyncHandler extends BaseHandler {
  setupListeners(): void {
    for (const eventName of RELAY_EVENTS) {
      this.socketManager.on(
        `event:${eventName}`,
        ({ connection, room, message }) =>
          this.handleEntityEvent(connection, room, message),
      );
    }
  }

  private handleEntityEvent(
    connection: Connection,
    room: Room,
    message: ServerEventMessage,
  ): void {
    const name = message.data.name;
    const isSenderHost =
      room.host === connection.id || room.coHosts.has(connection.id);

    // --- Authority: host-only mutations ---
    if (DM_ONLY_EVENTS.has(name) && !this.enforceHostOnly(connection, room, name)) {
      return;
    }

    // --- Authority: block player mutations while the DM is offline ---
    if (
      DM_OFFLINE_RESTRICTED_EVENTS.has(name) &&
      !isSenderHost &&
      !room.dmConnected
    ) {
      this.sendError(
        connection,
        'Host is offline; this action is temporarily restricted.',
        403,
      );
      return;
    }

    // --- Optimistic concurrency: reject stale updates, else bump the version ---
    if (VERSIONED_EVENTS.has(name)) {
      const { tokenId, propId, expectedVersion } = message.data as VersionedPayload;
      const entityId = tokenId ?? propId;
      if (entityId && typeof expectedVersion === 'number') {
        const currentVersion = room.entityVersions.get(entityId) ?? 0;
        if (expectedVersion < currentVersion) {
          console.warn(
            `⚠️ Version conflict for ${entityId}: expected ${expectedVersion}, current ${currentVersion}`,
          );
          this.sendError(
            connection,
            `Update rejected due to version conflict for ${entityId} (expected v${expectedVersion}, current v${currentVersion})`,
            409,
          );
          // No confirmation is sent, so the sender's rollback timer reverts it.
          return;
        }
        room.entityVersions.set(entityId, expectedVersion + 1);
      }
    }

    // --- Confirm the optimistic update so the sender doesn't roll back ---
    const { updateId } = message.data as VersionedPayload;
    if (updateId && !UNCONFIRMED_EVENTS.has(name)) {
      this.socketManager.sendMessage(connection, {
        type: 'update-confirmed',
        data: { updateId },
        timestamp: Date.now(),
      });
    }

    // --- Relay to peers, never echoing back to the sender ---
    const relayed: ServerEventMessage = {
      ...message,
      src: connection.id,
      timestamp: Date.now(),
    };

    if (message.dst) {
      // Targeted delivery (e.g. a whispered cursor); only if the recipient is
      // actually in this room.
      const target = this.socketManager.getConnection(message.dst);
      if (target && room.connections.has(message.dst)) {
        this.socketManager.sendMessage(target, relayed);
      }
      return;
    }

    this.socketManager.broadcastToRoom(room.code, relayed, connection.id);
  }
}
