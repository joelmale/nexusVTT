import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CombatHandler } from '../../../../server/socket/handlers/CombatHandler.js';
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
    ws: { close: vi.fn(), terminate: vi.fn(), readyState: 1 },
    user: { name: id, type },
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

  new CombatHandler(socketManager, {} as unknown as DatabaseService);

  const emit = async (event: string, payload: HandlerPayload) => {
    await handlers.get(event)?.(payload);
  };

  return { sent, broadcasts, emit };
}

describe('CombatHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('combat/add-character', () => {
    it('allows host to add NPC character and broadcasts event', async () => {
      const h = createHarness();
      const host = makeConnection('host-user', 'host');
      const room = makeRoom('host-user');
      const message: ServerEventMessage = {
        type: 'event',
        data: { name: 'combat/add-character', type: 'npc', characterName: 'Goblin' },
        timestamp: Date.now(),
      };

      await h.emit('event:combat/add-character', { connection: host, room, message });

      expect(h.broadcasts).toHaveLength(1);
      expect(h.broadcasts[0].excludeId).toBe('host-user');
      expect(h.sent).toHaveLength(0);
    });

    it('denies non-host from adding NPC character', async () => {
      const h = createHarness();
      const player = makeConnection('player-user', 'player');
      const room = makeRoom('host-user');
      const message: ServerEventMessage = {
        type: 'event',
        data: { name: 'combat/add-character', type: 'npc', characterName: 'Goblin' },
        timestamp: Date.now(),
      };

      await h.emit('event:combat/add-character', { connection: player, room, message });

      expect(h.broadcasts).toHaveLength(0);
      expect(h.sent).toHaveLength(1);
      expect(h.sent[0].message).toMatchObject({
        type: 'error',
        data: {
          message: 'Access denied: Host privilege required to add NPCs.',
          code: 403,
        },
      });
    });

    it('allows player to add their own character to combat', async () => {
      const h = createHarness();
      const player = makeConnection('player-user', 'player');
      const room = makeRoom('host-user');
      const message: ServerEventMessage = {
        type: 'event',
        data: {
          name: 'combat/add-character',
          type: 'player',
          ownerId: 'player-user',
          characterName: 'Hero',
        },
        timestamp: Date.now(),
      };

      await h.emit('event:combat/add-character', { connection: player, room, message });

      expect(h.broadcasts).toHaveLength(1);
      expect(h.broadcasts[0].excludeId).toBe('player-user');
      expect(h.sent).toHaveLength(0);
    });

    it('denies player from adding someone else’s character to combat', async () => {
      const h = createHarness();
      const player = makeConnection('player-user', 'player');
      const room = makeRoom('host-user');
      const message: ServerEventMessage = {
        type: 'event',
        data: {
          name: 'combat/add-character',
          type: 'player',
          ownerId: 'other-player',
          characterName: 'Hero',
        },
        timestamp: Date.now(),
      };

      await h.emit('event:combat/add-character', { connection: player, room, message });

      expect(h.broadcasts).toHaveLength(0);
      expect(h.sent).toHaveLength(1);
      expect(h.sent[0].message).toMatchObject({
        type: 'error',
        data: {
          message:
            'Access denied: You can only add your own characters to combat.',
          code: 403,
        },
      });
    });
  });

  describe('combat/sync-hp', () => {
    it('allows host to sync HP for any character', async () => {
      const h = createHarness();
      const host = makeConnection('host-user', 'host');
      const room = makeRoom('host-user');
      const message: ServerEventMessage = {
        type: 'event',
        data: { name: 'combat/sync-hp', ownerId: 'other-user', hp: 12 },
        timestamp: Date.now(),
      };

      await h.emit('event:combat/sync-hp', { connection: host, room, message });

      expect(h.broadcasts).toHaveLength(1);
      expect(h.broadcasts[0].excludeId).toBe('host-user');
    });

    it('allows character owner to sync their character’s HP', async () => {
      const h = createHarness();
      const player = makeConnection('player-1', 'player');
      const room = makeRoom('host-user');
      const message: ServerEventMessage = {
        type: 'event',
        data: { name: 'combat/sync-hp', ownerId: 'player-1', hp: 20 },
        timestamp: Date.now(),
      };

      await h.emit('event:combat/sync-hp', { connection: player, room, message });

      expect(h.broadcasts).toHaveLength(1);
      expect(h.broadcasts[0].excludeId).toBe('player-1');
    });

    it('denies non-host from modifying another player’s character HP', async () => {
      const h = createHarness();
      const player = makeConnection('player-1', 'player');
      const room = makeRoom('host-user');
      const message: ServerEventMessage = {
        type: 'event',
        data: { name: 'combat/sync-hp', ownerId: 'player-2', hp: 0 },
        timestamp: Date.now(),
      };

      await h.emit('event:combat/sync-hp', { connection: player, room, message });

      expect(h.broadcasts).toHaveLength(0);
      expect(h.sent).toHaveLength(1);
      expect(h.sent[0].message).toMatchObject({
        type: 'error',
        data: {
          message:
            'Access denied: You can only change HP for your own characters.',
          code: 403,
        },
      });
    });
  });
});
