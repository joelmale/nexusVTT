import { describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';

import type { DatabaseService, SessionRecord } from '../../../../server/database.js';
import { ConnectionLifecycle } from '../../../../server/socket/ConnectionLifecycle.js';
import type { SocketManager } from '../../../../server/socket/SocketManager.js';
import type { Connection, Room, ServerMessage } from '../../../../server/types.js';
import { createEmptySyncableGameState, type JsonValue } from '../../../../shared/sync/contracts.js';
import { hashSync } from '../../../../shared/sync/hashSync.js';

class MockSocket {
  readyState = WebSocket.OPEN;
  readonly send = vi.fn();
  readonly close = vi.fn((_code?: number, _reason?: string) => {
    this.readyState = WebSocket.CLOSING;
  });
}

const parseMessages = (socket: MockSocket): ServerMessage[] =>
  socket.send.mock.calls.map(([message]) =>
    JSON.parse(String(message)),
  ) as ServerMessage[];

function createRoom(overrides: Partial<Room> = {}): Room {
  const state = createEmptySyncableGameState();
  return {
    code: 'ROOM',
    host: 'host-id',
    coHosts: new Set(),
    players: new Set(['host-id']),
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

function createConnection(
  id: string,
  socket = new MockSocket(),
  room?: string,
): Connection {
  return {
    id,
    instanceId: `${id}-instance`,
    ws: socket as unknown as WebSocket,
    room,
    user: { name: id, type: 'player' },
    consecutiveMisses: 0,
    connectionQuality: 'excellent',
  };
}

function createSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  const state = createEmptySyncableGameState();
  return {
    id: 'session-id',
    joinCode: 'ROOM',
    campaignId: 'campaign-id',
    primaryHostId: 'host-id',
    gameState: state,
    syncToken: hashSync(state as unknown as JsonValue),
    stateVersion: 0,
    status: 'active',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    lastActivity: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createHarness(): {
  db: Pick<
    DatabaseService,
    | 'activateSessionByJoinCode'
    | 'addPlayerToSession'
    | 'createCampaign'
    | 'createGuestUser'
    | 'createSession'
    | 'createSessionWithJoinCode'
    | 'deleteSession'
    | 'getCampaignById'
    | 'getHostsBySession'
    | 'getSessionByJoinCode'
    | 'getUserById'
    | 'repairGameStateMetadata'
    | 'updateCampaign'
    | 'updatePlayerConnection'
    | 'updateSessionStatus'
  >;
  lifecycle: ConnectionLifecycle;
  socketManager: Pick<
    SocketManager,
    | 'connections'
    | 'rooms'
    | 'addConnection'
    | 'broadcastToRoom'
    | 'deliverRoomReplay'
    | 'getRoomReplayWindow'
    | 'hydrateDistributedPresence'
    | 'registerDistributedConnection'
    | 'removeRoom'
    | 'unregisterDistributedConnection'
  >;
} {
  const socketManager = {
    rooms: new Map<string, Room>(),
    connections: new Map<string, Connection>(),
    addConnection: vi.fn(),
    broadcastToRoom: vi.fn(),
    deliverRoomReplay: vi.fn(),
    getRoomReplayWindow: vi.fn().mockResolvedValue({
      events: [],
      latestSequence: 0,
      truncated: false,
    }),
    hydrateDistributedPresence: vi.fn().mockResolvedValue(undefined),
    registerDistributedConnection: vi.fn().mockResolvedValue(true),
    removeRoom: vi.fn((roomCode: string) => {
      socketManager.rooms.delete(roomCode);
    }),
    unregisterDistributedConnection: vi.fn().mockResolvedValue(undefined),
  };
  const db = {
    activateSessionByJoinCode: vi.fn(),
    addPlayerToSession: vi.fn().mockResolvedValue(undefined),
    createCampaign: vi.fn().mockResolvedValue({ id: 'campaign-id' }),
    createGuestUser: vi.fn().mockResolvedValue(undefined),
    createSession: vi.fn().mockResolvedValue({
      sessionId: 'session-id',
      joinCode: 'ROOM',
    }),
    createSessionWithJoinCode: vi.fn().mockResolvedValue({
      sessionId: 'session-id',
      joinCode: 'ROOM',
    }),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    getCampaignById: vi.fn(),
    getHostsBySession: vi.fn().mockResolvedValue([{ userId: 'host-id', isPrimary: true }]),
    getSessionByJoinCode: vi.fn().mockResolvedValue(null),
    getUserById: vi.fn().mockResolvedValue({ id: 'host-id', name: 'Host' }),
    repairGameStateMetadata: vi.fn().mockResolvedValue(null),
    updateCampaign: vi.fn().mockResolvedValue(undefined),
    updatePlayerConnection: vi.fn().mockResolvedValue(undefined),
    updateSessionStatus: vi.fn().mockResolvedValue(undefined),
  };
  const lifecycle = new ConnectionLifecycle({
    socketManager: socketManager as unknown as SocketManager,
    db: db as unknown as DatabaseService,
  });
  return { db, lifecycle, socketManager };
}

describe('ConnectionLifecycle', () => {
  it('hosts an existing campaign session and returns campaign scenes', async () => {
    const { db, lifecycle, socketManager } = createHarness();
    const socket = new MockSocket();
    const connection = createConnection('host-id', socket);
    const session = createSession({ joinCode: 'ROOM' });
    vi.mocked(socketManager.addConnection).mockReturnValue(connection);
    vi.mocked(db.getCampaignById).mockResolvedValue({
      id: 'campaign-id',
      dmId: 'host-id',
      name: 'Campaign',
      description: null,
      scenes: [{ id: 'scene-from-campaign' }],
      lastRoomCode: 'ROOM',
      lastRoomCodeUpdatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(db.getSessionByJoinCode).mockResolvedValue(session);
    vi.mocked(db.activateSessionByJoinCode).mockResolvedValue(session);

    await lifecycle.handleConnection(socket as unknown as WebSocket, {
      url: '/ws?host=room&campaignId=campaign-id',
      session: { passport: { user: 'host-id' } },
    } as never);

    expect(db.activateSessionByJoinCode).toHaveBeenCalledWith(
      'ROOM',
      'host-id',
    );
    expect(db.createSessionWithJoinCode).not.toHaveBeenCalled();
    expect(parseMessages(socket)[0]).toMatchObject({
      type: 'event',
      data: {
        name: 'session/created',
        roomCode: 'ROOM',
        campaignScenes: [{ id: 'scene-from-campaign' }],
      },
    });
  });

  it('rejects an existing campaign when the connecting host is not the owner', async () => {
    const { lifecycle, socketManager, db } = createHarness();
    const socket = new MockSocket();
    const connection = createConnection('intruder-id', socket);
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 'intruder-id',
      name: 'Intruder',
    });
    vi.mocked(socketManager.addConnection).mockReturnValue(connection);
    vi.mocked(db.getCampaignById).mockResolvedValue({
      id: 'campaign-id',
      dmId: 'host-id',
      name: 'Campaign',
      description: null,
      scenes: [],
      lastRoomCode: null,
      lastRoomCodeUpdatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await lifecycle.handleConnection(socket as unknown as WebSocket, {
      url: '/ws?host=room&campaignId=campaign-id',
      session: { passport: { user: 'intruder-id' } },
    } as never);

    expect(socket.close).toHaveBeenCalledWith(4403, 'Unauthorized');
    expect(parseMessages(socket)[0]).toMatchObject({
      type: 'error',
      data: { message: 'Unauthorized to host this campaign' },
    });
  });

  it('reports campaign lookup failures without creating a room', async () => {
    const { lifecycle, socketManager, db } = createHarness();
    const socket = new MockSocket();
    const connection = createConnection('host-id', socket);
    vi.mocked(socketManager.addConnection).mockReturnValue(connection);
    vi.mocked(db.getCampaignById).mockResolvedValue(null);

    await lifecycle.handleConnection(socket as unknown as WebSocket, {
      url: '/ws?host=room&campaignId=missing-campaign',
      session: { passport: { user: 'host-id' } },
    } as never);

    expect(socketManager.rooms.size).toBe(0);
    expect(parseMessages(socket)[0]).toMatchObject({
      type: 'error',
      data: { message: 'Campaign not found' },
    });
  });

  it('creates a hosted room for an authenticated default connection', async () => {
    const { db, lifecycle, socketManager } = createHarness();
    const socket = new MockSocket();
    const connection = createConnection('host-id', socket);
    vi.mocked(socketManager.addConnection).mockReturnValue(connection);

    await lifecycle.handleConnection(socket as unknown as WebSocket, {
      url: '/ws?connectionInstanceId=socket-1&lastSeenSequence=7',
      session: { passport: { user: 'host-id' } },
    } as never);

    const room = socketManager.rooms.get('ROOM');
    expect(room).toBeDefined();
    expect(room?.host).toBe('host-id');
    expect(room?.dmConnected).toBe(true);
    expect(db.createCampaign).toHaveBeenCalledWith(
      'host-id',
      expect.stringContaining('Campaign'),
      'Auto-created campaign for quick session',
    );
    expect(socketManager.registerDistributedConnection).toHaveBeenCalledWith(
      room,
      connection,
      'host',
    );
    expect(socketManager.getRoomReplayWindow).toHaveBeenCalledWith('ROOM', 7);
    expect(parseMessages(socket)[0]).toMatchObject({
      type: 'event',
      data: {
        name: 'session/created',
        roomCode: 'ROOM',
        sessionId: 'session-id',
        campaignId: 'campaign-id',
        uuid: 'host-id',
      },
    });
  });

  it('rejects anonymous host creation before opening a session', async () => {
    const { db, lifecycle, socketManager } = createHarness();
    const socket = new MockSocket();
    const connection = createConnection('anonymous-id', socket);
    vi.mocked(db.getUserById).mockResolvedValue(null);
    vi.mocked(socketManager.addConnection).mockReturnValue(connection);

    await lifecycle.handleConnection(socket as unknown as WebSocket, {
      url: '/ws?host=ROOM',
      session: {},
    } as never);

    expect(db.createCampaign).not.toHaveBeenCalled();
    expect(socket.close).toHaveBeenCalledWith(4403, 'Unauthorized');
    expect(parseMessages(socket)[0]).toMatchObject({
      type: 'error',
      data: { message: 'Unauthorized to create campaign' },
    });
  });

  it('cleans up a newly created host room when distributed presence rejects it', async () => {
    const { db, lifecycle, socketManager } = createHarness();
    const socket = new MockSocket();
    const connection = createConnection('host-id', socket);
    vi.mocked(socketManager.addConnection).mockReturnValue(connection);
    vi.mocked(socketManager.registerDistributedConnection).mockResolvedValue(
      false,
    );

    await lifecycle.handleConnection(socket as unknown as WebSocket, {
      url: '/ws?host=room',
      session: { passport: { user: 'host-id' } },
    } as never);

    const room = socketManager.rooms.get('ROOM');
    expect(room?.connections.has('host-id')).toBe(false);
    expect(room?.players.has('host-id')).toBe(false);
    expect(connection.room).toBeUndefined();
    expect(db.updateCampaign).toHaveBeenCalled();
    expect(parseMessages(socket)[0]).toMatchObject({
      type: 'error',
      data: { message: 'This room already has an active host' },
    });
  });

  it('falls back to a generated session when a preferred room code belongs to another campaign', async () => {
    const { db, lifecycle, socketManager } = createHarness();
    const socket = new MockSocket();
    const connection = createConnection('host-id', socket);
    vi.mocked(socketManager.addConnection).mockReturnValue(connection);
    vi.mocked(db.getCampaignById).mockResolvedValue({
      id: 'campaign-id',
      dmId: 'host-id',
      name: 'Campaign',
      description: null,
      scenes: [],
      lastRoomCode: null,
      lastRoomCodeUpdatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(db.getSessionByJoinCode).mockResolvedValue(
      createSession({ campaignId: 'other-campaign' }),
    );

    await lifecycle.handleConnection(socket as unknown as WebSocket, {
      url: '/ws?host=room&campaignId=campaign-id',
      session: { passport: { user: 'host-id' } },
    } as never);

    expect(db.createSession).toHaveBeenCalledWith('campaign-id', 'host-id');
    expect(db.createSessionWithJoinCode).not.toHaveBeenCalled();
    expect(parseMessages(socket)[0]).toMatchObject({
      type: 'event',
      data: { name: 'session/created', roomCode: 'ROOM' },
    });
  });

  it('recovers a persisted room when a player joins after an instance restart', async () => {
    const { db, lifecycle, socketManager } = createHarness();
    const socket = new MockSocket();
    const connection = createConnection('player-id', socket);
    const session = createSession({
      gameState: { scenes: [{ id: 'scene-1' }], activeSceneId: null },
      syncToken: 'stale-token',
      stateVersion: 3,
    });
    vi.mocked(db.getUserById).mockResolvedValue({ id: 'player-id', name: 'Player' });
    vi.mocked(db.getSessionByJoinCode).mockResolvedValue(session);
    vi.mocked(db.repairGameStateMetadata).mockResolvedValue({
      ...session,
      gameState: createEmptySyncableGameState(),
      syncToken: hashSync(createEmptySyncableGameState() as unknown as JsonValue),
    });
    vi.mocked(socketManager.addConnection).mockReturnValue(connection);
    vi.mocked(socketManager.getRoomReplayWindow).mockResolvedValue({
      events: [],
      latestSequence: 4,
      truncated: false,
    });

    await lifecycle.handleConnection(socket as unknown as WebSocket, {
      url: '/ws?join=room&lastSeenSequence=2',
      session: { passport: { user: 'player-id' } },
    } as never);

    const recoveredRoom = socketManager.rooms.get('ROOM');
    expect(recoveredRoom).toBeDefined();
    expect(socketManager.hydrateDistributedPresence).toHaveBeenCalledWith(
      recoveredRoom,
    );
    expect(socketManager.registerDistributedConnection).toHaveBeenCalledWith(
      recoveredRoom,
      connection,
      'player',
      4,
    );
    expect(db.addPlayerToSession).toHaveBeenCalledWith(
      'player-id',
      'session-id',
    );
    expect(parseMessages(socket)[0]).toMatchObject({
      type: 'event',
      data: {
        name: 'session/joined',
        roomCode: 'ROOM',
        hostId: 'host-id',
        campaignId: 'campaign-id',
      },
    });
    expect(socketManager.broadcastToRoom).toHaveBeenCalledWith(
      'ROOM',
      expect.objectContaining({
        data: expect.objectContaining({ name: 'session/join' }),
      }),
      'player-id',
    );
  });

  it('reconnects the host from a persisted session and delivers replay catch-up', async () => {
    const { db, lifecycle, socketManager } = createHarness();
    const socket = new MockSocket();
    const connection = createConnection('host-id', socket);
    connection.user = { name: 'Host', type: 'host' };
    const session = createSession({
      gameState: {
        ...createEmptySyncableGameState(),
        scenes: [{ id: 'persisted-scene' }],
      },
    });
    vi.mocked(socketManager.addConnection).mockReturnValue(connection);
    vi.mocked(db.getCampaignById).mockResolvedValue({
      id: 'campaign-id',
      dmId: 'host-id',
      name: 'Campaign',
      description: null,
      scenes: [],
      lastRoomCode: 'ROOM',
      lastRoomCodeUpdatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(db.getSessionByJoinCode).mockResolvedValue(session);
    vi.mocked(db.activateSessionByJoinCode).mockResolvedValue(session);
    vi.mocked(socketManager.getRoomReplayWindow)
      .mockResolvedValueOnce({
        events: [{ serverSequence: 5, type: 'event' }],
        latestSequence: 5,
        truncated: false,
      })
      .mockResolvedValueOnce({
        events: [{ serverSequence: 7, type: 'event' }],
        latestSequence: 7,
        truncated: false,
      });

    await lifecycle.handleConnection(socket as unknown as WebSocket, {
      url: '/ws?reconnect=room&campaignId=campaign-id&lastSeenSequence=3',
      session: { passport: { user: 'host-id' } },
    } as never);

    const room = socketManager.rooms.get('ROOM');
    expect(room?.host).toBe('host-id');
    expect(room?.dmConnected).toBe(true);
    expect(db.activateSessionByJoinCode).toHaveBeenCalledWith(
      'ROOM',
      'host-id',
    );
    expect(db.addPlayerToSession).toHaveBeenCalledWith(
      'host-id',
      'session-id',
    );
    expect(socketManager.registerDistributedConnection).toHaveBeenLastCalledWith(
      room,
      connection,
      'host',
      5,
    );
    expect(socketManager.deliverRoomReplay).toHaveBeenCalledTimes(2);
    expect(socketManager.deliverRoomReplay).toHaveBeenLastCalledWith(
      connection,
      expect.objectContaining({ latestSequence: 7 }),
      5,
    );
    expect(parseMessages(socket)[0]).toMatchObject({
      type: 'event',
      data: {
        name: 'session/reconnected',
        roomCode: 'ROOM',
        dmConnected: true,
      },
    });
    expect(socketManager.broadcastToRoom).toHaveBeenCalledWith(
      'ROOM',
      expect.objectContaining({
        data: { name: 'session/host-reconnected', uuid: 'host-id' },
      }),
      'host-id',
    );
  });

  it.each([
    [
      '/ws?reconnect=room&campaignId=campaign-id',
      'Room code belongs to another campaign',
      { sessionCampaignId: 'other-campaign', campaignDmId: 'host-id' },
    ],
    [
      '/ws?reconnect=room',
      'Room not found',
      { sessionCampaignId: null, campaignDmId: 'host-id' },
    ],
    [
      '/ws?reconnect=room&campaignId=campaign-id',
      'Unauthorized to host this campaign',
      { sessionCampaignId: 'campaign-id', campaignDmId: 'someone-else' },
    ],
  ])('rejects invalid host reconnects: %s', async (url, message, setup) => {
    const { db, lifecycle, socketManager } = createHarness();
    const socket = new MockSocket();
    const connection = createConnection('host-id', socket);
    vi.mocked(socketManager.addConnection).mockReturnValue(connection);
    vi.mocked(db.getSessionByJoinCode).mockResolvedValue(
      setup.sessionCampaignId
        ? createSession({ campaignId: setup.sessionCampaignId })
        : null,
    );
    vi.mocked(db.getCampaignById).mockResolvedValue({
      id: 'campaign-id',
      dmId: setup.campaignDmId,
      name: 'Campaign',
      description: null,
      scenes: [],
      lastRoomCode: 'ROOM',
      lastRoomCodeUpdatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await lifecycle.handleConnection(socket as unknown as WebSocket, {
      url,
      session: { passport: { user: 'host-id' } },
    } as never);

    expect(socket.close).toHaveBeenCalled();
    expect(parseMessages(socket)[0]).toMatchObject({
      type: 'error',
      data: { message },
    });
  });

  it('reports replay preparation failure before admitting a joiner', async () => {
    const { db, lifecycle, socketManager } = createHarness();
    const socket = new MockSocket();
    const connection = createConnection('player-id', socket);
    const room = createRoom();
    socketManager.rooms.set('ROOM', room);
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 'player-id',
      name: 'Player',
    });
    vi.mocked(socketManager.addConnection).mockReturnValue(connection);
    vi.mocked(socketManager.getRoomReplayWindow).mockRejectedValue(
      new Error('journal unavailable'),
    );

    await lifecycle.handleConnection(socket as unknown as WebSocket, {
      url: '/ws?join=room',
      session: { passport: { user: 'player-id' } },
    } as never);

    expect(room.players.has('player-id')).toBe(false);
    expect(parseMessages(socket)[0]).toMatchObject({
      type: 'error',
      data: { message: 'Unable to prepare room event recovery' },
    });
  });

  it('reactivates a hibernating room when a player joins while the DM is connected', async () => {
    const { db, lifecycle, socketManager } = createHarness();
    const socket = new MockSocket();
    const connection = createConnection('player-id', socket);
    const room = createRoom({
      status: 'hibernating',
      dmConnected: true,
      hibernationTimer: setTimeout(() => undefined, 1000),
      players: new Set(['host-id']),
      connections: new Map(),
    });
    socketManager.rooms.set('ROOM', room);
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 'player-id',
      name: 'Player',
    });
    vi.mocked(socketManager.addConnection).mockReturnValue(connection);
    vi.mocked(db.getSessionByJoinCode).mockResolvedValue(createSession());

    await lifecycle.handleConnection(socket as unknown as WebSocket, {
      url: '/ws?join=room',
      session: { passport: { user: 'player-id' } },
    } as never);

    expect(room.status).toBe('active');
    expect(room.hibernationTimer).toBeUndefined();
    expect(socketManager.broadcastToRoom).toHaveBeenCalledWith(
      'ROOM',
      expect.objectContaining({
        data: expect.objectContaining({ name: 'session/reactivated' }),
      }),
    );
    expect(parseMessages(socket)[0]).toMatchObject({
      type: 'event',
      data: { name: 'session/joined', roomStatus: 'active' },
    });
  });

  it('marks a leaving player disconnected and broadcasts the leave event', async () => {
    const { db, lifecycle, socketManager } = createHarness();
    const socket = new MockSocket();
    const connection = createConnection('player-id', socket, 'ROOM');
    const room = createRoom({
      players: new Set(['host-id', 'player-id']),
      connections: new Map([
        ['player-id', socket as unknown as WebSocket],
      ]),
    });
    socketManager.rooms.set('ROOM', room);
    socketManager.connections.set('player-id', connection);
    vi.mocked(db.getSessionByJoinCode).mockResolvedValue(createSession());

    await lifecycle.handleDisconnect('player-id', connection.instanceId);

    expect(db.updatePlayerConnection).toHaveBeenCalledWith(
      'player-id',
      'session-id',
      false,
    );
    expect(room.players.has('player-id')).toBe(false);
    expect(socketManager.unregisterDistributedConnection).toHaveBeenCalledWith(
      'ROOM',
      'player-id',
    );
    expect(socketManager.broadcastToRoom).toHaveBeenCalledWith(
      'ROOM',
      expect.objectContaining({
        data: { name: 'session/leave', uuid: 'player-id' },
      }),
    );
    expect(socketManager.connections.has('player-id')).toBe(false);
  });

  it('preserves a replacement connection that arrives during disconnect cleanup', async () => {
    const { lifecycle, socketManager } = createHarness();
    const oldSocket = new MockSocket();
    const replacementSocket = new MockSocket();
    const oldConnection = createConnection('player-id', oldSocket, 'ROOM');
    const replacement = createConnection('player-id', replacementSocket, 'ROOM');
    replacement.instanceId = 'replacement-instance';
    const room = createRoom({
      players: new Set(['host-id', 'player-id']),
      connections: new Map([
        ['player-id', oldSocket as unknown as WebSocket],
      ]),
    });
    socketManager.rooms.set('ROOM', room);
    socketManager.connections.set('player-id', oldConnection);
    vi.mocked(socketManager.unregisterDistributedConnection).mockImplementation(
      async () => {
        socketManager.connections.set('player-id', replacement);
        room.connections.set('player-id', replacement.ws);
      },
    );

    await lifecycle.handleDisconnect('player-id', oldConnection.instanceId);

    expect(socketManager.registerDistributedConnection).toHaveBeenCalledWith(
      room,
      replacement,
      'player',
    );
    expect(room.players.has('player-id')).toBe(true);
    expect(socketManager.connections.get('player-id')).toBe(replacement);
    expect(socketManager.broadcastToRoom).not.toHaveBeenCalled();
  });

  it('hibernates a room when the host disconnects and players remain connected', async () => {
    const { db, lifecycle, socketManager } = createHarness();
    const hostSocket = new MockSocket();
    const playerSocket = new MockSocket();
    const hostConnection = createConnection('host-id', hostSocket, 'ROOM');
    hostConnection.user = { name: 'Host', type: 'host' };
    const room = createRoom({
      players: new Set(['host-id', 'player-id']),
      connections: new Map([
        ['host-id', hostSocket as unknown as WebSocket],
        ['player-id', playerSocket as unknown as WebSocket],
      ]),
    });
    socketManager.rooms.set('ROOM', room);
    socketManager.connections.set('host-id', hostConnection);
    vi.mocked(db.getSessionByJoinCode).mockResolvedValue(createSession());

    await lifecycle.handleDisconnect('host-id', hostConnection.instanceId);

    expect(room.status).toBe('hibernating');
    expect(room.dmConnected).toBe(false);
    expect(room.hibernationTimer).toBeUndefined();
    expect(db.updateSessionStatus).toHaveBeenCalledWith(
      'session-id',
      'hibernating',
    );
    expect(socketManager.broadcastToRoom).toHaveBeenCalledWith(
      'ROOM',
      expect.objectContaining({
        data: expect.objectContaining({ name: 'session/hibernated' }),
      }),
    );
    expect(socketManager.broadcastToRoom).toHaveBeenCalledWith(
      'ROOM',
      expect.objectContaining({
        data: { name: 'session/dm-status', dmConnected: false },
      }),
    );
  });
});
