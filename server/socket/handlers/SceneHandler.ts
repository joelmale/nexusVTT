import { BaseHandler } from './BaseHandler.js';
import { ServerEventMessage, Connection, Room } from '../../types.js';

export class SceneHandler extends BaseHandler {
  setupListeners(): void {
    const sceneEvents = [
      'scene/create',
      'scene/update',
      'scene/delete',
      'scene/reorder',
      'scene/change',
    ];

    sceneEvents.forEach(event => {
      this.socketManager.on(`event:${event}`, ({ connection, room, message }) => {
        this.handleSceneEvent(event, connection, room, message);
      });
    });
  }

  private handleSceneEvent(event: string, connection: Connection, room: Room, message: ServerEventMessage) {
    // Logic from index.ts would go here
    // For now, just broadcast to others
    this.socketManager.broadcastToRoom(room.code, message, connection.id);
    console.log(`🎬 Scene event "${event}" in ${room.code} from ${connection.id}`);
  }
}
