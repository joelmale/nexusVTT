import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CampaignPrepAuthoringService } from '../../server/campaign-prep/CampaignPrepAuthoringService.js';
import { EncounterMaterializer } from '../../server/campaign-prep/EncounterMaterializer.js';
import {
  createDatabaseService,
  type DatabaseService,
} from '../../server/database.js';
import { runStartupMigrations } from '../../server/startupMigrations.js';
import { assertTestDatabase } from './assertTestDatabase.js';

const shouldSkip = !process.env.DATABASE_URL;
const describeIntegration = shouldSkip ? describe.skip : describe;

const TIMESTAMP = '2026-10-01T12:00:00.000Z';

const GOBLIN = {
  key: 'srd:goblin',
  name: 'Goblin',
  cr: '1/4',
  ac: 15,
  hp: 7,
  speed: 30,
  abilities: [8, 14, 10, 10, 8, 8],
};

describeIntegration('Campaign Studio kinds, mentions and encounters (Postgres)', () => {
  let pool: Pool;
  let db: DatabaseService;
  let authoring: CampaignPrepAuthoringService;
  let materializer: EncounterMaterializer;
  let userId: string;
  let campaignId: string;

  const entry = (
    kind: string,
    title: string,
    fields: Record<string, unknown> = {},
    links: unknown[] = [],
    id: string = randomUUID(),
  ) => ({
    id,
    campaignId,
    schemaVersion: 1,
    revision: 1,
    kind,
    title,
    visibility: 'dm-only',
    content: {
      format: 'lexical',
      schemaVersion: 1,
      value: { nexusStudio: { v: 1, fields } },
    },
    links,
    tags: [],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  });

  const create = (kind: string, data: ReturnType<typeof entry>) =>
    authoring.create({
      campaignId,
      kind: kind as never,
      data,
      principalId: userId,
      requestId: randomUUID(),
    });

  beforeAll(async () => {
    assertTestDatabase();
    const connectionString = process.env.DATABASE_URL!;
    pool = new Pool({ connectionString });
    db = createDatabaseService({ connectionString });
    await db.initialize();
    await runStartupMigrations(pool);
    authoring = new CampaignPrepAuthoringService(db.campaignPrep);
    materializer = new EncounterMaterializer({
      campaignPrep: db.campaignPrep,
      libraryObjects: db.libraryObjects,
    });

    const user = await db.users.createLocalUser(
      `kinds-dm-${Date.now()}@nexusvtt.test`,
      'SafePassword123!',
      'Kinds Test DM',
    );
    userId = user.id;
    campaignId = (
      await db.createCampaign(userId, 'Kinds campaign', 'integration')
    ).id;
  });

  afterAll(async () => {
    if (pool && db) {
      await db.close();
      await pool.end();
    }
  });

  it('accepts every new object kind after the startup migrations run', async () => {
    for (const kind of [
      'session',
      'act',
      'encounter',
      'party-member',
      'homebrew-monster',
    ]) {
      const result = await create(kind, entry(kind, `A ${kind}`));
      expect(result.object.kind).toBe(kind);
    }
    const listed = await db.campaignPrep.listObjects(campaignId, {});
    expect(new Set(listed.map((object) => object.kind))).toEqual(
      new Set(['session', 'act', 'encounter', 'party-member', 'homebrew-monster']),
    );
  });

  it('rejects an unknown kind at the database, not only in the API', async () => {
    await expect(
      pool.query(
        `INSERT INTO campaign_objects (id, "campaignId", kind, title)
         VALUES ($1, $2, 'bogus', 'x')`,
        [randomUUID(), campaignId],
      ),
    ).rejects.toThrow(/campaign_objects_kind_check/);
  });

  it('records mention links and answers "what links here"', async () => {
    const npc = await create('npc', entry('npc', 'Mira'));
    const npcRef = {
      target: 'campaign-object' as const,
      campaignId,
      id: npc.data.id,
      revision: 1,
    };
    const note = await create(
      'note',
      entry('note', 'Prep', { body: 'Ask Mira' }, [npcRef]),
    );

    const backlinks = await db.campaignPrep.getBacklinks(npcRef);
    expect(backlinks.map((link) => link.sourceObjectId)).toEqual([
      note.data.id,
    ]);
  });

  it('materializes an authored encounter into library definitions, idempotently', async () => {
    const encounterId = randomUUID();
    await create(
      'encounter',
      entry(
        'encounter',
        'Dock ambush',
        {
          composition: [
            { name: 'Goblin', count: 3, monsterKey: 'srd:goblin', cr: '1/4' },
            { name: 'Mystery Beast', count: 1 },
          ],
        },
        [],
        encounterId,
      ),
    );
    const run = (monsters: unknown[] = [GOBLIN]) =>
      materializer.materialize({
        campaignId,
        objectId: encounterId,
        principalId: userId,
        monsters,
      });

    const first = await run();
    expect(first).toMatchObject({
      encounterRef: { kind: 'encounter', id: encounterId, revision: 1 },
      monsterCount: 2,
      created: true,
    });

    // Stored in the tables the DeployEncounter command reads.
    const encounter = await db.libraryObjects.getObjectById(encounterId);
    expect(encounter).toMatchObject({
      kind: 'encounter',
      campaignId,
      ownerId: userId,
    });
    const revision = await db.libraryObjects.getRevision(encounterId, 1);
    const groups = (
      revision!.data as { groups: { count: number; monsterRef: { id: string } }[] }
    ).groups;
    expect(groups.map((group) => group.count)).toEqual([3, 1]);
    const goblinRevision = await db.libraryObjects.getRevision(
      groups[0].monsterRef.id,
      1,
    );
    expect(goblinRevision!.data).toMatchObject({
      name: 'Goblin',
      hitPoints: { average: 7 },
      armorClass: [{ value: 15 }],
      speed: { walk: 30 },
    });

    // jsonb does not keep key order; re-running must still add no revision.
    const again = await run();
    expect(again.encounterRef).toEqual(first.encounterRef);
    expect(
      (await db.libraryObjects.getObjectById(encounterId))!.currentRevision,
    ).toBe(1);

    // A changed stat block produces a new pinned revision.
    const changed = await run([{ ...GOBLIN, hp: 12 }]);
    expect(changed.encounterRef.revision).toBe(2);
    const goblin = await db.libraryObjects.getObjectById(groups[0].monsterRef.id);
    expect(goblin!.currentRevision).toBe(2);
  });

  it('refuses to materialize something that is not an encounter', async () => {
    const npc = await create('npc', entry('npc', 'Not an encounter'));
    await expect(
      materializer.materialize({
        campaignId,
        objectId: npc.data.id,
        principalId: userId,
        monsters: [GOBLIN],
      }),
    ).rejects.toMatchObject({ code: 'not-an-encounter' });
  });
});
