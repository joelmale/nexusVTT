import { EventEmitter } from 'events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket, type WebSocketServer } from 'ws';
import type { DatabaseService } from '../../../../server/database.js';
import { SocketManager } from '../../../../server/socket/SocketManager.js';
import type { Connection, Room, ServerMessage } from '../../../../server/types.js';

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

function room(code: string, host: string, connections: Connection[]): Room {
  return {
    code,
    host,
    coHosts: new Set(),
    players: new Set(connections.map((connection) => connection.id)),
    connections: new Map(connections.map((connection) => [connection.id, connection.ws])),
    created: Date.now(), lastActivity: Date.now(), status: 'active', dmConnected: true,
    stateVersion: 0, entityVersions: new Map(), syncToken: null,
  };
}

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

  it('broadcasts only to open peer sockets and records distributed room state', async () => {
    const manager = new SocketManager({} as WebSocketServer, {} as DatabaseService);
    managers.push(manager);
    const source = manager.addConnection(asWebSocket(new MockSocket()), 'Host');
    const peerSocket = new MockSocket();
    const peer = manager.addConnection(asWebSocket(peerSocket), 'Peer');
    const closedSocket = new MockSocket(); closedSocket.readyState = WebSocket.CLOSED;
    const closed = manager.addConnection(asWebSocket(closedSocket), 'Closed');
    const activeRoom = room('ROOM', source.id, [source, peer, closed]);
    manager.createRoom(activeRoom.code, activeRoom);

    manager.broadcastToRoom('ROOM', { type: 'chat-message', data: { text: 'hello' }, timestamp: 1 } as ServerMessage, source.id);
    await Promise.resolve();
    expect(peerSocket.send).toHaveBeenCalledTimes(1);
    expect(closedSocket.send).not.toHaveBeenCalled();
    await expect(manager.registerDistributedConnection(activeRoom, source, 'host', 4)).resolves.toBe(true);
    await manager.updateDistributedRole('ROOM', source.id, 'cohost');
    await manager.unregisterDistributedConnection('ROOM', source.id);
    manager.removeRoom('ROOM');
    expect(manager.getRoom('ROOM')).toBeUndefined();
  });

  it('delivers replay cursors and tracks entity versions from ordered events', () => {
    const manager = new SocketManager({} as WebSocketServer, {} as DatabaseService);
    managers.push(manager);
    const socket = new MockSocket();
    const connection = manager.addConnection(asWebSocket(socket), 'Host');
    connection.room = 'ROOM';
    const activeRoom = room('ROOM', connection.id, [connection]);
    manager.createRoom('ROOM', activeRoom);
    manager.deliverRoomReplay(connection, {
      baselineSequence: 2, latestSequence: 3, truncated: true,
      events: [{ type: 'event', data: { name: 'token/update', tokenId: 'token-1', expectedVersion: 2 }, timestamp: 1, eventId: '11111111-1111-4111-8111-111111111111', actorId: connection.id, clientSequence: 1, occurredAt: 1, roomCode: 'ROOM', serverSequence: 3, echoToActor: false }],
    }, 1);
    const internal = manager as unknown as { applyOrderedRoomMutation(event: { type: 'event'; roomCode: string; data: Record<string, unknown> }): void };
    internal.applyOrderedRoomMutation({ type: 'event', roomCode: 'ROOM', data: { name: 'token/update', tokenId: 'token-1', expectedVersion: 2 } });
    expect(activeRoom.entityVersions.get('token-1')).toBe(3);
    expect(JSON.parse(String(socket.send.mock.calls[0][0]))).toMatchObject({ type: 'event-cursor', data: { mode: 'baseline' } });
    expect(manager.getStats().orderedEvents).toMatchObject({ replayRequests: 1, replayed: 1, truncatedReplays: 1 });
  });

  it('repairs remote game-state patches from the committed session when the base token differs', async () => {
    const state = { scenes: [], activeSceneId: null };
    const database = { getSessionByJoinCode: vi.fn(async () => ({ gameState: state, stateVersion: 7 })) } as unknown as DatabaseService;
    const manager = new SocketManager({} as WebSocketServer, database);
    managers.push(manager);
    const activeRoom = room('ROOM', 'host', []); activeRoom.gameState = { scenes: [] }; activeRoom.syncToken = 'stale'; activeRoom.stateVersion = 1;
    manager.createRoom('ROOM', activeRoom);
    const internal = manager as unknown as { applyRemoteRoomMutation(roomCode: string, message: ServerMessage): Promise<ServerMessage> };
    const resolved = await internal.applyRemoteRoomMutation('ROOM', { type: 'game-state-patch', data: { baseToken: 'wrong', newToken: 'unused', patch: [], version: 2 }, timestamp: 1 } as ServerMessage);
    expect(resolved).toMatchObject({ type: 'game-state-resync-required', data: { gameState: state, version: 7, reason: 'base-mismatch' } });
    expect(activeRoom.stateVersion).toBe(7);
  });

  it('grades missed pongs and ignores acknowledgements from the wrong socket instance', () => {
    const manager = new SocketManager({} as WebSocketServer, {} as DatabaseService);
    managers.push(manager);
    const socket = new MockSocket();
    const connection = manager.addConnection(asWebSocket(socket), 'Player', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222');
    const internal = manager as unknown as { handleMissedPong(id: string): void; handleHeartbeatPong(id: string, instanceId: string, pingId: string): void };
    internal.handleMissedPong(connection.id); expect(connection.connectionQuality).toBe('good');
    internal.handleMissedPong(connection.id); expect(connection.connectionQuality).toBe('poor');
    connection.pendingPing = 'expected'; connection.lastPing = Date.now();
    internal.handleHeartbeatPong(connection.id, 'wrong-instance', 'expected');
    expect(connection.pendingPing).toBe('expected');
    internal.handleHeartbeatPong(connection.id, connection.instanceId, 'expected');
    expect(connection.pendingPing).toBeUndefined(); expect(connection.consecutiveMisses).toBe(0);
  });
});
