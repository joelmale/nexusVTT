import { EventEmitter } from 'events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket, type WebSocketServer } from 'ws';
import type { DatabaseService } from '../../../../server/database.js';
import { SocketManager } from '../../../../server/socket/SocketManager.js';
import type { Room } from '../../../../server/types.js';

class MockSocket extends EventEmitter {
  readyState = WebSocket.OPEN;
  readonly send = vi.fn();
  readonly close = vi.fn((_code?: number, _reason?: string) => {
    this.readyState = WebSocket.CLOSING;
  });
  readonly terminate = vi.fn(() => {
    this.readyState = WebSocket.CLOSED;
  });

  emitClose(code: number, reason: string): void {
    this.readyState = WebSocket.CLOSED;
    this.emit('close', code, Buffer.from(reason));
  }

  emitMessage(message: object): void {
    this.emit('message', Buffer.from(JSON.stringify(message)), false);
  }
}

const asWebSocket = (socket: MockSocket): WebSocket =>
  socket as unknown as WebSocket;

describe('SocketManager connection lifecycle', () => {
  const managers: SocketManager[] = [];

  afterEach(async () => {
    await Promise.all(managers.splice(0).map((manager) => manager.shutdown()));
  });

  it('keeps a replacement connected when its superseded socket closes', async () => {
    const manager = new SocketManager(
      {} as WebSocketServer,
      {} as DatabaseService,
    );
    managers.push(manager);
    const participantId = '11111111-1111-4111-8111-111111111111';
    const firstInstanceId = '22222222-2222-4222-8222-222222222222';
    const secondInstanceId = '33333333-3333-4333-8333-333333333333';
    const firstSocket = new MockSocket();
    const secondSocket = new MockSocket();
    const firstConnection = manager.addConnection(
      asWebSocket(firstSocket),
      'Player',
      participantId,
      firstInstanceId,
      'connect',
    );
    firstConnection.room = 'ROOM';
    const room: Room = {
      code: 'ROOM',
      host: 'host-id',
      coHosts: new Set(),
      players: new Set([participantId]),
      connections: new Map([[participantId, asWebSocket(firstSocket)]]),
      created: Date.now(),
      lastActivity: Date.now(),
      status: 'active',
      dmConnected: true,
      stateVersion: 0,
      entityVersions: new Map(),
      syncToken: null,
    };
    manager.rooms.set(room.code, room);
    const disconnectListener = vi.fn();
    manager.on('disconnect', disconnectListener);

    const replacement = manager.addConnection(
      asWebSocket(secondSocket),
      'Player',
      participantId,
      secondInstanceId,
      'manual-button',
    );
    replacement.room = room.code;
    room.connections.set(participantId, replacement.ws);

    firstSocket.emitClose(4000, 'Superseded by newer connection');
    await Promise.resolve();

    expect(firstSocket.close).toHaveBeenCalledWith(
      4000,
      'Superseded by newer connection',
    );
    expect(manager.connections.get(participantId)).toBe(replacement);
    expect(room.connections.get(participantId)).toBe(replacement.ws);
    expect(disconnectListener).not.toHaveBeenCalled();
  });

  it('returns a pong for a client RTT ping', () => {
    const manager = new SocketManager(
      {} as WebSocketServer,
      {} as DatabaseService,
    );
    managers.push(manager);
    const socket = new MockSocket();
    manager.addConnection(
      asWebSocket(socket),
      'Player',
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      'connect',
    );

    socket.emitMessage({
      type: 'heartbeat',
      data: { type: 'ping', id: 'ping-1' },
      timestamp: Date.now(),
    });

    const pong = JSON.parse(String(socket.send.mock.calls[0]?.[0]));
    expect(pong).toMatchObject({
      type: 'heartbeat',
      data: { type: 'pong', id: 'ping-1' },
    });
  });
});
