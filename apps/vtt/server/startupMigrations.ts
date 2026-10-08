import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import type { Pool, PoolClient } from 'pg';

export interface StartupMigration {
  fileName: string;
  isApplied: (client: PoolClient) => Promise<boolean>;
}

export type MigrationSqlLoader = (fileName: string) => string;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const STARTUP_MIGRATIONS: StartupMigration[] = [
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
  {
    fileName: '2026-09-30-harden-session-plan-activations.sql',
    isApplied: (client) =>
      hasColumn(client, 'session_plan_activations', 'requestId'),
  },
  {
    fileName: '2026-10-01-add-campaign-prep-kinds.sql',
    isApplied: (client) =>
      constraintMentions(
        client,
        'campaign_objects_kind_check',
        'party-member',
      ),
  },
  {
    fileName: '2026-10-02-add-homebrew-monster-kind.sql',
    isApplied: (client) =>
      constraintMentions(
        client,
        'campaign_objects_kind_check',
        'homebrew-monster',
      ),
  },
  {
    fileName: '2026-10-07-add-item-kind.sql',
    isApplied: (client) =>
      constraintMentions(client, 'campaign_objects_kind_check', 'item'),
  },
];

export interface NonStartupMigration {
  fileName: string;
  reason: string;
}

export const KNOWN_NON_STARTUP_MIGRATIONS: NonStartupMigration[] = [
  {
    fileName: '2025-12-08-add-account-fields.sql',
    reason: 'Baseline user table OAuth columns already represented in initial schema.sql',
  },
  {
    fileName: '2026-01-05-add-campaign-roomcode.sql',
    reason: 'Pre-deploy manual replica migration documented in AGENTS.md; represented in schema.sql',
  },
  {
    fileName: '2026-07-19-add-room-event-journal.sql',
    reason: 'Durability migration step 1 applied pre-deploy in event-journal order; represented in schema.sql',
  },
  {
    fileName: '2026-07-19-add-durable-game-state-commits.sql',
    reason: 'Durability migration step 2 applied pre-deploy in game-state order; represented in schema.sql',
  },
  {
    fileName: '2026-07-19-add-room-entity-versions.sql',
    reason: 'Durability migration step 3 applied pre-deploy in entity-version order; represented in schema.sql',
  },
  {
    fileName: '2026-09-24-add-campaign-actors-and-domain-commands.sql',
    reason: 'Forge-VTT Phase 2 manual migration; represented in schema.sql',
  },
  {
    fileName: '2026-09-24-add-control-plane-identity.sql',
    reason: 'Control API standalone identity/roles migration executed separately by operator/control service',
  },
  {
    fileName: '2026-09-24-add-encounter-runs.sql',
    reason: 'Live combat execution encounter_runs table represented in schema.sql',
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

async function constraintMentions(
  client: PoolClient,
  constraintName: string,
  text: string,
): Promise<boolean> {
  const result = await client.query(
    `SELECT COALESCE(
       (SELECT pg_get_constraintdef(oid) LIKE '%' || $2 || '%'
        FROM pg_constraint
        WHERE conname = $1
        LIMIT 1),
       FALSE
     ) AS exists`,
    [constraintName, text],
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
