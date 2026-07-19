import { isDurableTransportEvent } from '../../../shared/events/contracts.js';
import { BaseHandler } from './BaseHandler.js';
import { Connection, Room, ServerEventMessage } from '../../types.js';

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
  'fog/update',
  'fog/clear',
  'cursor/update',
] as const;

const VERSIONED_EVENTS = new Set<string>([
  'token/move',
  'token/update',
  'token/delete',
  'prop/move',
  'prop/update',
  'prop/delete',
  'prop/interact',
]);

const DM_ONLY_EVENTS = new Set<string>([
  'drawing/clear',
  'fog/update',
  'fog/clear',
]);

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

const UNCONFIRMED_EVENTS = new Set<string>(['cursor/update']);

interface VersionedPayload {
  tokenId?: string;
  propId?: string;
  expectedVersion?: number;
  updateId?: string;
}

/**
 * Validates and commits shared scene-entity mutations. Durable mutations go
 * through SocketManager's serialized journal before they are broadcast;
 * high-frequency presence signals such as cursors remain transient.
 */
export class EntitySyncHandler extends BaseHandler {
  setupListeners(): void {
    for (const eventName of RELAY_EVENTS) {
      this.socketManager.on(
        `event:${eventName}`,
        ({ connection, room, message }) =>
          void this.handleEntityEvent(connection, room, message),
      );
    }
  }

  private async handleEntityEvent(
    connection: Connection,
    room: Room,
    message: ServerEventMessage,
  ): Promise<void> {
    const name = message.data.name;
    const isSenderHost =
      room.host === connection.id || room.coHosts.has(connection.id);

    if (
      DM_ONLY_EVENTS.has(name) &&
      !this.enforceHostOnly(connection, room, name)
    ) {
      return;
    }

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

    const relayed: ServerEventMessage = {
      ...message,
      src: connection.id,
      timestamp: Date.now(),
    };

    if (message.dst) {
      const target = this.socketManager.getConnection(message.dst);
      if (target && room.connections.has(message.dst)) {
        this.socketManager.sendMessage(target, relayed);
      }
      return;
    }

    if (!isDurableTransportEvent(relayed.type, relayed.data)) {
      this.socketManager.broadcastToRoom(room.code, relayed, connection.id);
      return;
    }

    const payload = message.data as VersionedPayload;
    const entityId = payload.tokenId ?? payload.propId;
    const entityVersion =
      VERSIONED_EVENTS.has(name) &&
      entityId &&
      typeof payload.expectedVersion === 'number'
        ? { entityId, expectedVersion: payload.expectedVersion }
        : undefined;

    await this.socketManager.publishOrderedEvent(room, connection, relayed, {
      excludeId: connection.id,
      identitySource: message,
      entityVersion,
      onVersionConflict: (currentVersion) => {
        this.sendError(
          connection,
          `Update rejected due to version conflict for ${entityId} (expected v${payload.expectedVersion}, current v${currentVersion})`,
          409,
        );
      },
      onAccepted: () => {
        if (
          VERSIONED_EVENTS.has(name) &&
          entityId &&
          typeof payload.expectedVersion === 'number'
        ) {
          room.entityVersions.set(entityId, payload.expectedVersion + 1);
        }
      },
      onAcknowledged: () => {
        if (payload.updateId && !UNCONFIRMED_EVENTS.has(name)) {
          this.socketManager.sendMessage(connection, {
            type: 'update-confirmed',
            data: { updateId: payload.updateId },
            timestamp: Date.now(),
          });
        }
      },
    });
  }
}
