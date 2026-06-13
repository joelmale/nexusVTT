import { BaseHandler } from './BaseHandler.js';
import { ServerEventMessage, Connection, Room } from '../../types.js';

export class DiceHandler extends BaseHandler {
  setupListeners(): void {
    this.socketManager.on('event:dice/roll-request', ({ connection, room, message }) => {
      this.handleDiceRollRequest(connection, room, message);
    });
  }

  private async handleDiceRollRequest(connection: Connection, room: Room, _message: ServerEventMessage) {
    // This would call the dice roller service
    console.log(`🎲 Dice roll request in ${room.code} from ${connection.id}`);
    // Logic from index.ts would go here
  }
}
