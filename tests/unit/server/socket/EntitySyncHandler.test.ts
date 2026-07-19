import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySyncHandler } from '../../../../server/socket/handlers/EntitySyncHandler.js';
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

function makeRoom(host: string, dmConnected = true): Room {
  return {
    code: 'ABCD',
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

function evt(
  name: string,
  data: Record<string, unknown> = {},
): ServerEventMessage {
  return { type: 'event', data: { name, ...data }, timestamp: Date.now() };
}

function createHarness() {
  const handlers = new Map<string, (payload: HandlerPayload) => void>();
  const connections = new Map<string, Connection>();
  const sent: Array<{ connection: Connection; message: ServerMessage }> = [];
  const broadcasts: Array<{
    code: string;
    message: ServerMessage;
    excludeId?: string;
  }> = [];

  const socketManager = {
    connections,
    on: (event: string, cb: (payload: HandlerPayload) => void) => {
      handlers.set(event, cb);
    },
    getConnection: (id: string) => connections.get(id),
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
      options?: {
        excludeId?: string;
        entityVersion?: { entityId: string; expectedVersion: number };
        onVersionConflict?: (currentVersion: number) => void;
        onAccepted?: () => void;
        onAcknowledged?: () => void;
      },
    ) => {
      const currentVersion = options?.entityVersion
        ? (room.entityVersions.get(options.entityVersion.entityId) ?? 0)
        : 0;
      if (
        options?.entityVersion &&
        currentVersion > options.entityVersion.expectedVersion
      ) {
        options.onVersionConflict?.(currentVersion);
        return Promise.resolve(null);
      }
      options?.onAccepted?.();
      options?.onAcknowledged?.();
      broadcasts.push({
        code: room.code,
        message,
        excludeId: options?.excludeId,
      });
      return Promise.resolve(null);
    },
  } as unknown as SocketManager;

  new EntitySyncHandler(socketManager, {} as unknown as DatabaseService);

  const emit = (event: string, payload: HandlerPayload) => {
    const handler = handlers.get(event);
    if (!handler) throw new Error(`No handler registered for ${event}`);
    handler(payload);
  };

  return { connections, sent, broadcasts, emit };
}

const sentTypes = (sent: Array<{ message: ServerMessage }>) =>
  sent.map((s) => s.message.type);

describe('EntitySyncHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('token relay + optimistic confirmation', () => {
    it('broadcasts a token/move to peers excluding the sender and confirms the update', () => {
      const h = createHarness();
      const sender = makeConnection('p1', 'player');
      h.connections.set('p1', sender);
      const room = makeRoom('host');
      room.players.add('p1');

      h.emit('event:token/move', {
        connection: sender,
        room,
        message: evt('token/move', {
          tokenId: 't1',
          expectedVersion: 0,
          updateId: 'u1',
          position: { x: 5, y: 6 },
        }),
      });

      // Relayed once, excluding the sender.
      expect(h.broadcasts).toHaveLength(1);
      expect(h.broadcasts[0].excludeId).toBe('p1');
      expect((h.broadcasts[0].message as ServerEventMessage).data.name).toBe(
        'token/move',
      );
      // Sender's src is stamped on the relayed message.
      expect((h.broadcasts[0].message as ServerEventMessage).src).toBe('p1');

      // Sender received an update-confirmed for its optimistic update.
      const confirm = h.sent.find((s) => s.message.type === 'update-confirmed');
      expect(confirm).toBeDefined();
      expect(
        (confirm!.message as { data: { updateId: string } }).data.updateId,
      ).toBe('u1');

      // Version advanced from 0 → 1.
      expect(room.entityVersions.get('t1')).toBe(1);
    });

    it('rejects a stale update with 409 and neither confirms nor broadcasts', () => {
      const h = createHarness();
      const sender = makeConnection('p1', 'player');
      h.connections.set('p1', sender);
      const room = makeRoom('host');
      room.players.add('p1');
      room.entityVersions.set('t1', 3); // server already at v3

      h.emit('event:token/move', {
        connection: sender,
        room,
        message: evt('token/move', {
          tokenId: 't1',
          expectedVersion: 1, // stale
          updateId: 'u-stale',
          position: { x: 1, y: 1 },
        }),
      });

      expect(h.broadcasts).toHaveLength(0);
      expect(sentTypes(h.sent)).toContain('error');
      expect(sentTypes(h.sent)).not.toContain('update-confirmed');
      // Version untouched by the rejected update.
      expect(room.entityVersions.get('t1')).toBe(3);
    });
  });

  describe('authority enforcement', () => {
    it('denies drawing/clear from a non-host and does not broadcast', () => {
      const h = createHarness();
      const player = makeConnection('p1', 'player');
      h.connections.set('p1', player);
      const room = makeRoom('host');
      room.players.add('p1');

      h.emit('event:drawing/clear', {
        connection: player,
        room,
        message: evt('drawing/clear', {}),
      });

      expect(h.broadcasts).toHaveLength(0);
      expect(sentTypes(h.sent)).toContain('error');
      expect(player.maliciousAttemptsCount).toBe(1);
    });

    it('allows the host to drawing/clear', () => {
      const h = createHarness();
      const host = makeConnection('host', 'host');
      h.connections.set('host', host);
      const room = makeRoom('host');

      h.emit('event:drawing/clear', {
        connection: host,
        room,
        message: evt('drawing/clear', {}),
      });

      expect(h.broadcasts).toHaveLength(1);
      expect(sentTypes(h.sent)).not.toContain('error');
    });

    it('blocks player token moves while the host is offline', () => {
      const h = createHarness();
      const player = makeConnection('p1', 'player');
      h.connections.set('p1', player);
      const room = makeRoom('host', /* dmConnected */ false);
      room.players.add('p1');

      h.emit('event:token/move', {
        connection: player,
        room,
        message: evt('token/move', {
          tokenId: 't1',
          expectedVersion: 0,
          updateId: 'u1',
        }),
      });

      expect(h.broadcasts).toHaveLength(0);
      expect(sentTypes(h.sent)).toContain('error');
    });

    it('denies fog/update from a non-host (malicious player) and does not broadcast', () => {
      const h = createHarness();
      const player = makeConnection('p1', 'player');
      h.connections.set('p1', player);
      const room = makeRoom('host');
      room.players.add('p1');

      h.emit('event:fog/update', {
        connection: player,
        room,
        message: evt('fog/update', {
          sceneId: 'scene-1',
          fog: { enabled: true, shapes: [] },
        }),
      });

      expect(h.broadcasts).toHaveLength(0);
      expect(sentTypes(h.sent)).toContain('error');
      expect(player.maliciousAttemptsCount).toBe(1);
    });

    it('denies fog/clear from a non-host and does not broadcast', () => {
      const h = createHarness();
      const player = makeConnection('p1', 'player');
      h.connections.set('p1', player);
      const room = makeRoom('host');
      room.players.add('p1');

      h.emit('event:fog/clear', {
        connection: player,
        room,
        message: evt('fog/clear', { sceneId: 'scene-1' }),
      });

      expect(h.broadcasts).toHaveLength(0);
      expect(sentTypes(h.sent)).toContain('error');
    });

    it('allows the host to fog/update and relays the full SceneFog to peers', () => {
      const h = createHarness();
      const host = makeConnection('host', 'host');
      h.connections.set('host', host);
      const room = makeRoom('host');

      h.emit('event:fog/update', {
        connection: host,
        room,
        message: evt('fog/update', {
          sceneId: 'scene-1',
          fog: { enabled: true, shapes: [{ id: 's1', kind: 'reveal' }] },
        }),
      });

      expect(h.broadcasts).toHaveLength(1);
      expect(sentTypes(h.sent)).not.toContain('error');
      const relayed = h.broadcasts[0].message as ServerEventMessage;
      expect(relayed.data.name).toBe('fog/update');
      expect(
        (relayed.data as { fog: { shapes: unknown[] } }).fog.shapes,
      ).toHaveLength(1);
    });

    it('allows a co-host to fog/clear', () => {
      const h = createHarness();
      const coHost = makeConnection('c1', 'player');
      h.connections.set('c1', coHost);
      const room = makeRoom('host');
      room.coHosts.add('c1');

      h.emit('event:fog/clear', {
        connection: coHost,
        room,
        message: evt('fog/clear', { sceneId: 'scene-1' }),
      });

      expect(h.broadcasts).toHaveLength(1);
      expect(sentTypes(h.sent)).not.toContain('error');
    });
  });

  describe('cursor + targeted delivery', () => {
    it('relays cursor/update without sending a confirmation', () => {
      const h = createHarness();
      const sender = makeConnection('p1', 'player');
      h.connections.set('p1', sender);
      const room = makeRoom('host');
      room.players.add('p1');

      h.emit('event:cursor/update', {
        connection: sender,
        room,
        message: evt('cursor/update', { updateId: 'u1', x: 1, y: 2 }),
      });

      expect(h.broadcasts).toHaveLength(1);
      expect(h.broadcasts[0].excludeId).toBe('p1');
      // Cursor is fire-and-forget: never confirmed.
      expect(sentTypes(h.sent)).not.toContain('update-confirmed');
    });

    it('delivers a dst-targeted event only to the named peer in the room', () => {
      const h = createHarness();
      const sender = makeConnection('p1', 'player');
      const target = makeConnection('p2', 'player');
      h.connections.set('p1', sender);
      h.connections.set('p2', target);
      const room = makeRoom('host');
      room.players.add('p1');
      room.players.add('p2');
      room.connections.set('p2', target.ws);

      const message: ServerEventMessage = {
        ...evt('token/update', { tokenId: 't1', expectedVersion: 0 }),
        dst: 'p2',
      };
      h.emit('event:token/update', { connection: sender, room, message });

      // No room-wide broadcast; a single targeted send to p2.
      expect(h.broadcasts).toHaveLength(0);
      const targeted = h.sent.find(
        (s) =>
          s.connection === target &&
          (s.message as ServerEventMessage).data?.name === 'token/update',
      );
      expect(targeted).toBeDefined();
    });
  });
});
