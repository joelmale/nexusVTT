import { BaseHandler } from './BaseHandler.js';
import { Connection, Room, ServerEventMessage } from '../../types.js';
import {
  isAddressedPlayerIntentResult,
  isPlayerIntentMessage,
  PLAYER_INTENT_EVENT,
  PLAYER_INTENT_RESULT_EVENT,
  type PlayerIntentRejectReason,
} from '../../../shared/events/playerIntent.js';

/**
 * Routes Simple Player Mode intents between a player and the host.
 *
 * Intents are transient: they are never journaled and never touch canonical
 * state here. The host applies an accepted intent with its own store actions,
 * and its normal game-state publish is the durable record. Ownership is checked
 * on the host, which holds the authoritative character data.
 *
 * Delivery uses room fanout rather than a direct send so it works when the
 * player and host are connected to different backend replicas; clients ignore
 * intents (non-hosts) and results (anyone but the addressed player).
 */
export class PlayerIntentHandler extends BaseHandler {
  setupListeners(): void {
    this.socketManager.on(
      `event:${PLAYER_INTENT_EVENT}`,
      ({ connection, room, message }) =>
        this.handleIntent(connection, room, message),
    );
    this.socketManager.on(
      `event:${PLAYER_INTENT_RESULT_EVENT}`,
      ({ connection, room, message }) =>
        this.handleResult(connection, room, message),
    );
  }

  private handleIntent(
    connection: Connection,
    room: Room,
    message: ServerEventMessage,
  ): void {
    const data: unknown = message.data;
    if (!isPlayerIntentMessage(data)) {
      const intentId =
        typeof (data as { intentId?: unknown })?.intentId === 'string'
          ? (data as { intentId: string }).intentId
          : '';
      this.reject(connection, intentId, 'invalid');
      return;
    }

    if (!room.dmConnected) {
      this.reject(connection, data.intentId, 'host-offline');
      return;
    }

    this.socketManager.broadcastToRoom(
      room.code,
      {
        type: 'event',
        data: {
          name: PLAYER_INTENT_EVENT,
          intentId: data.intentId,
          intent: data.intent,
          fromUserId: connection.id,
          fromUserName: connection.user?.name || 'Player',
        },
        src: connection.id,
        timestamp: Date.now(),
      },
      connection.id,
    );
  }

  private handleResult(
    connection: Connection,
    room: Room,
    message: ServerEventMessage,
  ): void {
    if (!this.enforceHostOnly(connection, room, PLAYER_INTENT_RESULT_EVENT)) {
      return;
    }
    const data: unknown = message.data;
    if (!isAddressedPlayerIntentResult(data)) {
      this.sendError(connection, 'Invalid player intent result');
      return;
    }

    this.socketManager.broadcastToRoom(
      room.code,
      {
        type: 'event',
        data: {
          name: PLAYER_INTENT_RESULT_EVENT,
          intentId: data.intentId,
          targetUserId: data.targetUserId,
          status: data.status,
          ...(data.reason ? { reason: data.reason } : {}),
        },
        src: connection.id,
        timestamp: Date.now(),
      },
      connection.id,
    );
  }

  private reject(
    connection: Connection,
    intentId: string,
    reason: PlayerIntentRejectReason,
  ): void {
    this.socketManager.sendMessage(connection, {
      type: 'event',
      data: {
        name: PLAYER_INTENT_RESULT_EVENT,
        intentId,
        targetUserId: connection.id,
        status: 'rejected',
        reason,
      },
      timestamp: Date.now(),
    });
  }
}
