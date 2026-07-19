import { BaseHandler } from './BaseHandler.js';
import { ServerEventMessage, Connection, Room } from '../../types.js';

/**
 * Handles host-management actions: kicking players and granting/revoking
 * co-host ("DM") privileges. Follows the SocketManager event-relay pattern used
 * by the other live handlers, but with real side effects (mutating room state
 * and closing the kicked player's socket) rather than a plain rebroadcast.
 */
export class HostHandler extends BaseHandler {
  setupListeners(): void {
    this.socketManager.on(
      'event:session/kickPlayer',
      ({ connection, room, message }) =>
        this.handleKickPlayer(connection, room, message),
    );

    this.socketManager.on(
      'event:host/add-cohost',
      ({ connection, room, message }) =>
        this.handleAddCoHost(connection, room, message),
    );

    this.socketManager.on(
      'event:host/remove-cohost',
      ({ connection, room, message }) =>
        this.handleRemoveCoHost(connection, room, message),
    );
  }

  private isPrimaryHost(connection: Connection, room: Room): boolean {
    return room.host === connection.id;
  }

  private getTargetUserId(message: ServerEventMessage): string | null {
    const target = message.data.targetUserId;
    return typeof target === 'string' && target.length > 0 ? target : null;
  }

  private handleAddCoHost(
    connection: Connection,
    room: Room,
    message: ServerEventMessage,
  ): void {
    if (!this.isPrimaryHost(connection, room)) {
      this.sendError(connection, 'Only the host can grant DM privileges', 403);
      return;
    }
    const targetUserId = this.getTargetUserId(message);
    if (!targetUserId || !room.players.has(targetUserId)) {
      this.sendError(connection, 'Invalid target user for co-host addition', 403);
      return;
    }
    if (targetUserId === room.host || room.coHosts.has(targetUserId)) {
      return; // Already a host/co-host; nothing to do.
    }

    room.coHosts.add(targetUserId);
    const targetConn = this.socketManager.getConnection(targetUserId);
    if (targetConn?.user) {
      targetConn.user.type = 'host';
    }
    void this.socketManager.updateDistributedRole(
      room.code,
      targetUserId,
      'cohost',
    ).catch((error: unknown) => {
      console.error('Failed to update distributed co-host presence:', error);
    });

    console.log(`👥 Co-host added in room ${room.code}: ${targetUserId}`);
    this.socketManager.broadcastToRoom(room.code, {
      type: 'event',
      data: {
        name: 'session/cohost-added',
        coHostId: targetUserId,
        message: 'A new co-host has been added to the session.',
      },
      timestamp: Date.now(),
    });
  }

  private handleRemoveCoHost(
    connection: Connection,
    room: Room,
    message: ServerEventMessage,
  ): void {
    if (!this.isPrimaryHost(connection, room)) {
      this.sendError(connection, 'Only the host can revoke DM privileges', 403);
      return;
    }
    const targetUserId = this.getTargetUserId(message);
    if (!targetUserId || !room.coHosts.has(targetUserId)) {
      this.sendError(connection, 'Invalid target user for co-host removal', 403);
      return;
    }

    room.coHosts.delete(targetUserId);
    const targetConn = this.socketManager.getConnection(targetUserId);
    if (targetConn?.user) {
      targetConn.user.type = 'player';
    }
    void this.socketManager.updateDistributedRole(
      room.code,
      targetUserId,
      'player',
    ).catch((error: unknown) => {
      console.error('Failed to update distributed player presence:', error);
    });

    console.log(`👥 Co-host removed in room ${room.code}: ${targetUserId}`);
    this.socketManager.broadcastToRoom(room.code, {
      type: 'event',
      data: {
        name: 'session/cohost-removed',
        coHostId: targetUserId,
        message: 'A co-host has been removed from the session.',
      },
      timestamp: Date.now(),
    });
  }

  private handleKickPlayer(
    connection: Connection,
    room: Room,
    message: ServerEventMessage,
  ): void {
    if (!this.isHost(connection, room)) {
      this.sendError(connection, 'Host privileges required to kick players', 403);
      return;
    }
    const targetUserId = this.getTargetUserId(message);
    if (!targetUserId || !room.players.has(targetUserId)) {
      this.sendError(connection, 'Invalid target user for kick', 403);
      return;
    }
    if (targetUserId === room.host) {
      this.sendError(connection, 'The host cannot be kicked', 403);
      return;
    }
    if (targetUserId === connection.id) {
      this.sendError(connection, 'You cannot kick yourself', 403);
      return;
    }

    const targetConn = this.socketManager.getConnection(targetUserId);

    // Tell the kicked player directly so their client can leave gracefully.
    if (targetConn) {
      this.socketManager.sendMessage(targetConn, {
        type: 'event',
        data: {
          name: 'session/kicked',
          message: 'You have been removed from the game by the host.',
        },
        timestamp: Date.now(),
      });
    }

    // Remove from room state before broadcasting so the leave reflects reality.
    room.players.delete(targetUserId);
    room.coHosts.delete(targetUserId);
    room.connections.delete(targetUserId);
    room.lastActivity = Date.now();
    this.socketManager.connections.delete(targetUserId);
    void this.socketManager.unregisterDistributedConnection(
      room.code,
      targetUserId,
    ).catch((error: unknown) => {
      console.error('Failed to clear kicked player presence:', error);
    });

    console.log(`🚪 Player kicked from room ${room.code}: ${targetUserId}`);
    this.socketManager.broadcastToRoom(room.code, {
      type: 'event',
      data: { name: 'session/leave', uuid: targetUserId },
      timestamp: Date.now(),
    });

    // Close the kicked player's socket with a normal-closure code so their
    // client does not attempt to auto-reconnect.
    if (targetConn) {
      try {
        targetConn.ws.close(1000, 'Kicked by host');
      } catch (error) {
        console.error(`Failed to close kicked player socket:`, error);
      }
    }
  }
}
