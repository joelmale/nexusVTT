import { SocketManager } from '../SocketManager.js';
import { DatabaseService } from '../../database.js';
import { Connection, Room } from '../../types.js';

export abstract class BaseHandler {
  constructor(
    protected socketManager: SocketManager,
    protected db: DatabaseService,
  ) {
    this.setupListeners();
  }

  abstract setupListeners(): void;

  /** Send a typed error message to a single connection. */
  protected sendError(
    connection: Connection,
    message: string,
    code = 400,
  ): void {
    this.socketManager.sendMessage(connection, {
      type: 'error',
      data: { message, code },
      timestamp: Date.now(),
    });
  }

  /** True when the connection is the room's host or a co-host. */
  protected isHost(connection: Connection, room: Room): boolean {
    return room.host === connection.id || room.coHosts.has(connection.id);
  }

  /**
   * Guard a host-only action. Returns true when allowed; otherwise sends a 403,
   * increments the anti-tamper counter, terminates after repeated violations,
   * and returns false so the caller can bail out.
   */
  protected enforceHostOnly(
    connection: Connection,
    room: Room,
    eventName: string,
  ): boolean {
    if (this.isHost(connection, room)) return true;

    connection.maliciousAttemptsCount =
      (connection.maliciousAttemptsCount || 0) + 1;
    console.warn(
      `⚠️ Unauthorized host-only action "${eventName}" from ${connection.id} in ${room.code} (attempt ${connection.maliciousAttemptsCount}/3)`,
    );
    this.sendError(connection, 'Access denied: Host privilege required.', 403);
    if (connection.maliciousAttemptsCount >= 3) {
      connection.ws.terminate();
    }
    return false;
  }
}
