import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket, type WebSocketServer } from 'ws';
import { createRealtimeRuntime } from '../../../../server/bootstrap/realtimeRuntime.js';
import type { DatabaseService } from '../../../../server/database.js';
import type { DeltaSyncMetrics } from '../../../../server/observability/deltaSyncMetrics.js';
import type { Connection, Room } from '../../../../server/types.js';

describe('realtime runtime bootstrap', () => {
  const runtimes: Array<ReturnType<typeof createRealtimeRuntime>> = [];
  afterEach(async () => { await Promise.all(runtimes.splice(0).map((runtime) => runtime.socketManager.shutdown())); });

  it('attaches upgrade and connection handling without opening a real server', () => {
    const wss = new EventEmitter() as unknown as WebSocketServer;
    const runtime = createRealtimeRuntime({ db: {} as DatabaseService, deltaSyncMetrics: {} as DeltaSyncMetrics, wss });
    runtimes.push(runtime);
    const httpServer = new EventEmitter();
    runtime.attach(httpServer as never, ((_req, _res, next) => next()) as never);
    expect(httpServer.listenerCount('upgrade')).toBe(1);
    expect((wss as unknown as EventEmitter).listenerCount('connection')).toBeGreaterThan(0);
  });

  it('rejects canonical game-state uploads from non-host connections', () => {
    const wss = new EventEmitter() as unknown as WebSocketServer;
    const runtime = createRealtimeRuntime({ db: {} as DatabaseService, deltaSyncMetrics: {} as DeltaSyncMetrics, wss });
    runtimes.push(runtime);
    const send = vi.fn();
    const connection: Connection = { id: 'player-1', instanceId: 'socket-1', ws: { readyState: WebSocket.OPEN, send } as never, user: { name: 'Player', type: 'player' }, consecutiveMisses: 0, connectionQuality: 'excellent' };
    const room: Room = { code: 'ROOM', host: 'host-1', coHosts: new Set(), players: new Set(), connections: new Map(), created: 1, lastActivity: 1, status: 'active', dmConnected: true, stateVersion: 0, entityVersions: new Map(), syncToken: null };
    runtime.socketManager.emit('event:game-state-update', { connection, room, message: { data: {} } });
    expect(JSON.parse(String(send.mock.calls[0][0]))).toMatchObject({ type: 'error', data: { message: expect.stringContaining('Host privilege') } });
  });
});
