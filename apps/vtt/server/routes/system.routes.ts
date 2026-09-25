import { Router } from 'express';
import os from 'os';
import type { DatabaseService } from '../database.js';
import type { SocketManager } from '../socket/SocketManager.js';
import type { SystemInfoResponse } from '../../src/types/systemInfo.js';

export interface SystemRouterDependencies {
  db: DatabaseService;
  getSocketManager: () => SocketManager;
  port: number;
}

export function formatUptimeSeconds(totalSeconds: number): string {
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor((totalSeconds / 3600) % 24);
  const days = Math.floor(totalSeconds / 86400);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
}

export function createSystemRouter({
  db,
  getSocketManager,
  port: _port,
}: SystemRouterDependencies): Router {
  const router = Router();

  router.get('/api/system/info', async (_req, res) => {
    try {
      const memory = process.memoryUsage();
      const uptime = process.uptime();
      const poolStats = db.getPoolStats?.() || {
        totalConnections: 0,
        idleConnections: 0,
        waitingRequests: 0,
      };
      const socketManager = getSocketManager();
      const socketStats = socketManager.getStats();

      let dbVersion = 'PostgreSQL';
      try {
        const pool = db.getPool();
        const versionResult = await pool.query('SHOW server_version');
        if (versionResult.rows[0]?.server_version) {
          dbVersion = `PostgreSQL ${versionResult.rows[0].server_version}`;
        }
      } catch {
        // Fall back gracefully if server_version query fails
      }

      const commitSha =
        process.env.COMMIT_SHA ||
        process.env.VITE_BUILD_VERSION ||
        '5e148db';
      const gitBranch = process.env.GIT_BRANCH || 'main';
      const nodeEnv = process.env.NODE_ENV || 'development';
      const isDocker =
        process.env.DOCKER_CONTAINER === 'true' ||
        Boolean(process.env.DOCKER_IMAGE) ||
        process.env.HOSTNAME?.startsWith('nexus-') ||
        false;

      const response: SystemInfoResponse = {
        status: 'ok',
        timestamp: Date.now(),
        runtime: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          osRelease: os.release(),
          uptimeSeconds: Math.floor(uptime),
          formattedUptime: formatUptimeSeconds(uptime),
        },
        memory: {
          rssMb: Math.round((memory.rss / (1024 * 1024)) * 10) / 10,
          heapUsedMb: Math.round((memory.heapUsed / (1024 * 1024)) * 10) / 10,
          heapTotalMb: Math.round((memory.heapTotal / (1024 * 1024)) * 10) / 10,
          heapUtilizationRatio:
            memory.heapTotal > 0
              ? Math.round((memory.heapUsed / memory.heapTotal) * 100) / 100
              : 0,
        },
        database: {
          engine: 'PostgreSQL',
          version: dbVersion,
          status: 'connected',
          activeConnections: poolStats.totalConnections - poolStats.idleConnections,
          idleConnections: poolStats.idleConnections,
          waitingRequests: poolStats.waitingRequests,
          totalConnections: poolStats.totalConnections,
          latestMigration: '2026-09-25-campaign-prep',
        },
        realtime: {
          enabled: socketStats.realtime.enabled,
          connected: socketStats.realtime.connected,
          roomsCount: socketStats.totalRooms,
          connectionsCount: socketStats.totalConnections,
        },
        deployment: {
          version: process.env.npm_package_version || '0.1.0',
          buildCommit: commitSha,
          gitBranch,
          environment: nodeEnv,
          isDocker: Boolean(isDocker),
          dockerImage: process.env.DOCKER_IMAGE || 'fnsys/nexus-vtt:latest',
          edition: 'Community (Self-Hosted)',
          license: 'MIT',
          tagline: 'Lightweight, modern virtual tabletop for browser-based RPG sessions',
          links: {
            github: 'https://github.com/joelmale/nexusVTT',
            docs: 'https://github.com/joelmale/nexusVTT/tree/main/apps/docs',
            issues: 'https://github.com/joelmale/nexusVTT/issues',
            discord: 'https://discord.gg/nexusvtt',
            homelabStack: 'dockhand://stacks/nexus-vtt2',
          },
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Failed to generate system info:', error);
      res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
