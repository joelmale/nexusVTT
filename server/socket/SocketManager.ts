import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { encode, decode } from '@msgpack/msgpack';
import { Room, Connection, ServerMessage } from '../types.js';
import { DatabaseService } from '../database.js';
import { parseTransportEnvelope } from '../../shared/transport.js';

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

export class SocketManager extends EventEmitter {
  public rooms = new Map<string, Room>();
  public connections = new Map<string, Connection>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private useMessagePack = process.env.USE_MESSAGEPACK === 'true';

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
    };
  }
}
