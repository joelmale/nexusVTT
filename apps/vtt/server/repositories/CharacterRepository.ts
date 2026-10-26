import type { PoolClient } from 'pg';
import { BaseRepository, type CharacterRecord } from './base.js';
import { sanitizeLog } from '../sanitizeLog.js';
import {
  characterCreationPayloadHash,
  CharacterCreationConflictError,
} from '../utils/characterCreationIdentity.js';

export class CharacterRepository extends BaseRepository {
  /** Receipt and character commit together; concurrent retries serialize in PG. */
  async createCharacterOnce(
    ownerId: string,
    name: string,
    data: unknown,
    attemptId: string,
    draftRevision: number,
  ): Promise<CharacterRecord> {
    const payloadHash = characterCreationPayloadHash(name, data, draftRevision);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [JSON.stringify([ownerId, attemptId])],
      );
      const receipt = await client.query<{
        payloadHash: string;
        characterId: string | null;
      }>(
        `SELECT "payloadHash", "characterId" FROM character_creation_attempts
         WHERE "ownerId" = $1 AND "attemptId" = $2`,
        [ownerId, attemptId],
      );
      const existing = receipt.rows[0];
      if (existing) {
        if (existing.payloadHash !== payloadHash)
          throw new CharacterCreationConflictError();
        if (!existing.characterId) {
          throw new CharacterCreationConflictError(
            'The character from this creation attempt was deleted. Start a new creation to make another character.',
          );
        }
        const character = await this.getCharacterById(
          existing.characterId,
          client,
        );
        if (!character || character.ownerId !== ownerId) {
          throw new CharacterCreationConflictError(
            'The saved character is no longer available.',
          );
        }
        await client.query('COMMIT');
        return character;
      }

      const character = await this.createCharacter(ownerId, name, data, client);
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const canonicalData = {
          ...(character.data as Record<string, unknown>),
          id: character.id,
        };
        await client.query('UPDATE characters SET data = $1 WHERE id = $2', [
          JSON.stringify(canonicalData),
          character.id,
        ]);
        character.data = canonicalData;
      }
      await client.query(
        `INSERT INTO character_creation_attempts ("ownerId", "attemptId", "payloadHash", "characterId")
         VALUES ($1, $2, $3, $4)`,
        [ownerId, attemptId, payloadHash, character.id],
      );
      await client.query('COMMIT');
      return character;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

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
      await this.recordLegacyId(
        'character',
        embeddedId,
        created.id,
        ownerId,
        client,
      );
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

    console.log(`🗄️ Character created: ${created.id} for user ${ownerId}`);
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
    await executor.query('DELETE FROM characters WHERE id = $1', [characterId]);

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
