import express, { type Express } from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../../../../server/database.js';
import { registerApiRoutes } from '../../../../server/routes/api.js';

interface AppContext {
  baseUrl: string;
  server: Server;
  db: Partial<DatabaseService>;
}

async function startApp(opts: {
  authUser?: { id: string; name?: string; provider?: string };
  guestUser?: { id: string; name: string; provider: string };
  db?: Partial<DatabaseService>;
}): Promise<AppContext> {
  const db: Partial<DatabaseService> = opts.db ?? {};

  const app: Express = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).session = {
      guestUser: opts.guestUser,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).isAuthenticated = () => Boolean(opts.authUser);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).user = opts.authUser;
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
    throw new Error('Expected server to listen on TCP port');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server,
    db,
  };
}

describe('api.ts core CRUD routes', () => {
  let ctx: AppContext | null = null;

  afterEach(async () => {
    if (ctx) {
      await new Promise<void>((resolve) => ctx!.server.close(() => resolve()));
      ctx = null;
    }
  });

  describe('Campaign routes', () => {
    it('GET /api/campaigns requires authentication', async () => {
      ctx = await startApp({});
      const res = await fetch(`${ctx.baseUrl}/api/campaigns`);
      expect(res.status).toBe(401);
    });

    it('GET /api/campaigns returns user campaigns when authenticated', async () => {
      const mockCampaigns = [{ id: 'camp-1', name: 'My Campaign', dmId: 'u1' }];
      ctx = await startApp({
        authUser: { id: 'u1' },
        db: {
          getCampaignsByUser: vi.fn().mockResolvedValue(mockCampaigns),
        },
      });

      const res = await fetch(`${ctx.baseUrl}/api/campaigns`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(mockCampaigns);
      expect(ctx.db.getCampaignsByUser).toHaveBeenCalledWith('u1');
    });

    it('POST /api/campaigns validates name input', async () => {
      ctx = await startApp({ authUser: { id: 'u1' } });

      const emptyRes = await fetch(`${ctx.baseUrl}/api/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      });
      expect(emptyRes.status).toBe(400);

      const longNameRes = await fetch(`${ctx.baseUrl}/api/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'a'.repeat(256) }),
      });
      expect(longNameRes.status).toBe(400);
    });

    it('POST /api/campaigns creates a new campaign', async () => {
      const created = { id: 'c-new', name: 'New Campaign', dmId: 'u1' };
      ctx = await startApp({
        authUser: { id: 'u1' },
        db: {
          createCampaign: vi.fn().mockResolvedValue(created),
        },
      });

      const res = await fetch(`${ctx.baseUrl}/api/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Campaign', description: 'Fun adventure' }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data).toEqual(created);
      expect(ctx.db.createCampaign).toHaveBeenCalledWith('u1', 'New Campaign', 'Fun adventure');
    });

    it('PUT /api/campaigns/:id checks ownership and updates campaign', async () => {
      ctx = await startApp({
        authUser: { id: 'u1' },
        db: {
          getCampaignById: vi.fn().mockResolvedValue({ id: 'c-1', dmId: 'u1', name: 'Old' }),
          updateCampaign: vi.fn().mockResolvedValue(undefined),
        },
      });

      const res = await fetch(`${ctx.baseUrl}/api/campaigns/c-1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Campaign Name' }),
      });

      expect(res.status).toBe(200);
      expect(ctx.db.updateCampaign).toHaveBeenCalledWith('c-1', {
        name: 'Updated Campaign Name',
      });
    });

    it('PUT /api/campaigns/:id denies update for non-owner', async () => {
      ctx = await startApp({
        authUser: { id: 'u-intruder' },
        db: {
          getCampaignById: vi.fn().mockResolvedValue({ id: 'c-1', dmId: 'u-owner' }),
        },
      });

      const res = await fetch(`${ctx.baseUrl}/api/campaigns/c-1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Hacked Name' }),
      });

      expect(res.status).toBe(403);
    });

    it('DELETE /api/campaigns/:id deletes campaign when owned by caller', async () => {
      ctx = await startApp({
        authUser: { id: 'u1' },
        db: {
          getCampaignById: vi.fn().mockResolvedValue({ id: 'c-1', dmId: 'u1' }),
          deleteCampaign: vi.fn().mockResolvedValue(undefined),
        },
      });

      const res = await fetch(`${ctx.baseUrl}/api/campaigns/c-1`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      expect(ctx.db.deleteCampaign).toHaveBeenCalledWith('c-1');
    });
  });

  describe('Character routes', () => {
    it('GET /api/characters fetches and dedupes characters', async () => {
      const now = new Date();
      const older = new Date(now.getTime() - 1000);
      const chars = [
        { id: 'c-1', name: 'Hero', ownerId: 'u1', data: { hp: 10 }, updatedAt: now },
        { id: 'c-2', name: 'Hero', ownerId: 'u1', data: { hp: 10 }, updatedAt: older }, // Duplicate!
      ];

      ctx = await startApp({
        authUser: { id: 'u1' },
        db: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          getCharactersByUser: vi.fn().mockResolvedValue(chars as any),
          deleteCharactersByIds: vi.fn().mockResolvedValue(1),
        },
      });

      const res = await fetch(`${ctx.baseUrl}/api/characters`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe('c-1');
      expect(ctx.db.deleteCharactersByIds).toHaveBeenCalledWith(['c-2']);
    });

    it('GET /api/characters/:id returns character when owned, 404 when missing, 403 when owned by other', async () => {
      ctx = await startApp({
        authUser: { id: 'u1' },
        db: {
          getCharacterById: vi
            .fn()
            .mockResolvedValueOnce({ id: 'c-1', ownerId: 'u1', name: 'My Hero' })
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 'c-3', ownerId: 'other-user', name: 'Enemy Hero' }),
        },
      });

      // 1. Success
      const okRes = await fetch(`${ctx.baseUrl}/api/characters/c-1`);
      expect(okRes.status).toBe(200);

      // 2. 404
      const missingRes = await fetch(`${ctx.baseUrl}/api/characters/c-missing`);
      expect(missingRes.status).toBe(404);

      // 3. 403
      const forbiddenRes = await fetch(`${ctx.baseUrl}/api/characters/c-3`);
      expect(forbiddenRes.status).toBe(403);
    });

    it('POST /api/characters creates character and validates name', async () => {
      const created = { id: 'c-new', name: 'Ranger', ownerId: 'u1', data: {} };
      ctx = await startApp({
        authUser: { id: 'u1' },
        db: {
          getCharactersByUser: vi.fn().mockResolvedValue([]),
          createCharacter: vi.fn().mockResolvedValue(created),
        },
      });

      const badRes = await fetch(`${ctx.baseUrl}/api/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      });
      expect(badRes.status).toBe(400);

      const goodRes = await fetch(`${ctx.baseUrl}/api/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Ranger', data: { level: 1 } }),
      });
      expect(goodRes.status).toBe(201);
      expect(ctx.db.createCharacter).toHaveBeenCalledWith('u1', 'Ranger', { level: 1 });
    });

    it('PUT /api/characters/:id updates owned character', async () => {
      ctx = await startApp({
        authUser: { id: 'u1' },
        db: {
          getCharacterById: vi.fn().mockResolvedValue({ id: 'c-1', ownerId: 'u1' }),
          updateCharacter: vi.fn().mockResolvedValue(undefined),
        },
      });

      const res = await fetch(`${ctx.baseUrl}/api/characters/c-1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Upgraded Ranger' }),
      });

      expect(res.status).toBe(200);
      expect(ctx.db.updateCharacter).toHaveBeenCalledWith('c-1', {
        name: 'Upgraded Ranger',
      });
    });

    it('DELETE /api/characters/:id and DELETE /api/characters delete characters', async () => {
      ctx = await startApp({
        authUser: { id: 'u1' },
        db: {
          getCharacterById: vi.fn().mockResolvedValue({ id: 'c-1', ownerId: 'u1' }),
          deleteCharacter: vi.fn().mockResolvedValue(undefined),
          deleteCharactersByUser: vi.fn().mockResolvedValue(3),
        },
      });

      const singleRes = await fetch(`${ctx.baseUrl}/api/characters/c-1`, {
        method: 'DELETE',
      });
      expect(singleRes.status).toBe(200);
      expect(ctx.db.deleteCharacter).toHaveBeenCalledWith('c-1');

      const allRes = await fetch(`${ctx.baseUrl}/api/characters`, {
        method: 'DELETE',
      });
      expect(allRes.status).toBe(200);
      expect(ctx.db.deleteCharactersByUser).toHaveBeenCalledWith('u1');
    });
  });

  describe('User profile & preferences routes', () => {
    it('GET and PUT /api/users/preferences', async () => {
      const prefs = { allowSpectators: true, logSessions: false };
      ctx = await startApp({
        authUser: { id: 'u1' },
        db: {
          getUserPreferences: vi.fn().mockResolvedValue(prefs),
          updateUserPreferences: vi.fn().mockResolvedValue({ ...prefs, allowSpectators: false }),
        },
      });

      const getRes = await fetch(`${ctx.baseUrl}/api/users/preferences`);
      expect(getRes.status).toBe(200);
      expect(await getRes.json()).toEqual(prefs);

      const putRes = await fetch(`${ctx.baseUrl}/api/users/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowSpectators: false }),
      });
      expect(putRes.status).toBe(200);
      expect(ctx.db.updateUserPreferences).toHaveBeenCalledWith('u1', expect.objectContaining({
        allowSpectators: false,
      }));
    });

    it('POST /api/guest-users creates or returns guest', async () => {
      ctx = await startApp({
        db: {
          createGuestUser: vi.fn().mockResolvedValue({ id: 'guest-1', name: 'Traveler' }),
        },
      });

      const res = await fetch(`${ctx.baseUrl}/api/guest-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Traveler' }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data).toMatchObject({ id: 'guest-1', name: 'Traveler', provider: 'guest' });
    });

    it('GET /api/client-config returns devToolsEnabled flag', async () => {
      ctx = await startApp({});
      const res = await fetch(`${ctx.baseUrl}/api/client-config`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('devToolsEnabled');
    });
  });
});
