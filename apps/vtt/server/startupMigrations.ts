import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import type { Pool, PoolClient } from 'pg';

interface StartupMigration {
  fileName: string;
  isApplied: (client: PoolClient) => Promise<boolean>;
}

type MigrationSqlLoader = (fileName: string) => string;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STARTUP_MIGRATIONS: StartupMigration[] = [
  {
    fileName: '2025-12-08-add-local-auth.sql',
    isApplied: (client) => hasColumn(client, 'users', 'passwordHash'),
  },
  {
    fileName: '2026-09-25-add-campaign-prep.sql',
    isApplied: (client) => hasTable(client, 'campaign_objects'),
  },
  {
    fileName: '2026-09-25-add-session-plan-activations.sql',
    isApplied: (client) => hasTable(client, 'session_plan_activations'),
  },
];

async function hasColumn(
  client: PoolClient,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
     ) AS exists`,
    [tableName, columnName],
  );
  return result.rows[0]?.exists === true;
}

async function hasTable(
  client: PoolClient,
  tableName: string,
): Promise<boolean> {
  const result = await client.query(
    `SELECT to_regclass($1) IS NOT NULL AS exists`,
    [`public.${tableName}`],
  );
  return result.rows[0]?.exists === true;
}

function loadMigrationSql(fileName: string): string {
  const candidates = [
    path.join(__dirname, 'migrations', fileName),
    path.join(process.cwd(), 'server', 'migrations', fileName),
  ];
  const migrationPath = candidates.find((candidate) => fs.existsSync(candidate));

  if (!migrationPath) {
    throw new Error(`Required startup migration not found: ${fileName}`);
  }

  return fs.readFileSync(migrationPath, 'utf-8');
}

export async function runStartupMigrations(
  pool: Pool,
  sqlLoader: MigrationSqlLoader = loadMigrationSql,
): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];

  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext('nexus-vtt-startup-migrations'))`,
    );

    for (const migration of STARTUP_MIGRATIONS) {
      if (await migration.isApplied(client)) continue;

      await client.query(sqlLoader(migration.fileName));
      applied.push(migration.fileName);
    }

    await client.query('COMMIT');
    return applied;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
