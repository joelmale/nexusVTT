import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CampaignPrepAuthoringService } from '../../server/campaign-prep/CampaignPrepAuthoringService.js';
import { CampaignPrepDependencyResolver } from '../../server/campaign-prep/CampaignPrepDependencyResolver.js';
import { SessionPlanPublishingService } from '../../server/campaign-prep/SessionPlanPublishingService.js';
import { SessionPlanPublishValidator } from '../../server/campaign-prep/SessionPlanPublishValidator.js';
import { createDatabaseService, type DatabaseService } from '../../server/database.js';
import { runStartupMigrations } from '../../server/startupMigrations.js';
import type { UserAssetResolution } from '../../server/services/userAssetCatalogClient.js';
import { assertTestDatabase } from './assertTestDatabase.js';

const shouldSkip = !process.env.DATABASE_URL;
const describeIntegration = shouldSkip ? describe.skip : describe;

describeIntegration('Campaign Studio Publish Integration Smoke Test', () => {
  let pool: Pool;
  let dbService: DatabaseService;
  let authoringService: CampaignPrepAuthoringService;
  let publishingService: SessionPlanPublishingService;

  // Track mock user assets conforming to the asset-service contract
  const userAssetStore = new Map<
    string,
    { id: string; category: string; fullImage: string; name: string }
  >();

  const mockUserAssetCatalog = {
    async resolveAsset(
      userId: string,
      assetId: string,
    ): Promise<UserAssetResolution> {
      const asset = userAssetStore.get(`${userId}:${assetId}`);
      if (!asset) return 'missing';
      return 'available';
    },
  };

  beforeAll(async () => {
    assertTestDatabase();

    const connectionString = process.env.DATABASE_URL!;
    pool = new Pool({ connectionString });
    dbService = createDatabaseService({ connectionString });

    // Step 1: Start with expected database schema and run startup migrations
    await dbService.initialize();
    await runStartupMigrations(pool);

    const dependencyResolver = new CampaignPrepDependencyResolver({
      campaignPrep: dbService.campaignPrep,
      documentClient: null,
      getAssetManifest: () => ({
        assets: [],
        categories: [],
        generatedAt: new Date().toISOString(),
        totalAssets: 0,
        version: '1.0.0',
      }),
      libraryObjects: dbService.libraryObjects,
      rulesCatalog: null,
      userAssetCatalog: mockUserAssetCatalog,
    });

    authoringService = new CampaignPrepAuthoringService(dbService.campaignPrep);
    publishingService = new SessionPlanPublishingService(
      dbService.campaignPrep,
      new SessionPlanPublishValidator(dependencyResolver),
    );
  });

  afterAll(async () => {
    if (pool && dbService) {
      await dbService.close();
      await pool.end();
    }
  });

  it('1 & 2: confirms startup migrations apply and Campaign Studio tables exist', async () => {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    const tableNames = new Set(result.rows.map((row) => row.table_name));

    expect(tableNames.has('campaign_objects')).toBe(true);
    expect(tableNames.has('campaign_object_revisions')).toBe(true);
    expect(tableNames.has('campaign_object_links')).toBe(true);
    expect(tableNames.has('session_plan_activations')).toBe(true);
  });

  it('3 through 9: exercises complete end-to-end Publish Plan path with dependencies', async () => {
    // Step 3: Create test user without production shortcuts
    const userEmail = `smoke-dm-${Date.now()}@nexusvtt.test`;
    const user = await dbService.users.createLocalUser(
      userEmail,
      'SafePassword123!',
      'Smoke Test DM',
    );
    expect(user.id).toBeDefined();
    expect(user.passwordHash).toBeDefined();
    expect(user.passwordSalt).toBeDefined();

    // Step 4: Create campaign
    const campaign = await dbService.createCampaign(
      user.id,
      'The Obsidian Shore',
      'Integration smoke test campaign',
    );
    expect(campaign.id).toBeDefined();

    // Step 5: Create referenced note and scene template objects
    const noteId = randomUUID();
    const noteResult = await authoringService.create({
      campaignId: campaign.id,
      data: {
        campaignId: campaign.id,
        content: {
          format: 'lexical',
          schemaVersion: 1,
          value: {
            root: {
              children: [
                {
                  children: [{ text: 'Smuggler schedule details', type: 'text' }],
                  type: 'paragraph',
                },
              ],
              type: 'root',
            },
          },
        },
        createdAt: new Date().toISOString(),
        id: noteId,
        kind: 'note',
        links: [],
        revision: 1,
        schemaVersion: 1,
        tags: ['docks'],
        title: 'Dock Ledger Note',
        updatedAt: new Date().toISOString(),
        visibility: 'dm-only',
      },
      kind: 'note',
      principalId: user.id,
      requestId: randomUUID(),
    });
    expect(noteResult.object.id).toBe(noteId);
    expect(noteResult.object.currentRevision).toBe(1);

    const sceneId = randomUUID();
    const sceneResult = await authoringService.create({
      campaignId: campaign.id,
      data: {
        backgroundAssetRef: {
          assetId: 'asset-dock-map',
          target: 'asset',
        },
        campaignId: campaign.id,
        createdAt: new Date().toISOString(),
        fogPreset: { mode: 'concealed', revealedShapes: [] },
        grid: {
          enabled: true,
          offsetX: 0,
          offsetY: 0,
          size: 70,
          snapToGrid: true,
          type: 'square',
        },
        id: sceneId,
        lighting: {
          ambientLight: 0.5,
          darkness: 0.5,
          enabled: true,
          globalIllumination: false,
        },
        name: 'Midnight Pier Scene',
        revision: 1,
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
      },
      kind: 'scene-template',
      principalId: user.id,
      requestId: randomUUID(),
    });
    expect(sceneResult.object.id).toBe(sceneId);
    expect(sceneResult.object.currentRevision).toBe(1);

    // Step 6: Upload a plain-text handout conforming to asset-service contract
    const handoutAssetId = `handout-${randomUUID()}`;
    userAssetStore.set(`${user.id}:${handoutAssetId}`, {
      category: 'documents',
      fullImage: `/assets/user/${user.id}/${handoutAssetId}/manifest.txt`,
      id: handoutAssetId,
      name: 'Cargo Manifest Handout',
    });

    // Step 7: Build session plan containing campaign-object and asset dependencies
    const planId = randomUUID();
    const draftPlanData = {
      campaignId: campaign.id,
      createdAt: new Date().toISOString(),
      dependencies: [
        {
          campaignId: campaign.id,
          id: noteId,
          revision: 1,
          target: 'campaign-object' as const,
        },
        {
          campaignId: campaign.id,
          id: sceneId,
          revision: 1,
          target: 'campaign-object' as const,
        },
        {
          assetId: handoutAssetId,
          target: 'asset' as const,
        },
      ],
      id: planId,
      revision: 1,
      schemaVersion: 1,
      status: 'draft' as const,
      steps: [
        {
          entryRef: {
            campaignId: campaign.id,
            id: noteId,
            revision: 1,
            target: 'campaign-object' as const,
          },
          estimatedMinutes: 10,
          id: randomUUID(),
          title: 'Review Dock Ledger',
          track: 'main' as const,
          type: 'open-entry' as const,
          visibility: 'dm-only' as const,
        },
        {
          estimatedMinutes: 20,
          id: randomUUID(),
          sceneTemplateRef: {
            campaignId: campaign.id,
            id: sceneId,
            revision: 1,
            target: 'campaign-object' as const,
          },
          title: 'Activate Midnight Pier',
          track: 'main' as const,
          type: 'activate-scene' as const,
          visibility: 'players' as const,
        },
        {
          assetRef: {
            assetId: handoutAssetId,
            target: 'asset' as const,
          },
          estimatedMinutes: 5,
          id: randomUUID(),
          title: 'Share Cargo Manifest',
          track: 'main' as const,
          type: 'share-handout' as const,
          visibility: 'players' as const,
        },
      ],
      title: 'Session 1 - Arrival at Obsidian Shore',
      updatedAt: new Date().toISOString(),
    };

    const planCreateResult = await authoringService.create({
      campaignId: campaign.id,
      data: draftPlanData,
      kind: 'session-plan',
      principalId: user.id,
      requestId: randomUUID(),
    });
    expect(planCreateResult.object.status).toBe('draft');
    expect(planCreateResult.object.currentRevision).toBe(1);

    // Step 8: Publish the session plan
    const publishResult = await publishingService.publish({
      campaignId: campaign.id,
      expectedRevision: 1,
      planId,
      principalId: user.id,
      requestId: randomUUID(),
    });

    expect(publishResult.published).toBe(true);
    if (!publishResult.published) throw new Error('Publish expected to succeed');

    expect(publishResult.plan.status).toBe('ready');
    expect(publishResult.plan.revision).toBe(2);

    // Step 9: Read persisted object back and verify ready status, revision, and dependency manifest
    const persistedObject = await dbService.campaignPrep.getObject(
      campaign.id,
      planId,
    );
    expect(persistedObject).toBeDefined();
    expect(persistedObject?.status).toBe('ready');
    expect(persistedObject?.currentRevision).toBe(2);

    const persistedRevision = await dbService.campaignPrep.getRevision(
      planId,
      2,
    );
    expect(persistedRevision).toBeDefined();
    expect(persistedRevision?.revision).toBe(2);
    expect(persistedRevision?.dependencyManifest).toHaveLength(3);

    const links = await dbService.campaignPrep.getBacklinks({
      campaignId: campaign.id,
      id: noteId,
      revision: 1,
      target: 'campaign-object',
    });
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0].sourceObjectId).toBe(planId);
  });

  it('10 & 11: validates that a missing dependency produces the expected validation issue deterministically', async () => {
    const user = await dbService.users.createLocalUser(
      `smoke-missing-${Date.now()}@nexusvtt.test`,
      'SafePassword123!',
      'Smoke Test Missing DM',
    );
    const campaign = await dbService.createCampaign(
      user.id,
      'Missing Dependency Campaign',
      'Test validation failure',
    );

    const nonExistentNoteId = randomUUID();
    const planId = randomUUID();

    const planWithMissingDep = {
      campaignId: campaign.id,
      createdAt: new Date().toISOString(),
      dependencies: [
        {
          campaignId: campaign.id,
          id: nonExistentNoteId,
          revision: 1,
          target: 'campaign-object' as const,
        },
      ],
      id: planId,
      revision: 1,
      schemaVersion: 1,
      status: 'draft' as const,
      steps: [
        {
          entryRef: {
            campaignId: campaign.id,
            id: nonExistentNoteId,
            revision: 1,
            target: 'campaign-object' as const,
          },
          estimatedMinutes: 5,
          id: randomUUID(),
          title: 'Missing Note Step',
          track: 'main' as const,
          type: 'open-entry' as const,
          visibility: 'dm-only' as const,
        },
      ],
      title: 'Session with Missing Dep',
      updatedAt: new Date().toISOString(),
    };

    await authoringService.create({
      campaignId: campaign.id,
      data: planWithMissingDep,
      kind: 'session-plan',
      principalId: user.id,
      requestId: randomUUID(),
    });

    // Attempt to publish
    const publishResult = await publishingService.publish({
      campaignId: campaign.id,
      expectedRevision: 1,
      planId,
      principalId: user.id,
      requestId: randomUUID(),
    });

    expect(publishResult.published).toBe(false);
    if (publishResult.published) throw new Error('Expected publish to fail');

    const missingIssue = publishResult.validation.issues.find(
      (issue) => issue.code === 'missing-dependency',
    );
    expect(missingIssue).toBeDefined();
    expect(missingIssue?.code).toBe('missing-dependency');

    // Confirm plan remains in draft
    const persistedObject = await dbService.campaignPrep.getObject(
      campaign.id,
      planId,
    );
    expect(persistedObject?.status).toBe('draft');
    expect(persistedObject?.currentRevision).toBe(1);
  });
});
