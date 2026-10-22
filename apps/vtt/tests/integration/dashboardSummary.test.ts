import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createDatabaseService,
  type DatabaseService,
} from '../../server/database.js';
import { assertTestDatabase } from './assertTestDatabase.js';

const shouldSkip = !process.env.DATABASE_URL;
const describeIntegration = shouldSkip ? describe.skip : describe;

describeIntegration('DashboardRepository.getSummary', () => {
  let pool: Pool;
  let db: DatabaseService;

  beforeAll(async () => {
    assertTestDatabase();
    const connectionString = process.env.DATABASE_URL!;
    db = createDatabaseService({ connectionString });
    pool = new Pool({ connectionString });
    await db.initialize();
  });

  afterAll(async () => {
    await db?.close();
    await pool?.end();
  });

  beforeEach(async () => {
    await pool.query(
      'TRUNCATE TABLE players, hosts, sessions, characters, campaign_objects, campaigns, users RESTART IDENTITY CASCADE',
    );
  });

  async function user(name: string) {
    return db.createGuestUser(name);
  }

  async function session(
    campaignId: string,
    hostId: string,
    status: 'active' | 'hibernating' | 'abandoned',
    lastActivity: string,
  ) {
    const { sessionId } = await db.createSession(campaignId, hostId);
    await pool.query(
      'UPDATE sessions SET status = $2, "lastActivity" = $3 WHERE id = $1',
      [sessionId, status, lastActivity],
    );
    return sessionId;
  }

  async function join(
    sessionId: string,
    userId: string,
    characterId: string | null,
    isConnected = true,
  ) {
    await pool.query(
      'INSERT INTO players ("userId", "sessionId", "characterId", "isConnected") VALUES ($1, $2, $3, $4)',
      [userId, sessionId, characterId, isConnected],
    );
  }

  async function prepObject(campaignId: string, kind: string, title: string) {
    await pool.query(
      `INSERT INTO campaign_objects (id, "campaignId", kind, title)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), campaignId, kind, title],
    );
  }

  it('returns only runs for a DM-only user, with prep counts and no session', async () => {
    const dm = await user('Dana DM');
    const campaign = await db.createCampaign(dm.id, 'Quiet Table', 'Desc');
    await prepObject(campaign.id, 'npc', 'Innkeeper');
    await prepObject(campaign.id, 'npc', 'Smith');
    await prepObject(campaign.id, 'encounter', 'Ambush');
    await prepObject(campaign.id, 'session', 'The Amber Temple');
    await prepObject(campaign.id, 'location', 'Ignored');

    const summary = await db.dashboard.getSummary(dm.id);

    expect(summary.joined).toEqual([]);
    expect(summary.runs).toHaveLength(1);
    expect(summary.runs[0]).toMatchObject({
      id: campaign.id,
      name: 'Quiet Table',
      description: 'Desc',
      role: 'dm',
      dmName: 'Dana DM',
      status: 'never',
      lastPlayedAt: null,
      roster: [],
      prep: { npcs: 2, encounters: 1, nextSession: 'The Amber Temple' },
    });
    expect(summary.runs[0].myCharacterId).toBeUndefined();
    expect(summary.lastTable).toBeUndefined();
  });

  it('returns joined tables for a player-only user with their hero and the DM name', async () => {
    const dm = await user('Dana DM');
    const player = await user('Pat Player');
    const campaign = await db.createCampaign(dm.id, 'Strahd');
    const hero = await db.characters.createCharacter(player.id, 'Aria', {});
    const sessionId = await session(
      campaign.id,
      dm.id,
      'active',
      '2026-10-01T12:00:00Z',
    );
    await join(sessionId, player.id, hero.id);
    await db.updateCampaign(campaign.id, { lastRoomCode: 'ABCD' });

    const summary = await db.dashboard.getSummary(player.id);

    expect(summary.runs).toEqual([]);
    expect(summary.joined).toHaveLength(1);
    const table = summary.joined[0];
    expect(table).toMatchObject({
      id: campaign.id,
      role: 'player',
      dmName: 'Dana DM',
      roomCode: 'ABCD',
      status: 'open',
      myCharacterId: hero.id,
    });
    expect(table.prep).toBeUndefined();
    // createSession already seeds the host as a player; the DM is not listed.
    expect(table.roster).toEqual([
      { userName: 'Pat Player', characterName: 'Aria', online: true },
    ]);
    expect(summary.heroes).toEqual([
      expect.objectContaining({ id: hero.id, boundCampaignId: campaign.id }),
    ]);
    expect(summary.lastTable).toEqual({
      campaignId: campaign.id,
      role: 'player',
    });
  });

  it('handles a user who runs one table and plays in another, newest activity first', async () => {
    const me = await user('Me');
    const otherDm = await user('Other DM');
    const mine = await db.createCampaign(me.id, 'Mine');
    const theirs = await db.createCampaign(otherDm.id, 'Theirs');
    const spare = await db.characters.createCharacter(me.id, 'Unbound', {});

    await session(
      mine.id,
      me.id,
      'hibernating',
      '2026-09-01T00:00:00Z',
    );
    const theirSession = await session(
      theirs.id,
      otherDm.id,
      'active',
      '2026-10-10T00:00:00Z',
    );
    await join(theirSession, me.id, null);

    const summary = await db.dashboard.getSummary(me.id);

    expect(summary.runs.map((t) => t.id)).toEqual([mine.id]);
    expect(summary.joined.map((t) => t.id)).toEqual([theirs.id]);
    expect(summary.lastTable).toEqual({
      campaignId: theirs.id,
      role: 'player',
    });
    expect(summary.heroes).toEqual([
      expect.objectContaining({ id: spare.id, boundCampaignId: null }),
    ]);
  });

  it('reports a hibernating latest session as resting with nobody online', async () => {
    const dm = await user('Dana DM');
    const player = await user('Pat Player');
    const campaign = await db.createCampaign(dm.id, 'Sleepy');
    const sessionId = await session(
      campaign.id,
      dm.id,
      'hibernating',
      '2026-10-05T08:00:00Z',
    );
    // isConnected is stale-true after hibernation; it must not read as online.
    await join(sessionId, player.id, null, true);

    const summary = await db.dashboard.getSummary(dm.id);

    expect(summary.runs[0]).toMatchObject({
      status: 'resting',
      lastPlayedAt: '2026-10-05T08:00:00.000Z',
      roster: [{ userName: 'Pat Player', online: false }],
    });
  });

  it('uses the latest non-abandoned session and lists a joined campaign once', async () => {
    const dm = await user('Dana DM');
    const player = await user('Pat Player');
    const campaign = await db.createCampaign(dm.id, 'Many Sessions');
    const older = await session(
      campaign.id,
      dm.id,
      'hibernating',
      '2026-08-01T00:00:00Z',
    );
    const newer = await session(
      campaign.id,
      dm.id,
      'active',
      '2026-09-01T00:00:00Z',
    );
    await session(campaign.id, dm.id, 'abandoned', '2026-10-01T00:00:00Z');
    await join(older, player.id, null);
    await join(newer, player.id, null, false);

    const summary = await db.dashboard.getSummary(player.id);

    expect(summary.joined).toHaveLength(1);
    expect(summary.joined[0]).toMatchObject({
      status: 'open',
      // lastPlayedAt spans every session, including the abandoned one.
      lastPlayedAt: '2026-10-01T00:00:00.000Z',
      roster: [{ userName: 'Pat Player', online: false }],
    });
  });
});
