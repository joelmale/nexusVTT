import { EventEmitter } from 'events';
import { createClient } from 'redis';
import { v4 as uuidv4 } from 'uuid';
import type { DatabaseService } from '../database.js';
import type { ServerMessage } from '../types.js';
import {
  hasOrderedEventMetadata,
  type OrderedTransportEnvelope,
} from '../../shared/events/contracts.js';

const FANOUT_CHANNEL = 'nexus:vtt:fanout:v1';
const PRESENCE_TTL_MS = 45_000;
const PRESENCE_REFRESH_MS = 15_000;

interface RedisScoreMember {
  score: number;
  value: string;
}

interface RedisClientAdapter {
  readonly isOpen: boolean;
  connect(): Promise<unknown>;
  duplicate(): RedisClientAdapter;
  on(event: string, listener: (...args: unknown[]) => void): RedisClientAdapter;
  publish(channel: string, message: string): Promise<number>;
  subscribe(
    channel: string,
    listener: (message: string) => void,
  ): Promise<unknown>;
  quit(): Promise<unknown>;
  get(key: string): Promise<string | null>;
  eval(
    script: string,
    options: { keys: string[]; arguments: string[] },
  ): Promise<unknown>;
  zAdd(key: string, member: RedisScoreMember): Promise<number>;
  zRem(key: string, member: string): Promise<number>;
  zRemRangeByScore(
    key: string,
    minimum: number,
    maximum: number,
  ): Promise<number>;
  zRangeWithScores(
    key: string,
    minimum: number,
    maximum: number,
  ): Promise<RedisScoreMember[]>;
}

export type DistributedRole = 'host' | 'cohost' | 'player';

export interface DistributedPresenceMember {
  instanceId: string;
  connectionId: string;
  userId: string;
  role: DistributedRole;
}

export interface DistributedRoomPresence {
  members: DistributedPresenceMember[];
  hostLease: {
    userId: string;
    instanceId: string;
    connectionId: string;
  } | null;
}

interface LocalPresence extends DistributedPresenceMember {
  roomCode: string;
  member: string;
  leaseValue?: string;
}

interface OrderedFanout {
  version: 1;
  kind: 'ordered';
  originInstanceId: string;
  roomCode: string;
  publishedAt: number;
  event: OrderedTransportEnvelope;
}

interface TransientFanout {
  version: 1;
  kind: 'transient';
  originInstanceId: string;
  roomCode: string;
  publishedAt: number;
  excludeId?: string;
  message: ServerMessage;
}

interface PresenceFanout {
  version: 1;
  kind: 'presence';
  originInstanceId: string;
  roomCode: string;
  publishedAt: number;
}

type FanoutMessage = OrderedFanout | TransientFanout | PresenceFanout;

export interface RealtimeCoordinatorMetrics {
  enabled: boolean;
  connected: boolean;
  instanceId: string;
  orderedPublished: number;
  orderedReceived: number;
  transientPublished: number;
  transientReceived: number;
  sequenceGaps: number;
  journalCatchUps: number;
  replayedEvents: number;
  duplicateFanout: number;
  publishFailures: number;
  reconnects: number;
  presenceRefreshFailures: number;
  hostLeaseConflicts: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseFanoutMessage(value: string): FanoutMessage | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      !isRecord(parsed) ||
      parsed.version !== 1 ||
      typeof parsed.kind !== 'string' ||
      typeof parsed.originInstanceId !== 'string' ||
      typeof parsed.roomCode !== 'string' ||
      typeof parsed.publishedAt !== 'number'
    ) {
      return null;
    }
    if (
      parsed.kind === 'ordered' &&
      isRecord(parsed.event) &&
      hasOrderedEventMetadata(parsed.event) &&
      parsed.event.roomCode === parsed.roomCode
    ) {
      return parsed as unknown as OrderedFanout;
    }
    if (
      parsed.kind === 'transient' &&
      isRecord(parsed.message) &&
      typeof parsed.message.type === 'string' &&
      isRecord(parsed.message.data) &&
      typeof parsed.message.timestamp === 'number'
    ) {
      return parsed as unknown as TransientFanout;
    }
    if (parsed.kind === 'presence') return parsed as unknown as PresenceFanout;
  } catch {
    return null;
  }
  return null;
}

function parsePresenceMember(value: string): DistributedPresenceMember | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      !isRecord(parsed) ||
      typeof parsed.instanceId !== 'string' ||
      typeof parsed.connectionId !== 'string' ||
      typeof parsed.userId !== 'string' ||
      !['host', 'cohost', 'player'].includes(String(parsed.role))
    ) {
      return null;
    }
    return parsed as unknown as DistributedPresenceMember;
  } catch {
    return null;
  }
}

function parseHostLease(value: string | null): DistributedRoomPresence['hostLease'] {
  if (!value) return null;
  const [userId, instanceId, connectionId] = value.split('|');
  return userId && instanceId && connectionId
    ? { userId, instanceId, connectionId }
    : null;
}

export class RealtimeCoordinator extends EventEmitter {
  private readonly redisUrl = process.env.REDIS_URL;
  private readonly instanceId =
    process.env.BACKEND_INSTANCE_ID || uuidv4();
  private commandClient: RedisClientAdapter | null = null;
  private subscriberClient: RedisClientAdapter | null = null;
  private presenceTimer: NodeJS.Timeout | null = null;
  private connected = false;
  private initialized = false;
  private subscriberReadyOnce = false;
  private readonly activeRoomSequences = new Map<string, number>();
  private readonly roomQueues = new Map<string, Promise<void>>();
  private readonly localPresence = new Map<string, LocalPresence>();
  private readonly metrics: RealtimeCoordinatorMetrics = {
    enabled: Boolean(process.env.REDIS_URL),
    connected: false,
    instanceId: this.instanceId,
    orderedPublished: 0,
    orderedReceived: 0,
    transientPublished: 0,
    transientReceived: 0,
    sequenceGaps: 0,
    journalCatchUps: 0,
    replayedEvents: 0,
    duplicateFanout: 0,
    publishFailures: 0,
    reconnects: 0,
    presenceRefreshFailures: 0,
    hostLeaseConflicts: 0,
  };

  constructor(private readonly database: DatabaseService) {
    super();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    if (!this.redisUrl) {
      console.log('Realtime coordinator running in single-instance mode');
      return;
    }

    const command = createClient({ url: this.redisUrl });
    this.commandClient = command as unknown as RedisClientAdapter;
    this.subscriberClient = command.duplicate() as RedisClientAdapter;
    for (const client of [this.commandClient, this.subscriberClient]) {
      client.on('error', (error) => {
        this.connected = false;
        this.metrics.connected = false;
        console.error('Redis realtime coordinator error:', error);
      });
    }
    this.commandClient.on('ready', () => {
      this.connected = true;
      this.metrics.connected = true;
    });
    this.subscriberClient.on('ready', () => {
      this.connected = true;
      this.metrics.connected = true;
      if (this.subscriberReadyOnce) {
        this.metrics.reconnects += 1;
        void this.catchUpActiveRooms().catch((error: unknown) => {
          console.error('Failed to catch up rooms after Redis reconnect:', error);
        });
      }
      this.subscriberReadyOnce = true;
    });

    await Promise.all([
      this.commandClient.connect(),
      this.subscriberClient.connect(),
    ]);
    await this.subscriberClient.subscribe(FANOUT_CHANNEL, (message) => {
      void this.handleFanout(message).catch((error: unknown) => {
        console.error('Failed to process realtime fanout:', error);
      });
    });
    this.connected = true;
    this.metrics.connected = true;
    await this.refreshLocalPresence();
    this.presenceTimer = setInterval(() => {
      void this.refreshLocalPresence();
    }, PRESENCE_REFRESH_MS);
    this.presenceTimer.unref();
    console.log(`Redis realtime coordinator ready (${this.instanceId})`);
  }

  registerRoom(roomCode: string, baselineSequence: number): void {
    const normalized = roomCode.toUpperCase();
    const current = this.activeRoomSequences.get(normalized);
    if (current === undefined || baselineSequence > current) {
      this.activeRoomSequences.set(normalized, baselineSequence);
    }
  }

  unregisterRoom(roomCode: string): void {
    const normalized = roomCode.toUpperCase();
    this.activeRoomSequences.delete(normalized);
    this.roomQueues.delete(normalized);
  }

  async publishOrdered(event: OrderedTransportEnvelope): Promise<void> {
    await this.processOrderedEvent(event);
    this.metrics.orderedPublished += 1;
    await this.publish({
      version: 1,
      kind: 'ordered',
      originInstanceId: this.instanceId,
      roomCode: event.roomCode,
      publishedAt: Date.now(),
      event,
    });
  }

  async publishTransient(
    roomCode: string,
    message: ServerMessage,
    excludeId?: string,
  ): Promise<void> {
    const normalized = roomCode.toUpperCase();
    this.metrics.transientPublished += 1;
    await this.publish({
      version: 1,
      kind: 'transient',
      originInstanceId: this.instanceId,
      roomCode: normalized,
      publishedAt: Date.now(),
      excludeId,
      message,
    });
  }

  async registerPresence(
    roomCode: string,
    connectionId: string,
    userId: string,
    role: DistributedRole,
  ): Promise<boolean> {
    const normalized = roomCode.toUpperCase();
    const presence: DistributedPresenceMember = {
      instanceId: this.instanceId,
      connectionId,
      userId,
      role,
    };
    const member = JSON.stringify(presence);
    const local: LocalPresence = {
      ...presence,
      roomCode: normalized,
      member,
    };
    if (role === 'host') {
      local.leaseValue = `${userId}|${this.instanceId}|${connectionId}`;
      if (this.commandClient && this.connected) {
        const claimed = await this.claimHostLease(normalized, local.leaseValue);
        if (!claimed) {
          this.metrics.hostLeaseConflicts += 1;
          return false;
        }
      }
    }
    this.localPresence.set(this.presenceId(normalized, connectionId), local);
    if (this.commandClient && this.connected) {
      await this.writePresence(local);
      await this.publishPresenceSignal(normalized);
    }
    await this.refreshRoomPresence(normalized);
    return true;
  }

  async unregisterPresence(
    roomCode: string,
    connectionId: string,
  ): Promise<void> {
    const normalized = roomCode.toUpperCase();
    const presenceId = this.presenceId(normalized, connectionId);
    const local = this.localPresence.get(presenceId);
    this.localPresence.delete(presenceId);
    if (!local) return;
    if (this.commandClient && this.connected) {
      await this.commandClient.zRem(this.presenceKey(normalized), local.member);
      if (local.leaseValue) {
        await this.releaseHostLease(normalized, local.leaseValue);
      }
      await this.publishPresenceSignal(normalized);
    }
    await this.refreshRoomPresence(normalized);
  }

  async updatePresenceRole(
    roomCode: string,
    connectionId: string,
    role: DistributedRole,
  ): Promise<void> {
    const normalized = roomCode.toUpperCase();
    const id = this.presenceId(normalized, connectionId);
    const existing = this.localPresence.get(id);
    if (!existing || existing.role === role) return;
    if (this.commandClient && this.connected) {
      await this.commandClient.zRem(this.presenceKey(normalized), existing.member);
    }
    existing.role = role;
    existing.member = JSON.stringify({
      instanceId: existing.instanceId,
      connectionId: existing.connectionId,
      userId: existing.userId,
      role,
    } satisfies DistributedPresenceMember);
    await this.writePresence(existing);
    await this.publishPresenceSignal(normalized);
    await this.refreshRoomPresence(normalized);
  }

  async getRoomPresence(roomCode: string): Promise<DistributedRoomPresence> {
    const normalized = roomCode.toUpperCase();
    if (!this.commandClient || !this.connected) {
      return {
        members: Array.from(this.localPresence.values())
          .filter((presence) => presence.roomCode === normalized)
          .map(({ instanceId, connectionId, userId, role }) => ({
            instanceId,
            connectionId,
            userId,
            role,
          })),
        hostLease: null,
      };
    }
    const key = this.presenceKey(normalized);
    await this.commandClient.zRemRangeByScore(key, 0, Date.now());
    const [members, lease] = await Promise.all([
      this.commandClient.zRangeWithScores(key, 0, -1),
      this.commandClient.get(this.hostLeaseKey(normalized)),
    ]);
    return {
      members: members
        .map((entry) => parsePresenceMember(entry.value))
        .filter((entry): entry is DistributedPresenceMember => entry !== null),
      hostLease: parseHostLease(lease),
    };
  }

  getMetrics(): RealtimeCoordinatorMetrics {
    return {
      ...this.metrics,
      connected: this.connected,
    };
  }

  async shutdown(): Promise<void> {
    if (this.presenceTimer) clearInterval(this.presenceTimer);
    await Promise.all(
      Array.from(this.localPresence.values()).map((presence) =>
        this.unregisterPresence(presence.roomCode, presence.connectionId),
      ),
    );
    const clients = [this.subscriberClient, this.commandClient].filter(
      (client): client is RedisClientAdapter => client !== null && client.isOpen,
    );
    await Promise.all(clients.map((client) => client.quit()));
    this.connected = false;
    this.metrics.connected = false;
  }

  private async handleFanout(raw: string): Promise<void> {
    const message = parseFanoutMessage(raw);
    if (!message || message.originInstanceId === this.instanceId) return;
    message.roomCode = message.roomCode.toUpperCase();
    if (message.kind === 'ordered') {
      this.metrics.orderedReceived += 1;
      if (this.activeRoomSequences.has(message.roomCode)) {
        await this.processOrderedEvent(message.event);
      }
      return;
    }
    if (message.kind === 'transient') {
      this.metrics.transientReceived += 1;
      if (this.activeRoomSequences.has(message.roomCode)) {
        this.emit(
          'transient',
          message.roomCode,
          message.message,
          message.excludeId,
        );
      }
      return;
    }
    if (this.activeRoomSequences.has(message.roomCode)) {
      await this.refreshRoomPresence(message.roomCode);
    }
  }

  private processOrderedEvent(event: OrderedTransportEnvelope): Promise<void> {
    return this.enqueueRoom(event.roomCode, async () => {
      let cursor = this.activeRoomSequences.get(event.roomCode);
      if (cursor === undefined) {
        cursor = event.serverSequence - 1;
        this.activeRoomSequences.set(event.roomCode, cursor);
      }
      if (event.serverSequence <= cursor) {
        this.metrics.duplicateFanout += 1;
        return;
      }
      if (event.serverSequence > cursor + 1) {
        this.metrics.sequenceGaps += 1;
        await this.catchUpRoom(event.roomCode, cursor);
        return;
      }
      this.emit('ordered', event);
      this.activeRoomSequences.set(event.roomCode, event.serverSequence);
    });
  }

  private async catchUpRoom(roomCode: string, cursor: number): Promise<void> {
    const replay = await this.database.getRoomEventReplay(roomCode, cursor);
    this.metrics.journalCatchUps += 1;
    if (replay.truncated) {
      this.activeRoomSequences.set(roomCode, replay.baselineSequence);
    }
    let sequence = this.activeRoomSequences.get(roomCode) ?? cursor;
    for (const event of replay.events) {
      if (event.serverSequence <= sequence) continue;
      this.emit('ordered', event);
      sequence = event.serverSequence;
      this.metrics.replayedEvents += 1;
    }
    this.activeRoomSequences.set(roomCode, sequence);
  }

  private async catchUpActiveRooms(): Promise<void> {
    for (const [roomCode, cursor] of this.activeRoomSequences) {
      await this.enqueueRoom(roomCode, () => this.catchUpRoom(roomCode, cursor));
    }
  }

  private async publish(message: FanoutMessage): Promise<void> {
    if (!this.commandClient || !this.connected) return;
    try {
      await this.commandClient.publish(FANOUT_CHANNEL, JSON.stringify(message));
    } catch (error) {
      this.metrics.publishFailures += 1;
      console.error('Failed to publish realtime fanout:', error);
    }
  }

  private async refreshLocalPresence(): Promise<void> {
    try {
      const refreshedRooms = new Set<string>();
      for (const presence of this.localPresence.values()) {
        await this.writePresence(presence);
        if (presence.leaseValue) {
          const refreshed = await this.refreshHostLease(
            presence.roomCode,
            presence.leaseValue,
          );
          if (!refreshed) {
            const currentLease = await this.commandClient?.get(
              this.hostLeaseKey(presence.roomCode),
            );
            if (currentLease) {
              this.metrics.hostLeaseConflicts += 1;
              this.emit(
                'host-lease-lost',
                presence.roomCode,
                presence.connectionId,
              );
            } else {
              await this.claimHostLease(
                presence.roomCode,
                presence.leaseValue,
              );
            }
          }
        }
        refreshedRooms.add(presence.roomCode);
      }
      for (const roomCode of refreshedRooms) {
        await this.publishPresenceSignal(roomCode);
      }
    } catch (error) {
      this.metrics.presenceRefreshFailures += 1;
      console.error('Failed to refresh distributed presence:', error);
    }
  }

  private async refreshRoomPresence(roomCode: string): Promise<void> {
    const presence = await this.getRoomPresence(roomCode);
    const lease = presence.hostLease;
    for (const local of this.localPresence.values()) {
      if (
        local.roomCode === roomCode &&
        local.leaseValue &&
        lease &&
        local.leaseValue !==
          `${lease.userId}|${lease.instanceId}|${lease.connectionId}`
      ) {
        this.emit('host-lease-lost', roomCode, local.connectionId);
      }
    }
    this.emit('presence', roomCode, presence);
  }

  private async writePresence(presence: LocalPresence): Promise<void> {
    if (!this.commandClient || !this.connected) return;
    await this.commandClient.zAdd(this.presenceKey(presence.roomCode), {
      score: Date.now() + PRESENCE_TTL_MS,
      value: presence.member,
    });
  }

  private publishPresenceSignal(roomCode: string): Promise<void> {
    return this.publish({
      version: 1,
      kind: 'presence',
      originInstanceId: this.instanceId,
      roomCode,
      publishedAt: Date.now(),
    });
  }

  private async claimHostLease(
    roomCode: string,
    leaseValue: string,
  ): Promise<boolean> {
    if (!this.commandClient) return true;
    const userPrefix = `${leaseValue.split('|')[0]}|`;
    const result = await this.commandClient.eval(
      `local current = redis.call('GET', KEYS[1])
       if (not current) or string.sub(current, 1, string.len(ARGV[2])) == ARGV[2] then
         redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[3])
         return 1
       end
       return 0`,
      {
        keys: [this.hostLeaseKey(roomCode)],
        arguments: [leaseValue, userPrefix, String(PRESENCE_TTL_MS)],
      },
    );
    return Number(result) === 1;
  }

  private async refreshHostLease(
    roomCode: string,
    leaseValue: string,
  ): Promise<boolean> {
    if (!this.commandClient) return false;
    const result = await this.commandClient.eval(
      `if redis.call('GET', KEYS[1]) == ARGV[1] then
         return redis.call('PEXPIRE', KEYS[1], ARGV[2])
       end
       return 0`,
      {
        keys: [this.hostLeaseKey(roomCode)],
        arguments: [leaseValue, String(PRESENCE_TTL_MS)],
      },
    );
    return Number(result) === 1;
  }

  private async releaseHostLease(
    roomCode: string,
    leaseValue: string,
  ): Promise<void> {
    if (!this.commandClient) return;
    await this.commandClient.eval(
      `if redis.call('GET', KEYS[1]) == ARGV[1] then
         return redis.call('DEL', KEYS[1])
       end
       return 0`,
      {
        keys: [this.hostLeaseKey(roomCode)],
        arguments: [leaseValue],
      },
    );
  }

  private presenceId(roomCode: string, connectionId: string): string {
    return `${roomCode}:${connectionId}`;
  }

  private presenceKey(roomCode: string): string {
    return `nexus:vtt:presence:${roomCode}`;
  }

  private hostLeaseKey(roomCode: string): string {
    return `nexus:vtt:host:${roomCode}`;
  }

  private enqueueRoom(roomCode: string, task: () => Promise<void>): Promise<void> {
    const previous = this.roomQueues.get(roomCode) || Promise.resolve();
    const current = previous.catch(() => undefined).then(task);
    this.roomQueues.set(
      roomCode,
      current.then(
        () => undefined,
        () => undefined,
      ),
    );
    return current;
  }
}
