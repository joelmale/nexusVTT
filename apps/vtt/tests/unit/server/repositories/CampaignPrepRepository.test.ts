import type { CampaignObjectRef } from '@nexus/game-contracts';
import type { Pool, PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CampaignPrepRepository,
  CampaignPrepRevisionConflictError,
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
});
