import { Router } from 'express';

import type { DatabaseService } from '../database.js';
import { sanitizeLog } from '../sanitizeLog.js';

export interface DashboardRouterDependencies {
  db: Pick<DatabaseService, 'dashboard'>;
}

/**
 * Builds the read-only dashboard router. Mounted under `/api`.
 * Auth matches `GET /api/campaigns`: passport-authenticated users only.
 */
export function createDashboardRouter({
  db,
}: DashboardRouterDependencies): Router {
  const router = Router();

  router.get('/dashboard', async (req, res) => {
    if (!req.isAuthenticated?.()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = req.user as { id: string };
    try {
      res.json(await db.dashboard.getSummary(user.id));
    } catch (error) {
      console.error(
        `Failed to build dashboard for ${sanitizeLog(user.id)}:`,
        error,
      );
      res.status(500).json({ error: 'Failed to load dashboard' });
    }
  });

  return router;
}
