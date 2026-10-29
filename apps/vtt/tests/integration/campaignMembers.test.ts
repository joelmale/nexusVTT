import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createDatabaseService,
  type DatabaseService,
} from '../../server/database.js';
import { runStartupMigrations } from '../../server/startupMigrations.js';
import { assertTestDatabase } from './assertTestDatabase.js';

const shouldSkip = !process.env.DATABASE_URL;
const describeIntegration = shouldSkip ? describe.skip : describe;

describeIntegration('campaign co-DM membership', () => {
  let pool: Pool;
  let db: DatabaseService;

  beforeAll(async () => {
    assertTestDatabase();
    const connectionString = process.env.DATABASE_URL!;
    pool = new Pool({ connectionString });
    db = createDatabaseService({ connectionString });
    await db.initialize();
    await runStartupMigrations(pool);
  });

  afterAll(async () => {
    if (pool && db) {
      await db.close();
      await pool.end();
    }
  });

  async function user(name: string, provider = 'test') {
    const email = `${name.toLowerCase()}-${randomUUID()}@nexusvtt.test`;
    const result = await pool.query<{ id: string }>(
      'INSERT INTO users (name, email, provider) VALUES ($1, $2, $3) RETURNING id',
      [name, email, provider],
    );
    return { id: result.rows[0]!.id, email };
  }

  it('grants, lists and revokes co-DM access', async () => {
    const owner = await user('Owner');
    const coDm = await user('CoDm');
    const stranger = await user('Stranger');
    const campaign = await db.createCampaign(owner.id, 'Shared prep');

    expect(
      (await db.campaigns.getCampaignAccess(campaign.id, owner.id))?.role,
    ).toBe('owner');
    expect(
      (await db.campaigns.getCampaignAccess(campaign.id, coDm.id))?.role,
    ).toBeNull();
    expect(
      await db.campaigns.getCampaignAccess(randomUUID(), owner.id),
    ).toBeNull();

    const found = await db.campaigns.findInvitableUserByEmail(
      coDm.email.toUpperCase(),
    );
    expect(found?.id).toBe(coDm.id);
    expect(
      await db.campaigns.addCampaignMember(
        campaign.id,
        coDm.id,
        'co-dm',
        owner.id,
      ),
    ).toBe(true);
    expect(
      await db.campaigns.addCampaignMember(
        campaign.id,
        coDm.id,
        'co-dm',
        owner.id,
      ),
    ).toBe(false);

    const access = await db.campaigns.getCampaignAccess(campaign.id, coDm.id);
    expect(access?.role).toBe('co-dm');
    expect(access?.campaign).toMatchObject({ id: campaign.id, dmId: owner.id });
    expect(access?.campaign).not.toHaveProperty('accessRole');
    expect(
      (await db.campaigns.getCampaignAccess(campaign.id, stranger.id))?.role,
    ).toBeNull();
    expect(await db.isUserAuthorizedForCampaign(coDm.id, campaign.id)).toBe(
      true,
    );

    const members = await db.campaigns.listCampaignMembers(campaign.id);
    expect(members.map((member) => [member.userId, member.role])).toEqual([
      [owner.id, 'owner'],
      [coDm.id, 'co-dm'],
    ]);

    const shared = await db.campaigns.getCampaignsForEditor(coDm.id);
    expect(shared.map((entry) => [entry.id, entry.role])).toEqual([
      [campaign.id, 'co-dm'],
    ]);
    expect(await db.getCampaignsByUser(coDm.id)).toEqual([]);

    expect(await db.campaigns.removeCampaignMember(campaign.id, coDm.id)).toBe(
      true,
    );
    expect(await db.campaigns.removeCampaignMember(campaign.id, coDm.id)).toBe(
      false,
    );
    expect(
      (await db.campaigns.getCampaignAccess(campaign.id, coDm.id))?.role,
    ).toBeNull();
  });

  it('never offers guest accounts as co-DMs', async () => {
    const guest = await user('Guest', 'guest');
    expect(await db.campaigns.findInvitableUserByEmail(guest.email)).toBeNull();
  });

  it('drops memberships when the campaign is deleted', async () => {
    const owner = await user('Owner');
    const coDm = await user('CoDm');
    const campaign = await db.createCampaign(owner.id, 'Short-lived');
    await db.campaigns.addCampaignMember(campaign.id, coDm.id, 'co-dm', owner.id);

    await db.deleteCampaign(campaign.id);

    const rows = await pool.query(
      'SELECT 1 FROM campaign_members WHERE "campaignId" = $1',
      [campaign.id],
    );
    expect(rows.rowCount).toBe(0);
  });
});
