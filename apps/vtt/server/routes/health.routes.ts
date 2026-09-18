import { Router } from 'express';
import type { DatabaseService } from '../database.js';
import type { SocketManager } from '../socket/SocketManager.js';
import type { AssetManifest } from '../../shared/types.js';

export interface HealthRouterDependencies {
  db: DatabaseService;
  /**
   * Resolved lazily: these routes are registered before the SocketManager is
   * constructed, and are only ever dereferenced while serving a request.
   */
  getSocketManager: () => SocketManager;
  port: number;
  /** Reads the currently loaded asset manifest (it is reloaded on change). */
  getManifest: () => AssetManifest | null;
}

/**
 * Builds the liveness/readiness router: `/health`, `/api/system/health` and the
 * root `/` status document. Mounted at the application root.
 */
export function createHealthRouter({
  db,
  getSocketManager,
  port,
  getManifest,
}: HealthRouterDependencies): Router {
  const router = Router();

  router.get(['/health', '/api/system/health'], async (_req, res) => {
    const wsUrl =
      process.env.NODE_ENV === 'production' ? '/ws' : `ws://localhost:${port}`;

    try {
      await db.healthCheck();
      const socketManager = getSocketManager();
      const realtime = socketManager.getStats().realtime;
      if (realtime.enabled && !realtime.connected) {
        throw new Error('realtime coordinator unavailable');
      }
      res.json({
        status: 'ok',
        version: '1.0.0',
        port,
        wsUrl,
        rooms: socketManager.rooms.size,
        connections: socketManager.connections.size,
        realtime,
        assetsLoaded: getManifest()?.totalAssets || 0,
        uptime: process.uptime(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'error',
        reason:
          error instanceof Error
            ? error.message
            : 'required dependency unavailable',
        uptime: process.uptime(),
      });
    }
  });

  router.get('/', (req, res) => {
    // In production behind nginx proxy, use relative /ws path
    // In development, use localhost:port for direct connection
    const wsUrl =
      process.env.NODE_ENV === 'production' ? '/ws' : `ws://localhost:${port}`;

    const socketManager = getSocketManager();
    res.json({
      status: 'ok',
      port,
      wsUrl,
      rooms: socketManager.rooms.size,
      connections: socketManager.connections.size,
    });
  });

  return router;
}
