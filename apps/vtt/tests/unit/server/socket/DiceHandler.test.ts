import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiceHandler } from '../../../../server/socket/handlers/DiceHandler.js';
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

function makeConnection(
  id: string,
  type: 'host' | 'player' = 'player',
): Connection {
  return {
    id,
    ws: { readyState: 1 },
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
  const broadcasts: Array<{
    code: string;
    message: ServerMessage;
    excludeId?: string;
  }> = [];

  const socketManager = {
    connections: new Map<string, Connection>(),
    on: (event: string, cb: (payload: HandlerPayload) => void) => {
      handlers.set(event, cb);
    },
    sendMessage: (connection: Connection, message: ServerMessage) => {
      sent.push({ connection, message });
    },
    broadcastToRoom: (
      code: string,
      message: ServerMessage,
      excludeId?: string,
    ) => {
      broadcasts.push({ code, message, excludeId });
    },
    publishOrderedEvent: (
      room: Room,
      _connection: Connection,
      message: ServerMessage,
    ) => {
      broadcasts.push({ code: room.code, message });
      return Promise.resolve(null);
    },
  } as unknown as SocketManager;

  new DiceHandler(socketManager, {} as unknown as DatabaseService);

  const emit = (event: string, payload: HandlerPayload) => {
    handlers.get(event)?.(payload);
  };

  return { sent, broadcasts, emit };
}

const rollRequest = (data: Record<string, unknown>): ServerEventMessage => ({
  type: 'event',
  data: { name: 'dice/roll-request', ...data },
  timestamp: Date.now(),
});

// Read the `roll` payload out of a broadcast dice/roll-result message.
const rollOf = (message: ServerMessage) =>
  (message as ServerEventMessage).data.roll as {
    total: number;
    expression: string;
    isPrivate?: boolean;
  };

describe('DiceHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rolls server-side and broadcasts the result to the whole room (sender included)', () => {
    const h = createHarness();
    const player = makeConnection('p1', 'player');
    const room = makeRoom('host');
    room.players.add('p1');

    h.emit('event:dice/roll-request', {
      connection: player,
      room,
      message: rollRequest({ expression: '1d20+3' }),
    });

    expect(h.broadcasts).toHaveLength(1);
    // Not excluded — the roller sees the authoritative result too.
    expect(h.broadcasts[0].excludeId).toBeUndefined();
    const msg = h.broadcasts[0].message as ServerEventMessage;
    expect(msg.data.name).toBe('dice/roll-result');
    expect(rollOf(msg).expression).toBe('1d20+3');
    expect(typeof rollOf(msg).total).toBe('number');
  });

  it('rejects an invalid expression with an error and no broadcast', () => {
    const h = createHarness();
    const player = makeConnection('p1', 'player');
    const room = makeRoom('host');
    room.players.add('p1');

    h.emit('event:dice/roll-request', {
      connection: player,
      room,
      message: rollRequest({ expression: 'not-a-roll!!' }),
    });

    expect(h.broadcasts).toHaveLength(0);
    expect(h.sent.some((s) => s.message.type === 'error')).toBe(true);
  });

  it('honors a private roll from the host but strips privacy from a player', () => {
    const h = createHarness();
    const room = makeRoom('host');
    const host = makeConnection('host', 'host');
    const player = makeConnection('p1', 'player');
    room.players.add('p1');

    h.emit('event:dice/roll-request', {
      connection: host,
      room,
      message: rollRequest({ expression: '1d20', isPrivate: true }),
    });
    h.emit('event:dice/roll-request', {
      connection: player,
      room,
      message: rollRequest({ expression: '1d20', isPrivate: true }),
    });

    expect(rollOf(h.broadcasts[0].message).isPrivate).toBe(true);
    expect(rollOf(h.broadcasts[1].message).isPrivate).toBe(false);
  });
});
