import {
  BaseRepository,
  type CampaignAccess,
  type CampaignMemberRecord,
  type CampaignMetadata,
  type CampaignRecord,
  type CampaignRole,
} from './base.js';
import { sanitizeLog } from '../sanitizeLog.js';

export class CampaignRepository extends BaseRepository {
  async createCampaign(
    dmId: string,
    name: string,
    description?: string,
    metadata?: CampaignMetadata,
  ): Promise<CampaignRecord> {
    const result =
      metadata === undefined
        ? await this.pool.query<CampaignRecord>(
            `INSERT INTO campaigns (name, description, "dmId", scenes)
       VALUES ($1, $2, $3, '[]'::jsonb)
       RETURNING *`,
            [name, description || null, dmId],
          )
        : await this.pool.query<CampaignRecord>(
            `INSERT INTO campaigns (name, description, "dmId", scenes, edition, mode, mood)
       VALUES ($1, $2, $3, '[]'::jsonb, $4, $5, $6)
       RETURNING *`,
            [
              name,
              description || null,
              dmId,
              metadata.edition ?? '2024',
              metadata.mode ?? 'campaign',
              metadata.mood ?? null,
            ],
          );

    console.log(`🗄️ Campaign created: ${result.rows[0].id} by DM ${dmId}`);
    return result.rows[0];
  }

  async getCampaignsByUser(userId: string): Promise<CampaignRecord[]> {
    const result = await this.pool.query<CampaignRecord>(
      'SELECT * FROM campaigns WHERE "dmId" = $1 ORDER BY "createdAt" DESC',
      [userId],
    );

    return result.rows;
  }

  async getCampaignById(campaignId: string): Promise<CampaignRecord | null> {
    const result = await this.pool.query<CampaignRecord>(
      'SELECT * FROM campaigns WHERE id = $1',
      [campaignId],
    );

    return result.rows[0] || null;
  }

  /** Campaigns the user owns or co-DMs, with the user's role in each. */
  async getCampaignsForEditor(
    userId: string,
  ): Promise<Array<CampaignRecord & { role: CampaignRole }>> {
    const result = await this.pool.query<
      CampaignRecord & { role: CampaignRole }
    >(
      `SELECT c.*,
              CASE WHEN c."dmId" = $1 THEN 'owner' ELSE m.role END AS role
         FROM campaigns c
         LEFT JOIN campaign_members m
           ON m."campaignId" = c.id AND m."userId" = $1
        WHERE c."dmId" = $1 OR m."userId" IS NOT NULL
        ORDER BY c."createdAt" DESC`,
      [userId],
    );
    return result.rows;
  }

  /** Null when the campaign does not exist. */
  async getCampaignAccess(
    campaignId: string,
    userId: string,
  ): Promise<CampaignAccess | null> {
    const result = await this.pool.query<
      CampaignRecord & { accessRole: CampaignRole | null }
    >(
      `SELECT c.*,
              CASE WHEN c."dmId" = $2 THEN 'owner' ELSE m.role END AS "accessRole"
         FROM campaigns c
         LEFT JOIN campaign_members m
           ON m."campaignId" = c.id AND m."userId" = $2
        WHERE c.id = $1`,
      [campaignId, userId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const { accessRole, ...campaign } = row;
    return { campaign, role: accessRole ?? null };
  }

  /** The owner first, then co-DMs in the order they were added. */
  async listCampaignMembers(
    campaignId: string,
  ): Promise<CampaignMemberRecord[]> {
    const result = await this.pool.query<CampaignMemberRecord>(
      `SELECT * FROM (
         SELECT u.id AS "userId", COALESCE(u."displayName", u.name) AS name,
                u.email, u."avatarUrl", 'owner' AS role, c."createdAt" AS "addedAt"
           FROM campaigns c
           JOIN users u ON u.id = c."dmId"
          WHERE c.id = $1
         UNION ALL
         SELECT u.id, COALESCE(u."displayName", u.name), u.email, u."avatarUrl",
                m.role, m."createdAt"
           FROM campaign_members m
           JOIN users u ON u.id = m."userId"
          WHERE m."campaignId" = $1
       ) members
       ORDER BY (role = 'owner') DESC, "addedAt"`,
      [campaignId],
    );
    return result.rows;
  }

  /** Active, non-guest account with this email (case-insensitive). */
  async findInvitableUserByEmail(
    email: string,
  ): Promise<{ id: string } | null> {
    const result = await this.pool.query<{ id: string }>(
      `SELECT id FROM users
        WHERE lower(email) = lower($1)
          AND provider <> 'guest'
          AND "isActive" IS NOT FALSE
        LIMIT 1`,
      [email],
    );
    return result.rows[0] ?? null;
  }

  /** False when the user is already a member. */
  async addCampaignMember(
    campaignId: string,
    userId: string,
    role: Exclude<CampaignRole, 'owner'>,
    invitedBy: string,
  ): Promise<boolean> {
    const result = await this.pool.query(
      `INSERT INTO campaign_members ("campaignId", "userId", role, "invitedBy")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("campaignId", "userId") DO NOTHING`,
      [campaignId, userId, role, invitedBy],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** False when the user was not a member. */
  async removeCampaignMember(
    campaignId: string,
    userId: string,
  ): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM campaign_members WHERE "campaignId" = $1 AND "userId" = $2',
      [campaignId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async isUserAuthorizedForCampaign(
    userId: string,
    campaignId: string,
  ): Promise<boolean> {
    try {
      const campaign = await this.getCampaignById(campaignId);
      if (!campaign) {
        return false;
      }
      if (campaign.dmId === userId) {
        return true;
      }

      const member = await this.pool.query(
        'SELECT 1 FROM campaign_members WHERE "campaignId" = $1 AND "userId" = $2',
        [campaignId, userId],
      );
      if ((member.rowCount ?? 0) > 0) {
        return true;
      }

      const result = await this.pool.query(
        `SELECT 1 FROM sessions s
         LEFT JOIN players p ON s.id = p."sessionId"
         LEFT JOIN hosts h ON s.id = h."sessionId"
         WHERE s."campaignId" = $1 AND (p."userId" = $2 OR h."userId" = $2 OR s."primaryHostId" = $2)
         LIMIT 1`,
        [campaignId, userId],
      );

      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error('Error checking campaign authorization:', error);
      return false;
    }
  }

  async updateCampaign(
    campaignId: string,
    updates: Partial<CampaignRecord>,
  ): Promise<void> {
    const allowedFields = [
      'name',
      'description',
      'scenes',
      'lastRoomCode',
      'lastRoomCodeUpdatedAt',
      'edition',
      'mode',
      'mood',
    ];
    const updateFields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (allowedFields.includes(key)) {
        updateFields.push(`"${key}" = $${paramIndex}`);
        values.push(key === 'scenes' ? JSON.stringify(value) : value);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return;
    }

    values.push(campaignId);

    await this.pool.query(
      `UPDATE campaigns SET ${updateFields.join(', ')}, "updatedAt" = NOW() WHERE id = $${paramIndex}`,
      values,
    );

    console.log(`🗄️ Campaign updated: ${sanitizeLog(campaignId)}`);
  }

  async deleteCampaign(campaignId: string): Promise<void> {
    await this.pool.query('DELETE FROM campaigns WHERE id = $1', [campaignId]);

    console.log(`🗄️ Campaign deleted: ${sanitizeLog(campaignId)}`);
  }

  async saveCampaignScenes(
    campaignId: string,
    scenes: unknown[],
  ): Promise<void> {
    await this.pool.query(
      `UPDATE campaigns SET scenes = $1, "updatedAt" = NOW() WHERE id = $2`,
      [JSON.stringify(scenes), campaignId],
    );

    console.log(`🗄️ Saved ${scenes.length} scenes to campaign: ${campaignId}`);
  }

  async getCampaignScenes(campaignId: string): Promise<unknown[]> {
    const result = await this.pool.query<{ scenes: unknown }>(
      'SELECT scenes FROM campaigns WHERE id = $1',
      [campaignId],
    );

    const scenes = result.rows[0]?.scenes;
    return Array.isArray(scenes) ? scenes : [];
  }
}
