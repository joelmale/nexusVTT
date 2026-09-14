import { BaseHandler } from './BaseHandler.js';
import { ServerEventMessage, Connection, Room } from '../../types.js';

export class DocumentSyncHandler extends BaseHandler {
  setupListeners(): void {
    this.socketManager.on(
      'event:document/sync-session',
      ({ connection, room, message }) => {
        this.handleDocumentSyncSession(connection, room, message);
      },
    );
  }

  private handleDocumentSyncSession(
    connection: Connection,
    room: Room,
    message: ServerEventMessage,
  ): void {
    this.socketManager.broadcastToRoom(room.code, message, connection.id);
    console.log(`📚 Document sync session broadcast in ${room.code} from ${connection.id}`);
  }
}
