import type { Pool, PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { runStartupMigrations } from '../../../server/startupMigrations';

interface FakeSchema {
  campaignObjects: boolean;
  localAuth: boolean;
  sessionPlanActivations: boolean;
  sessionPlanActivationRequestId: boolean;
  campaignPrepKinds: boolean;
}

function createPool(schema: FakeSchema) {
  const query = vi.fn(
    async (
      sql: string,
      params?: unknown[],
    ): Promise<Partial<QueryResult<Record<string, unknown>>>> => {
      if (sql.includes('information_schema.columns')) {
        const [tableName, columnName] = params ?? [];
        return {
          rows: [
            {
              exists:
                tableName === 'session_plan_activations' &&
                columnName === 'requestId'
                  ? schema.sessionPlanActivationRequestId
                  : schema.localAuth,
            },
          ],
        };
      }
      if (sql.includes('pg_get_constraintdef')) {
        return { rows: [{ exists: schema.campaignPrepKinds }] };
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
      sessionPlanActivationRequestId: false,
      campaignPrepKinds: false,
    });
    const sqlLoader = vi.fn((fileName: string) => `-- ${fileName}`);

    const applied = await runStartupMigrations(pool, sqlLoader);

    expect(applied).toEqual([
      '2025-12-08-add-local-auth.sql',
      '2026-09-25-add-campaign-prep.sql',
      '2026-09-25-add-session-plan-activations.sql',
      '2026-09-30-harden-session-plan-activations.sql',
      '2026-10-01-add-campaign-prep-kinds.sql',
      '2026-10-02-add-homebrew-monster-kind.sql',
      '2026-10-07-add-item-kind.sql',
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
      sessionPlanActivationRequestId: true,
      campaignPrepKinds: true,
    });
    const sqlLoader = vi.fn();

    await expect(runStartupMigrations(pool, sqlLoader)).resolves.toEqual([]);

    expect(sqlLoader).not.toHaveBeenCalled();
    expect(query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
  });

  it('hardens an existing activations table that predates activation receipts', async () => {
    const { pool } = createPool({
      campaignObjects: true,
      localAuth: true,
      sessionPlanActivations: true,
      sessionPlanActivationRequestId: false,
      campaignPrepKinds: true,
    });
    const sqlLoader = vi.fn((fileName: string) => `-- ${fileName}`);

    await expect(runStartupMigrations(pool, sqlLoader)).resolves.toEqual([
      '2026-09-30-harden-session-plan-activations.sql',
    ]);
  });

  it('rolls back and releases the client when a migration fails', async () => {
    const { pool, query, release } = createPool({
      campaignObjects: false,
      localAuth: false,
      sessionPlanActivations: false,
      sessionPlanActivationRequestId: false,
      campaignPrepKinds: false,
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

  it('fails with a fatal error when a startup migration file is missing from disk', async () => {
    const { pool } = createPool({
      campaignObjects: false,
      localAuth: false,
      sessionPlanActivations: false,
      sessionPlanActivationRequestId: false,
      campaignPrepKinds: false,
    });

    await expect(
      runStartupMigrations(pool, () => {
        throw new Error('Required startup migration not found: missing.sql');
      }),
    ).rejects.toThrow('Required startup migration not found');
  });

  it('accounts for all SQL migration files in either startup or non-startup registries', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const migrationsDir = path.resolve(
      __dirname,
      '../../../server/migrations',
    );
    const diskFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'));

    const { STARTUP_MIGRATIONS, KNOWN_NON_STARTUP_MIGRATIONS } = await import(
      '../../../server/startupMigrations'
    );

    const startupFileNames = STARTUP_MIGRATIONS.map((m) => m.fileName);
    const nonStartupFileNames = KNOWN_NON_STARTUP_MIGRATIONS.map(
      (m) => m.fileName,
    );

    // No overlap
    const intersection = startupFileNames.filter((name) =>
      nonStartupFileNames.includes(name),
    );
    expect(intersection).toEqual([]);

    // Every disk file is registered
    const allRegistered = new Set([
      ...startupFileNames,
      ...nonStartupFileNames,
    ]);
    const unmapped = diskFiles.filter((file) => !allRegistered.has(file));
    expect(unmapped).toEqual([]);

    // Startup migrations are ordered chronologically
    const sortedStartup = [...startupFileNames].sort();
    expect(startupFileNames).toEqual(sortedStartup);
  });
});
