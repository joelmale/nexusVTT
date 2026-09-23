import { describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';

import type { DatabaseService } from '../../../../server/database.js';
import { createDeltaSyncMetrics } from '../../../../server/observability/deltaSyncMetrics.js';
import { GameStateCommitService } from '../../../../server/socket/GameStateCommitService.js';
import type { SocketManager } from '../../../../server/socket/SocketManager.js';
import type { Connection, Room, ServerMessage } from '../../../../server/types.js';
import {
  createEmptySyncableGameState,
  type JsonPatch,
  type JsonValue,
  type StateHash,
  type SyncableGameState,
} from '../../../../shared/sync/contracts.js';
import { hashSync } from '../../../../shared/sync/hashSync.js';

class MockSocket {
  readyState = WebSocket.OPEN;
  readonly send = vi.fn();
  readonly close = vi.fn();
}

const asStateHash = (value: string): StateHash => value as StateHash;

const parseMessages = (socket: MockSocket): ServerMessage[] =>
  socket.send.mock.calls.map(([message]) =>
    JSON.parse(String(message)),
  ) as ServerMessage[];

const flushQueue = async (service: GameStateCommitService): Promise<void> => {
  for (let attempt = 0; attempt < 20 && service.queueDepth > 0; attempt += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  expect(service.queueDepth).toBe(0);
};

function createConnection(id = 'sender-id'): {
  connection: Connection;
  socket: MockSocket;
} {
  const socket = new MockSocket();
  return {
    socket,
    connection: {
      id,
      instanceId: `${id}-instance`,
      ws: socket as unknown as WebSocket,
      room: 'ROOM',
      user: { name: 'Sender', type: 'host' },
      consecutiveMisses: 0,
      connectionQuality: 'excellent',
    },
  };
}

function createRoom(
  overrides: Partial<Pick<Room, 'gameState' | 'stateVersion' | 'syncToken'>> = {},
): Room {
  const state = createEmptySyncableGameState();
  return {
    code: 'ROOM',
    host: 'sender-id',
    coHosts: new Set(),
    players: new Set(['sender-id']),
    connections: new Map(),
    created: Date.now(),
    lastActivity: Date.now(),
    status: 'active',
    dmConnected: true,
    gameState: state,
    stateVersion: 0,
    entityVersions: new Map(),
    syncToken: hashSync(state as unknown as JsonValue),
    ...overrides,
  };
}

function createHarness(room = createRoom()): {
  db: Pick<DatabaseService, 'commitGameState' | 'repairGameStateMetadata'>;
  service: GameStateCommitService;
  socketManager: Pick<SocketManager, 'rooms' | 'broadcastToRoom'>;
} {
  const socketManager = {
    rooms: new Map([[room.code, room]]),
    broadcastToRoom: vi.fn(),
  };
  const db = {
    commitGameState: vi.fn(),
    repairGameStateMetadata: vi.fn(),
  };
  const service = new GameStateCommitService({
    socketManager: socketManager as unknown as SocketManager,
    db: db as unknown as DatabaseService,
    deltaSyncMetrics: createDeltaSyncMetrics(),
  });
  return { db, service, socketManager };
}

describe('GameStateCommitService', () => {
  it('durably commits a tagged full upload before acking and broadcasting the peer patch', async () => {
    const { connection, socket } = createConnection();
    const previous = createEmptySyncableGameState();
    const room = createRoom({ gameState: previous });
    const nextState: SyncableGameState = {
      ...previous,
      scenes: [{ id: 'scene-1', name: 'Dungeon' }],
    };
    const nextToken = hashSync(nextState as unknown as JsonValue);
    const { db, service, socketManager } = createHarness(room);
    vi.mocked(db.commitGameState).mockResolvedValue({
      status: 'committed',
      gameState: nextState,
      syncToken: nextToken,
      stateVersion: 1,
    });

    service.enqueueUpload('ROOM', connection, {
      upload: { kind: 'full', state: nextState, newToken: nextToken },
    });
    await flushQueue(service);

    expect(db.commitGameState).toHaveBeenCalledWith(
      'ROOM',
      0,
      hashSync(previous as unknown as JsonValue),
      nextState,
      nextToken,
    );
    expect(room.gameState).toEqual(nextState);
    expect(room.syncToken).toBe(nextToken);
    expect(room.stateVersion).toBe(1);
    expect(parseMessages(socket)).toMatchObject([
      { type: 'game-state-ack', data: { token: nextToken, version: 1 } },
    ]);
    expect(socketManager.broadcastToRoom).toHaveBeenCalledWith(
      'ROOM',
      expect.objectContaining({
        type: 'game-state-patch',
        data: expect.objectContaining({
          version: 1,
          baseToken: hashSync(previous as unknown as JsonValue),
          newToken: nextToken,
        }),
      }),
      connection.id,
    );
  });

  it('applies and broadcasts a valid chained patch upload', async () => {
    const { connection, socket } = createConnection();
    const room = createRoom();
    const patch: JsonPatch = [
      { op: 'add', path: '/scenes/0', value: { id: 'scene-1' } },
    ];
    const nextState = {
      ...(room.gameState as SyncableGameState),
      scenes: [{ id: 'scene-1' }],
    };
    const nextToken = hashSync(nextState as unknown as JsonValue);
    const { db, service, socketManager } = createHarness(room);
    vi.mocked(db.commitGameState).mockResolvedValue({
      status: 'committed',
      gameState: nextState,
      syncToken: nextToken,
      stateVersion: 1,
    });

    service.enqueueUpload('ROOM', connection, {
      upload: {
        kind: 'patch',
        patch,
        baseToken: room.syncToken,
        newToken: nextToken,
      },
    });
    await flushQueue(service);

    expect(db.commitGameState).toHaveBeenCalledWith(
      'ROOM',
      0,
      expect.any(String),
      nextState,
      nextToken,
    );
    expect(parseMessages(socket)[0]).toMatchObject({
      type: 'game-state-ack',
      data: { token: nextToken, version: 1 },
    });
    expect(socketManager.broadcastToRoom).toHaveBeenCalledWith(
      'ROOM',
      expect.objectContaining({
        data: expect.objectContaining({ patch, version: 1 }),
      }),
      connection.id,
    );
  });

  it.each([
    ['base-mismatch', { kind: 'patch', patch: [], baseToken: asStateHash('stale'), newToken: asStateHash('next') }],
    ['malformed-patch', { kind: 'patch', patch: [{ op: 'remove', path: '/missing' }], baseToken: undefined, newToken: asStateHash('next') }],
    ['payload-too-large', { kind: 'patch', patch: Array.from({ length: 5001 }, () => ({ op: 'test', path: '/activeSceneId', value: null })), baseToken: undefined, newToken: asStateHash('next') }],
  ])('requests resync on %s without committing', async (reason, uploadTemplate) => {
    const { connection, socket } = createConnection();
    const room = createRoom();
    const { db, service } = createHarness(room);
    const upload =
      uploadTemplate.baseToken === undefined
        ? { ...uploadTemplate, baseToken: room.syncToken }
        : uploadTemplate;

    service.enqueueUpload('ROOM', connection, { upload });
    await flushQueue(service);

    expect(db.commitGameState).not.toHaveBeenCalled();
    expect(parseMessages(socket)[0]).toMatchObject({
      type: 'game-state-resync-required',
      data: { reason, serverToken: room.syncToken, version: 0 },
    });
  });

  it('rejects a full upload with an integrity mismatch', async () => {
    const { connection, socket } = createConnection();
    const { db, service } = createHarness();

    service.enqueueUpload('ROOM', connection, {
      upload: {
        kind: 'full',
        state: createEmptySyncableGameState(),
        newToken: asStateHash('not-the-real-token'),
      },
    });
    await flushQueue(service);

    expect(db.commitGameState).not.toHaveBeenCalled();
    expect(parseMessages(socket)[0]).toMatchObject({
      type: 'game-state-resync-required',
      data: { reason: 'integrity-mismatch' },
    });
  });

  it('rehydrates room state from a conflicting database commit and requests resync', async () => {
    const { connection, socket } = createConnection();
    const room = createRoom();
    const authoritative: SyncableGameState = {
      ...createEmptySyncableGameState(),
      scenes: [{ id: 'server-wins' }],
    };
    const repairedToken = hashSync(authoritative as unknown as JsonValue);
    const { db, service } = createHarness(room);
    vi.mocked(db.commitGameState).mockResolvedValue({
      status: 'conflict',
      gameState: authoritative,
      syncToken: 'stale-token',
      stateVersion: 2,
    });
    vi.mocked(db.repairGameStateMetadata).mockResolvedValue({
      id: 'session-id',
      joinCode: 'ROOM',
      campaignId: 'campaign-id',
      primaryHostId: 'host-id',
      gameState: authoritative,
      syncToken: repairedToken,
      stateVersion: 2,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivity: new Date(),
    });

    service.enqueueUpload('ROOM', connection, {
      scenes: [{ id: 'client-loses' }],
    });
    await flushQueue(service);

    expect(db.repairGameStateMetadata).toHaveBeenCalledWith(
      'ROOM',
      2,
      'stale-token',
      authoritative,
      repairedToken,
    );
    expect(room.gameState).toEqual(authoritative);
    expect(room.syncToken).toBe(repairedToken);
    expect(room.stateVersion).toBe(2);
    expect(parseMessages(socket)[0]).toMatchObject({
      type: 'game-state-resync-required',
      data: { reason: 'base-mismatch', version: 2 },
    });
  });

  it('reports commit failures without mutating room state or acknowledging', async () => {
    const { connection, socket } = createConnection();
    const room = createRoom();
    const originalToken = room.syncToken;
    const { db, service } = createHarness(room);
    vi.mocked(db.commitGameState).mockRejectedValue(new Error('database down'));

    service.enqueueUpload('ROOM', connection, {
      scenes: [{ id: 'uncommitted' }],
    });
    await flushQueue(service);

    expect(room.stateVersion).toBe(0);
    expect(room.syncToken).toBe(originalToken);
    expect(parseMessages(socket)[0]).toMatchObject({
      type: 'error',
      data: {
        code: 503,
        message: 'Game-state commit failed; the update was not acknowledged.',
      },
    });
  });
});
