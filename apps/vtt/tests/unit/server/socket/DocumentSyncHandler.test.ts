import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentSyncHandler } from '../../../../server/socket/handlers/DocumentSyncHandler.js';
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
    code: 'ROOM_DOC',
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

describe('DocumentSyncHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('broadcasts event:document/sync-session to room excluding sender', () => {
    let syncListener: ((payload: HandlerPayload) => void) | undefined;
    const broadcasts: Array<{
      code: string;
      message: ServerMessage;
      excludeId?: string;
    }> = [];

    const socketManager = {
      on: (event: string, cb: (payload: HandlerPayload) => void) => {
        if (event === 'event:document/sync-session') {
          syncListener = cb;
        }
      },
      broadcastToRoom: (
        code: string,
        message: ServerMessage,
        excludeId?: string,
      ) => {
        broadcasts.push({ code, message, excludeId });
      },
    } as unknown as SocketManager;

    new DocumentSyncHandler(socketManager, {} as unknown as DatabaseService);

    expect(syncListener).toBeDefined();

    const sender = makeConnection('sender-1');
    const room = makeRoom('host-1');
    const message: ServerEventMessage = {
      type: 'event',
      data: { name: 'document/sync-session', documentId: 'doc-123' },
      timestamp: Date.now(),
    };

    syncListener!({ connection: sender, room, message });

    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0]).toEqual({
      code: 'ROOM_DOC',
      message,
      excludeId: 'sender-1',
    });
  });
});
