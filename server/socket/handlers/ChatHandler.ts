import { BaseHandler } from './BaseHandler.js';
import { ServerChatMessage, Connection, Room } from '../../types.js';

export class ChatHandler extends BaseHandler {
  setupListeners(): void {
    this.socketManager.on('chat-message', ({ connection, room, message }) => {
      this.handleChatMessage(connection, room, message);
    });
  }

  private handleChatMessage(connection: Connection, room: Room, message: ServerChatMessage) {
    // Broadcast to everyone in the room
    this.socketManager.broadcastToRoom(room.code, message);
    console.log(`💬 Chat in ${room.code} from ${connection.id}: ${message.data.content}`);
  }
}
