import { describe, expect, it, vi } from 'vitest';
import { PlayerIntentHandler } from '../../../../server/socket/handlers/PlayerIntentHandler.js';
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

function makeConnection(id: string, type: 'host' | 'player'): Connection {
  return {
    id,
    ws: { close: vi.fn(), terminate: vi.fn(), readyState: 1 },
    user: { name: `${id}-name`, type },
    consecutiveMisses: 0,
    connectionQuality: 'excellent',
  } as unknown as Connection;
}

function makeRoom(host: string, dmConnected = true): Room {
  return {
    code: 'ROOM1',
    host,
    coHosts: new Set<string>(),
    players: new Set<string>([host]),
    connections: new Map(),
    created: Date.now(),
    lastActivity: Date.now(),
    status: 'active',
    dmConnected,
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
  } as unknown as SocketManager;

  new PlayerIntentHandler(socketManager, {} as unknown as DatabaseService);

  const emit = (event: string, payload: HandlerPayload) =>
    handlers.get(event)?.(payload);

  return { sent, broadcasts, emit };
}

function eventMessage(data: Record<string, unknown>): ServerEventMessage {
  return { type: 'event', data, timestamp: Date.now() } as ServerEventMessage;
}

const validIntent = {
  name: 'player/intent',
  intentId: 'i1',
  intent: { kind: 'hp-adjust', characterId: 'c1', delta: -3 },
};

describe('PlayerIntentHandler', () => {
  it('forwards a valid intent to the room, stamped with the sender', () => {
    const { broadcasts, sent, emit } = createHarness();
    const player = makeConnection('p1', 'player');

    emit('event:player/intent', {
      connection: player,
      room: makeRoom('host1'),
      message: eventMessage(validIntent),
    });

    expect(sent).toEqual([]);
    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0].excludeId).toBe('p1');
    expect(broadcasts[0].message.data).toMatchObject({
      name: 'player/intent',
      intentId: 'i1',
      fromUserId: 'p1',
      fromUserName: 'p1-name',
      intent: validIntent.intent,
    });
  });

  it('rejects malformed intents back to the sender only', () => {
    const { broadcasts, sent, emit } = createHarness();
    const player = makeConnection('p1', 'player');

    emit('event:player/intent', {
      connection: player,
      room: makeRoom('host1'),
      message: eventMessage({
        name: 'player/intent',
        intentId: 'i2',
        intent: { kind: 'hp-adjust', characterId: 'c1', delta: 5000 },
      }),
    });

    expect(broadcasts).toEqual([]);
    expect(sent[0].connection).toBe(player);
    expect(sent[0].message.data).toMatchObject({
      name: 'player/intent-result',
      intentId: 'i2',
      targetUserId: 'p1',
      status: 'rejected',
      reason: 'invalid',
    });
  });

  it('rejects with an empty id when the payload has none', () => {
    const { sent, emit } = createHarness();
    emit('event:player/intent', {
      connection: makeConnection('p1', 'player'),
      room: makeRoom('host1'),
      message: eventMessage({ name: 'player/intent' }),
    });
    expect(sent[0].message.data).toMatchObject({
      intentId: '',
      reason: 'invalid',
    });
  });

  it('rejects when the DM is offline', () => {
    const { broadcasts, sent, emit } = createHarness();
    emit('event:player/intent', {
      connection: makeConnection('p1', 'player'),
      room: makeRoom('host1', false),
      message: eventMessage(validIntent),
    });
    expect(broadcasts).toEqual([]);
    expect(sent[0].message.data).toMatchObject({ reason: 'host-offline' });
  });

  it('relays a host result addressed to the player', () => {
    const { broadcasts, emit } = createHarness();
    emit('event:player/intent-result', {
      connection: makeConnection('host1', 'host'),
      room: makeRoom('host1'),
      message: eventMessage({
        name: 'player/intent-result',
        intentId: 'i1',
        targetUserId: 'p1',
        status: 'rejected',
        reason: 'not-owner',
      }),
    });
    expect(broadcasts[0].message.data).toEqual({
      name: 'player/intent-result',
      intentId: 'i1',
      targetUserId: 'p1',
      status: 'rejected',
      reason: 'not-owner',
    });
  });

  it('refuses results from non-hosts', () => {
    const { broadcasts, sent, emit } = createHarness();
    const player = makeConnection('p2', 'player');
    emit('event:player/intent-result', {
      connection: player,
      room: makeRoom('host1'),
      message: eventMessage({
        name: 'player/intent-result',
        intentId: 'i1',
        targetUserId: 'p1',
        status: 'applied',
      }),
    });
    expect(broadcasts).toEqual([]);
    expect(sent[0].message).toMatchObject({
      type: 'error',
      data: { code: 403 },
    });
  });

  it('refuses malformed results from the host', () => {
    const { broadcasts, sent, emit } = createHarness();
    emit('event:player/intent-result', {
      connection: makeConnection('host1', 'host'),
      room: makeRoom('host1'),
      message: eventMessage({ name: 'player/intent-result', status: 'ok' }),
    });
    expect(broadcasts).toEqual([]);
    expect(sent[0].message).toMatchObject({ type: 'error' });
  });
});
