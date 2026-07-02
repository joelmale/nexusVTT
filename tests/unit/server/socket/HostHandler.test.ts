import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HostHandler } from '../../../../server/socket/handlers/HostHandler.js';
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
    ws: { close: vi.fn(), readyState: 1 },
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
    entityVersions: new Map(),
  } as unknown as Room;
}

function kickEvent(targetUserId: string): ServerEventMessage {
  return {
    type: 'event',
    data: { name: 'session/kickPlayer', targetUserId },
    timestamp: Date.now(),
  };
}

function coHostEvent(
  name: 'host/add-cohost' | 'host/remove-cohost',
  targetUserId: string,
): ServerEventMessage {
  return {
    type: 'event',
    data: { name, targetUserId },
    timestamp: Date.now(),
  };
}

function createHarness() {
  const handlers = new Map<string, (payload: HandlerPayload) => void>();
  const connections = new Map<string, Connection>();
  const sent: Array<{ connection: Connection; message: ServerMessage }> = [];
  const broadcasts: Array<{ code: string; message: ServerMessage }> = [];

  const socketManager = {
    connections,
    on: (event: string, cb: (payload: HandlerPayload) => void) => {
      handlers.set(event, cb);
    },
    getConnection: (id: string) => connections.get(id),
    sendMessage: (connection: Connection, message: ServerMessage) => {
      sent.push({ connection, message });
    },
    broadcastToRoom: (code: string, message: ServerMessage) => {
      broadcasts.push({ code, message });
    },
  } as unknown as SocketManager;

  new HostHandler(socketManager, {} as unknown as DatabaseService);

  const emit = (event: string, payload: HandlerPayload) => {
    const handler = handlers.get(event);
    if (!handler) throw new Error(`No handler registered for ${event}`);
    handler(payload);
  };

  return { connections, sent, broadcasts, emit };
}

/** Names of events broadcast to the room, in order. */
const broadcastNames = (broadcasts: Array<{ message: ServerMessage }>) =>
  broadcasts
    .map((b) => (b.message as ServerEventMessage).data?.name)
    .filter(Boolean);

describe('HostHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('kick player', () => {
    it('removes the player, broadcasts session/leave, notifies and closes the victim', () => {
      const h = createHarness();
      const host = makeConnection('host', 'host');
      const victim = makeConnection('p1', 'player');
      h.connections.set('host', host);
      h.connections.set('p1', victim);

      const room = makeRoom('host');
      room.players.add('p1');
      room.connections.set('p1', victim.ws);

      h.emit('event:session/kickPlayer', {
        connection: host,
        room,
        message: kickEvent('p1'),
      });

      // Player removed from all room state.
      expect(room.players.has('p1')).toBe(false);
      expect(room.connections.has('p1')).toBe(false);
      expect(h.connections.has('p1')).toBe(false);

      // Everyone else told to drop the player.
      expect(broadcastNames(h.broadcasts)).toContain('session/leave');
      const leave = h.broadcasts.find(
        (b) => (b.message as ServerEventMessage).data.name === 'session/leave',
      );
      expect((leave!.message as ServerEventMessage).data.uuid).toBe('p1');

      // Victim told directly and disconnected with a normal-closure code.
      const kicked = h.sent.find(
        (s) => (s.message as ServerEventMessage).data.name === 'session/kicked',
      );
      expect(kicked).toBeDefined();
      expect(kicked!.connection).toBe(victim);
      expect(victim.ws.close).toHaveBeenCalledWith(1000, 'Kicked by host');
    });

    it('allows a co-host to kick a player', () => {
      const h = createHarness();
      const coHost = makeConnection('co', 'host');
      const victim = makeConnection('p1', 'player');
      h.connections.set('co', coHost);
      h.connections.set('p1', victim);

      const room = makeRoom('host');
      room.coHosts.add('co');
      room.players.add('co');
      room.players.add('p1');

      h.emit('event:session/kickPlayer', {
        connection: coHost,
        room,
        message: kickEvent('p1'),
      });

      expect(room.players.has('p1')).toBe(false);
      expect(broadcastNames(h.broadcasts)).toContain('session/leave');
    });

    it('rejects a kick from a non-host and leaves state untouched', () => {
      const h = createHarness();
      const player = makeConnection('p1', 'player');
      const target = makeConnection('p2', 'player');
      h.connections.set('p1', player);
      h.connections.set('p2', target);

      const room = makeRoom('host');
      room.players.add('p1');
      room.players.add('p2');

      h.emit('event:session/kickPlayer', {
        connection: player,
        room,
        message: kickEvent('p2'),
      });

      expect(room.players.has('p2')).toBe(true);
      expect(broadcastNames(h.broadcasts)).not.toContain('session/leave');
      // An error was returned to the offender.
      expect(
        h.sent.some((s) => (s.message as ServerMessage).type === 'error'),
      ).toBe(true);
    });

    it('refuses to kick the host', () => {
      const h = createHarness();
      const host = makeConnection('host', 'host');
      h.connections.set('host', host);
      const room = makeRoom('host');

      h.emit('event:session/kickPlayer', {
        connection: host,
        room,
        message: kickEvent('host'),
      });

      expect(room.players.has('host')).toBe(true);
      expect(broadcastNames(h.broadcasts)).not.toContain('session/leave');
    });
  });

  describe('co-host privileges', () => {
    it('grants co-host and broadcasts session/cohost-added', () => {
      const h = createHarness();
      const host = makeConnection('host', 'host');
      const player = makeConnection('p1', 'player');
      h.connections.set('host', host);
      h.connections.set('p1', player);

      const room = makeRoom('host');
      room.players.add('p1');

      h.emit('event:host/add-cohost', {
        connection: host,
        room,
        message: coHostEvent('host/add-cohost', 'p1'),
      });

      expect(room.coHosts.has('p1')).toBe(true);
      expect(player.user?.type).toBe('host');
      const added = h.broadcasts.find(
        (b) =>
          (b.message as ServerEventMessage).data.name ===
          'session/cohost-added',
      );
      expect(added).toBeDefined();
      expect((added!.message as ServerEventMessage).data.coHostId).toBe('p1');
    });

    it('revokes co-host and broadcasts session/cohost-removed', () => {
      const h = createHarness();
      const host = makeConnection('host', 'host');
      const coHost = makeConnection('p1', 'host');
      h.connections.set('host', host);
      h.connections.set('p1', coHost);

      const room = makeRoom('host');
      room.players.add('p1');
      room.coHosts.add('p1');

      h.emit('event:host/remove-cohost', {
        connection: host,
        room,
        message: coHostEvent('host/remove-cohost', 'p1'),
      });

      expect(room.coHosts.has('p1')).toBe(false);
      expect(coHost.user?.type).toBe('player');
      expect(broadcastNames(h.broadcasts)).toContain('session/cohost-removed');
    });

    it('rejects co-host changes from a non-primary-host', () => {
      const h = createHarness();
      const coHost = makeConnection('co', 'host');
      const player = makeConnection('p1', 'player');
      h.connections.set('co', coHost);
      h.connections.set('p1', player);

      const room = makeRoom('host');
      room.coHosts.add('co'); // co is a co-host, but not the primary host
      room.players.add('co');
      room.players.add('p1');

      h.emit('event:host/add-cohost', {
        connection: coHost,
        room,
        message: coHostEvent('host/add-cohost', 'p1'),
      });

      expect(room.coHosts.has('p1')).toBe(false);
      expect(
        h.sent.some((s) => (s.message as ServerMessage).type === 'error'),
      ).toBe(true);
    });
  });
});
