import { BaseHandler } from './BaseHandler.js';
import { ServerEventMessage, Connection, Room } from '../../types.js';

export class CombatHandler extends BaseHandler {
  setupListeners(): void {
    const combatEvents = ['combat/add-character', 'combat/sync-hp'];

    combatEvents.forEach((event) => {
      this.socketManager.on(
        `event:${event}`,
        ({ connection, room, message }) => {
          void this.handleCombatEvent(event, connection, room, message);
        },
      );
    });
  }

  private async handleCombatEvent(
    event: string,
    connection: Connection,
    room: Room,
    message: ServerEventMessage,
  ): Promise<void> {
    if (event === 'combat/add-character') {
      const data = message.data as Record<string, unknown>;
      const isHost = this.isHost(connection, room);
      // NPC additions are only allowed from host/co-host
      if (data.type === 'npc' && !isHost) {
        this.sendError(connection, 'Access denied: Host privilege required to add NPCs.', 403);
        return;
      }
      // PC additions are allowed from host, co-host, or the character's owner
      if (data.type === 'player' && !isHost && data.ownerId !== connection.id) {
        this.sendError(connection, 'Access denied: You can only add your own characters to combat.', 403);
        return;
      }
    } else if (event === 'combat/sync-hp') {
      const data = message.data as Record<string, unknown>;
      const isHost = this.isHost(connection, room);
      // HP changes allowed from host/co-host, or from owner of the character
      if (!isHost && data.ownerId !== connection.id) {
        this.sendError(connection, 'Access denied: You can only change HP for your own characters.', 403);
        return;
      }
    }

    // Both events should be relayed durably
    await this.socketManager.publishOrderedEvent(room, connection, message, {
      excludeId: connection.id,
    });
    console.log(
      `⚔️ Combat event "${event}" in ${room.code} from ${connection.id}`,
    );
  }
}
