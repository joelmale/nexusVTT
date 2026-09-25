import {
  campaignObjectRefKey,
  type CampaignObjectRef,
} from '@nexus/game-contracts';
import type { PoolClient } from 'pg';

import {
  BaseRepository,
  type CampaignPrepObjectKind,
  type CampaignPrepObjectLinkRecord,
  type CampaignPrepObjectRecord,
  type CampaignPrepObjectRevisionRecord,
  type CampaignPrepObjectStatus,
} from './base.js';

export class CampaignPrepRevisionConflictError extends Error {
  constructor(
    public readonly objectId: string,
    public readonly expectedRevision: number,
  ) {
    super(
      `Campaign prep object ${objectId} is no longer at revision ${expectedRevision}`,
    );
    this.name = 'CampaignPrepRevisionConflictError';
  }
}

interface CampaignPrepRevisionInput {
  revision: number;
  schemaVersion: number;
  data: unknown;
  dependencies: CampaignObjectRef[];
  createdBy: string;
  requestId: string;
}

interface CreateCampaignPrepObjectInput {
  id?: string;
  campaignId: string;
  kind: CampaignPrepObjectKind;
  title: string;
  status?: CampaignPrepObjectStatus;
  createdBy: string;
}

interface AddCampaignPrepRevisionInput extends CampaignPrepRevisionInput {
  title?: string;
  status?: CampaignPrepObjectStatus;
}

interface CampaignPrepObjectFilter {
  kind?: CampaignPrepObjectKind;
  status?: CampaignPrepObjectStatus;
}

export class CampaignPrepRepository extends BaseRepository {
  async getObject(
    campaignId: string,
    objectId: string,
    client?: PoolClient,
  ): Promise<CampaignPrepObjectRecord | null> {
    const result = await this.getExecutor(
      client,
    ).query<CampaignPrepObjectRecord>(
      `SELECT * FROM campaign_objects
       WHERE "campaignId" = $1 AND id = $2`,
      [campaignId, objectId],
    );
    return result.rows[0] ?? null;
  }

  async getRevision(
    objectId: string,
    revision: number,
    client?: PoolClient,
  ): Promise<CampaignPrepObjectRevisionRecord | null> {
    const result = await this.getExecutor(
      client,
    ).query<CampaignPrepObjectRevisionRecord>(
      `SELECT * FROM campaign_object_revisions
         WHERE "objectId" = $1 AND revision = $2`,
      [objectId, revision],
    );
    return result.rows[0] ?? null;
  }

  async listObjects(
    campaignId: string,
    filter: CampaignPrepObjectFilter = {},
    client?: PoolClient,
  ): Promise<CampaignPrepObjectRecord[]> {
    const conditions = ['"campaignId" = $1'];
    const params: unknown[] = [campaignId];

    if (filter.kind) {
      params.push(filter.kind);
      conditions.push(`kind = $${params.length}`);
    }
    if (filter.status) {
      params.push(filter.status);
      conditions.push(`status = $${params.length}`);
    }

    const result = await this.getExecutor(
      client,
    ).query<CampaignPrepObjectRecord>(
      `SELECT * FROM campaign_objects
       WHERE ${conditions.join(' AND ')}
       ORDER BY "updatedAt" DESC`,
      params,
    );
    return result.rows;
  }

  async getBacklinks(
    reference: CampaignObjectRef,
    client?: PoolClient,
  ): Promise<CampaignPrepObjectLinkRecord[]> {
    const result = await this.getExecutor(
      client,
    ).query<CampaignPrepObjectLinkRecord>(
      `SELECT links.* FROM campaign_object_links links
         INNER JOIN campaign_objects objects
           ON objects.id = links."sourceObjectId"
          AND objects."currentRevision" = links."sourceRevision"
         WHERE links."targetKey" = $1
         ORDER BY links."createdAt" DESC`,
      [campaignObjectRefKey(reference)],
    );
    return result.rows;
  }

  async createObject(
    object: CreateCampaignPrepObjectInput,
    revision: CampaignPrepRevisionInput,
    client?: PoolClient,
  ): Promise<{
    object: CampaignPrepObjectRecord;
    revision: CampaignPrepObjectRevisionRecord;
  }> {
    return this.withTransaction(client, async (executor) => {
      const objectResult = await executor.query<CampaignPrepObjectRecord>(
        object.id
          ? `INSERT INTO campaign_objects
               (id, "campaignId", kind, title, "currentRevision", status, "createdBy", "updatedBy")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
             RETURNING *`
          : `INSERT INTO campaign_objects
               ("campaignId", kind, title, "currentRevision", status, "createdBy", "updatedBy")
             VALUES ($1, $2, $3, $4, $5, $6, $6)
             RETURNING *`,
        object.id
          ? [
              object.id,
              object.campaignId,
              object.kind,
              object.title,
              revision.revision,
              object.status ?? 'draft',
              object.createdBy,
            ]
          : [
              object.campaignId,
              object.kind,
              object.title,
              revision.revision,
              object.status ?? 'draft',
              object.createdBy,
            ],
      );
      const createdObject = objectResult.rows[0];
      const createdRevision = await this.insertRevision(
        createdObject.id,
        revision,
        executor,
      );
      await this.insertLinks(
        createdObject.id,
        revision.revision,
        revision.dependencies,
        executor,
      );

      return { object: createdObject, revision: createdRevision };
    });
  }

  async addRevision(
    campaignId: string,
    objectId: string,
    expectedRevision: number,
    revision: AddCampaignPrepRevisionInput,
    client?: PoolClient,
  ): Promise<{
    object: CampaignPrepObjectRecord;
    revision: CampaignPrepObjectRevisionRecord;
  }> {
    if (revision.revision !== expectedRevision + 1) {
      throw new Error(
        'The new revision must immediately follow the expected revision',
      );
    }

    return this.withTransaction(client, async (executor) => {
      const objectResult = await executor.query<CampaignPrepObjectRecord>(
        `UPDATE campaign_objects
         SET "currentRevision" = $3,
             title = COALESCE($4, title),
             status = COALESCE($5, status),
             "updatedBy" = $6,
             "updatedAt" = NOW()
         WHERE "campaignId" = $1
           AND id = $2
           AND "currentRevision" = $7
         RETURNING *`,
        [
          campaignId,
          objectId,
          revision.revision,
          revision.title ?? null,
          revision.status ?? null,
          revision.createdBy,
          expectedRevision,
        ],
      );
      const updatedObject = objectResult.rows[0];
      if (!updatedObject) {
        throw new CampaignPrepRevisionConflictError(objectId, expectedRevision);
      }

      const createdRevision = await this.insertRevision(
        objectId,
        revision,
        executor,
      );
      await this.insertLinks(
        objectId,
        revision.revision,
        revision.dependencies,
        executor,
      );

      return { object: updatedObject, revision: createdRevision };
    });
  }

  private async insertRevision(
    objectId: string,
    revision: CampaignPrepRevisionInput,
    client: PoolClient,
  ): Promise<CampaignPrepObjectRevisionRecord> {
    const result = await client.query<CampaignPrepObjectRevisionRecord>(
      `INSERT INTO campaign_object_revisions
         ("objectId", revision, "schemaVersion", data, "dependencyManifest", "createdBy", "requestId")
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)
       RETURNING *`,
      [
        objectId,
        revision.revision,
        revision.schemaVersion,
        JSON.stringify(revision.data),
        JSON.stringify(revision.dependencies),
        revision.createdBy,
        revision.requestId,
      ],
    );
    return result.rows[0];
  }

  private async insertLinks(
    objectId: string,
    revision: number,
    dependencies: CampaignObjectRef[],
    client: PoolClient,
  ): Promise<void> {
    const insertedKeys = new Set<string>();

    for (const dependency of dependencies) {
      const targetKey = campaignObjectRefKey(dependency);
      if (insertedKeys.has(targetKey)) {
        continue;
      }
      insertedKeys.add(targetKey);

      await client.query(
        `INSERT INTO campaign_object_links
           ("sourceObjectId", "sourceRevision", "targetKey", target)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [objectId, revision, targetKey, JSON.stringify(dependency)],
      );
    }
  }

  private async withTransaction<T>(
    client: PoolClient | undefined,
    operation: (executor: PoolClient) => Promise<T>,
  ): Promise<T> {
    if (client) {
      return operation(client);
    }

    const transactionClient = await this.pool.connect();
    try {
      await transactionClient.query('BEGIN');
      const result = await operation(transactionClient);
      await transactionClient.query('COMMIT');
      return result;
    } catch (error) {
      await transactionClient.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      transactionClient.release();
    }
  }
}
