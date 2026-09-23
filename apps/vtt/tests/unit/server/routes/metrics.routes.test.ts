import express, { type Express } from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMultiplayerMetricsSnapshot, createMetricsRouter } from '../../../../server/routes/metrics.routes.js';
import type { DatabaseService } from '../../../../server/database.js';
import type { DeltaSyncMetrics } from '../../../../server/observability/deltaSyncMetrics.js';
import type { SocketManager } from '../../../../server/socket/SocketManager.js';

const deltaSyncMetrics = {
  commits: { legacy: 1, full: 2, patch: 3 }, totalUploads: 8, patchBytesSaved: 42,
  resync: { 'base-mismatch': 1, 'integrity-mismatch': 0, 'malformed-patch': 0, 'payload-too-large': 0 },
  durability: { committed: 6, conflicts: 1, failures: 0, totalCommitLatencyMs: 123, commitLatency: { count: 1, sum: 10, buckets: { '10': 1 } } },
} as unknown as DeltaSyncMetrics;

function dependencies() {
  return {
    deltaSyncMetrics,
    getSocketManager: vi.fn(() => ({ getStats: () => ({ totalRooms: 2, totalConnections: 3, orderedEvents: { committed: 4 }, realtime: { enabled: false } }) }) as unknown as SocketManager),
    db: { getPoolStats: () => ({ totalConnections: 1, idleConnections: 1, waitingRequests: 0 }) } as unknown as DatabaseService,
    getGameStateQueueDepth: () => 7,
  };
}

describe('metrics routes', () => {
  let server: Server | undefined;
  afterEach(async () => { if (server) await new Promise<void>((resolve, reject) => server?.close((error) => error ? reject(error) : resolve())); server = undefined; vi.unstubAllEnvs(); });

  it('builds a complete snapshot and calculates resync ratios', () => {
    const snapshot = buildMultiplayerMetricsSnapshot(dependencies());
    expect(snapshot).toMatchObject({ rooms: 2, connections: 3, gameStateQueueDepth: 7, gameState: { totalResyncs: 1, resyncRateRatio: 0.125 } });
  });

  it('serves JSON metrics and protects Prometheus scraping when configured', async () => {
    vi.stubEnv('METRICS_AUTH_TOKEN', 'secret');
    const app: Express = express(); app.use(createMetricsRouter(dependencies()));
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server?.once('listening', resolve));
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('Expected TCP server');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const delta = await fetch(`${baseUrl}/api/metrics/delta-sync`);
    expect(delta.status).toBe(200); await expect(delta.json()).resolves.toMatchObject({ totalCommits: 6, resyncRate: 12.5 });
    expect((await fetch(`${baseUrl}/metrics`)).status).toBe(401);
    const scrape = await fetch(`${baseUrl}/metrics`, { headers: { Authorization: 'Bearer secret' } });
    expect(scrape.status).toBe(200); expect(await scrape.text()).toContain('nexus_vtt_connections 3');
  });
});
