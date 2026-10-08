import type { CampaignObjectRef } from '@nexus/game-contracts';
import type { Pool, PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CampaignPrepRepository,
  CampaignPrepRevisionConflictError,
  SessionPlanActivationError,
} from '../../../../server/repositories/CampaignPrepRepository.js';
import type {
  CampaignPrepObjectRecord,
  CampaignPrepObjectRevisionRecord,
} from '../../../../server/repositories/base.js';

const IDS = {
  campaign: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  object: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  scene: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  user: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  request: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
} as const;

const sceneReference: CampaignObjectRef = {
  target: 'campaign-object',
  campaignId: IDS.campaign,
  id: IDS.scene,
  revision: 4,
};

const objectRecord: CampaignPrepObjectRecord = {
  id: IDS.object,
  campaignId: IDS.campaign,
  kind: 'session-plan',
  title: 'Session 12 - The Glass Harbor',
  currentRevision: 1,
  status: 'draft',
  createdBy: IDS.user,
  updatedBy: IDS.user,
  createdAt: new Date('2026-09-25T12:00:00.000Z'),
  updatedAt: new Date('2026-09-25T12:00:00.000Z'),
};

const revisionRecord: CampaignPrepObjectRevisionRecord = {
  objectId: IDS.object,
  revision: 1,
  schemaVersion: 1,
  data: { title: objectRecord.title },
  dependencyManifest: [sceneReference],
  createdBy: IDS.user,
  requestId: IDS.request,
  createdAt: new Date('2026-09-25T12:00:00.000Z'),
};

describe('CampaignPrepRepository', () => {
  let poolQuery: ReturnType<typeof vi.fn>;
  let clientQuery: ReturnType<typeof vi.fn>;
  let release: ReturnType<typeof vi.fn>;
  let repository: CampaignPrepRepository;

  beforeEach(() => {
    poolQuery = vi.fn();
    clientQuery = vi.fn();
    release = vi.fn();
    const client = { query: clientQuery, release };
    const pool = {
      query: poolQuery,
      connect: vi.fn().mockResolvedValue(client),
    };
    repository = new CampaignPrepRepository(pool as unknown as Pool);
  });

  it('reads campaign-scoped objects, revisions, filtered lists, and backlinks', async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [objectRecord] })
      .mockResolvedValueOnce({ rows: [revisionRecord] })
      .mockResolvedValueOnce({ rows: [objectRecord] })
      .mockResolvedValueOnce({
        rows: [
          {
            sourceObjectId: IDS.object,
            sourceRevision: 1,
            targetKey: 'key',
            target: sceneReference,
            createdAt: new Date(),
          },
        ],
      });

    await expect(
      repository.getObject(IDS.campaign, IDS.object),
    ).resolves.toEqual(objectRecord);
    await expect(repository.getRevision(IDS.object, 1)).resolves.toEqual(
      revisionRecord,
    );
    await expect(
      repository.listObjects(IDS.campaign, {
        kind: 'session-plan',
        status: 'draft',
      }),
    ).resolves.toEqual([objectRecord]);
    await expect(repository.getBacklinks(sceneReference)).resolves.toHaveLength(
      1,
    );

    expect(poolQuery).toHaveBeenCalledWith(
      expect.stringContaining('kind = $2'),
      [IDS.campaign, 'session-plan', 'draft'],
    );
    expect(poolQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('campaign_object_links'),
      [
        '["campaign-object","aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","cccccccc-cccc-4ccc-8ccc-cccccccccccc",4]',
      ],
    );
  });

  it('hides archived objects unless a status is requested and CASes status changes', async () => {
    poolQuery.mockResolvedValue({ rows: [] });
    await repository.listObjects(IDS.campaign, {});
    expect(poolQuery).toHaveBeenLastCalledWith(
      expect.stringContaining(`status <> 'archived'`),
      [IDS.campaign],
    );
    await repository.listObjects(IDS.campaign, { status: 'archived' });
    expect(poolQuery).toHaveBeenLastCalledWith(
      expect.not.stringContaining(`status <> 'archived'`),
      [IDS.campaign, 'archived'],
    );

    await expect(
      repository.setObjectStatus(IDS.campaign, IDS.object, 2, 'archived'),
    ).resolves.toBeNull();
    expect(poolQuery).toHaveBeenLastCalledWith(
      expect.stringContaining('"currentRevision" = $3'),
      [IDS.campaign, IDS.object, 2, 'archived'],
    );
  });

  it('finds non-archived current-revision objects that reference an asset', async () => {
    const reference = {
      campaignId: IDS.campaign,
      campaignName: 'Ashes of Veyra',
      objectId: IDS.object,
      kind: 'campaign-map',
      title: 'Harbor',
    };
    poolQuery.mockResolvedValue({ rows: [reference] });
    await expect(
      repository.findAssetReferences(IDS.user, 'asset-1'),
    ).resolves.toEqual([reference]);
    const [sql, params] = poolQuery.mock.calls.at(-1) as [string, unknown[]];
    expect(params).toEqual([IDS.user, 'asset-1']);
    expect(sql).toContain('c."dmId" = $1');
    expect(sql).toContain(`o.status <> 'archived'`);
    expect(sql).toContain('r.revision = o."currentRevision"');
    expect(sql).toContain(`r.data #>> '{imageAssetRef,assetId}' = $2`);
    expect(sql).toContain(`r.data ->> 'imageUrl'`);
    expect(sql).toContain(`r.data ->> 'imagePath'`);
  });

  it('returns null when an object or revision does not exist', async () => {
    poolQuery.mockResolvedValue({ rows: [] });

    await expect(
      repository.getObject(IDS.campaign, IDS.object),
    ).resolves.toBeNull();
    await expect(repository.getRevision(IDS.object, 99)).resolves.toBeNull();
  });

  it('creates an object, immutable revision, and links atomically', async () => {
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [objectRecord] })
      .mockResolvedValueOnce({ rows: [revisionRecord] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await repository.createObject(
      {
        id: IDS.object,
        campaignId: IDS.campaign,
        kind: 'session-plan',
        title: objectRecord.title,
        createdBy: IDS.user,
      },
      {
        revision: 1,
        schemaVersion: 1,
        data: revisionRecord.data,
        dependencies: [sceneReference, sceneReference],
        createdBy: IDS.user,
        requestId: IDS.request,
      },
    );

    expect(result).toEqual({ object: objectRecord, revision: revisionRecord });
    expect(clientQuery).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(clientQuery).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('INSERT INTO campaign_object_links'),
      expect.arrayContaining([IDS.object, 1, expect.any(String)]),
    );
    expect(clientQuery).toHaveBeenCalledTimes(5);
    expect(clientQuery).toHaveBeenLastCalledWith('COMMIT');
    expect(release).toHaveBeenCalledOnce();
  });

  it('creates a generated-ID object using a caller-owned transaction', async () => {
    const externalQuery = vi
      .fn()
      .mockResolvedValueOnce({ rows: [objectRecord] })
      .mockResolvedValueOnce({ rows: [revisionRecord] });
    const externalClient = { query: externalQuery } as unknown as PoolClient;

    await repository.createObject(
      {
        campaignId: IDS.campaign,
        kind: 'session-plan',
        title: objectRecord.title,
        createdBy: IDS.user,
      },
      {
        revision: 1,
        schemaVersion: 1,
        data: revisionRecord.data,
        dependencies: [],
        createdBy: IDS.user,
        requestId: IDS.request,
      },
      externalClient,
    );

    expect(externalQuery).toHaveBeenCalledTimes(2);
    expect(externalQuery).not.toHaveBeenCalledWith('BEGIN');
  });

  it('adds the next revision with a compare-and-swap', async () => {
    const updatedObject = {
      ...objectRecord,
      currentRevision: 2,
      status: 'ready' as const,
    };
    const updatedRevision = { ...revisionRecord, revision: 2 };
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [updatedObject] })
      .mockResolvedValueOnce({ rows: [updatedRevision] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await repository.addRevision(IDS.campaign, IDS.object, 1, {
      revision: 2,
      schemaVersion: 1,
      data: { title: objectRecord.title, status: 'ready' },
      dependencies: [sceneReference],
      createdBy: IDS.user,
      requestId: IDS.request,
      status: 'ready',
    });

    expect(result.object).toEqual(updatedObject);
    expect(clientQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('AND "currentRevision" = $7'),
      expect.arrayContaining([
        IDS.campaign,
        IDS.object,
        2,
        'ready',
        IDS.user,
        1,
      ]),
    );
    expect(clientQuery).toHaveBeenLastCalledWith('COMMIT');
  });

  it('rolls back and reports a compare-and-swap conflict', async () => {
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      repository.addRevision(IDS.campaign, IDS.object, 1, {
        revision: 2,
        schemaVersion: 1,
        data: {},
        dependencies: [],
        createdBy: IDS.user,
        requestId: IDS.request,
      }),
    ).rejects.toBeInstanceOf(CampaignPrepRevisionConflictError);

    expect(clientQuery).toHaveBeenLastCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledOnce();
  });

  it('rejects skipped revisions before opening a transaction', async () => {
    await expect(
      repository.addRevision(IDS.campaign, IDS.object, 1, {
        revision: 3,
        schemaVersion: 1,
        data: {},
        dependencies: [],
        createdBy: IDS.user,
        requestId: IDS.request,
      }),
    ).rejects.toThrow('must immediately follow');

    expect(clientQuery).not.toHaveBeenCalled();
  });

  it('rolls back when a revision insert fails', async () => {
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [objectRecord] })
      .mockRejectedValueOnce(new Error('revision insert failed'))
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      repository.createObject(
        {
          id: IDS.object,
          campaignId: IDS.campaign,
          kind: 'session-plan',
          title: objectRecord.title,
          createdBy: IDS.user,
        },
        {
          revision: 1,
          schemaVersion: 1,
          data: {},
          dependencies: [],
          createdBy: IDS.user,
          requestId: IDS.request,
        },
      ),
    ).rejects.toThrow('revision insert failed');

    expect(clientQuery).toHaveBeenLastCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledOnce();
  });

  const ACTIVATION_ID = '99999999-9999-4999-8999-999999999999';
  const ACTIVATION_REQUEST = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const stepId = '10000000-0000-4000-8000-000000000001';
  const nextStepId = '10000000-0000-4000-8000-000000000002';

  function activationRecord(overrides: Record<string, unknown> = {}) {
    return {
      id: ACTIVATION_ID,
      campaignId: IDS.campaign,
      sessionPlanId: IDS.object,
      planRevision: 1,
      sessionId: 'session-123',
      currentStepIndex: 0,
      status: 'active' as const,
      stepStates: {},
      activatedBy: IDS.user,
      requestId: ACTIVATION_REQUEST,
      revision: 1,
      completedAt: null,
      createdAt: new Date('2026-09-25T12:00:00.000Z'),
      updatedAt: new Date('2026-09-25T12:00:00.000Z'),
      ...overrides,
    };
  }

  const twoStepRevision = {
    ...revisionRecord,
    data: {
      steps: [
        { id: stepId, track: 'main' },
        { id: nextStepId, track: 'main' },
        { id: '10000000-0000-4000-8000-000000000003', track: 'parallel' },
      ],
    },
  };

  const readyObject = { ...objectRecord, status: 'ready' };

  it('activates a ready session plan and completes prior activations', async () => {
    const record = activationRecord();
    clientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // advisory lock
      .mockResolvedValueOnce({ rows: [] }) // receipt lookup
      .mockResolvedValueOnce({ rows: [readyObject] }) // getObject
      .mockResolvedValueOnce({ rows: [revisionRecord] }) // getRevision
      .mockResolvedValueOnce({ rows: [] }) // UPDATE prior activations
      .mockResolvedValueOnce({ rows: [record] }) // INSERT activation
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const result = await repository.activateSessionPlan({
      campaignId: IDS.campaign,
      sessionPlanId: IDS.object,
      sessionId: 'session-123',
      activatedBy: IDS.user,
      requestId: ACTIVATION_REQUEST,
    });

    expect(result.activation.id).toBe(record.id);
    expect(result.plan).toEqual(revisionRecord.data);
    expect(result.replayed).toBe(false);
    expect(clientQuery.mock.calls[1]?.[0]).toContain('pg_advisory_xact_lock');
    expect(clientQuery.mock.calls[5]?.[0]).toContain(
      "SET status = 'completed'",
    );
    expect(clientQuery.mock.calls[6]?.[1]).toContain(ACTIVATION_REQUEST);
    expect(clientQuery).toHaveBeenCalledWith('COMMIT');
  });

  it('replays a committed activation request without restarting the run', async () => {
    const record = activationRecord({ currentStepIndex: 1, revision: 4 });
    clientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // advisory lock
      .mockResolvedValueOnce({ rows: [record] }) // receipt lookup
      .mockResolvedValueOnce({ rows: [revisionRecord] }) // pinned revision
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const result = await repository.activateSessionPlan({
      campaignId: IDS.campaign,
      sessionPlanId: IDS.object,
      sessionId: 'session-123',
      requestId: ACTIVATION_REQUEST,
    });

    expect(result.replayed).toBe(true);
    expect(result.activation.currentStepIndex).toBe(1);
    const sql = clientQuery.mock.calls.map((call) => String(call[0]));
    expect(sql.some((text) => text.includes('INSERT INTO session_plan'))).toBe(
      false,
    );
  });

  it('rejects reuse of an activation request for a different plan', async () => {
    clientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // advisory lock
      .mockResolvedValueOnce({
        rows: [activationRecord({ sessionPlanId: IDS.scene })],
      })
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(
      repository.activateSessionPlan({
        campaignId: IDS.campaign,
        sessionPlanId: IDS.object,
        sessionId: 'session-123',
        requestId: ACTIVATION_REQUEST,
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('rejects activation of a stale plan revision', async () => {
    clientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // advisory lock
      .mockResolvedValueOnce({ rows: [] }) // receipt lookup
      .mockResolvedValueOnce({
        rows: [{ ...readyObject, currentRevision: 3 }],
      })
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(
      repository.activateSessionPlan({
        campaignId: IDS.campaign,
        sessionPlanId: IDS.object,
        planRevision: 2,
        sessionId: 'session-123',
        requestId: ACTIVATION_REQUEST,
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('maps a concurrent unique-index violation to a conflict', async () => {
    clientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // advisory lock
      .mockResolvedValueOnce({ rows: [] }) // receipt lookup
      .mockResolvedValueOnce({ rows: [readyObject] })
      .mockResolvedValueOnce({ rows: [revisionRecord] })
      .mockResolvedValueOnce({ rows: [] }) // UPDATE prior
      .mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }))
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(
      repository.activateSessionPlan({
        campaignId: IDS.campaign,
        sessionPlanId: IDS.object,
        sessionId: 'session-123',
        requestId: ACTIVATION_REQUEST,
      }),
    ).rejects.toBeInstanceOf(SessionPlanActivationError);
    expect(clientQuery).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('rejects activation of a draft session plan', async () => {
    clientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // advisory lock
      .mockResolvedValueOnce({ rows: [] }) // receipt lookup
      .mockResolvedValueOnce({ rows: [objectRecord] }) // getObject (status: 'draft')
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(
      repository.activateSessionPlan({
        campaignId: IDS.campaign,
        sessionPlanId: IDS.object,
        sessionId: 'session-123',
        requestId: ACTIVATION_REQUEST,
      }),
    ).rejects.toThrow('only ready plans can be activated');
  });

  it('retrieves the active activation for a campaign session', async () => {
    const record = activationRecord();
    poolQuery
      .mockResolvedValueOnce({ rows: [record] })
      .mockResolvedValueOnce({ rows: [revisionRecord] });

    const active = await repository.getActiveSessionPlanActivation(
      IDS.campaign,
      'session-123',
    );
    expect(active?.activation.id).toBe(record.id);
    expect(active?.plan).toEqual(revisionRecord.data);
    expect(poolQuery.mock.calls[0]?.[1]).toEqual([IDS.campaign, 'session-123']);
  });

  it('updates progress under the observed activation revision', async () => {
    const record = activationRecord();
    clientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [record] }) // lock
      .mockResolvedValueOnce({ rows: [twoStepRevision] }) // step bounds
      .mockResolvedValueOnce({
        rows: [{ ...record, currentStepIndex: 1, revision: 2 }],
      })
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const progress = await repository.updateSessionPlanActivationProgress({
      campaignId: IDS.campaign,
      activationId: ACTIVATION_ID,
      expectedRevision: 1,
      currentStepIndex: 1,
    });

    expect(progress.currentStepIndex).toBe(1);
    const update = clientQuery.mock.calls[3];
    expect(update?.[0]).toContain('revision = revision + 1');
    expect(update?.[0]).toContain('AND revision = $6');
    expect(update?.[0]).toContain('"stepStates" || COALESCE');
    expect(update?.[1]).toEqual([
      ACTIVATION_ID,
      IDS.campaign,
      1,
      null,
      null,
      1,
    ]);
  });

  it('rejects progress from a stale revision or out-of-range step', async () => {
    clientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [activationRecord({ revision: 5 })] })
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK
    await expect(
      repository.updateSessionPlanActivationProgress({
        campaignId: IDS.campaign,
        activationId: ACTIVATION_ID,
        expectedRevision: 1,
        status: 'completed',
      }),
    ).rejects.toMatchObject({ code: 'conflict' });

    clientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [activationRecord()] })
      .mockResolvedValueOnce({ rows: [twoStepRevision] })
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK
    await expect(
      repository.updateSessionPlanActivationProgress({
        campaignId: IDS.campaign,
        activationId: ACTIVATION_ID,
        expectedRevision: 1,
        currentStepIndex: 2,
      }),
    ).rejects.toMatchObject({ code: 'invalid-step' });
  });

  it('scopes progress to the campaign and reports a missing activation', async () => {
    clientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // lock finds nothing
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK
    await expect(
      repository.updateSessionPlanActivationProgress({
        campaignId: IDS.campaign,
        activationId: ACTIVATION_ID,
        expectedRevision: 1,
        status: 'abandoned',
      }),
    ).rejects.toMatchObject({ code: 'not-found' });
    expect(clientQuery.mock.calls[1]?.[1]).toEqual([
      ACTIVATION_ID,
      IDS.campaign,
    ]);
  });

  it('refuses to reopen a run while another is active for the session', async () => {
    clientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [activationRecord({ status: 'completed' })],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'other' }] }) // competing
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK
    await expect(
      repository.updateSessionPlanActivationProgress({
        campaignId: IDS.campaign,
        activationId: ACTIVATION_ID,
        expectedRevision: 1,
        status: 'active',
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('completes the active step and advances in one transaction', async () => {
    const record = activationRecord({
      stepStates: { [stepId]: { encounterRunId: 'run-1' } },
    });
    const updatedActivation = {
      ...record,
      currentStepIndex: 1,
      revision: 2,
      stepStates: { [stepId]: { completed: true } },
    };
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [record] })
      .mockResolvedValueOnce({ rows: [twoStepRevision] })
      .mockResolvedValueOnce({ rows: [updatedActivation] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await repository.advanceSessionPlanActivation({
      activationId: ACTIVATION_ID,
      campaignId: IDS.campaign,
      completedBy: IDS.user,
      stepId,
      stepIndex: 0,
      expectedRevision: 1,
    });

    expect(result.currentStepIndex).toBe(1);
    expect(clientQuery).toHaveBeenCalledWith('COMMIT');
    const update = clientQuery.mock.calls[3];
    expect(update?.[1]).toMatchObject({
      0: ACTIVATION_ID,
      1: IDS.campaign,
      2: 1,
      4: 0,
      5: 1,
    });
    // Runtime facts already on the step survive completion.
    expect(JSON.parse(update?.[1][3])[stepId]).toMatchObject({
      encounterRunId: 'run-1',
      completed: true,
    });
  });

  it('rejects advance from a stale activation revision', async () => {
    clientQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [activationRecord({ revision: 3 })] })
      .mockResolvedValueOnce({ rows: [] });
    await expect(
      repository.advanceSessionPlanActivation({
        activationId: ACTIVATION_ID,
        campaignId: IDS.campaign,
        stepId,
        stepIndex: 0,
        expectedRevision: 2,
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });
});
