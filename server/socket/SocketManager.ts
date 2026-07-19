import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { validate as validateUuid } from 'uuid';
import { encode, decode } from '@msgpack/msgpack';
import { Room, Connection, ServerMessage } from '../types.js';
import { DatabaseService } from '../database.js';
import { parseTransportEnvelope } from '../../shared/transport.js';
import type { AppendRoomEventResult } from '../repositories/EventJournalRepository.js';
import type {
  ClientEventIdentity,
  EventReplayWindow,
  OrderedTransportEnvelope,
} from '../../shared/events/contracts.js';
import { hasClientEventIdentity } from '../../shared/events/contracts.js';

const CLIENT_MESSAGE_TYPES = new Set([
  'event',
  'error',
  'heartbeat',
  'update-confirmed',
  'chat-message',
  'game-state-patch',
  'game-state-ack',
  'game-state-resync-required',
]);

export interface OrderedPublishOptions {
  excludeId?: string;
  identitySource?: ServerMessage;
  validate?: () => boolean;
  onAccepted?: () => void;
  onAcknowledged?: () => void;
  senderReceivesEvent?: boolean;
}

export class SocketManager extends EventEmitter {
  public rooms = new Map<string, Room>();
  public connections = new Map<string, Connection>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private useMessagePack = process.env.USE_MESSAGEPACK === 'true';
  private roomPublishQueues = new Map<string, Promise<void>>();
  private readonly orderedEventMetrics = {
    committed: 0,
    duplicates: 0,
    failed: 0,
    replayRequests: 0,
    replayed: 0,
    truncatedReplays: 0,
  };

  private readonly HIBERNATION_TIMEOUT = 72 * 60 * 60 * 1000;
  private readonly MAX_CONSECUTIVE_MISSES = 3;
  private readonly HEARTBEAT_INTERVAL = 30 * 1000;
  private readonly HEARTBEAT_TIMEOUT = 10 * 1000;

  constructor(
    private wss: WebSocketServer,
    private db: DatabaseService,
  ) {
    super();
    this.startHeartbeat();
    console.log(
      `🔌 SocketManager initialized (MessagePack: ${this.useMessagePack})`,
    );
  }

  public getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  public getConnection(id: string): Connection | undefined {
    return this.connections.get(id);
  }

  public addConnection(
    ws: WebSocket,
    displayName: string,
    existingId?: string,
  ): Connection {
    const id = existingId || uuidv4();
    const connection: Connection = {
      id,
      ws,
      user: {
        name: displayName,
        type: 'player',
      },
      consecutiveMisses: 0,
      connectionQuality: 'excellent',
    };

    this.connections.set(id, connection);

    ws.on('message', (data, isBinary) => {
      try {
        let decodedMessage: unknown;
        if (isBinary || this.useMessagePack) {
          decodedMessage = decode(data as Buffer);
        } else {
          decodedMessage = JSON.parse(data.toString()) as unknown;
        }
        const message = parseTransportEnvelope(
          decodedMessage,
          CLIENT_MESSAGE_TYPES,
        ) as ServerMessage;
        this.handleMessage(id, message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    });

    ws.on('close', () => this.handleDisconnect(id));
    ws.on('error', (error) => {
      console.error(`WebSocket error for ${id}:`, error);
      this.handleDisconnect(id);
    });

    return connection;
  }

  private handleMessage(fromId: string, message: ServerMessage) {
    if (message.type === 'heartbeat') {
      const data = message.data as { type: 'ping' | 'pong'; id: string };
      if (data.type === 'pong') {
        this.handleHeartbeatPong(fromId, data.id);
      }
      return;
    }

    const connection = this.connections.get(fromId);
    if (!connection?.room) return;

    const room = this.rooms.get(connection.room);
    if (!room) return;

    room.lastActivity = Date.now();

    // Emit for specialized handlers
    this.emit('message', { fromId, connection, room, message });
    this.emit(message.type, { fromId, connection, room, message });
    if (message.type === 'event' && message.data?.name) {
      this.emit(`event:${message.data.name}`, {
        fromId,
        connection,
        room,
        message,
      });
    }
  }

  public async handleDisconnect(id: string) {
    const connection = this.connections.get(id);
    if (!connection) return;

    if (connection.room) {
      const room = this.rooms.get(connection.room);
      if (room) {
        this.emit('disconnect', { id, connection, room });
      }
    }

    this.connections.delete(id);
  }

  public broadcastToRoom(
    roomCode: string,
    message: ServerMessage,
    excludeId?: string,
  ) {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const payload = this.useMessagePack
      ? encode(message)
      : JSON.stringify(message);

    room.connections.forEach((ws, id) => {
      if (id !== excludeId) {
        const connection = this.connections.get(id);
        if (connection && connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.send(payload);
        }
      }
    });
  }

  /**
   * Transactionally accepts a durable room event, assigns its room-global
   * sequence, acknowledges the sender, then broadcasts the stored envelope.
   * Reusing an eventId returns the original acknowledgement without another
   * broadcast, which makes client retries safe.
   */
  public publishOrderedEvent(
    room: Room,
    connection: Connection,
    message: ServerMessage,
    options: OrderedPublishOptions = {},
  ): Promise<AppendRoomEventResult | null> {
    return this.enqueueRoomPublish(room.code, async () => {
      const identitySource = options.identitySource || message;
      const identity = this.getEventIdentity(connection, identitySource);
      try {
        const existing = await this.db.findRoomEvent(
          room.code,
          identity.eventId,
        );
        if (existing) {
          this.orderedEventMetrics.duplicates += 1;
          if (options.senderReceivesEvent) {
            this.sendMessage(connection, existing as unknown as ServerMessage);
          }
          this.sendEventAcknowledgement(
            connection,
            identity.eventId,
            existing.serverSequence,
            true,
            !options.senderReceivesEvent,
          );
          options.onAcknowledged?.();
          return { duplicate: true, event: existing };
        }

        if (options.validate && !options.validate()) {
          return null;
        }

        const result = await this.db.appendRoomEvent(
          room.code,
          identity,
          message,
        );
        if (result.duplicate) {
          this.orderedEventMetrics.duplicates += 1;
        } else {
          this.orderedEventMetrics.committed += 1;
          options.onAccepted?.();
        }
        this.sendEventAcknowledgement(
          connection,
          identity.eventId,
          result.event.serverSequence,
          result.duplicate,
          !options.senderReceivesEvent,
        );
        options.onAcknowledged?.();

        if (!result.duplicate) {
          this.broadcastToRoom(
            room.code,
            result.event as unknown as ServerMessage,
            options.excludeId,
          );
        }
        return result;
      } catch (error) {
        this.orderedEventMetrics.failed += 1;
        console.error(
          `Failed to commit ordered event ${identity.eventId} in ${room.code}:`,
          error,
        );
        this.sendMessage(connection, {
          type: 'error',
          data: {
            message: 'Event could not be committed; the client will retry.',
            code: 503,
          },
          timestamp: Date.now(),
        });
        return null;
      }
    });
  }

  public findOrderedEvent(
    roomCode: string,
    message: ServerMessage,
  ): Promise<OrderedTransportEnvelope | null> {
    if (!hasClientEventIdentity(message) || !validateUuid(message.eventId)) {
      return Promise.resolve(null);
    }
    return this.db.findRoomEvent(roomCode, message.eventId);
  }

  public getRoomReplayWindow(
    roomCode: string,
    requestedSequence: number | null,
  ): Promise<EventReplayWindow> {
    return this.db.getRoomEventReplay(roomCode, requestedSequence);
  }

  public deliverRoomReplay(
    connection: Connection,
    replay: EventReplayWindow,
    requestedSequence: number | null,
  ): void {
    this.orderedEventMetrics.replayRequests += 1;
    this.orderedEventMetrics.replayed += replay.events.length;
    if (replay.truncated) this.orderedEventMetrics.truncatedReplays += 1;
    this.sendMessage(connection, {
      type: 'event-cursor',
      data: {
        mode:
          requestedSequence === null || replay.truncated
            ? 'baseline'
            : 'resume',
        sequence: replay.baselineSequence,
        replayThrough: replay.latestSequence,
      },
      timestamp: Date.now(),
    });

    for (const event of replay.events) {
      this.sendMessage(connection, event as unknown as ServerMessage);
    }
  }

  public sendMessage(connection: Connection, message: ServerMessage) {
    if (connection.ws.readyState === WebSocket.OPEN) {
      const payload = this.useMessagePack
        ? encode(message)
        : JSON.stringify(message);
      connection.ws.send(payload);
    }
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.connections.forEach((connection) => {
        if (connection.pendingPing) {
          this.handleMissedPong(connection.id);
        }
        const pingId = uuidv4();
        connection.pendingPing = pingId;
        connection.lastPing = Date.now();
        this.sendMessage(connection, {
          type: 'heartbeat',
          data: { type: 'ping', id: pingId },
          timestamp: Date.now(),
        });
      });
    }, this.HEARTBEAT_INTERVAL);
  }

  private handleHeartbeatPong(id: string, pingId: string) {
    const connection = this.connections.get(id);
    if (!connection || connection.pendingPing !== pingId) return;

    const responseTime = Date.now() - (connection.lastPing || 0);
    connection.lastPong = Date.now();
    connection.pendingPing = undefined;
    connection.consecutiveMisses = 0;
    this.updateConnectionQuality(connection, responseTime);
  }

  private handleMissedPong(id: string) {
    const connection = this.connections.get(id);
    if (!connection) return;
    connection.consecutiveMisses += 1;
    connection.pendingPing = undefined;
    if (connection.consecutiveMisses >= this.MAX_CONSECUTIVE_MISSES) {
      connection.connectionQuality = 'critical';
      this.handleDisconnect(id);
      connection.ws.terminate();
    } else if (connection.consecutiveMisses >= 2) {
      connection.connectionQuality = 'poor';
    } else if (connection.consecutiveMisses >= 1) {
      connection.connectionQuality = 'good';
    }
  }

  private updateConnectionQuality(
    connection: Connection,
    responseTime: number,
  ) {
    if (responseTime < 100) connection.connectionQuality = 'excellent';
    else if (responseTime < 500) connection.connectionQuality = 'good';
    else if (responseTime < 2000) connection.connectionQuality = 'poor';
    else connection.connectionQuality = 'critical';
  }

  public shutdown() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.connections.forEach((c) => c.ws.close());
    this.rooms.clear();
    this.connections.clear();
    this.roomPublishQueues.clear();
  }

  // Room lifecycle methods to be called by handlers or NexusServer
  public createRoom(code: string, room: Room) {
    this.rooms.set(code, room);
  }

  public removeRoom(code: string) {
    this.rooms.delete(code);
  }

  public getStats() {
    return {
      totalRooms: this.rooms.size,
      totalConnections: this.connections.size,
      orderedEvents: { ...this.orderedEventMetrics },
    };
  }

  private getEventIdentity(
    connection: Connection,
    message: ServerMessage,
  ): ClientEventIdentity {
    if (hasClientEventIdentity(message) && validateUuid(message.eventId)) {
      return {
        eventId: message.eventId,
        // Never trust a client-supplied actor identity.
        actorId: connection.id,
        clientSequence: message.clientSequence,
        occurredAt: message.occurredAt,
      };
    }

    connection.legacyClientSequence =
      (connection.legacyClientSequence || 0) + 1;
    return {
      eventId: uuidv4(),
      actorId: connection.id,
      clientSequence: connection.legacyClientSequence,
      occurredAt: message.timestamp,
    };
  }

  private sendEventAcknowledgement(
    connection: Connection,
    eventId: string,
    serverSequence: number,
    duplicate: boolean,
    advancesCursor: boolean,
  ): void {
    this.sendMessage(connection, {
      type: 'event-ack',
      data: { eventId, serverSequence, duplicate, advancesCursor },
      timestamp: Date.now(),
    });
  }

  private enqueueRoomPublish<T>(
    roomCode: string,
    task: () => Promise<T>,
  ): Promise<T> {
    const previous = this.roomPublishQueues.get(roomCode) || Promise.resolve();
    const current = previous.catch(() => undefined).then(task);
    this.roomPublishQueues.set(
      roomCode,
      current.then(
        () => undefined,
        () => undefined,
      ),
    );
    return current;
  }
}
