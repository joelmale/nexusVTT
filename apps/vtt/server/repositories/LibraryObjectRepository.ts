import type { PoolClient } from 'pg';
import {
  BaseRepository,
  type LibraryObjectRecord,
  type LibraryObjectRevisionRecord,
} from './base.js';

export class LibraryObjectRepository extends BaseRepository {
  async getObjectById(
    id: string,
    client?: PoolClient,
  ): Promise<LibraryObjectRecord | null> {
    const executor = this.getExecutor(client);
    const result = await executor.query<LibraryObjectRecord>(
      'SELECT * FROM library_objects WHERE id = $1',
      [id],
    );
    return result.rows[0] ?? null;
  }

  async getRevision(
    objectId: string,
    revision: number,
    client?: PoolClient,
  ): Promise<LibraryObjectRevisionRecord | null> {
    const executor = this.getExecutor(client);
    const result = await executor.query<LibraryObjectRevisionRecord>(
      'SELECT * FROM library_object_revisions WHERE "objectId" = $1 AND revision = $2',
      [objectId, revision],
    );
    return result.rows[0] ?? null;
  }

  async createObject(
    object: {
      ownerId: string;
      campaignId?: string | null;
      kind: 'monster' | 'spell' | 'item' | 'encounter';
      name: string;
      tags?: string[];
      currentRevision?: number;
    },
    initialRevision: {
      ruleset: unknown;
      data: unknown;
    },
    customId?: string,
    client?: PoolClient,
  ): Promise<{ object: LibraryObjectRecord; revision: LibraryObjectRevisionRecord }> {
    const executor = this.getExecutor(client);
    const idClause = customId ? '$1, ' : '';
    const valuesClause = customId
      ? '$1, $2, $3, $4, $5, $6, $7'
      : '$1, $2, $3, $4, $5, $6';

    const baseParams: unknown[] = [
      object.ownerId,
      object.campaignId ?? null,
      object.kind,
      object.name,
      object.tags ?? [],
      object.currentRevision ?? 1,
    ];
    const params = customId ? [customId, ...baseParams] : baseParams;

    const objResult = await executor.query<LibraryObjectRecord>(
      `INSERT INTO library_objects (${idClause}"ownerId", "campaignId", kind, name, tags, "currentRevision")
       VALUES (${valuesClause})
       RETURNING *`,
      params,
    );
    const createdObj = objResult.rows[0];

    const revResult = await executor.query<LibraryObjectRevisionRecord>(
      `INSERT INTO library_object_revisions ("objectId", revision, ruleset, data)
       VALUES ($1, $2, $3::jsonb, $4::jsonb)
       RETURNING *`,
      [
        createdObj.id,
        createdObj.currentRevision,
        JSON.stringify(initialRevision.ruleset),
        JSON.stringify(initialRevision.data),
      ],
    );

    console.log(
      `🗄️ LibraryObject created: ${createdObj.id} (${createdObj.name}, kind: ${createdObj.kind})`,
    );
    return { object: createdObj, revision: revResult.rows[0] };
  }

  async addRevision(
    objectId: string,
    ruleset: unknown,
    data: unknown,
    client?: PoolClient,
  ): Promise<LibraryObjectRevisionRecord> {
    const executor = this.getExecutor(client);

    const updateObj = await executor.query<LibraryObjectRecord>(
      `UPDATE library_objects
       SET "currentRevision" = "currentRevision" + 1, "updatedAt" = NOW()
       WHERE id = $1
       RETURNING "currentRevision"`,
      [objectId],
    );

    if (!updateObj.rows[0]) {
      throw new Error(`Cannot add revision to missing library object ${objectId}`);
    }

    const nextRev = updateObj.rows[0].currentRevision;

    const revResult = await executor.query<LibraryObjectRevisionRecord>(
      `INSERT INTO library_object_revisions ("objectId", revision, ruleset, data)
       VALUES ($1, $2, $3::jsonb, $4::jsonb)
       RETURNING *`,
      [objectId, nextRev, JSON.stringify(ruleset), JSON.stringify(data)],
    );

    return revResult.rows[0];
  }

  async listObjects(
    filter: {
      ownerId?: string;
      campaignId?: string;
      kind?: 'monster' | 'spell' | 'item' | 'encounter';
    },
    client?: PoolClient,
  ): Promise<LibraryObjectRecord[]> {
    const executor = this.getExecutor(client);
    const conditions: string[] = ['"isArchived" = false'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filter.ownerId) {
      conditions.push(`"ownerId" = $${paramIndex++}`);
      params.push(filter.ownerId);
    }
    if (filter.campaignId) {
      conditions.push(`"campaignId" = $${paramIndex++}`);
      params.push(filter.campaignId);
    }
    if (filter.kind) {
      conditions.push(`kind = $${paramIndex}`);
      params.push(filter.kind);
    }

    const result = await executor.query<LibraryObjectRecord>(
      `SELECT * FROM library_objects WHERE ${conditions.join(' AND ')} ORDER BY "updatedAt" DESC`,
      params,
    );
    return result.rows;
  }
}
