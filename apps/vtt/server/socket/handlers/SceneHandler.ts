import { BaseHandler } from './BaseHandler.js';
import { ServerEventMessage, Connection, Room } from '../../types.js';

/**
 * Relays scene lifecycle events. Scenes are authoritative, host-owned state, so
 * every mutation is host-only — a non-host attempting one is rejected (matching
 * EntitySyncHandler and the original routeMessage authority rules) rather than
 * silently broadcast.
 */
export class SceneHandler extends BaseHandler {
  setupListeners(): void {
    const sceneEvents = [
      'scene/create',
      'scene/update',
      'scene/delete',
      'scene/reorder',
      'scene/change',
      'camera/update',
    ];

    sceneEvents.forEach((event) => {
      this.socketManager.on(
        `event:${event}`,
        ({ connection, room, message }) => {
          void this.handleSceneEvent(event, connection, room, message);
        },
      );
    });
  }

  private async handleSceneEvent(
    event: string,
    connection: Connection,
    room: Room,
    message: ServerEventMessage,
  ): Promise<void> {
    if (!this.enforceHostOnly(connection, room, event)) return;

    if (event === 'camera/update') {
      // Keep camera events transient; do not add them to the durable journal.
      this.socketManager.broadcastToRoom(room.code, message, connection.id);
    } else {
      // Relay to the rest of the room; the sender already applied it optimistically.
      await this.socketManager.publishOrderedEvent(room, connection, message, {
        excludeId: connection.id,
      });
    }

    console.log(
      `🎬 Scene event "${event}" in ${room.code} from ${connection.id}`,
    );
  }
}
