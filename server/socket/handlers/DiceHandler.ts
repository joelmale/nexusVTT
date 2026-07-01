import { BaseHandler } from './BaseHandler.js';
import { ServerEventMessage, Connection, Room } from '../../types.js';
import {
  createServerDiceRoll,
  validateDiceRollRequest,
  DiceRollRequest,
} from '../../diceRoller.js';

/**
 * Server-authoritative dice rolling. Unlike token/prop moves (which the client
 * applies optimistically), dice are rolled on the server so no client can forge
 * a result — the request carries only the expression. The canonical roll is
 * broadcast to the whole room, including the requester, so everyone sees the
 * same numbers.
 */
export class DiceHandler extends BaseHandler {
  setupListeners(): void {
    this.socketManager.on(
      'event:dice/roll-request',
      ({ connection, room, message }) => {
        this.handleDiceRollRequest(connection, room, message);
      },
    );
  }

  private handleDiceRollRequest(
    connection: Connection,
    room: Room,
    message: ServerEventMessage,
  ): void {
    const request = message.data as unknown as DiceRollRequest;

    const validation = validateDiceRollRequest(request);
    if (!validation.valid) {
      this.sendError(connection, validation.error || 'Invalid dice roll request');
      return;
    }

    const userName = connection.user?.name || 'Unknown Player';
    const isHost = connection.user?.type === 'host';

    const roll = createServerDiceRoll(
      request.expression,
      connection.id,
      userName,
      {
        // Private rolls are a host-only privilege.
        isPrivate: isHost && request.isPrivate,
        advantage: request.advantage,
        disadvantage: request.disadvantage,
      },
    );

    if (!roll) {
      this.sendError(connection, 'Failed to create dice roll');
      return;
    }

    console.log(
      `🎲 Dice roll "${roll.expression}" = ${roll.total} in ${room.code} from ${connection.id}`,
    );

    // Broadcast to the whole room (the roller sees the authoritative result too).
    this.socketManager.broadcastToRoom(room.code, {
      type: 'event',
      data: { name: 'dice/roll-result', roll },
      src: connection.id,
      timestamp: Date.now(),
    });
  }
}
