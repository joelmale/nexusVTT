#!/usr/bin/env tsx

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { decode, encode } from '@msgpack/msgpack';
import jsonpatch from 'fast-json-patch';
import type { Operation } from 'fast-json-patch';
import WebSocket from 'ws';
import {
  createEmptySyncableGameState,
  type JsonValue,
  type StateHash,
  type SyncableGameState,
} from '../shared/sync/contracts.js';
import { hashSync } from '../shared/sync/hashSync.js';

type OperationKind = 'chat' | 'dice' | 'scene' | 'token' | 'state';

interface WireMessage {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
  eventId?: string;
  actorId?: string;
  clientSequence?: number;
  occurredAt?: number;
  serverSequence?: number;
}

interface GuestIdentity {
  id: string;
  name: string;
  cookie: string;
}

interface SoakConfig {
  baseUrl: string;
  websocketUrls: string[];
  rooms: number;
  clientsPerRoom: number;
  durationMs: number;
  eventsPerSecond: number;
  ackTimeoutMs: number;
  ackP95Ms: number;
  reconnectP95Ms: number;
  reconnectEveryMs: number;
  messagePack: boolean;
  conflictProbe: boolean;
  reportPath: string;
  readyFile?: string;
  metricsToken?: string;
}

interface PendingEvent {
  eventId: string;
  kind: OperationKind;
  startedAt: number;
  resolve: (latencyMs: number) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
  message: WireMessage;
}

interface LoadStats {
  orderedSent: number;
  orderedCommitted: number;
  duplicateAcknowledgements: number;
  duplicateDeliveries: number;
  orderingErrors: number;
  stateUploads: number;
  stateAcknowledgements: number;
  stateResyncs: number;
  stateIntegrityErrors: number;
  reconnects: number;
  expectedConflicts: number;
  unexpectedErrors: string[];
  eventAckLatenciesMs: number[];
  stateAckLatenciesMs: number[];
  reconnectLatenciesMs: number[];
  operations: Record<OperationKind, number>;
}

interface ServerMetrics {
  gameState: {
    failures: number;
    conflicts: number;
    totalResyncs: number;
  };
  orderedEvents: {
    failed: number;
    duplicates: number;
  };
  realtime: {
    publishFailures: number;
    reconnects: number;
    journalCatchUps: number;
    sequenceGaps: number;
  };
}

interface StateOutcome {
  type: 'ack' | 'resync';
  reason?: string;
}

class ExpectedConflictError extends Error {}

const activeClients = new Set<LoadClient>();

function parseDuration(value: string): number {
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h)?$/i.exec(value.trim());
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const amount = Number(match[1]);
  const multiplier = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000 }[
    (match[2]?.toLowerCase() || 'ms') as 'ms' | 's' | 'm' | 'h'
  ];
  return amount * multiplier;
}

function numberArgument(
  args: Map<string, string>,
  name: string,
  fallback: number,
): number {
  const value = Number(args.get(name) ?? fallback);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return value;
}

function parseArguments(): SoakConfig {
  const raw = process.argv.slice(2);
  const args = new Map<string, string>();
  for (let index = 0; index < raw.length; index += 1) {
    const key = raw[index];
    if (!key.startsWith('--')) continue;
    const next = raw[index + 1];
    if (!next || next.startsWith('--')) {
      args.set(key, 'true');
    } else {
      args.set(key, next);
      index += 1;
    }
  }

  const rooms = numberArgument(args, '--rooms', 10);
  const clientsPerRoom = numberArgument(args, '--clients-per-room', 4);
  if (clientsPerRoom < 2) {
    throw new Error('--clients-per-room must be at least 2');
  }
  if (rooms * clientsPerRoom > 1_000 && args.get('--allow-large') !== 'true') {
    throw new Error(
      'More than 1,000 clients requires the explicit --allow-large flag.',
    );
  }

  const baseUrl = (args.get('--base-url') ?? 'http://127.0.0.1:4173').replace(
    /\/$/,
    '',
  );
  return {
    baseUrl,
    websocketUrls: (args.get('--websocket-urls') ?? baseUrl)
      .split(',')
      .map((url) => url.trim().replace(/\/$/, ''))
      .filter(Boolean),
    rooms,
    clientsPerRoom,
    durationMs: parseDuration(args.get('--duration') ?? '5m'),
    eventsPerSecond: numberArgument(
      args,
      '--events-per-second',
      Math.max(rooms, 10),
    ),
    ackTimeoutMs: parseDuration(args.get('--ack-timeout') ?? '20s'),
    ackP95Ms: parseDuration(args.get('--ack-p95') ?? '1s'),
    reconnectP95Ms: parseDuration(args.get('--reconnect-p95') ?? '10s'),
    reconnectEveryMs: parseDuration(args.get('--reconnect-every') ?? '30s'),
    messagePack: args.get('--message-pack') === 'true',
    conflictProbe: args.get('--conflict-probe') !== 'false',
    reportPath:
      args.get('--report') ?? 'test-results/multiplayer-soak-report.json',
    readyFile: args.get('--ready-file'),
    metricsToken: args.get('--metrics-token') ?? process.env.METRICS_AUTH_TOKEN,
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function percentile(values: readonly number[], quantile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * quantile) - 1),
  );
  return sorted[index];
}

function toWebSocketUrl(baseUrl: string): URL {
  const url = new URL('/ws', baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url;
}

async function createGuest(
  baseUrl: string,
  name: string,
): Promise<GuestIdentity> {
  const response = await fetch(new URL('/api/guest-users', baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error(`Guest creation failed (${response.status})`);
  }
  const body = (await response.json()) as { id: string; name: string };
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie)
    throw new Error('Guest creation did not set a session cookie');
  return {
    id: body.id,
    name: body.name,
    cookie: setCookie.split(';', 1)[0],
  };
}

function emptyStats(): LoadStats {
  return {
    orderedSent: 0,
    orderedCommitted: 0,
    duplicateAcknowledgements: 0,
    duplicateDeliveries: 0,
    orderingErrors: 0,
    stateUploads: 0,
    stateAcknowledgements: 0,
    stateResyncs: 0,
    stateIntegrityErrors: 0,
    reconnects: 0,
    expectedConflicts: 0,
    unexpectedErrors: [],
    eventAckLatenciesMs: [],
    stateAckLatenciesMs: [],
    reconnectLatenciesMs: [],
    operations: { chat: 0, dice: 0, scene: 0, token: 0, state: 0 },
  };
}

class LoadClient {
  private socket: WebSocket | null = null;
  private stopped = false;
  private connecting: Promise<void> | null = null;
  private initialConnection = true;
  private clientSequence = 0;
  private reconnectAttempt = 0;
  private pendingEvents = new Map<string, PendingEvent>();
  private seenEventIds = new Set<string>();
  private stateOutcomes: StateOutcome[] = [];
  private stateOutcomeWaiters: Array<(outcome: StateOutcome) => void> = [];
  private pendingStates = new Map<
    string,
    { state: SyncableGameState; startedAt: number }
  >();
  public state: SyncableGameState = createEmptySyncableGameState();
  public stateToken: StateHash = hashSync(
    createEmptySyncableGameState() as unknown as JsonValue,
  );
  public stateVersion = 0;
  public eventCursor = 0;
  private lastDeliveredSequence = 0;
  public readonly observedEventIds = new Set<string>();

  constructor(
    private readonly config: SoakConfig,
    public readonly identity: GuestIdentity,
    public readonly room: LoadRoom,
    public readonly role: 'host' | 'player',
    private readonly websocketBaseUrl: string,
    private readonly stats: LoadStats,
  ) {
    activeClients.add(this);
  }

  async connect(): Promise<void> {
    if (this.stopped) throw new Error('Client has stopped');
    if (this.socket?.readyState === WebSocket.OPEN) return;
    if (this.connecting) return this.connecting;
    this.connecting = this.openSocket().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private async openSocket(): Promise<void> {
    const startedAt = Date.now();
    const url = toWebSocketUrl(this.websocketBaseUrl);
    if (this.role === 'host') {
      url.searchParams.set(
        this.initialConnection ? 'host' : 'reconnect',
        this.room.code,
      );
    } else {
      url.searchParams.set('join', this.room.code);
    }
    if (!this.initialConnection) {
      url.searchParams.set('lastSeenSequence', String(this.eventCursor));
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const socket = new WebSocket(url, {
        headers: { Cookie: this.identity.cookie },
      });
      this.socket = socket;
      const readyTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        socket.terminate();
        reject(
          new Error(`Connection readiness timed out for ${this.identity.name}`),
        );
      }, this.config.ackTimeoutMs);

      const finishReady = (): void => {
        if (settled) return;
        settled = true;
        clearTimeout(readyTimer);
        this.reconnectAttempt = 0;
        const isReconnect = !this.initialConnection;
        if (isReconnect) {
          this.stats.reconnects += 1;
          this.stats.reconnectLatenciesMs.push(Date.now() - startedAt);
        }
        this.initialConnection = false;
        if (isReconnect) {
          setTimeout(() => this.retryPendingWork(), 750);
        }
        resolve();
      };

      socket.on('message', (data, isBinary) => {
        try {
          const parsed =
            this.config.messagePack || isBinary
              ? (decode(data as Buffer) as WireMessage)
              : (JSON.parse(data.toString()) as WireMessage);
          this.handleMessage(parsed, finishReady);
        } catch (error) {
          this.stats.unexpectedErrors.push(
            `${this.identity.name} message decode: ${String(error)}`,
          );
        }
      });
      socket.once('error', (error) => {
        if (!settled) {
          settled = true;
          clearTimeout(readyTimer);
          reject(error);
        }
      });
      socket.once('close', () => {
        clearTimeout(readyTimer);
        if (!settled) {
          settled = true;
          reject(
            new Error(`Socket closed before ${this.identity.name} joined`),
          );
        }
        if (!this.stopped) this.scheduleReconnect();
      });
    });
  }

  private scheduleReconnect(): void {
    const attempt = this.reconnectAttempt;
    this.reconnectAttempt += 1;
    const backoff = Math.min(5_000, 250 * 2 ** Math.min(attempt, 5));
    setTimeout(() => {
      if (this.stopped || this.socket?.readyState === WebSocket.OPEN) return;
      void this.connect().catch(() => this.scheduleReconnect());
    }, backoff);
  }

  private handleMessage(message: WireMessage, ready: () => void): void {
    if (message.type === 'heartbeat' && message.data.type === 'ping') {
      this.send({
        type: 'heartbeat',
        data: { type: 'pong', id: message.data.id },
        timestamp: Date.now(),
      });
      return;
    }

    if (message.type === 'event') {
      const name = String(message.data.name ?? '');
      if (
        name === 'session/created' ||
        name === 'session/joined' ||
        name === 'session/reconnected'
      ) {
        const receivedState = message.data.gameState;
        if (receivedState && typeof receivedState === 'object') {
          this.installState(receivedState as SyncableGameState, undefined);
          this.reconcilePendingStateAfterReconnect();
        }
        ready();
      }
    }

    if (message.type === 'event-cursor') {
      this.eventCursor = Math.max(
        this.eventCursor,
        Number(message.data.sequence ?? 0),
      );
      return;
    }

    if (typeof message.serverSequence === 'number') {
      if (message.serverSequence < this.lastDeliveredSequence) {
        this.stats.orderingErrors += 1;
      }
      this.lastDeliveredSequence = Math.max(
        this.lastDeliveredSequence,
        message.serverSequence,
      );
      this.eventCursor = Math.max(this.eventCursor, message.serverSequence);
      if (message.eventId) {
        if (this.seenEventIds.has(message.eventId)) {
          this.stats.duplicateDeliveries += 1;
        } else {
          this.seenEventIds.add(message.eventId);
        }
        this.observeCommittedEvent(message.eventId);
      }
    }

    if (message.type === 'event-ack') {
      const eventId = String(message.data.eventId);
      const sequence = Number(message.data.serverSequence);
      this.eventCursor = Math.max(this.eventCursor, sequence);
      if (message.data.duplicate === true) {
        this.stats.duplicateAcknowledgements += 1;
      }
      this.observeCommittedEvent(eventId);
      return;
    }

    if (message.type === 'game-state-patch') {
      const baseToken = String(message.data.baseToken ?? '') as StateHash;
      const newToken = String(message.data.newToken ?? '') as StateHash;
      if (baseToken !== this.stateToken) {
        this.stats.stateIntegrityErrors += 1;
        return;
      }
      try {
        const result = jsonpatch.applyPatch(
          structuredClone(this.state),
          message.data.patch as Operation[],
          true,
        );
        this.installState(
          result.newDocument as SyncableGameState,
          Number(message.data.version),
        );
        if (this.stateToken !== newToken) this.stats.stateIntegrityErrors += 1;
      } catch (error) {
        this.stats.stateIntegrityErrors += 1;
        this.stats.unexpectedErrors.push(
          `${this.identity.name} patch application: ${String(error)}`,
        );
      }
      return;
    }

    if (message.type === 'game-state-ack') {
      const token = String(message.data.token) as StateHash;
      const pending = this.pendingStates.get(token);
      if (pending) {
        this.state = pending.state;
        this.stateToken = token;
        this.stateVersion = Number(message.data.version);
        this.stats.stateAckLatenciesMs.push(Date.now() - pending.startedAt);
        this.pendingStates.delete(token);
      }
      this.stats.stateAcknowledgements += 1;
      this.pushStateOutcome({ type: 'ack' });
      return;
    }

    if (message.type === 'game-state-resync-required') {
      this.stats.stateResyncs += 1;
      this.pendingStates.clear();
      this.installState(
        message.data.gameState as SyncableGameState,
        Number(message.data.version),
      );
      const serverToken = String(message.data.serverToken) as StateHash;
      if (this.stateToken !== serverToken) this.stats.stateIntegrityErrors += 1;
      this.pushStateOutcome({
        type: 'resync',
        reason: String(message.data.reason),
      });
      return;
    }

    if (message.type === 'error') {
      const code = Number(message.data.code ?? 0);
      if (code === 409) {
        const conflict = [...this.pendingEvents.values()].find(
          (pending) => pending.kind === 'token',
        );
        if (conflict) {
          clearTimeout(conflict.timer);
          this.pendingEvents.delete(conflict.eventId);
          this.stats.expectedConflicts += 1;
          conflict.reject(
            new ExpectedConflictError(String(message.data.message)),
          );
          return;
        }
      }
      if (
        code === 503 ||
        (code === 403 &&
          String(message.data.message).includes('Host is offline'))
      ) {
        const pending = this.pendingEvents.values().next().value as
          PendingEvent | undefined;
        if (pending) {
          setTimeout(() => {
            void this.ensureConnected()
              .then(() => {
                if (this.pendingEvents.has(pending.eventId)) {
                  return this.sendReliably(pending.message);
                }
                return undefined;
              })
              .catch(() => undefined);
          }, 1_000);
        }
        const pendingState = [...this.pendingStates.values()].at(-1);
        if (pendingState) {
          this.pendingStates.clear();
          setTimeout(() => {
            void this.ensureConnected()
              .then(() => this.sendStateCandidate(pendingState.state))
              .catch(() => undefined);
          }, 1_000);
        }
        return;
      }
      this.stats.unexpectedErrors.push(
        `${this.identity.name} server error ${code}: ${String(message.data.message)}`,
      );
    }
  }

  private installState(
    state: SyncableGameState,
    version: number | undefined,
  ): void {
    this.state = structuredClone(state);
    this.stateToken = hashSync(this.state as unknown as JsonValue);
    if (version !== undefined && Number.isSafeInteger(version)) {
      this.stateVersion = version;
    }
  }

  private reconcilePendingStateAfterReconnect(): void {
    const pending = [...this.pendingStates.values()].at(-1);
    if (!pending) return;
    const pendingToken = hashSync(pending.state as unknown as JsonValue);
    if (pendingToken === this.stateToken) {
      this.pendingStates.clear();
      this.stats.stateAcknowledgements += 1;
      this.stats.stateAckLatenciesMs.push(Date.now() - pending.startedAt);
      this.pushStateOutcome({ type: 'ack' });
      return;
    }
    this.pendingStates.clear();
    setTimeout(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        void this.sendStateCandidate(pending.state);
      }
    }, 750);
  }

  private retryPendingWork(): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    for (const pending of this.pendingEvents.values()) {
      void this.sendReliably(pending.message).catch(() => undefined);
    }
  }

  public async ensureConnected(): Promise<void> {
    const deadline = Date.now() + this.config.ackTimeoutMs;
    while (Date.now() < deadline) {
      if (this.socket?.readyState === WebSocket.OPEN) return;
      try {
        await this.connect();
      } catch {
        await delay(250);
      }
    }
    throw new Error(`${this.identity.name} could not reconnect before timeout`);
  }

  private observeCommittedEvent(eventId: string): void {
    this.observedEventIds.add(eventId);
    this.room.committedEventIds.add(eventId);
    const pending = this.pendingEvents.get(eventId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pendingEvents.delete(eventId);
    const latency = Date.now() - pending.startedAt;
    this.stats.eventAckLatenciesMs.push(latency);
    this.stats.orderedCommitted += 1;
    pending.resolve(latency);
  }

  private pushStateOutcome(outcome: StateOutcome): void {
    const waiter = this.stateOutcomeWaiters.shift();
    if (waiter) waiter(outcome);
    else this.stateOutcomes.push(outcome);
  }

  public nextStateOutcome(): Promise<StateOutcome> {
    const current = this.stateOutcomes.shift();
    if (current) return Promise.resolve(current);
    return new Promise((resolve, reject) => {
      const waiter = (outcome: StateOutcome): void => {
        clearTimeout(timer);
        resolve(outcome);
      };
      const timer = setTimeout(() => {
        const index = this.stateOutcomeWaiters.indexOf(waiter);
        if (index >= 0) this.stateOutcomeWaiters.splice(index, 1);
        reject(new Error('State outcome timed out'));
      }, this.config.ackTimeoutMs);
      this.stateOutcomeWaiters.push(waiter);
    });
  }

  private send(message: WireMessage): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      throw new Error(`${this.identity.name} is not connected`);
    }
    this.socket.send(
      this.config.messagePack ? encode(message) : JSON.stringify(message),
    );
  }

  private async sendReliably(message: WireMessage): Promise<void> {
    const deadline = Date.now() + this.config.ackTimeoutMs;
    while (Date.now() < deadline) {
      await this.ensureConnected();
      try {
        this.send(message);
        return;
      } catch {
        await delay(100);
      }
    }
    throw new Error(`${this.identity.name} could not send before timeout`);
  }

  public async sendOrdered(
    kind: OperationKind,
    type: 'event' | 'chat-message',
    data: Record<string, unknown>,
  ): Promise<number> {
    await this.ensureConnected();
    const eventId = randomUUID();
    this.clientSequence += 1;
    const timestamp = Date.now();
    const message: WireMessage = {
      type,
      data,
      timestamp,
      eventId,
      actorId: this.identity.id,
      clientSequence: this.clientSequence,
      occurredAt: timestamp,
    };
    this.stats.orderedSent += 1;
    this.stats.operations[kind] += 1;
    const completion = new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingEvents.delete(eventId);
        reject(new Error(`${kind} event ${eventId} acknowledgement timed out`));
      }, this.config.ackTimeoutMs);
      this.pendingEvents.set(eventId, {
        eventId,
        kind,
        startedAt: timestamp,
        resolve,
        reject,
        timer,
        message,
      });
    });
    try {
      await this.sendReliably(message);
    } catch (error) {
      const pending = this.pendingEvents.get(eventId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingEvents.delete(eventId);
        pending.reject(error as Error);
        await completion.catch(() => undefined);
      }
      throw error;
    }
    return completion;
  }

  public async sendStateCandidate(
    candidate: SyncableGameState,
    baseState: SyncableGameState = this.state,
    baseToken: StateHash = this.stateToken,
  ): Promise<StateHash> {
    const token = hashSync(candidate as unknown as JsonValue);
    const patch = jsonpatch.compare(
      baseState as unknown as Record<string, unknown>,
      candidate as unknown as Record<string, unknown>,
    );
    this.pendingStates.set(token, { state: candidate, startedAt: Date.now() });
    this.stats.stateUploads += 1;
    this.stats.operations.state += 1;
    try {
      await this.sendReliably({
        type: 'event',
        data: {
          name: 'game-state-update',
          upload: {
            kind: 'patch',
            patch,
            baseToken,
            newToken: token,
          },
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      this.pendingStates.delete(token);
      throw error;
    }
    return token;
  }

  public forceReconnect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.close(1012, 'soak reconnect probe');
    }
  }

  public async forceReconnectAndWait(): Promise<void> {
    this.forceReconnect();
    await delay(250);
    await this.ensureConnected();
  }

  public stop(): void {
    this.stopped = true;
    activeClients.delete(this);
    for (const pending of this.pendingEvents.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Soak test stopped'));
    }
    this.pendingEvents.clear();
    this.socket?.close(1000, 'soak complete');
  }
}

class LoadRoom {
  public clients: LoadClient[] = [];
  public readonly committedEventIds = new Set<string>();
  private mutation = 0;
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(
    public readonly code: string,
    private readonly stats: LoadStats,
  ) {}

  get host(): LoadClient {
    const host = this.clients[0];
    if (!host) throw new Error(`Room ${this.code} has no host`);
    return host;
  }

  runOperation(index: number): Promise<void> {
    const operation = this.operationQueue.then(() =>
      this.executeOperation(index),
    );
    this.operationQueue = operation.catch(() => undefined);
    return operation;
  }

  private async executeOperation(index: number): Promise<void> {
    const client = this.clients[index % this.clients.length];
    const operation = index % 5;
    if (operation === 0) {
      await client.sendOrdered('chat', 'chat-message', {
        content: `soak:${this.code}:${index}:${Date.now()}`,
      });
      return;
    }
    if (operation === 1) {
      await client.sendOrdered('dice', 'event', {
        name: 'dice/roll-request',
        expression: '1d20+5',
        advantage: false,
        disadvantage: false,
        isPrivate: false,
      });
      return;
    }
    if (operation === 2) {
      await this.host.sendOrdered('scene', 'event', {
        name: 'scene/change',
        sceneId: `scene-${index % 3}`,
      });
      return;
    }
    if (operation === 3) {
      await client.sendOrdered('token', 'event', {
        name: 'token/move',
        tokenId: `token-${index}`,
        expectedVersion: 0,
        updateId: randomUUID(),
        x: index % 100,
        y: (index * 3) % 100,
      });
      return;
    }

    const candidate = this.nextState();
    await this.host.ensureConnected();
    await this.host.sendStateCandidate(candidate);
    const outcome = await this.host.nextStateOutcome();
    if (outcome.type !== 'ack') {
      throw new Error(`Unexpected ${outcome.reason ?? 'unknown'} resync`);
    }
  }

  private nextState(label?: string): SyncableGameState {
    this.mutation += 1;
    const current = structuredClone(this.host.state);
    const mode = this.mutation % 3;
    const sceneId = 'soak-scene';
    const scenes = [...current.scenes] as Array<Record<string, JsonValue>>;
    const existingScene = scenes.findIndex((scene) => scene.id === sceneId);
    const scene =
      existingScene >= 0
        ? structuredClone(scenes[existingScene])
        : ({ id: sceneId, name: 'Soak Scene', tokens: [] } as Record<
            string,
            JsonValue
          >);

    if (mode === 0) {
      scene.name = label ?? `Soak Scene ${this.mutation}`;
    } else if (mode === 1) {
      scene.tokens = [
        {
          id: 'soak-token',
          x: this.mutation % 100,
          y: (this.mutation * 7) % 100,
        },
      ];
    }
    if (existingScene >= 0) scenes[existingScene] = scene;
    else scenes.push(scene);

    const initiative =
      mode === 2
        ? {
            isActive: true,
            isPaused: false,
            round: Math.ceil(this.mutation / 3),
            entries: [
              {
                id: 'soak-token',
                name: 'Soak Token',
                initiative: 15,
              },
            ],
            activeEntryId: 'soak-token',
            history: [],
            autoAdvanceTurns: false,
            showPlayerHP: true,
            allowPlayerInitiative: true,
            sortByInitiative: true,
          }
        : current.initiative;

    return {
      ...current,
      scenes,
      activeSceneId: sceneId,
      initiative,
    };
  }

  async runDeltaConflictProbe(): Promise<void> {
    const baseState = structuredClone(this.host.state);
    const baseToken = this.host.stateToken;
    const first = this.nextState('conflict-winner');
    const second = this.nextState('conflict-loser');
    await this.host.sendStateCandidate(first, baseState, baseToken);
    const firstOutcome = await this.host.nextStateOutcome();
    console.log(
      `Delta conflict first outcome: ${JSON.stringify(firstOutcome)}`,
    );
    await this.host.sendStateCandidate(second, baseState, baseToken);
    const secondOutcome = await this.host.nextStateOutcome();
    console.log(
      `Delta conflict stale outcome: ${JSON.stringify(secondOutcome)}`,
    );
    const outcomes = [firstOutcome, secondOutcome];
    const acknowledgements = outcomes.filter(
      (outcome) => outcome.type === 'ack',
    ).length;
    const baseResyncs = outcomes.filter(
      (outcome) =>
        outcome.type === 'resync' && outcome.reason === 'base-mismatch',
    ).length;
    if (acknowledgements !== 1 || baseResyncs !== 1) {
      throw new Error(
        `Delta conflict probe expected one ack/one base resync, got ${JSON.stringify(outcomes)}`,
      );
    }
  }

  async runEntityConflictProbe(): Promise<void> {
    const contenders = this.clients.slice(1, 3);
    if (contenders.length < 2) return;
    const attempts = contenders.map((client, index) =>
      client.sendOrdered('token', 'event', {
        name: 'token/move',
        tokenId: 'conflict-token',
        expectedVersion: 0,
        updateId: randomUUID(),
        x: index,
        y: index,
      }),
    );
    const outcomes = await Promise.allSettled(attempts);
    const accepted = outcomes.filter(
      (outcome) => outcome.status === 'fulfilled',
    ).length;
    const rejected = outcomes.filter(
      (outcome) =>
        outcome.status === 'rejected' &&
        outcome.reason instanceof ExpectedConflictError,
    ).length;
    if (accepted !== 1 || rejected !== 1) {
      throw new Error(
        `Entity conflict probe expected one accept/one conflict, got ${accepted}/${rejected}`,
      );
    }
  }

  convergenceFailures(): string[] {
    const failures: string[] = [];
    const expectedToken = this.host.stateToken;
    const expectedCursor = Math.max(
      ...this.clients.map((client) => client.eventCursor),
    );
    for (const client of this.clients) {
      if (client.stateToken !== expectedToken) {
        failures.push(
          `${this.code}/${client.identity.name}: state token ${client.stateToken} != ${expectedToken}`,
        );
      }
      if (client.eventCursor !== expectedCursor) {
        failures.push(
          `${this.code}/${client.identity.name}: cursor ${client.eventCursor} != ${expectedCursor}`,
        );
      }
      for (const eventId of this.committedEventIds) {
        if (!client.observedEventIds.has(eventId)) {
          failures.push(
            `${this.code}/${client.identity.name}: missing event ${eventId}`,
          );
          break;
        }
      }
    }
    return failures;
  }
}

async function fetchMetrics(config: SoakConfig): Promise<ServerMetrics | null> {
  try {
    const headers: Record<string, string> = {};
    if (config.metricsToken) {
      headers.authorization = `Bearer ${config.metricsToken}`;
    }
    const response = await fetch(
      new URL('/api/metrics/multiplayer', config.baseUrl),
      { headers },
    );
    if (!response.ok) return null;
    return (await response.json()) as ServerMetrics;
  } catch {
    return null;
  }
}

function metricDelta(
  before: ServerMetrics | null,
  after: ServerMetrics | null,
): Record<string, number> | null {
  if (!before || !after) return null;
  return {
    durableCommitFailures: after.gameState.failures - before.gameState.failures,
    durableCommitConflicts:
      after.gameState.conflicts - before.gameState.conflicts,
    resyncs: after.gameState.totalResyncs - before.gameState.totalResyncs,
    orderedEventFailures:
      after.orderedEvents.failed - before.orderedEvents.failed,
    orderedEventDuplicates:
      after.orderedEvents.duplicates - before.orderedEvents.duplicates,
    realtimePublishFailures:
      after.realtime.publishFailures - before.realtime.publishFailures,
    realtimeReconnects: after.realtime.reconnects - before.realtime.reconnects,
    journalCatchUps:
      after.realtime.journalCatchUps - before.realtime.journalCatchUps,
    sequenceGaps: after.realtime.sequenceGaps - before.realtime.sequenceGaps,
  };
}

async function createRooms(
  config: SoakConfig,
  stats: LoadStats,
): Promise<LoadRoom[]> {
  const rooms = Array.from({ length: config.rooms }, (_, index) => {
    const suffix = index.toString(36).toUpperCase().padStart(3, '0');
    return new LoadRoom(`S${suffix}`.slice(-4), stats);
  });

  for (const [roomIndex, room] of rooms.entries()) {
    const identities = await Promise.all(
      Array.from({ length: config.clientsPerRoom }, (_, clientIndex) =>
        createGuest(config.baseUrl, `Soak-${roomIndex + 1}-${clientIndex + 1}`),
      ),
    );
    room.clients = identities.map(
      (identity, clientIndex) =>
        new LoadClient(
          config,
          identity,
          room,
          clientIndex === 0 ? 'host' : 'player',
          config.websocketUrls[clientIndex % config.websocketUrls.length],
          stats,
        ),
    );
    await room.host.connect();
    await Promise.all(room.clients.slice(1).map((client) => client.connect()));
    process.stdout.write(
      `\rCreated ${roomIndex + 1}/${rooms.length} rooms (${(roomIndex + 1) * config.clientsPerRoom} clients)`,
    );
  }
  process.stdout.write('\n');
  return rooms;
}

async function runWorkload(
  config: SoakConfig,
  rooms: LoadRoom[],
  stats: LoadStats,
): Promise<void> {
  const startedAt = Date.now();
  let operationIndex = 0;
  let nextReconnectAt = startedAt + config.reconnectEveryMs;
  while (Date.now() - startedAt < config.durationMs) {
    const tickStartedAt = Date.now();
    const operationsThisTick = Math.max(1, Math.round(config.eventsPerSecond));
    const operations = Array.from(
      { length: operationsThisTick },
      (_, offset) => {
        const current = operationIndex + offset;
        const room = rooms[current % rooms.length];
        return room.runOperation(current).catch((error) => {
          stats.unexpectedErrors.push(`operation ${current}: ${String(error)}`);
        });
      },
    );
    operationIndex += operationsThisTick;
    await Promise.all(operations);

    if (Date.now() >= nextReconnectAt) {
      const clientIndex = 1 + (operationIndex % (config.clientsPerRoom - 1));
      for (const room of rooms.slice(
        0,
        Math.max(1, Math.ceil(rooms.length / 20)),
      )) {
        room.clients[clientIndex]?.forceReconnect();
      }
      nextReconnectAt = Date.now() + config.reconnectEveryMs;
    }

    const elapsed = Date.now() - startedAt;
    process.stdout.write(
      `\rWorkload ${Math.min(100, Math.round((elapsed / config.durationMs) * 100))}% | sent ${stats.orderedSent} | state ${stats.stateUploads} | reconnects ${stats.reconnects}`,
    );
    const remainingInTick = 1_000 - (Date.now() - tickStartedAt);
    if (remainingInTick > 0) await delay(remainingInTick);
  }
  process.stdout.write('\n');
}

async function main(): Promise<void> {
  const config = parseArguments();
  const stats = emptyStats();
  const startedAt = new Date();
  console.log(
    `Starting multiplayer soak: ${config.rooms} rooms x ${config.clientsPerRoom} clients for ${Math.round(config.durationMs / 1_000)}s`,
  );
  const metricsBefore = await fetchMetrics(config);
  const rooms = await createRooms(config, stats);

  if (config.conflictProbe) {
    console.log('Running delta-sync and entity conflict probes...');
    await rooms[0].runDeltaConflictProbe();
    await rooms[0].runEntityConflictProbe();
  }

  if (config.readyFile) {
    const readyPath = path.resolve(config.readyFile);
    await mkdir(path.dirname(readyPath), { recursive: true });
    await writeFile(readyPath, `${new Date().toISOString()}\n`, 'utf8');
  }

  await runWorkload(config, rooms, stats);
  await delay(2_000);
  await Promise.all(
    rooms.flatMap((room) =>
      room.clients.slice(1).map((client) => client.forceReconnectAndWait()),
    ),
  );
  await delay(2_000);

  const convergenceFailures = rooms.flatMap((room) =>
    room.convergenceFailures(),
  );
  const metricsAfter = await fetchMetrics(config);
  const deltas = metricDelta(metricsBefore, metricsAfter);
  const eventAckP95Ms = percentile(stats.eventAckLatenciesMs, 0.95);
  const stateAckP95Ms = percentile(stats.stateAckLatenciesMs, 0.95);
  const reconnectP95Ms = percentile(stats.reconnectLatenciesMs, 0.95);
  const expectedCommittedEvents =
    stats.orderedSent - stats.expectedConflicts;
  const lostEvents = Math.max(
    0,
    expectedCommittedEvents - stats.orderedCommitted,
  );
  const failures = [...stats.unexpectedErrors, ...convergenceFailures];
  if (lostEvents > 0) {
    failures.push(`${lostEvents} acknowledged-or-replayed events were lost`);
  }
  if (stats.orderingErrors > 0) {
    failures.push(`${stats.orderingErrors} out-of-order event deliveries`);
  }
  if (stats.stateIntegrityErrors > 0) {
    failures.push(`${stats.stateIntegrityErrors} state integrity errors`);
  }
  if (eventAckP95Ms > config.ackP95Ms) {
    failures.push(
      `event ack p95 ${eventAckP95Ms}ms exceeded ${config.ackP95Ms}ms`,
    );
  }
  if (stateAckP95Ms > config.ackP95Ms) {
    failures.push(
      `state ack p95 ${stateAckP95Ms}ms exceeded ${config.ackP95Ms}ms`,
    );
  }
  if (reconnectP95Ms > config.reconnectP95Ms) {
    failures.push(
      `reconnect p95 ${reconnectP95Ms}ms exceeded ${config.reconnectP95Ms}ms`,
    );
  }
  if (deltas?.durableCommitFailures) {
    failures.push(`${deltas.durableCommitFailures} durable commit failures`);
  }
  if (deltas?.orderedEventFailures) {
    failures.push(`${deltas.orderedEventFailures} ordered event failures`);
  }

  const report = {
    passed: failures.length === 0,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    config: {
      ...config,
      metricsToken: config.metricsToken ? '[redacted]' : undefined,
    },
    summary: {
      rooms: rooms.length,
      clients: rooms.length * config.clientsPerRoom,
      eventAckP50Ms: percentile(stats.eventAckLatenciesMs, 0.5),
      eventAckP95Ms,
      eventAckP99Ms: percentile(stats.eventAckLatenciesMs, 0.99),
      stateAckP95Ms,
      reconnectP95Ms,
      convergenceFailures: convergenceFailures.length,
      lostEvents,
      duplicateEventDeliveries: stats.duplicateDeliveries,
    },
    stats,
    serverMetricDeltas: deltas,
    failures,
  };

  const reportPath = path.resolve(config.reportPath);
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  for (const room of rooms) {
    for (const client of room.clients) client.stop();
  }

  console.log(
    `${report.passed ? 'PASS' : 'FAIL'}: event ack p95=${eventAckP95Ms}ms, state ack p95=${stateAckP95Ms}ms, reconnect p95=${reconnectP95Ms}ms`,
  );
  console.log(`Report: ${reportPath}`);
  if (!report.passed) {
    console.error(failures.slice(0, 20).join('\n'));
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  for (const client of activeClients) client.stop();
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
