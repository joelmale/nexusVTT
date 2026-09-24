import type { PoolClient } from 'pg';
import { BaseRepository, type CampaignActorRecord } from './base.js';
import { sanitizeLog } from '../sanitizeLog.js';

interface RawCampaignActorRecord extends Omit<CampaignActorRecord, 'stateVersion'> {
  stateVersion: string | number;
}

function parseStateVersion(value: string | number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid stateVersion in campaign_actors: ${String(value)}`);
  }
  return parsed;
}

function normalizeActor(row: RawCampaignActorRecord): CampaignActorRecord {
  return {
    ...row,
    stateVersion: parseStateVersion(row.stateVersion),
    conditions: Array.isArray(row.conditions) ? row.conditions : [],
    deathSaves:
      typeof row.deathSaves === 'object' && row.deathSaves !== null
        ? row.deathSaves
        : { successes: 0, failures: 0 },
    resourcePools:
      typeof row.resourcePools === 'object' && row.resourcePools !== null
        ? row.resourcePools
        : {},
    spellcastingProfiles: Array.isArray(row.spellcastingProfiles)
      ? row.spellcastingProfiles
      : [],
    inventory: Array.isArray(row.inventory) ? row.inventory : [],
  };
}

export type UpdateActorResult =
  | { status: 'updated'; actor: CampaignActorRecord }
  | { status: 'conflict'; currentActor: CampaignActorRecord };

export class CampaignActorRepository extends BaseRepository {
  async getActorById(
    actorId: string,
    client?: PoolClient,
  ): Promise<CampaignActorRecord | null> {
    const executor = this.getExecutor(client);
    const result = await executor.query<RawCampaignActorRecord>(
      'SELECT * FROM campaign_actors WHERE id = $1',
      [actorId],
    );
    return result.rows[0] ? normalizeActor(result.rows[0]) : null;
  }

  /**
   * Locks the actor row for update inside an active transaction.
   */
  async lockActorForUpdate(
    actorId: string,
    client: PoolClient,
  ): Promise<CampaignActorRecord | null> {
    const result = await client.query<RawCampaignActorRecord>(
      'SELECT * FROM campaign_actors WHERE id = $1 FOR UPDATE',
      [actorId],
    );
    return result.rows[0] ? normalizeActor(result.rows[0]) : null;
  }

  async getActorsByCampaign(
    campaignId: string,
    client?: PoolClient,
  ): Promise<CampaignActorRecord[]> {
    const executor = this.getExecutor(client);
    const result = await executor.query<RawCampaignActorRecord>(
      'SELECT * FROM campaign_actors WHERE "campaignId" = $1 ORDER BY "createdAt" ASC',
      [campaignId],
    );
    return result.rows.map(normalizeActor);
  }

  async getActorsBySession(
    sessionId: string,
    client?: PoolClient,
  ): Promise<CampaignActorRecord[]> {
    const executor = this.getExecutor(client);
    const result = await executor.query<RawCampaignActorRecord>(
      'SELECT * FROM campaign_actors WHERE "activeSessionId" = $1 ORDER BY "createdAt" ASC',
      [sessionId],
    );
    return result.rows.map(normalizeActor);
  }

  async createActor(
    actor: Omit<CampaignActorRecord, 'id' | 'createdAt' | 'updatedAt' | 'stateVersion'> & {
      stateVersion?: number;
    },
    customId?: string,
    client?: PoolClient,
  ): Promise<CampaignActorRecord> {
    const executor = this.getExecutor(client);
    const idClause = customId ? '$1, ' : '';
    const valuesClause = customId
      ? '$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17'
      : '$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16';

    const baseParams: unknown[] = [
      actor.campaignId,
      actor.sourceRef ? JSON.stringify(actor.sourceRef) : null,
      actor.ownerId,
      actor.name,
      JSON.stringify(actor.ruleset),
      actor.stateVersion ?? 1,
      actor.currentHp,
      actor.maxHp,
      actor.tempHp,
      JSON.stringify(actor.conditions ?? []),
      JSON.stringify(actor.deathSaves ?? { successes: 0, failures: 0 }),
      JSON.stringify(actor.resourcePools ?? {}),
      JSON.stringify(actor.spellcastingProfiles ?? []),
      JSON.stringify(actor.inventory ?? []),
      actor.activeSessionId,
      JSON.stringify(actor.payload),
    ];

    const params = customId ? [customId, ...baseParams] : baseParams;

    const result = await executor.query<RawCampaignActorRecord>(
      `INSERT INTO campaign_actors (
         ${idClause}"campaignId", "sourceRef", "ownerId", name, ruleset,
         "stateVersion", "currentHp", "maxHp", "tempHp", conditions,
         "deathSaves", "resourcePools", "spellcastingProfiles", inventory,
         "activeSessionId", payload
       ) VALUES (${valuesClause})
       RETURNING *`,
      params,
    );

    const created = normalizeActor(result.rows[0]);
    console.log(
      `🗄️ CampaignActor created: ${created.id} (${created.name}) for campaign ${created.campaignId}`,
    );
    return created;
  }

  async updateActorState(
    actorId: string,
    updates: {
      expectedVersion: number;
      currentHp?: number;
      maxHp?: number;
      tempHp?: number;
      conditions?: unknown[];
      deathSaves?: { successes: number; failures: number };
      resourcePools?: Record<string, unknown>;
      spellcastingProfiles?: unknown[];
      inventory?: unknown[];
      activeSessionId?: string | null;
      payload?: unknown;
    },
    client?: PoolClient,
  ): Promise<UpdateActorResult> {
    const executor = this.getExecutor(client);
    const updateClauses: string[] = ['"stateVersion" = "stateVersion" + 1', '"updatedAt" = NOW()'];
    const params: unknown[] = [actorId, updates.expectedVersion];
    let paramIndex = 3;

    if (updates.currentHp !== undefined) {
      updateClauses.push(`"currentHp" = $${paramIndex++}`);
      params.push(updates.currentHp);
    }
    if (updates.maxHp !== undefined) {
      updateClauses.push(`"maxHp" = $${paramIndex++}`);
      params.push(updates.maxHp);
    }
    if (updates.tempHp !== undefined) {
      updateClauses.push(`"tempHp" = $${paramIndex++}`);
      params.push(updates.tempHp);
    }
    if (updates.conditions !== undefined) {
      updateClauses.push(`conditions = $${paramIndex++}::jsonb`);
      params.push(JSON.stringify(updates.conditions));
    }
    if (updates.deathSaves !== undefined) {
      updateClauses.push(`"deathSaves" = $${paramIndex++}::jsonb`);
      params.push(JSON.stringify(updates.deathSaves));
    }
    if (updates.resourcePools !== undefined) {
      updateClauses.push(`"resourcePools" = $${paramIndex++}::jsonb`);
      params.push(JSON.stringify(updates.resourcePools));
    }
    if (updates.spellcastingProfiles !== undefined) {
      updateClauses.push(`"spellcastingProfiles" = $${paramIndex++}::jsonb`);
      params.push(JSON.stringify(updates.spellcastingProfiles));
    }
    if (updates.inventory !== undefined) {
      updateClauses.push(`inventory = $${paramIndex++}::jsonb`);
      params.push(JSON.stringify(updates.inventory));
    }
    if (updates.activeSessionId !== undefined) {
      updateClauses.push(`"activeSessionId" = $${paramIndex++}`);
      params.push(updates.activeSessionId);
    }
    if (updates.payload !== undefined) {
      updateClauses.push(`payload = $${paramIndex}::jsonb`);
      params.push(JSON.stringify(updates.payload));
    }

    const query = `
      UPDATE campaign_actors
      SET ${updateClauses.join(', ')}
      WHERE id = $1 AND "stateVersion" = $2
      RETURNING *
    `;

    const result = await executor.query<RawCampaignActorRecord>(query, params);
    if (result.rows[0]) {
      return {
        status: 'updated',
        actor: normalizeActor(result.rows[0]),
      };
    }

    // CAS Mismatch or missing actor: fetch current
    const currentResult = await executor.query<RawCampaignActorRecord>(
      'SELECT * FROM campaign_actors WHERE id = $1',
      [actorId],
    );

    if (!currentResult.rows[0]) {
      throw new Error(`Cannot update non-existent CampaignActor: ${actorId}`);
    }

    return {
      status: 'conflict',
      currentActor: normalizeActor(currentResult.rows[0]),
    };
  }

  async deleteActor(actorId: string, client?: PoolClient): Promise<boolean> {
    const executor = this.getExecutor(client);
    const result = await executor.query('DELETE FROM campaign_actors WHERE id = $1', [actorId]);
    console.log(`🗄️ CampaignActor deleted: ${sanitizeLog(actorId)}`);
    return (result.rowCount ?? 0) > 0;
  }
}
