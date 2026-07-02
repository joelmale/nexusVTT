import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SceneHandler } from '../../../../server/socket/handlers/SceneHandler.js';
import type { SocketManager } from '../../../../server/socket/SocketManager.js';
import type { DatabaseService } from '../../../../server/database.js';
import type {
  Connection,
  Room,
  ServerEventMessage,
  ServerMessage,
} from '../../../../server/types.js';

type HandlerPayload = {
  connection: Connection;
  room: Room;
  message: ServerEventMessage;
};

function makeConnection(id: string, type: 'host' | 'player' = 'player'): Connection {
  return {
    id,
    ws: { close: vi.fn(), terminate: vi.fn(), readyState: 1 },
    user: { name: id, type },
    consecutiveMisses: 0,
    connectionQuality: 'excellent',
  } as unknown as Connection;
}

function makeRoom(host: string): Room {
  return {
    code: 'ABCD',
    host,
    coHosts: new Set<string>(),
    players: new Set<string>([host]),
    connections: new Map(),
    created: Date.now(),
    lastActivity: Date.now(),
    status: 'active',
    dmConnected: true,
    stateVersion: 0,
    entityVersions: new Map<string, number>(),
  } as unknown as Room;
}

function createHarness() {
  const handlers = new Map<string, (payload: HandlerPayload) => void>();
  const sent: Array<{ connection: Connection; message: ServerMessage }> = [];
  const broadcasts: Array<{ code: string; message: ServerMessage; excludeId?: string }> = [];

  const socketManager = {
    connections: new Map<string, Connection>(),
    on: (event: string, cb: (payload: HandlerPayload) => void) => {
      handlers.set(event, cb);
    },
    sendMessage: (connection: Connection, message: ServerMessage) => {
      sent.push({ connection, message });
    },
    broadcastToRoom: (code: string, message: ServerMessage, excludeId?: string) => {
      broadcasts.push({ code, message, excludeId });
    },
  } as unknown as SocketManager;

  new SceneHandler(socketManager, {} as unknown as DatabaseService);

  const emit = (event: string, payload: HandlerPayload) => {
    handlers.get(event)?.(payload);
  };

  return { sent, broadcasts, emit };
}

const sceneUpdate = (): ServerEventMessage => ({
  type: 'event',
  data: { name: 'scene/update', sceneId: 's1', updates: { name: 'X' } },
  timestamp: Date.now(),
});

describe('SceneHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('relays a scene mutation from the host, excluding the sender', () => {
    const h = createHarness();
    const host = makeConnection('host', 'host');
    const room = makeRoom('host');

    h.emit('event:scene/update', { connection: host, room, message: sceneUpdate() });

    expect(h.broadcasts).toHaveLength(1);
    expect(h.broadcasts[0].excludeId).toBe('host');
    expect(h.sent.some((s) => s.message.type === 'error')).toBe(false);
  });

  it('rejects a scene mutation from a non-host and does not broadcast', () => {
    const h = createHarness();
    const player = makeConnection('p1', 'player');
    const room = makeRoom('host');
    room.players.add('p1');

    h.emit('event:scene/update', { connection: player, room, message: sceneUpdate() });

    expect(h.broadcasts).toHaveLength(0);
    expect(h.sent.some((s) => s.message.type === 'error')).toBe(true);
    expect(player.maliciousAttemptsCount).toBe(1);
  });

  it('allows a co-host to mutate scenes', () => {
    const h = createHarness();
    const coHost = makeConnection('co', 'host');
    const room = makeRoom('host');
    room.coHosts.add('co');

    h.emit('event:scene/update', { connection: coHost, room, message: sceneUpdate() });

    expect(h.broadcasts).toHaveLength(1);
    expect(h.sent.some((s) => s.message.type === 'error')).toBe(false);
  });
});
