import type { PoolClient } from 'pg';
import { BaseRepository, type CharacterRecord } from './base.js';
import { sanitizeLog } from '../sanitizeLog.js';

export class CharacterRepository extends BaseRepository {
  async recordLegacyId(
    namespace: string,
    legacyId: string,
    canonicalId: string,
    ownerId: string | null = null,
    client?: PoolClient,
  ): Promise<void> {
    const executor = this.getExecutor(client);
    await executor.query(
      `INSERT INTO legacy_object_ids (namespace, "legacyId", "canonicalId", "ownerId")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (namespace, "legacyId") DO UPDATE
       SET "canonicalId" = EXCLUDED."canonicalId", "ownerId" = COALESCE(EXCLUDED."ownerId", legacy_object_ids."ownerId")`,
      [namespace, legacyId, canonicalId, ownerId],
    );
  }

  async resolveCanonicalId(
    namespace: string,
    legacyId: string,
    client?: PoolClient,
  ): Promise<string | null> {
    const executor = this.getExecutor(client);
    const result = await executor.query<{ canonicalId: string }>(
      'SELECT "canonicalId" FROM legacy_object_ids WHERE namespace = $1 AND "legacyId" = $2',
      [namespace, legacyId],
    );
    return result.rows[0]?.canonicalId ?? null;
  }

  async createCharacter(
    ownerId: string,
    name: string,
    data: unknown = {},
    client?: PoolClient,
  ): Promise<CharacterRecord> {
    const executor = this.getExecutor(client);
    const embeddedId =
      typeof data === 'object' &&
      data !== null &&
      'id' in data &&
      typeof (data as { id: unknown }).id === 'string'
        ? (data as { id: string }).id
        : null;

    const result = await executor.query<CharacterRecord>(
      `INSERT INTO characters (name, "ownerId", data)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, ownerId, JSON.stringify(data)],
    );

    const created = result.rows[0];

    // Reconcile embedded legacy ID if provided and distinct
    if (embeddedId && embeddedId !== created.id) {
      await this.recordLegacyId('character', embeddedId, created.id, ownerId, client);
      const reconciledData = {
        ...(typeof data === 'object' && data ? data : {}),
        id: created.id,
        legacyId: embeddedId,
      };
      await executor.query(
        `UPDATE characters SET data = $1, "updatedAt" = NOW() WHERE id = $2`,
        [JSON.stringify(reconciledData), created.id],
      );
      created.data = reconciledData;
    }

    console.log(
      `🗄️ Character created: ${created.id} for user ${ownerId}`,
    );
    return created;
  }

  async getCharactersByUser(
    userId: string,
    client?: PoolClient,
  ): Promise<CharacterRecord[]> {
    const executor = this.getExecutor(client);
    const result = await executor.query<CharacterRecord>(
      'SELECT * FROM characters WHERE "ownerId" = $1 ORDER BY "createdAt" DESC',
      [userId],
    );

    return result.rows;
  }

  async getCharacterById(
    characterId: string,
    client?: PoolClient,
  ): Promise<CharacterRecord | null> {
    const executor = this.getExecutor(client);

    try {
      const result = await executor.query<CharacterRecord>(
        'SELECT * FROM characters WHERE id = $1',
        [characterId],
      );
      if (result?.rows?.[0]) {
        return result.rows[0];
      }
    } catch {
      // In PostgreSQL, querying a UUID column with a non-UUID string throws invalid input syntax.
      // We catch this and gracefully proceed to legacy lookup.
    }

    // Attempt legacy lookup
    try {
      const canonicalId = await this.resolveCanonicalId(
        'character',
        characterId,
        client,
      );
      if (canonicalId) {
        const result = await executor.query<CharacterRecord>(
          'SELECT * FROM characters WHERE id = $1',
          [canonicalId],
        );
        return result?.rows?.[0] || null;
      }
    } catch {
      // Ignore errors in legacy lookup
    }

    return null;
  }

  async updateCharacter(
    characterId: string,
    updates: Partial<CharacterRecord>,
    client?: PoolClient,
  ): Promise<void> {
    const executor = this.getExecutor(client);

    const allowedFields = ['name', 'data'];
    const updateFields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (allowedFields.includes(key)) {
        updateFields.push(`"${key}" = $${paramIndex}`);
        values.push(key === 'data' ? JSON.stringify(value) : value);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return;
    }

    values.push(characterId);

    await executor.query(
      `UPDATE characters SET ${updateFields.join(', ')}, "updatedAt" = NOW() WHERE id = $${paramIndex}`,
      values,
    );

    console.log(`🗄️ Character updated: ${sanitizeLog(characterId)}`);
  }

  async deleteCharacter(
    characterId: string,
    client?: PoolClient,
  ): Promise<void> {
    const executor = this.getExecutor(client);
    await executor.query('DELETE FROM characters WHERE id = $1', [
      characterId,
    ]);

    console.log(`🗄️ Character deleted: ${sanitizeLog(characterId)}`);
  }

  async deleteCharactersByUser(
    userId: string,
    client?: PoolClient,
  ): Promise<number> {
    const executor = this.getExecutor(client);
    const result = await executor.query(
      'DELETE FROM characters WHERE "ownerId" = $1',
      [userId],
    );

    console.log(`🗄️ Deleted ${result.rowCount} characters for user ${userId}`);
    return result.rowCount || 0;
  }

  async deleteCharactersByIds(
    ids: string[],
    client?: PoolClient,
  ): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const executor = this.getExecutor(client);
    const result = await executor.query(
      'DELETE FROM characters WHERE id = ANY($1::uuid[])',
      [ids],
    );

    console.log(`🗄️ Deleted ${result.rowCount} characters`);
    return result.rowCount || 0;
  }
}
