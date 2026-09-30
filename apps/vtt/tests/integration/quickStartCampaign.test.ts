import express from 'express';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CampaignPrepAuthoringService } from '../../server/campaign-prep/CampaignPrepAuthoringService.js';
import {
  createDatabaseService,
  type DatabaseService,
} from '../../server/database.js';
import { createCampaignPrepRouter } from '../../server/routes/campaignPrep.routes.js';
import { registerApiRoutes } from '../../server/routes/api.js';
import { runStartupMigrations } from '../../server/startupMigrations.js';
import { assertTestDatabase } from './assertTestDatabase.js';

const shouldSkip = !process.env.DATABASE_URL;
const describeIntegration = shouldSkip ? describe.skip : describe;

describeIntegration('quick-start campaign is a normal owned campaign', () => {
  let pool: Pool;
  let db: DatabaseService;
  let server: Server;
  let baseUrl: string;
  let currentUserId = '';
  let ownerId: string;
  let playerId: string;

  beforeAll(async () => {
    assertTestDatabase();
    const connectionString = process.env.DATABASE_URL!;
    db = createDatabaseService({ connectionString });
    pool = new Pool({ connectionString });
    await db.initialize();
    await runStartupMigrations(pool);

    ownerId = (
      await db.users.createLocalUser(
        `qs-owner-${Date.now()}@nexusvtt.test`,
        'SafePassword123!',
        'Quick Start DM',
      )
    ).id;
    playerId = (
      await db.users.createLocalUser(
        `qs-player-${Date.now()}@nexusvtt.test`,
        'SafePassword123!',
        'Quick Start Player',
      )
    ).id;

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.isAuthenticated = (() => Boolean(currentUserId)) as never;
      req.user = currentUserId
        ? ({ id: currentUserId, provider: 'google' } as Express.User)
        : undefined;
      (req as unknown as { session: unknown }).session = {};
      next();
    });
    registerApiRoutes(app, db, '/tmp/assets');
    app.use(
      '/api',
      createCampaignPrepRouter({
        author: new CampaignPrepAuthoringService(db.campaignPrep),
        db,
        publisher: {
          publish: async () => {
            throw new Error('unused');
          },
        },
      }),
    );
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('no port');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await db?.close();
    await pool?.end();
  });

  function npcPayload(campaignId: string) {
    const now = new Date().toISOString();
    return {
      id: randomUUID(),
      campaignId,
      schemaVersion: 1,
      revision: 1,
      kind: 'npc',
      title: 'Harbormaster Vell',
      visibility: 'dm-only',
      content: { format: 'lexical', schemaVersion: 1, value: {} },
      links: [],
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  function post(path: string, body: unknown) {
    return fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function put(path: string, body: unknown) {
    return fetch(`${baseUrl}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('lets the quick-start owner edit the overview and add an NPC; a player cannot', async () => {
    // Exactly what ConnectionLifecycle does for a quick start: title +
    // description only, then a session that a second user joins as a player.
    const campaign = await db.createCampaign(
      ownerId,
      'Goblin Ambush',
      'One-shot at level 3',
    );
    expect(campaign.dmId).toBe(ownerId);
    const { sessionId } = await db.createSession(campaign.id, ownerId);
    await db.addPlayerToSession(playerId, sessionId);

    // Blank studio overview: no prep objects, no fixtures.
    currentUserId = ownerId;
    const listed = await fetch(
      `${baseUrl}/api/campaigns/${campaign.id}/prep/objects`,
    );
    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toEqual({ objects: [] });

    const rename = await put(`/api/campaigns/${campaign.id}`, {
      name: 'Goblin Ambush (revised)',
      description: 'Now with a harbor',
    });
    expect(rename.status).toBe(200);
    expect(await db.getCampaignById(campaign.id)).toMatchObject({
      name: 'Goblin Ambush (revised)',
      description: 'Now with a harbor',
    });

    const created = await post(`/api/campaigns/${campaign.id}/prep/objects`, {
      kind: 'npc',
      requestId: randomUUID(),
      data: npcPayload(campaign.id),
    });
    expect(created.status).toBe(201);

    // The session history survives the prep edits.
    const sessions = await pool.query(
      'SELECT id FROM sessions WHERE "campaignId" = $1',
      [campaign.id],
    );
    expect(sessions.rows).toHaveLength(1);

    // A user who only joined as a player is not an owner.
    currentUserId = playerId;
    const playerRename = await put(`/api/campaigns/${campaign.id}`, {
      name: 'Hijacked',
    });
    expect(playerRename.status).toBe(403);
    const playerNpc = await post(`/api/campaigns/${campaign.id}/prep/objects`, {
      kind: 'npc',
      requestId: randomUUID(),
      data: npcPayload(campaign.id),
    });
    expect(playerNpc.status).toBe(403);
    expect((await db.getCampaignById(campaign.id))?.name).toBe(
      'Goblin Ambush (revised)',
    );
  });

  it('grants ownership at creation on the API create path', async () => {
    currentUserId = ownerId;
    const response = await post('/api/campaigns', {
      name: 'API Campaign',
      description: 'via API',
    });
    expect(response.status).toBe(201);
    const body = (await response.json()) as { dmId: string };
    expect(body.dmId).toBe(ownerId);
  });
});
