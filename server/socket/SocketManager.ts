import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4, validate as validateUuid } from 'uuid';
import { encode, decode } from '@msgpack/msgpack';
import jsonpatch, { type Operation } from 'fast-json-patch';
import { Room, Connection, ServerMessage, type GameState } from '../types.js';
import { DatabaseService } from '../database.js';
import { parseTransportEnvelope } from '../../shared/transport.js';
import {
  EntityVersionConflictError,
  type AppendRoomEventResult,
  type EntityVersionPrecondition,
} from '../repositories/EventJournalRepository.js';
import {
  RealtimeCoordinator,
  type DistributedRole,
  type DistributedRoomPresence,
} from '../services/realtimeCoordinator.js';
import type {
  ClientEventIdentity,
  EventReplayWindow,
  OrderedTransportEnvelope,
} from '../../shared/events/contracts.js';
import { hasClientEventIdentity } from '../../shared/events/contracts.js';
import { hashSync } from '../../shared/sync/hashSync.js';
import type { JsonValue } from '../../shared/sync/contracts.js';

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

const sanitizeSocketLogValue = (value: string): string =>
  value.replace(/[\r\n\t]/g, ' ').slice(0, 160);

export interface OrderedPublishOptions {
  excludeId?: string;
  identitySource?: ServerMessage;
  validate?: () => boolean;
  onAccepted?: () => void;
  onAcknowledged?: () => void;
  senderReceivesEvent?: boolean;
  entityVersion?: EntityVersionPrecondition;
  onVersionConflict?: (currentVersion: number) => void;
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
    versionConflicts: 0,
  };

  private readonly HIBERNATION_TIMEOUT = 72 * 60 * 60 * 1000;
  private readonly MAX_CONSECUTIVE_MISSES = 3;
  private readonly HEARTBEAT_INTERVAL = 30 * 1000;
  private readonly HEARTBEAT_TIMEOUT = 10 * 1000;

  constructor(
    private wss: WebSocketServer,
    private db: DatabaseService,
    private readonly realtime = new RealtimeCoordinator(db),
  ) {
    super();
    this.realtime.on('ordered', (event: OrderedTransportEnvelope) =>
      this.broadcastOrderedLocally(event),
    );
    this.realtime.on(
      'transient',
      (roomCode: string, message: ServerMessage, excludeId?: string) => {
        void this.handleRemoteTransient(roomCode, message, excludeId);
      },
    );
    this.realtime.on(
      'presence',
      (roomCode: string, presence: DistributedRoomPresence) =>
        this.applyDistributedPresence(roomCode, presence),
    );
    this.realtime.on(
      'host-lease-lost',
      (roomCode: string, connectionId: string) => {
        const connection = this.connections.get(connectionId);
        if (!connection || connection.room !== roomCode) return;
        this.sendMessage(connection, {
          type: 'error',
          data: {
            message: 'Host authority moved to another connection.',
            code: 409,
          },
          timestamp: Date.now(),
        });
        connection.ws.close(1012, 'Host lease superseded');
      },
    );
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
    requestedInstanceId?: string,
    reconnectTrigger?: string,
  ): Connection {
    const id = existingId || uuidv4();
    let instanceId =
      requestedInstanceId && validateUuid(requestedInstanceId)
        ? requestedInstanceId
        : uuidv4();
    const previousConnection = this.connections.get(id);
    const safeReconnectTrigger = reconnectTrigger
      ? sanitizeSocketLogValue(reconnectTrigger)
      : 'connect';
    if (previousConnection?.instanceId === instanceId) {
      instanceId = uuidv4();
    }
    const connection: Connection = {
      id,
      instanceId,
      ws,
      user: {
        name: displayName,
        type: 'player',
      },
      consecutiveMisses: 0,
      connectionQuality: 'excellent',
      reconnectTrigger: safeReconnectTrigger,
    };

    this.connections.set(id, connection);
    console.info('[WebSocket] connection registered', {
      socketInstanceId: instanceId,
      participantId: id,
      reconnectTrigger: safeReconnectTrigger,
    });

    if (
      previousConnection &&
      previousConnection.instanceId !== instanceId &&
      previousConnection.ws.readyState !== WebSocket.CLOSED
    ) {
      console.info('[WebSocket] replacing participant socket', {
        socketInstanceId: instanceId,
        replacedSocketInstanceId: previousConnection.instanceId,
        participantId: id,
        reconnectTrigger: safeReconnectTrigger,
      });
      previousConnection.ws.close(4000, 'Superseded by newer connection');
    }

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
        this.handleMessage(id, instanceId, message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    });

    ws.on('close', (code, reason) => {
      void this.handleDisconnect(id, instanceId, code, reason.toString());
    });
    ws.on('error', (error) => {
      console.error('[WebSocket] server socket error', {
        socketInstanceId: instanceId,
        participantId: id,
        error,
      });
      void this.handleDisconnect(id, instanceId, 1011, 'Socket error');
    });

    return connection;
  }

  private handleMessage(
    fromId: string,
    instanceId: string,
    message: ServerMessage,
  ) {
    const connection = this.connections.get(fromId);
    if (!connection || connection.instanceId !== instanceId) {
      console.warn('[WebSocket] ignored message from superseded socket', {
        socketInstanceId: instanceId,
        activeSocketInstanceId: connection?.instanceId || null,
        participantId: fromId,
        messageType: message.type,
      });
      return;
    }

    if (message.type === 'heartbeat') {
      const data = message.data as { type: 'ping' | 'pong'; id: string };
      if (data.type === 'ping') {
        this.sendMessage(connection, {
          type: 'heartbeat',
          data: { type: 'pong', id: data.id },
          timestamp: Date.now(),
        });
      } else {
        this.handleHeartbeatPong(fromId, instanceId, data.id);
      }
      return;
    }

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

  public async handleDisconnect(
    id: string,
    instanceId: string,
    closeCode = 1006,
    closeReason = '',
  ) {
    const connection = this.connections.get(id);
    const superseded = !connection || connection.instanceId !== instanceId;
    console.info('[WebSocket] connection closed', {
      socketInstanceId: instanceId,
      activeSocketInstanceId: connection?.instanceId || null,
      participantId: id,
      closeCode,
      closeReason: sanitizeSocketLogValue(closeReason),
      reconnectTrigger: connection?.reconnectTrigger || null,
      superseded,
    });
    if (superseded) return;

    if (connection.room) {
      const room = this.rooms.get(connection.room);
      if (room) {
        this.emit('disconnect', { id, instanceId, connection, room });
      }
    }

    if (this.connections.get(id)?.instanceId === instanceId) {
      this.connections.delete(id);
    }
  }

  public broadcastToRoom(
    roomCode: string,
    message: ServerMessage,
    excludeId?: string,
  ): void {
    this.broadcastLocally(roomCode, message, excludeId);
    void this.realtime.publishTransient(roomCode, message, excludeId);
  }

  private broadcastLocally(
    roomCode: string,
    message: ServerMessage,
    excludeId?: string,
  ): void {
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
          if (existing.echoToActor) {
            this.sendMessage(connection, existing as unknown as ServerMessage);
          }
          this.sendEventAcknowledgement(
            connection,
            identity.eventId,
            existing.serverSequence,
            true,
            !existing.echoToActor,
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
          Boolean(options.senderReceivesEvent),
          options.entityVersion,
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
          !result.event.echoToActor,
        );
        options.onAcknowledged?.();

        if (!result.duplicate) await this.realtime.publishOrdered(result.event);
        return result;
      } catch (error) {
        if (error instanceof EntityVersionConflictError) {
          this.orderedEventMetrics.versionConflicts += 1;
          options.onVersionConflict?.(error.currentVersion);
          return null;
        }
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
    const roomCode = connection.room || replay.events[0]?.roomCode;
    if (roomCode) this.realtime.registerRoom(roomCode, replay.latestSequence);
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

  private handleHeartbeatPong(
    id: string,
    instanceId: string,
    pingId: string,
  ) {
    const connection = this.connections.get(id);
    if (
      !connection ||
      connection.instanceId !== instanceId ||
      connection.pendingPing !== pingId
    ) {
      return;
    }

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
      void this.handleDisconnect(
        id,
        connection.instanceId,
        4001,
        'Heartbeat timeout',
      );
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

  public async shutdown(): Promise<void> {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.connections.forEach((c) => c.ws.close());
    this.rooms.clear();
    this.connections.clear();
    this.roomPublishQueues.clear();
    await this.realtime.shutdown();
  }

  // Room lifecycle methods to be called by handlers or NexusServer
  public createRoom(code: string, room: Room) {
    this.rooms.set(code, room);
  }

  public removeRoom(code: string) {
    this.rooms.delete(code);
    this.realtime.unregisterRoom(code);
  }

  public initializeRealtime(): Promise<void> {
    return this.realtime.initialize();
  }

  public async registerDistributedConnection(
    room: Room,
    connection: Connection,
    role: DistributedRole,
    baselineSequence = 0,
  ): Promise<boolean> {
    this.realtime.registerRoom(room.code, baselineSequence);
    const registered = await this.realtime.registerPresence(
      room.code,
      connection.id,
      connection.id,
      role,
    );
    if (registered) await this.hydrateDistributedPresence(room);
    return registered;
  }

  public async unregisterDistributedConnection(
    roomCode: string,
    connectionId: string,
  ): Promise<void> {
    await this.realtime.unregisterPresence(roomCode, connectionId);
  }

  public updateDistributedRole(
    roomCode: string,
    connectionId: string,
    role: DistributedRole,
  ): Promise<void> {
    return this.realtime.updatePresenceRole(roomCode, connectionId, role);
  }

  public async hydrateDistributedPresence(room: Room): Promise<void> {
    this.applyDistributedPresence(
      room.code,
      await this.realtime.getRoomPresence(room.code),
    );
  }

  public getStats() {
    return {
      totalRooms: this.rooms.size,
      totalConnections: this.connections.size,
      orderedEvents: { ...this.orderedEventMetrics },
      realtime: this.realtime.getMetrics(),
    };
  }

  private broadcastOrderedLocally(event: OrderedTransportEnvelope): void {
    this.applyOrderedRoomMutation(event);
    this.broadcastLocally(
      event.roomCode,
      event as unknown as ServerMessage,
      event.echoToActor ? undefined : event.actorId,
    );
  }

  private applyDistributedPresence(
    roomCode: string,
    presence: DistributedRoomPresence,
  ): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    const distributedPlayers = presence.members.map((member) => member.userId);
    const activePlayerIds = new Set([
      ...distributedPlayers,
      ...room.connections.keys(),
    ]);
    room.players = new Set([...activePlayerIds]);
    room.coHosts = new Set([
      ...Array.from(room.coHosts).filter((userId) =>
        activePlayerIds.has(userId),
      ),
      ...presence.members
        .filter((member) => member.role === 'cohost')
        .map((member) => member.userId),
    ]);
    room.dmConnected =
      presence.hostLease !== null ||
      presence.members.some((member) => member.role === 'host');
  }

  private async handleRemoteTransient(
    roomCode: string,
    message: ServerMessage,
    excludeId?: string,
  ): Promise<void> {
    try {
      const resolved = await this.applyRemoteRoomMutation(roomCode, message);
      this.broadcastLocally(roomCode, resolved, excludeId);
    } catch (error) {
      console.error(
        `Failed to reconcile remote mutation in room ${roomCode}:`,
        error,
      );
    }
  }

  private async applyRemoteRoomMutation(
    roomCode: string,
    message: ServerMessage,
  ): Promise<ServerMessage> {
    const room = this.rooms.get(roomCode);
    if (!room) return message;
    if (message.type === 'game-state-patch') {
      const { baseToken, newToken, patch, version } = message.data;
      if (
        room.gameState &&
        room.syncToken === baseToken &&
        typeof newToken === 'string' &&
        Array.isArray(patch)
      ) {
        try {
          const nextState = jsonpatch.applyPatch(
            structuredClone(room.gameState),
            patch as Operation[],
            true,
            false,
          ).newDocument as GameState;
          if (hashSync(nextState as unknown as JsonValue) === newToken) {
            room.previousGameState = room.gameState;
            room.gameState = nextState;
            room.syncToken = newToken;
            room.stateVersion = Math.max(room.stateVersion, version);
            return message;
          }
        } catch (error) {
          console.error(
            `Failed to apply remote game-state patch in ${roomCode}:`,
            error,
          );
        }
      }

      // A patch may arrive out of order when different replicas win adjacent
      // database commits. Hydrate the latest committed tuple and send local
      // clients one authoritative snapshot instead of dropping the update.
      const session = await this.db.getSessionByJoinCode(roomCode);
      if (!session?.gameState) return message;
      const authoritativeState = session.gameState as GameState;
      const authoritativeToken = hashSync(
        authoritativeState as unknown as JsonValue,
      );
      room.previousGameState = room.gameState;
      room.gameState = authoritativeState;
      room.syncToken = authoritativeToken;
      room.stateVersion = session.stateVersion;
      return {
        type: 'game-state-resync-required',
        data: {
          serverToken: authoritativeToken,
          gameState: authoritativeState,
          version: session.stateVersion,
          reason: 'base-mismatch',
        },
        timestamp: Date.now(),
      };
    }
    if (message.type !== 'event') return message;
    const eventData = message.data as Record<string, unknown> & {
      name: string;
    };
    const eventName = eventData.name;
    const userId = typeof eventData.uuid === 'string' ? eventData.uuid : null;
    if (eventName === 'session/join' && userId) room.players.add(userId);
    if (eventName === 'session/leave' && userId) {
      room.players.delete(userId);
      room.coHosts.delete(userId);
    }
    if (
      eventName === 'session/cohost-added' &&
      typeof eventData.coHostId === 'string'
    ) {
      room.coHosts.add(eventData.coHostId);
    }
    if (
      eventName === 'session/cohost-removed' &&
      typeof eventData.coHostId === 'string'
    ) {
      room.coHosts.delete(eventData.coHostId);
    }
    if (
      eventName === 'session/host-changed' &&
      typeof eventData.newHostId === 'string'
    ) {
      room.host = eventData.newHostId;
    }
    if (
      eventName === 'session/dm-status' &&
      typeof eventData.dmConnected === 'boolean'
    ) {
      room.dmConnected = eventData.dmConnected;
    }
    return message;
  }

  private applyOrderedRoomMutation(event: OrderedTransportEnvelope): void {
    const room = this.rooms.get(event.roomCode);
    if (!room || event.type !== 'event') return;
    const data = event.data as Record<string, unknown> & { name?: string };
    const entityId =
      typeof data.tokenId === 'string'
        ? data.tokenId
        : typeof data.propId === 'string'
          ? data.propId
          : null;
    if (
      entityId &&
      typeof data.expectedVersion === 'number' &&
      [
        'token/move',
        'token/update',
        'token/delete',
        'prop/move',
        'prop/update',
        'prop/delete',
        'prop/interact',
      ].includes(String(data.name))
    ) {
      room.entityVersions.set(
        entityId,
        Math.max(
          room.entityVersions.get(entityId) ?? 0,
          data.expectedVersion + 1,
        ),
      );
    }
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
