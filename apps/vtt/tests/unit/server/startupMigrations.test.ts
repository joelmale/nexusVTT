import type { Pool, PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { runStartupMigrations } from '../../../server/startupMigrations';

interface FakeSchema {
  campaignObjects: boolean;
  localAuth: boolean;
  sessionPlanActivations: boolean;
}

function createPool(schema: FakeSchema) {
  const query = vi.fn(
    async (
      sql: string,
      params?: unknown[],
    ): Promise<Partial<QueryResult<Record<string, unknown>>>> => {
      if (sql.includes('information_schema.columns')) {
        return { rows: [{ exists: schema.localAuth }] };
      }
      if (sql.includes('to_regclass')) {
        const tableName = params?.[0];
        return {
          rows: [
            {
              exists:
                tableName === 'public.campaign_objects'
                  ? schema.campaignObjects
                  : schema.sessionPlanActivations,
            },
          ],
        };
      }
      return { rows: [] };
    },
  );
  const release = vi.fn();
  const client = { query, release } as unknown as PoolClient;
  const pool = {
    connect: vi.fn().mockResolvedValue(client),
  } as unknown as Pool;

  return { client, pool, query, release };
}

describe('runStartupMigrations', () => {
  it('applies missing migrations in dependency order', async () => {
    const { pool, query, release } = createPool({
      campaignObjects: false,
      localAuth: false,
      sessionPlanActivations: false,
    });
    const sqlLoader = vi.fn((fileName: string) => `-- ${fileName}`);

    const applied = await runStartupMigrations(pool, sqlLoader);

    expect(applied).toEqual([
      '2025-12-08-add-local-auth.sql',
      '2026-09-25-add-campaign-prep.sql',
      '2026-09-25-add-session-plan-activations.sql',
    ]);
    expect(sqlLoader.mock.calls.map(([fileName]) => fileName)).toEqual(applied);
    expect(query.mock.calls.at(0)?.[0]).toBe('BEGIN');
    expect(query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
    expect(release).toHaveBeenCalledOnce();
  });

  it('does not reload migrations that are already applied', async () => {
    const { pool, query } = createPool({
      campaignObjects: true,
      localAuth: true,
      sessionPlanActivations: true,
    });
    const sqlLoader = vi.fn();

    await expect(runStartupMigrations(pool, sqlLoader)).resolves.toEqual([]);

    expect(sqlLoader).not.toHaveBeenCalled();
    expect(query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
  });

  it('rolls back and releases the client when a migration fails', async () => {
    const { pool, query, release } = createPool({
      campaignObjects: false,
      localAuth: false,
      sessionPlanActivations: false,
    });
    const failure = new Error('migration failed');
    query.mockImplementationOnce(async () => ({ rows: [] }));
    query.mockImplementationOnce(async () => ({ rows: [] }));
    query.mockImplementationOnce(async () => ({ rows: [{ exists: false }] }));
    query.mockImplementationOnce(async () => {
      throw failure;
    });

    await expect(
      runStartupMigrations(pool, (fileName) => `-- ${fileName}`),
    ).rejects.toBe(failure);

    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledOnce();
  });
});
