import { BaseRepository, CampaignRecord } from './base.js';
import { sanitizeLog } from '../sanitizeLog.js';

export class CampaignRepository extends BaseRepository {
  async createCampaign(
    dmId: string,
    name: string,
    description?: string,
  ): Promise<CampaignRecord> {
    const result = await this.pool.query<CampaignRecord>(
      `INSERT INTO campaigns (name, description, "dmId", scenes)
       VALUES ($1, $2, $3, '[]'::jsonb)
       RETURNING *`,
      [name, description || null, dmId],
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
