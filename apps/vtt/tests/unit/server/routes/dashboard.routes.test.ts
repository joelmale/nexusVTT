import express, { type Express } from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../../../../server/database.js';
import { createDashboardRouter } from '../../../../server/routes/dashboard.routes.js';

describe('dashboard routes', () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server?.close((error) => (error ? reject(error) : resolve())),
      );
    }
    server = undefined;
  });

  async function start(user?: { id: string }, getSummary = vi.fn()) {
    const app: Express = express();
    app.use((req, _res, next) => {
      (req as unknown as { isAuthenticated: () => boolean }).isAuthenticated =
        () => Boolean(user);
      (req as unknown as { user?: unknown }).user = user;
      next();
    });
    app.use(
      '/api',
      createDashboardRouter({
        db: { dashboard: { getSummary } } as unknown as DatabaseService,
      }),
    );
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server?.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('no port');
    return { baseUrl: `http://127.0.0.1:${address.port}`, getSummary };
  }

  it('returns 401 without querying when unauthenticated', async () => {
    const { baseUrl, getSummary } = await start();
    const response = await fetch(`${baseUrl}/api/dashboard`);
    expect(response.status).toBe(401);
    expect(getSummary).not.toHaveBeenCalled();
  });

  it('returns the summary for the authenticated user', async () => {
    const summary = { runs: [], joined: [], heroes: [] };
    const { baseUrl, getSummary } = await start(
      { id: 'user-1' },
      vi.fn().mockResolvedValue(summary),
    );
    const response = await fetch(`${baseUrl}/api/dashboard`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(summary);
    expect(getSummary).toHaveBeenCalledWith('user-1');
  });

  it('returns 500 when the repository fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { baseUrl } = await start(
      { id: 'user-1' },
      vi.fn().mockRejectedValue(new Error('boom')),
    );
    expect((await fetch(`${baseUrl}/api/dashboard`)).status).toBe(500);
  });
});
