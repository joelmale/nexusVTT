import { WebSocket } from 'ws';
import type { Connection, ServerMessage } from '../types.js';

/**
 * Sends a message to a specific connection.
 * Only sends if the WebSocket connection is open.
 */
export function sendMessage(
  connection: Connection,
  message: ServerMessage,
): void {
  if (connection.ws.readyState === WebSocket.OPEN) {
    connection.ws.send(JSON.stringify(message));
  }
}

/** Sends an error message to a connection. */
export function sendError(connection: Connection, error: string): void {
  sendMessage(connection, {
    type: 'error',
    data: { message: error },
    timestamp: Date.now(),
  });
}
