import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WebSocket, WebSocketServer } from 'ws';
import { SocketManager } from '../../../../server/socket/SocketManager.js';
import { EntityVersionConflictError } from '../../../../server/repositories/EventJournalRepository.js';
import type { DatabaseService } from '../../../../server/database.js';
import type {
  Connection,
  Room,
  ServerEventMessage,
} from '../../../../server/types.js';
import type { OrderedTransportEnvelope } from '../../../../shared/events/contracts.js';

function connection(id: string): Connection {
  return {
    id,
    ws: {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
    } as unknown as WebSocket,
    user: { name: id, type: 'host' },
    consecutiveMisses: 0,
    connectionQuality: 'excellent',
  };
}

function room(sender: Connection, peer: Connection): Room {
  return {
    code: 'ABCD',
    host: sender.id,
    coHosts: new Set(),
    players: new Set([sender.id, peer.id]),
    connections: new Map([
      [sender.id, sender.ws],
      [peer.id, peer.ws],
    ]),
    created: Date.now(),
    lastActivity: Date.now(),
    status: 'active',
    dmConnected: true,
    stateVersion: 0,
    entityVersions: new Map(),
    syncToken: null,
  };
}

describe('SocketManager ordered events', () => {
  const managers: SocketManager[] = [];
  afterEach(() => {
    managers.splice(0).forEach((manager) => manager.shutdown());
  });

  it('broadcasts one committed envelope and only acknowledges its retry', async () => {
    let stored: OrderedTransportEnvelope | null = null;
    const database = {
      findRoomEvent: vi.fn(async () => stored),
      appendRoomEvent: vi.fn(
        async (
          roomCode: string,
          identity: {
            eventId: string;
            actorId: string;
            clientSequence: number;
            occurredAt: number;
          },
          message: ServerEventMessage,
        ) => {
          stored = {
            ...message,
            ...identity,
            roomCode,
            serverSequence: 1,
            echoToActor: false,
          };
          return { duplicate: false, event: stored };
        },
      ),
    } as unknown as DatabaseService;
    const manager = new SocketManager({} as WebSocketServer, database);
    managers.push(manager);
    const sender = connection('11111111-1111-4111-8111-111111111111');
    const peer = connection('22222222-2222-4222-8222-222222222222');
    const activeRoom = room(sender, peer);
    manager.rooms.set(activeRoom.code, activeRoom);
    manager.connections.set(sender.id, sender);
    manager.connections.set(peer.id, peer);

    const message: ServerEventMessage = {
      type: 'event',
      data: { name: 'scene/update', sceneId: 'scene-1' },
      timestamp: 1,
      eventId: '33333333-3333-4333-8333-333333333333',
      actorId: sender.id,
      clientSequence: 1,
      occurredAt: 1,
    };

    await manager.publishOrderedEvent(activeRoom, sender, message, {
      excludeId: sender.id,
    });
    await manager.publishOrderedEvent(activeRoom, sender, message, {
      excludeId: sender.id,
    });

    expect(database.appendRoomEvent).toHaveBeenCalledTimes(1);
    expect(peer.ws.send).toHaveBeenCalledTimes(1);
    const acknowledgements = vi
      .mocked(sender.ws.send)
      .mock.calls.map((call) => JSON.parse(String(call[0]))) as Array<{
      data: { duplicate: boolean; serverSequence: number };
    }>;
    expect(acknowledgements).toHaveLength(2);
    expect(acknowledgements.map((message) => message.data.duplicate)).toEqual([
      false,
      true,
    ]);
    expect(
      acknowledgements.every((message) => message.data.serverSequence === 1),
    ).toBe(true);
    expect(manager.getStats().orderedEvents).toMatchObject({
      committed: 1,
      duplicates: 1,
      failed: 0,
    });
  });

  it('reports an entity compare-and-swap conflict without counting an infrastructure failure', async () => {
    const database = {
      findRoomEvent: vi.fn(async () => null),
      appendRoomEvent: vi.fn(async () => {
        throw new EntityVersionConflictError('token-1', 0, 1);
      }),
    } as unknown as DatabaseService;
    const manager = new SocketManager({} as WebSocketServer, database);
    managers.push(manager);
    const sender = connection('11111111-1111-4111-8111-111111111111');
    const peer = connection('22222222-2222-4222-8222-222222222222');
    const activeRoom = room(sender, peer);
    manager.rooms.set(activeRoom.code, activeRoom);
    manager.connections.set(sender.id, sender);

    const onVersionConflict = vi.fn();
    await manager.publishOrderedEvent(
      activeRoom,
      sender,
      {
        type: 'event',
        data: {
          name: 'token/move',
          tokenId: 'token-1',
          expectedVersion: 0,
        },
        timestamp: 1,
        eventId: '33333333-3333-4333-8333-333333333333',
        actorId: sender.id,
        clientSequence: 1,
        occurredAt: 1,
      },
      {
        entityVersion: { entityId: 'token-1', expectedVersion: 0 },
        onVersionConflict,
      },
    );

    expect(onVersionConflict).toHaveBeenCalledWith(1);
    expect(manager.getStats().orderedEvents).toMatchObject({
      failed: 0,
      versionConflicts: 1,
    });
    expect(sender.ws.send).not.toHaveBeenCalled();
  });
});
