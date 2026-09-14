import { BaseRepository, CharacterRecord } from './base.js';
import { sanitizeLog } from '../sanitizeLog.js';

export class CharacterRepository extends BaseRepository {
  async createCharacter(
    ownerId: string,
    name: string,
    data: unknown = {},
  ): Promise<CharacterRecord> {
    const result = await this.pool.query<CharacterRecord>(
      `INSERT INTO characters (name, "ownerId", data)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, ownerId, JSON.stringify(data)],
    );

    console.log(
      `🗄️ Character created: ${result.rows[0].id} for user ${ownerId}`,
    );
    return result.rows[0];
  }

  async getCharactersByUser(userId: string): Promise<CharacterRecord[]> {
    const result = await this.pool.query<CharacterRecord>(
      'SELECT * FROM characters WHERE "ownerId" = $1 ORDER BY "createdAt" DESC',
      [userId],
    );

    return result.rows;
  }

  async getCharacterById(characterId: string): Promise<CharacterRecord | null> {
    const result = await this.pool.query<CharacterRecord>(
      'SELECT * FROM characters WHERE id = $1',
      [characterId],
    );

    return result.rows[0] || null;
  }

  async updateCharacter(
    characterId: string,
    updates: Partial<CharacterRecord>,
  ): Promise<void> {
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

    await this.pool.query(
      `UPDATE characters SET ${updateFields.join(', ')}, "updatedAt" = NOW() WHERE id = $${paramIndex}`,
      values,
    );

    console.log(`🗄️ Character updated: ${sanitizeLog(characterId)}`);
  }

  async deleteCharacter(characterId: string): Promise<void> {
    await this.pool.query('DELETE FROM characters WHERE id = $1', [
      characterId,
    ]);

    console.log(`🗄️ Character deleted: ${sanitizeLog(characterId)}`);
  }

  async deleteCharactersByUser(userId: string): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM characters WHERE "ownerId" = $1',
      [userId],
    );

    console.log(`🗄️ Deleted ${result.rowCount} characters for user ${userId}`);
    return result.rowCount || 0;
  }

  async deleteCharactersByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const result = await this.pool.query(
      'DELETE FROM characters WHERE id = ANY($1::uuid[])',
      [ids],
    );

    console.log(`🗄️ Deleted ${result.rowCount} characters`);
    return result.rowCount || 0;
  }
}
