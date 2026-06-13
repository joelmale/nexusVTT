import { BaseRepository, UserRecord, OAuthProfile } from './base.js';
import { hashPassword } from '../utils/auth.js';

export class UserRepository extends BaseRepository {
  async getUserById(id: string): Promise<UserRecord | null> {
    const result = await this.pool.query<UserRecord>(
      'SELECT * FROM users WHERE id = $1',
      [id],
    );
    return result.rows[0] || null;
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const result = await this.pool.query<UserRecord>(
      'SELECT * FROM users WHERE email = $1',
      [email],
    );
    return result.rows[0] || null;
  }

  async findOrCreateUserByOAuth(profile: OAuthProfile): Promise<UserRecord> {
    const { email, name, avatarUrl, provider } = profile;

    const result = await this.pool.query<UserRecord>(
      `INSERT INTO users (email, name, "displayName", bio, "avatarUrl", provider, preferences, "isActive", "lastLogin")
       VALUES ($1, $2, $2, NULL, $3, $4, '{}'::jsonb, TRUE, NOW())
       ON CONFLICT (email) WHERE email IS NOT NULL DO UPDATE
       SET name = COALESCE(EXCLUDED.name, users.name),
           "displayName" = COALESCE(EXCLUDED."displayName", users."displayName"),
           "avatarUrl" = EXCLUDED."avatarUrl",
           "isActive" = TRUE,
           "lastLogin" = NOW(),
           "updatedAt" = NOW()
       RETURNING *`,
      [email, name, avatarUrl, provider],
    );

    return result.rows[0];
  }

  async createLocalUser(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<UserRecord> {
    const { hash, salt, iterations } = hashPassword(password);
    const fallbackName = email.split('@')[0] || 'Adventurer';
    const name = displayName?.trim() || fallbackName;

    const result = await this.pool.query<UserRecord>(
      `INSERT INTO users (email, name, "displayName", bio, "avatarUrl", provider, "passwordHash", "passwordSalt", "passwordIterations", preferences, "isActive", "lastLogin")
       VALUES ($1, $2, $3, NULL, NULL, 'local', $4, $5, $6, '{}'::jsonb, TRUE, NOW())
       RETURNING *`,
      [email, name, name, hash, salt, iterations],
    );

    return result.rows[0];
  }

  async createGuestUser(name: string, userId?: string): Promise<UserRecord> {
    const query = userId
      ? `INSERT INTO users (id, email, name, "displayName", bio, "avatarUrl", provider, preferences, "isActive", "lastLogin")
         VALUES ($1, NULL, $2, $2, NULL, NULL, 'guest', '{}'::jsonb, TRUE, NOW())
         RETURNING *`
      : `INSERT INTO users (email, name, "displayName", bio, "avatarUrl", provider, preferences, "isActive", "lastLogin")
         VALUES (NULL, $1, $1, NULL, NULL, 'guest', '{}'::jsonb, TRUE, NOW())
         RETURNING *`;

    const params = userId ? [userId, name] : [name];
    const result = await this.pool.query<UserRecord>(query, params);

    return result.rows[0];
  }

  async getUserProfile(userId: string): Promise<
    | (UserRecord & {
        stats: { characters: number; campaigns: number; sessions: number };
      })
    | null
  > {
    const profileQuery = this.pool.query<UserRecord>(
      'SELECT * FROM users WHERE id = $1 AND "isActive" = TRUE',
      [userId],
    );
    const characterCountQuery = this.pool.query<{ count: string }>(
      'SELECT COUNT(*) FROM characters WHERE "ownerId" = $1',
      [userId],
    );
    const campaignCountQuery = this.pool.query<{ count: string }>(
      'SELECT COUNT(*) FROM campaigns WHERE "dmId" = $1',
      [userId],
    );
    const sessionCountQuery = this.pool.query<{ count: string }>(
      'SELECT COUNT(*) FROM sessions WHERE "primaryHostId" = $1',
      [userId],
    );

    const [profileResult, characterCount, campaignCount, sessionCount] =
      await Promise.all([
        profileQuery,
        characterCountQuery,
        campaignCountQuery,
        sessionCountQuery,
      ]);

    const profile = profileResult.rows[0];
    if (!profile) return null;

    return {
      ...profile,
      stats: {
        characters: Number(characterCount.rows[0]?.count || 0),
        campaigns: Number(campaignCount.rows[0]?.count || 0),
        sessions: Number(sessionCount.rows[0]?.count || 0),
      },
    };
  }

  async updateUserProfile(
    userId: string,
    updates: {
      displayName?: string | null;
      bio?: string | null;
      avatarUrl?: string | null;
    },
  ): Promise<UserRecord> {
    const fields: string[] = [];
    const values: unknown[] = [userId];
    let paramIndex = 2;

    if (updates.displayName !== undefined) {
      fields.push(`"displayName" = $${paramIndex}`);
      values.push(updates.displayName);
      paramIndex += 1;
    }

    if (updates.bio !== undefined) {
      fields.push(`bio = $${paramIndex}`);
      values.push(updates.bio);
      paramIndex += 1;
    }

    if (updates.avatarUrl !== undefined) {
      fields.push(`"avatarUrl" = $${paramIndex}`);
      values.push(updates.avatarUrl);
      paramIndex += 1;
    }

    if (fields.length === 0) {
      const existing = await this.getUserById(userId);
      if (!existing) {
        throw new Error('User not found');
      }
      return existing;
    }

    const result = await this.pool.query<UserRecord>(
      `UPDATE users
       SET ${fields.join(', ')},
           "updatedAt" = NOW()
       WHERE id = $1
       RETURNING *`,
      values,
    );
    return result.rows[0];
  }
}
