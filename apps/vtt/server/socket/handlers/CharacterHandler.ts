import { BaseHandler } from './BaseHandler.js';
import { ServerEventMessage, Connection, Room } from '../../types.js';

export class CharacterHandler extends BaseHandler {
  setupListeners(): void {
    const characterEvents = [
      'character/create',
      'character/update',
      'character/delete',
      'character/sync',
      'character/roll',
    ];

    characterEvents.forEach((event) => {
      this.socketManager.on(
        `event:${event}`,
        ({ connection, room, message }) => {
          void this.handleCharacterEvent(event, connection, room, message);
        },
      );
    });
  }

  private async handleCharacterEvent(
    event: string,
    connection: Connection,
    room: Room,
    message: ServerEventMessage,
  ): Promise<void> {
    // Characters are owned by players, so anyone can send character updates.
    // In a fully secure model, we would verify `message.payload.ownerId === connection.userId`.

    // Relay to the rest of the room
    await this.socketManager.publishOrderedEvent(room, connection, message, {
      excludeId: connection.id,
    });
    console.log(
      `🛡️ Character event "${event}" in ${room.code} from ${connection.id}`,
    );
  }
}
