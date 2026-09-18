import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CharacterHandler } from '../../../../server/socket/handlers/CharacterHandler.js';
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

function makeConnection(id: string): Connection {
  return {
    id,
    ws: { close: vi.fn(), terminate: vi.fn(), readyState: 1 },
    user: { name: id, type: 'player' },
    consecutiveMisses: 0,
    connectionQuality: 'excellent',
  } as unknown as Connection;
}

function makeRoom(host: string): Room {
  return {
    code: 'ROOM1',
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

describe('CharacterHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registers all character events and relays them via publishOrderedEvent excluding sender', async () => {
    const handlers = new Map<string, (payload: HandlerPayload) => void>();
    const broadcasts: Array<{
      code: string;
      message: ServerMessage;
      excludeId?: string;
    }> = [];

    const socketManager = {
      on: (event: string, cb: (payload: HandlerPayload) => void) => {
        handlers.set(event, cb);
      },
      publishOrderedEvent: (
        room: Room,
        _connection: Connection,
        message: ServerMessage,
        options?: { excludeId?: string },
      ) => {
        broadcasts.push({
          code: room.code,
          message,
          excludeId: options?.excludeId,
        });
        return Promise.resolve(null);
      },
    } as unknown as SocketManager;

    new CharacterHandler(socketManager, {} as unknown as DatabaseService);

    const events = [
      'character/create',
      'character/update',
      'character/delete',
      'character/sync',
      'character/roll',
    ];

    const sender = makeConnection('sender-1');
    const room = makeRoom('host-1');

    for (const event of events) {
      expect(handlers.has(`event:${event}`)).toBe(true);

      const message: ServerEventMessage = {
        type: 'event',
        data: { name: event, payload: { characterId: 'char-1' } },
        timestamp: Date.now(),
      };

      await handlers.get(`event:${event}`)!({ connection: sender, room, message });

      expect(broadcasts[broadcasts.length - 1]).toEqual({
        code: 'ROOM1',
        message,
        excludeId: 'sender-1',
      });
    }

    expect(broadcasts).toHaveLength(events.length);
  });
});
