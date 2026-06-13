import { v4 as uuidv4 } from 'uuid';
import { BaseRepository, SessionRecord, PlayerRecord, HostRecord, CharacterRecord } from './base.js';

export class SessionRepository extends BaseRepository {
  private async generateUniqueJoinCode(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
      let code = '';
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const exists = await this.pool.query(
        'SELECT 1 FROM sessions WHERE "joinCode" = $1',
        [code],
      );

      if (exists.rows.length === 0) {
        return code;
      }

      attempts++;
    }

    throw new Error(
      'Failed to generate unique join code after ' + maxAttempts + ' attempts',
    );
  }

  async createSession(
    campaignId: string,
    hostId: string,
  ): Promise<{ sessionId: string; joinCode: string }> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const sessionId = uuidv4();
      const joinCode = await this.generateUniqueJoinCode();

      await client.query(
        `INSERT INTO sessions (id, "joinCode", "campaignId", "primaryHostId", "gameState")
         VALUES ($1, $2, $3, $4, '{}'::jsonb)`,
        [sessionId, joinCode, campaignId, hostId],
      );

      await client.query(
        `INSERT INTO hosts (id, "userId", "sessionId", "isPrimary", permissions)
         VALUES (uuid_generate_v4(), $1, $2, true, '{}'::jsonb)`,
        [hostId, sessionId],
      );

      await client.query(
        `INSERT INTO players (id, "userId", "sessionId", "isConnected")
         VALUES (uuid_generate_v4(), $1, $2, true)`,
        [hostId, sessionId],
      );

      await client.query('COMMIT');

      console.log(
        `🗄️ Session created: ${joinCode} (${sessionId}) by host ${hostId}`,
      );

      return { sessionId, joinCode };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Failed to create session:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async createSessionWithJoinCode(
    campaignId: string,
    hostId: string,
    joinCode: string,
  ): Promise<{ sessionId: string; joinCode: string }> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const existing = await client.query(
        'SELECT 1 FROM sessions WHERE "joinCode" = $1',
        [joinCode],
      );
      if (existing.rows.length > 0) {
        throw new Error(`Join code already exists: ${joinCode}`);
      }

      const sessionId = uuidv4();

      await client.query(
        `INSERT INTO sessions (id, "joinCode", "campaignId", "primaryHostId", "gameState")
         VALUES ($1, $2, $3, $4, '{}'::jsonb)`,
        [sessionId, joinCode, campaignId, hostId],
      );

      await client.query(
        `INSERT INTO hosts (id, "userId", "sessionId", "isPrimary", permissions)
         VALUES (uuid_generate_v4(), $1, $2, true, '{}'::jsonb)`,
        [hostId, sessionId],
      );

      await client.query(
        `INSERT INTO players (id, "userId", "sessionId", "isConnected")
         VALUES (uuid_generate_v4(), $1, $2, true)`,
        [hostId, sessionId],
      );

      await client.query('COMMIT');

      console.log(
        `🗄️ Session created with custom code: ${joinCode} (${sessionId}) by host ${hostId}`,
      );

      return { sessionId, joinCode };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Failed to create session with custom code:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getSessionByJoinCode(joinCode: string): Promise<SessionRecord | null> {
    const result = await this.pool.query<SessionRecord>(
      'SELECT * FROM sessions WHERE "joinCode" = $1',
      [joinCode],
    );

    return result.rows[0] || null;
  }

  async getCampaignIdByJoinCode(joinCode: string): Promise<string | null> {
    const result = await this.pool.query<{ campaignId: string }>(
      'SELECT "campaignId" FROM sessions WHERE "joinCode" = $1',
      [joinCode],
    );

    return result.rows[0]?.campaignId || null;
  }

  async updateSessionStatus(
    sessionId: string,
    status: 'active' | 'hibernating' | 'abandoned',
  ): Promise<void> {
    await this.pool.query(
      `UPDATE sessions SET status = $1, "lastActivity" = NOW() WHERE id = $2`,
      [status, sessionId],
    );

    console.log(`🗄️ Session ${sessionId} status updated to: ${status}`);
  }

  async saveGameState(sessionId: string, gameState: unknown): Promise<void> {
    await this.pool.query(
      `UPDATE sessions SET "gameState" = $1, "lastActivity" = NOW() WHERE id = $2`,
      [JSON.stringify(gameState), sessionId],
    );

    console.log(`🗄️ Game state saved for session: ${sessionId}`);
  }

  async saveGameStateByJoinCode(
    joinCode: string,
    gameState: unknown,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE sessions SET "gameState" = $1, "lastActivity" = NOW() WHERE "joinCode" = $2`,
      [JSON.stringify(gameState), joinCode],
    );

    console.log(`🗄️ Game state saved for room: ${joinCode}`);
  }

  async getGameStateByJoinCode(joinCode: string): Promise<unknown | null> {
    const result = await this.pool.query<{ gameState: unknown }>(
      'SELECT "gameState" FROM sessions WHERE "joinCode" = $1',
      [joinCode],
    );

    return result.rows[0]?.gameState || null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
    console.log(`🗄️ Session deleted: ${sessionId}`);
  }

  async addPlayerToSession(
    userId: string,
    sessionId: string,
    characterId?: string | null,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO players (id, "userId", "sessionId", "characterId", "isConnected")
       VALUES (uuid_generate_v4(), $1, $2, $3, true)
       ON CONFLICT ("userId", "sessionId") DO UPDATE
       SET "isConnected" = true, "characterId" = EXCLUDED."characterId", "lastSeen" = NOW()`,
      [userId, sessionId, characterId || null],
    );

    console.log(
      `🗄️ Player ${userId} added to session ${sessionId}${characterId ? ` with character ${characterId}` : ''}`,
    );
  }

  async removePlayerFromSession(
    userId: string,
    sessionId: string,
  ): Promise<void> {
    await this.pool.query(
      'DELETE FROM players WHERE "userId" = $1 AND "sessionId" = $2',
      [userId, sessionId],
    );

    console.log(`🗄️ Player ${userId} removed from session ${sessionId}`);
  }

  async updatePlayerConnection(
    userId: string,
    sessionId: string,
    isConnected: boolean,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE players
       SET "isConnected" = $1, "lastSeen" = NOW()
       WHERE "userId" = $2 AND "sessionId" = $3`,
      [isConnected, userId, sessionId],
    );
  }

  async getPlayersBySession(sessionId: string): Promise<PlayerRecord[]> {
    const result = await this.pool.query<PlayerRecord>(
      'SELECT * FROM players WHERE "sessionId" = $1',
      [sessionId],
    );

    return result.rows;
  }

  async addCoHost(
    userId: string,
    sessionId: string,
    permissions?: unknown,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO hosts (id, "userId", "sessionId", "isPrimary", permissions)
       VALUES (uuid_generate_v4(), $1, $2, false, $3)
       ON CONFLICT ("userId", "sessionId") DO UPDATE
       SET permissions = EXCLUDED.permissions`,
      [userId, sessionId, JSON.stringify(permissions || {})],
    );

    console.log(`🗄️ Co-host ${userId} added to session ${sessionId}`);
  }

  async removeCoHost(userId: string, sessionId: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM hosts WHERE "userId" = $1 AND "sessionId" = $2 AND "isPrimary" = false',
      [userId, sessionId],
    );

    console.log(`🗄️ Co-host ${userId} removed from session ${sessionId}`);
  }

  async transferPrimaryHost(
    sessionId: string,
    newHostId: string,
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE hosts SET "isPrimary" = false WHERE "sessionId" = $1 AND "isPrimary" = true`,
        [sessionId],
      );

      await client.query(
        `INSERT INTO hosts (id, "userId", "sessionId", "isPrimary", permissions)
         VALUES (uuid_generate_v4(), $1, $2, true, '{}'::jsonb)
         ON CONFLICT ("userId", "sessionId") DO UPDATE
         SET "isPrimary" = true`,
        [newHostId, sessionId],
      );

      await client.query(
        `UPDATE sessions SET "primaryHostId" = $1 WHERE id = $2`,
        [newHostId, sessionId],
      );

      await client.query('COMMIT');

      console.log(
        `🗄️ Primary host transferred to ${newHostId} in session ${sessionId}`,
      );
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Failed to transfer primary host:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getHostsBySession(sessionId: string): Promise<HostRecord[]> {
    const result = await this.pool.query<HostRecord>(
      'SELECT * FROM hosts WHERE "sessionId" = $1',
      [sessionId],
    );

    return result.rows;
  }

  async activateSessionByJoinCode(
    joinCode: string,
    hostId: string,
  ): Promise<SessionRecord | null> {
    const session = await this.getSessionByJoinCode(joinCode);
    if (!session) return null;

    await this.updateSessionStatus(session.id, 'active');
    await this.transferPrimaryHost(session.id, hostId);
    await this.addPlayerToSession(hostId, session.id);

    return this.getSessionByJoinCode(joinCode);
  }

  async getPlayerCharacter(
    userId: string,
    sessionId: string,
  ): Promise<CharacterRecord | null> {
    const playerResult = await this.pool.query<PlayerRecord>(
      'SELECT "characterId" FROM players WHERE "userId" = $1 AND "sessionId" = $2',
      [userId, sessionId],
    );

    if (!playerResult.rows[0] || !playerResult.rows[0].characterId) {
      return null;
    }

    const charResult = await this.pool.query<CharacterRecord>(
      'SELECT * FROM characters WHERE id = $1',
      [playerResult.rows[0].characterId],
    );

    return charResult.rows[0] || null;
  }
}
