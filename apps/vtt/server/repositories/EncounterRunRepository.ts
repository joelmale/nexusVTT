import type { PoolClient } from 'pg';
import { BaseRepository, type EncounterRunRecord } from './base.js';

export class EncounterRunRepository extends BaseRepository {
  async getRunById(
    id: string,
    client?: PoolClient,
  ): Promise<EncounterRunRecord | null> {
    const executor = this.getExecutor(client);
    const result = await executor.query<EncounterRunRecord>(
      'SELECT * FROM encounter_runs WHERE id = $1',
      [id],
    );
    return result.rows[0] ?? null;
  }

  async createRun(
    run: {
      id?: string;
      campaignId: string;
      templateRef: unknown;
      stage?: 'staged' | 'deployed' | 'active' | 'completed' | 'archived';
      deploymentCommandId: string;
      activeSessionId?: string | null;
      currentRound?: number;
      currentTurnIndex?: number;
      activeWaveIndex?: number;
      participants?: unknown[];
    },
    client?: PoolClient,
  ): Promise<EncounterRunRecord> {
    const executor = this.getExecutor(client);
    const idClause = run.id ? '$1, ' : '';
    const valuesClause = run.id
      ? '$1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10::jsonb'
      : '$1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9::jsonb';

    const baseParams = [
      run.campaignId,
      JSON.stringify(run.templateRef),
      run.stage ?? 'staged',
      run.deploymentCommandId,
      run.activeSessionId ?? null,
      run.currentRound ?? 1,
      run.currentTurnIndex ?? 0,
      run.activeWaveIndex ?? 0,
      JSON.stringify(run.participants ?? []),
    ];
    const params = run.id ? [run.id, ...baseParams] : baseParams;

    const result = await executor.query<EncounterRunRecord>(
      `INSERT INTO encounter_runs (${idClause}"campaignId", "templateRef", stage, "deploymentCommandId", "activeSessionId", "currentRound", "currentTurnIndex", "activeWaveIndex", participants)
       VALUES (${valuesClause})
       RETURNING *`,
      params,
    );

    return result.rows[0];
  }

  async updateRun(
    id: string,
    updates: {
      stage?: 'staged' | 'deployed' | 'active' | 'completed' | 'archived';
      currentRound?: number;
      currentTurnIndex?: number;
      activeWaveIndex?: number;
      participants?: unknown[];
      activeSessionId?: string | null;
    },
    client?: PoolClient,
  ): Promise<EncounterRunRecord | null> {
    const executor = this.getExecutor(client);
    const setClauses: string[] = ['"updatedAt" = NOW()'];
    const params: unknown[] = [id];
    let paramIndex = 2;

    if (updates.stage !== undefined) {
      setClauses.push(`stage = $${paramIndex++}`);
      params.push(updates.stage);
    }
    if (updates.currentRound !== undefined) {
      setClauses.push(`"currentRound" = $${paramIndex++}`);
      params.push(updates.currentRound);
    }
    if (updates.currentTurnIndex !== undefined) {
      setClauses.push(`"currentTurnIndex" = $${paramIndex++}`);
      params.push(updates.currentTurnIndex);
    }
    if (updates.activeWaveIndex !== undefined) {
      setClauses.push(`"activeWaveIndex" = $${paramIndex++}`);
      params.push(updates.activeWaveIndex);
    }
    if (updates.participants !== undefined) {
      setClauses.push(`participants = $${paramIndex++}::jsonb`);
      params.push(JSON.stringify(updates.participants));
    }
    if (updates.activeSessionId !== undefined) {
      setClauses.push(`"activeSessionId" = $${paramIndex}`);
      params.push(updates.activeSessionId);
    }

    const result = await executor.query<EncounterRunRecord>(
      `UPDATE encounter_runs
       SET ${setClauses.join(', ')}
       WHERE id = $1
       RETURNING *`,
      params,
    );

    return result.rows[0] ?? null;
  }

  async listRunsByCampaign(
    campaignId: string,
    client?: PoolClient,
  ): Promise<EncounterRunRecord[]> {
    const executor = this.getExecutor(client);
    const result = await executor.query<EncounterRunRecord>(
      'SELECT * FROM encounter_runs WHERE "campaignId" = $1 ORDER BY "createdAt" DESC',
      [campaignId],
    );
    return result.rows;
  }
}
