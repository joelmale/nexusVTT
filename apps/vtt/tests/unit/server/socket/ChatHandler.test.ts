import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatHandler } from '../../../../server/socket/handlers/ChatHandler.js';
import type { SocketManager } from '../../../../server/socket/SocketManager.js';
import type { DatabaseService } from '../../../../server/database.js';
import type {
  Connection,
  Room,
  ServerChatMessage,
  ServerMessage,
} from '../../../../server/types.js';

type ChatPayload = {
  connection: Connection;
  room: Room;
  message: ServerChatMessage;
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
    code: 'ROOM_CHAT',
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

describe('ChatHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registers chat-message listener and publishes ordered event with senderReceivesEvent: true', async () => {
    let chatListener: ((payload: ChatPayload) => void) | undefined;
    let publishedOptions: { senderReceivesEvent?: boolean } | undefined;
    let publishedMessage: ServerMessage | undefined;

    const socketManager = {
      on: (event: string, cb: (payload: ChatPayload) => void) => {
        if (event === 'chat-message') {
          chatListener = cb;
        }
      },
      publishOrderedEvent: (
        _room: Room,
        _connection: Connection,
        message: ServerMessage,
        options?: { senderReceivesEvent?: boolean },
      ) => {
        publishedMessage = message;
        publishedOptions = options;
        return Promise.resolve(null);
      },
    } as unknown as SocketManager;

    new ChatHandler(socketManager, {} as unknown as DatabaseService);

    expect(chatListener).toBeDefined();

    const sender = makeConnection('alice');
    const room = makeRoom('host-1');
    const message: ServerChatMessage = {
      type: 'chat',
      data: {
        id: 'msg-1',
        sender: 'alice',
        content: 'Hello adventurers!',
        timestamp: Date.now(),
      },
    };

    await chatListener!({ connection: sender, room, message });

    expect(publishedMessage).toEqual(message);
    expect(publishedOptions).toEqual({ senderReceivesEvent: true });
  });
});
