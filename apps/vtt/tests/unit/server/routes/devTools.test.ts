import express, { type Express } from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../../../../server/database.js';

/**
 * The dev tooling routes are registered at module-call time based on
 * DEV_MODE, so each test sets the env var and then re-imports the
 * module with a fresh registry.
 */
async function startApp(opts: {
  enabled: boolean;
  guestUser?: { id: string; name: string; provider: string };
  authUser?: { id: string };
  db?: Partial<DatabaseService>;
}): Promise<{ baseUrl: string; server: Server; db: Partial<DatabaseService> }> {
  process.env.DEV_MODE = opts.enabled ? 'true' : 'false';

  vi.resetModules();
  const { registerApiRoutes } = await import('../../../../server/routes/api.js');

  const db: Partial<DatabaseService> = opts.db ?? {
    createCampaign: vi
      .fn()
      .mockResolvedValue({ id: 'camp-1', name: 'Seeded', description: null }),
    createCharacter: vi
      .fn()
      .mockResolvedValue({ id: 'char-1', name: 'Seeded Hero' }),
    getCampaignsByUser: vi.fn().mockResolvedValue([]),
    getCharactersByUser: vi.fn().mockResolvedValue([]),
    deleteCampaign: vi.fn().mockResolvedValue(undefined),
    deleteCharactersByUser: vi.fn().mockResolvedValue(undefined),
  };

  const app: Express = express();
  app.use(express.json());

  // Minimal passport/session surface: guests live on req.session.guestUser and
  // never satisfy req.isAuthenticated() (see assetWriteGuard.ts).
  app.use((req, _res, next) => {
    (req as unknown as { session: unknown }).session = {
      guestUser: opts.guestUser,
    };
    (req as unknown as { isAuthenticated: () => boolean }).isAuthenticated =
      () => Boolean(opts.authUser);
    (req as unknown as { user?: { id: string } }).user = opts.authUser;
    next();
  });

  registerApiRoutes(app, db as DatabaseService, '/tmp/assets');

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected the test server to listen on a TCP port');
  }
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, db };
}

describe('dev tooling routes', () => {
  let server: Server | undefined;
  const originalFlag = process.env.DEV_MODE;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server!.close((e) => (e ? reject(e) : resolve())),
      );
      server = undefined;
    }
    process.env.DEV_MODE = originalFlag;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when DEV_MODE=false', () => {
    it('does not register the dev routes at all', async () => {
      const app = await startApp({
        enabled: false,
        guestUser: { id: 'guest-1', name: 'G', provider: 'guest' },
      });
      server = app.server;

      for (const route of [
        '/api/dev/quick-start',
        '/api/dev/clear-all',
        '/api/dev/populate-mock-data',
      ]) {
        const res = await fetch(`${app.baseUrl}${route}`, { method: 'POST' });
        expect(res.status, `${route} should not exist`).toBe(404);
      }
    });
  });

  describe('when DEV_MODE=true', () => {
    it('seeds a campaign, character and scene for a GUEST user', async () => {
      const app = await startApp({
        enabled: true,
        guestUser: { id: 'guest-42', name: 'Tester', provider: 'guest' },
      });
      server = app.server;

      const res = await fetch(`${app.baseUrl}/api/dev/quick-start`, {
        method: 'POST',
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.campaign.id).toBe('camp-1');
      expect(body.character.id).toBe('char-1');
      expect(body.scene.gridSettings.enabled).toBe(true);
      expect(body.scene.createdBy).toBe('guest-42');

      // Rows must be attributed to the guest, not to a passport user.
      expect(app.db.createCampaign).toHaveBeenCalledWith(
        'guest-42',
        expect.any(String),
        expect.anything(),
      );
    });

    it('seeds for an authenticated passport user too', async () => {
      const app = await startApp({
        enabled: true,
        authUser: { id: 'oauth-7' },
      });
      server = app.server;

      const res = await fetch(`${app.baseUrl}/api/dev/quick-start`, {
        method: 'POST',
      });
      expect(res.status).toBe(200);
      expect((await res.json()).scene.createdBy).toBe('oauth-7');
    });

    it('rejects callers with no identity at all', async () => {
      const app = await startApp({ enabled: true });
      server = app.server;

      const res = await fetch(`${app.baseUrl}/api/dev/quick-start`, {
        method: 'POST',
      });
      expect(res.status).toBe(401);
    });

    it('clear-all deletes only the caller\'s campaigns and characters', async () => {
      const db: Partial<DatabaseService> = {
        getCampaignsByUser: vi
          .fn()
          .mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]),
        getCharactersByUser: vi.fn().mockResolvedValue([{ id: 'h1' }]),
        deleteCampaign: vi.fn().mockResolvedValue(undefined),
        deleteCharactersByUser: vi.fn().mockResolvedValue(undefined),
      };
      const app = await startApp({
        enabled: true,
        guestUser: { id: 'guest-9', name: 'G', provider: 'guest' },
        db,
      });
      server = app.server;

      const res = await fetch(`${app.baseUrl}/api/dev/clear-all`, {
        method: 'POST',
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.deleted).toEqual({ campaigns: 2, characters: 1 });
      expect(db.getCampaignsByUser).toHaveBeenCalledWith('guest-9');
      expect(db.deleteCharactersByUser).toHaveBeenCalledWith('guest-9');
    });

    it('reports partial failure instead of aborting the whole teardown', async () => {
      const db: Partial<DatabaseService> = {
        getCampaignsByUser: vi
          .fn()
          .mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]),
        getCharactersByUser: vi.fn().mockResolvedValue([]),
        deleteCampaign: vi
          .fn()
          .mockRejectedValueOnce(new Error('locked'))
          .mockResolvedValueOnce(undefined),
        deleteCharactersByUser: vi.fn().mockResolvedValue(undefined),
      };
      const app = await startApp({
        enabled: true,
        guestUser: { id: 'guest-9', name: 'G', provider: 'guest' },
        db,
      });
      server = app.server;

      const body = await (
        await fetch(`${app.baseUrl}/api/dev/clear-all`, { method: 'POST' })
      ).json();

      expect(body.success).toBe(false);
      expect(body.deleted.campaigns).toBe(1);
      expect(body.errors).toHaveLength(1);
    });
  });
});
