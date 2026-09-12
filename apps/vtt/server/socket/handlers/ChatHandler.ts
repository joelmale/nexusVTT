import { BaseHandler } from './BaseHandler.js';
import { ServerChatMessage, Connection, Room } from '../../types.js';

export class ChatHandler extends BaseHandler {
  setupListeners(): void {
    this.socketManager.on('chat-message', ({ connection, room, message }) => {
      void this.handleChatMessage(connection, room, message);
    });
  }

  private async handleChatMessage(
    connection: Connection,
    room: Room,
    message: ServerChatMessage,
  ): Promise<void> {
    await this.socketManager.publishOrderedEvent(room, connection, message, {
      senderReceivesEvent: true,
    });
    console.log(
      `💬 Chat in ${room.code} from ${connection.id}: ${message.data.content}`,
    );
  }
}
