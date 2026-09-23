import { createHash, timingSafeEqual } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import type { DatabaseService } from '../database.js';
import type { SocketManager } from '../socket/SocketManager.js';
import type { DeltaSyncMetrics } from '../observability/deltaSyncMetrics.js';
import {
  evaluateMultiplayerSlos,
  getMultiplayerSloConfig,
  renderPrometheusMetrics,
  type MultiplayerMetricsSnapshot,
} from '../observability/multiplayerMetrics.js';

export interface MetricsRouterDependencies {
  /** The live accumulator mutated by the game-state commit path. */
  deltaSyncMetrics: DeltaSyncMetrics;
  /**
   * Resolved lazily: these routes are registered before the SocketManager is
   * constructed, and are only ever dereferenced while serving a request.
   */
  getSocketManager: () => SocketManager;
  db: DatabaseService;
  /** Current depth of the per-room game-state commit queue map. */
  getGameStateQueueDepth: () => number;
}

/**
 * Builds the current multiplayer metrics snapshot from the live socket manager,
 * database pool and delta-sync accumulator.
 */
export function buildMultiplayerMetricsSnapshot({
  deltaSyncMetrics,
  getSocketManager,
  db,
  getGameStateQueueDepth,
}: MetricsRouterDependencies): MultiplayerMetricsSnapshot {
  const socketStats = getSocketManager().getStats();
  const memory = process.memoryUsage();
  const totalResyncs = Object.values(deltaSyncMetrics.resync).reduce(
    (sum, count) => sum + count,
    0,
  );
  return {
    timestamp: Date.now(),
    process: {
      uptimeSeconds: process.uptime(),
      residentMemoryBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
      heapUtilizationRatio:
        memory.heapTotal > 0 ? memory.heapUsed / memory.heapTotal : 0,
    },
    rooms: socketStats.totalRooms,
    connections: socketStats.totalConnections,
    gameStateQueueDepth: getGameStateQueueDepth(),
    database: db.getPoolStats(),
    gameState: {
      commits: { ...deltaSyncMetrics.commits },
      committed: deltaSyncMetrics.durability.committed,
      conflicts: deltaSyncMetrics.durability.conflicts,
      failures: deltaSyncMetrics.durability.failures,
      resync: { ...deltaSyncMetrics.resync },
      totalResyncs,
      totalUploads: deltaSyncMetrics.totalUploads,
      resyncRateRatio:
        deltaSyncMetrics.totalUploads > 0
          ? totalResyncs / deltaSyncMetrics.totalUploads
          : 0,
      patchBytesSaved: deltaSyncMetrics.patchBytesSaved,
      commitLatency: {
        ...deltaSyncMetrics.durability.commitLatency,
        buckets: {
          ...deltaSyncMetrics.durability.commitLatency.buckets,
        },
      },
    },
    orderedEvents: socketStats.orderedEvents,
    realtime: socketStats.realtime,
  };
}

// Hashing first gives equal-length buffers, as timingSafeEqual requires.
function tokensMatch(supplied: string | undefined, configured: string): boolean {
  if (supplied === undefined) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(supplied), digest(configured));
}

/**
 * Builds the metrics router (`/api/metrics/*` plus the Prometheus `/metrics`
 * scrape endpoint).
 *
 * Mounted at the application root, and registered BEFORE the `/api` document
 * router so its `/api/metrics/...` paths are not swallowed by that catch-all.
 */
export function createMetricsRouter(deps: MetricsRouterDependencies): Router {
  const { deltaSyncMetrics, getSocketManager } = deps;
  const router = Router();

  // Guards every route, not just /metrics: the JSON diagnostics expose the
  // same operational detail and are reachable through the public gateway's
  // generic `/api` proxy. The managed soak already sends this bearer token.
  const requireMetricsToken: RequestHandler = (req, res, next) => {
    const configuredToken = process.env.METRICS_AUTH_TOKEN;
    const suppliedToken = req.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (configuredToken && !tokensMatch(suppliedToken, configuredToken)) {
      res.status(401).type('text/plain').send('Unauthorized\n');
      return;
    }
    next();
  };

  router.get('/api/metrics/delta-sync', requireMetricsToken, (req, res) => {
    const totalResyncs = Object.values(deltaSyncMetrics.resync).reduce(
      (sum, count) => sum + count,
      0,
    );
    const totalCommits =
      deltaSyncMetrics.commits.legacy +
      deltaSyncMetrics.commits.full +
      deltaSyncMetrics.commits.patch;
    // totalUploads already counts every attempt (commits AND resyncs), so it
    // is the correct denominator — adding totalResyncs again would understate
    // the rate (the dangerous direction for a health signal).
    const totalOps = deltaSyncMetrics.totalUploads;
    const resyncRate = totalOps > 0 ? (totalResyncs / totalOps) * 100 : 0;
    res.json({
      commits: deltaSyncMetrics.commits,
      totalCommits,
      durability: {
        ...deltaSyncMetrics.durability,
        averageCommitLatencyMs:
          deltaSyncMetrics.durability.committed > 0
            ? parseFloat(
                (
                  deltaSyncMetrics.durability.totalCommitLatencyMs /
                  deltaSyncMetrics.durability.committed
                ).toFixed(2),
              )
            : 0,
      },
      resync: deltaSyncMetrics.resync,
      totalResyncs,
      patchBytesSaved: deltaSyncMetrics.patchBytesSaved,
      totalUploads: deltaSyncMetrics.totalUploads,
      resyncRate: parseFloat(resyncRate.toFixed(2)),
      timestamp: Date.now(),
    });
  });

  router.get('/api/metrics/ordered-events', requireMetricsToken, (req, res) => {
    res.json({
      ...getSocketManager().getStats().orderedEvents,
      timestamp: Date.now(),
    });
  });

  router.get('/api/metrics/realtime', requireMetricsToken, (req, res) => {
    res.json({
      ...getSocketManager().getStats().realtime,
      timestamp: Date.now(),
    });
  });

  router.get('/api/metrics/multiplayer', requireMetricsToken, (req, res) => {
    const snapshot = buildMultiplayerMetricsSnapshot(deps);
    res.json({
      ...snapshot,
      slo: evaluateMultiplayerSlos(snapshot, getMultiplayerSloConfig()),
    });
  });

  router.get('/metrics', requireMetricsToken, (req, res) => {
    const snapshot = buildMultiplayerMetricsSnapshot(deps);
    res
      .status(200)
      .type('text/plain; version=0.0.4; charset=utf-8')
      .send(renderPrometheusMetrics(snapshot));
  });

  return router;
}
