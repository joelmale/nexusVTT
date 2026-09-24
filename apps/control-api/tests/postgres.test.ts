import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgControlStore } from '../src/store/pgStore.js';
import { defineStoreContract } from './support/storeContract.js';

/**
 * Runs the ControlStore contract against real PostgreSQL, connected as the
 * least-privilege nexus_control role created by the migration's (commented)
 * Section 2. Requires Docker; skipped when Docker is unavailable.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const vttServer = path.resolve(here, '../../vtt/server');
const MIGRATION = path.join(vttServer, 'migrations/2026-09-24-add-control-plane-identity.sql');
const IMAGE = process.env.CONTROL_API_TEST_PG_IMAGE ?? 'postgres:16-alpine';

function dockerAvailable(): boolean {
  try {
    execFileSync('docker', ['info', '--format', '{{.ServerVersion}}'], { stdio: 'pipe', timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

/** The users table exactly as schema.sql defines it. */
function usersDdl(): string {
  const schema = readFileSync(path.join(vttServer, 'schema.sql'), 'utf8');
  const match = schema.match(/CREATE TABLE IF NOT EXISTS users \([\s\S]*?\n\);/);
  if (!match) throw new Error('users table not found in schema.sql');
  return `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n${match[0]}`;
}

/** Uncomments Section 2 of the migration verbatim. */
function roleSection(migration: string): string {
  const lines = migration.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith('-- DO $$'));
  const end = lines.findIndex((line, i) => i > start && line.startsWith('-- ----'));
  if (start < 0 || end < 0) throw new Error('role section not found');
  return lines.slice(start, end).map((line) => line.replace(/^-- ?/, '')).join('\n');
}

async function waitForPostgres(url: string): Promise<void> {
  const deadline = Date.now() + 90_000;
  for (;;) {
    const client = new pg.Client({ connectionString: url });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return;
    } catch (error) {
      await client.end().catch(() => undefined);
      if (Date.now() > deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

const hasDocker = dockerAvailable();

describe.skipIf(!hasDocker)('PostgreSQL (Docker)', () => {
  let containerId = '';
  let owner: pg.Pool;
  let store: PgControlStore;
  let controlUrl = '';

  beforeAll(async () => {
    containerId = execFileSync('docker', [
      'run', '-d', '--rm',
      '-e', 'POSTGRES_USER=nexus', '-e', 'POSTGRES_PASSWORD=nexus-test', '-e', 'POSTGRES_DB=nexus_vtt',
      '-p', '127.0.0.1::5432', IMAGE,
    ], { encoding: 'utf8', timeout: 120_000 }).trim();
    const mapping = execFileSync('docker', ['port', containerId, '5432/tcp'], { encoding: 'utf8' }).trim().split('\n')[0]!;
    const port = mapping.slice(mapping.lastIndexOf(':') + 1);
    const ownerUrl = `postgres://nexus:nexus-test@127.0.0.1:${port}/nexus_vtt`;
    await waitForPostgres(ownerUrl);

    owner = new pg.Pool({ connectionString: ownerUrl });
    await owner.query(usersDdl());
    // A game table control-api must not be able to touch.
    await owner.query('CREATE TABLE sessions (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), "gameState" JSONB)');
    const migration = readFileSync(MIGRATION, 'utf8');
    await owner.query(migration);
    await owner.query(migration); // idempotent
    await owner.query(roleSection(migration));
    await owner.query(roleSection(migration)); // idempotent
    await owner.query("ALTER ROLE nexus_control PASSWORD 'control-test-only'");
    controlUrl = `postgres://nexus_control:control-test-only@127.0.0.1:${port}/nexus_vtt`;
    store = PgControlStore.fromUrl(controlUrl);
  }, 180_000);

  afterAll(async () => {
    await store?.close().catch(() => undefined);
    await owner?.end().catch(() => undefined);
    if (containerId) execFileSync('docker', ['rm', '-f', containerId], { stdio: 'pipe' });
  });

  defineStoreContract('PostgreSQL as nexus_control', {
    store: () => store,
    reset: async () => {
      await owner.query('TRUNCATE admin_audit_events, admin_sessions, admin_identities, user_roles RESTART IDENTITY');
      await owner.query('DELETE FROM users');
    },
    createUser: async (email, options = {}) => {
      const { rows } = await owner.query<{ id: string }>(
        `INSERT INTO users (email, name, provider, "isActive", "passwordHash") VALUES ($1, $2, $3, $4, 'hash') RETURNING id`,
        [email, email.split('@')[0], options.provider ?? 'google', options.isActive ?? true],
      );
      return rows[0]!.id;
    },
    addRole: async (userId, role) => {
      await owner.query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [userId, role]);
    },
  });

  describe('least privilege for nexus_control', () => {
    let control: pg.Pool;
    beforeAll(() => {
      control = new pg.Pool({ connectionString: controlUrl });
    });
    afterAll(async () => {
      await control.end();
    });

    const denied = async (sql: string) => {
      await expect(control.query(sql)).rejects.toThrow(/permission denied/);
    };

    it('reads only the allowed users columns', async () => {
      await control.query('SELECT id, email, name, "displayName", provider, "isActive" FROM users');
      await denied('SELECT "passwordHash" FROM users');
      await denied('SELECT * FROM users');
      await denied("UPDATE users SET name = 'x'");
    });

    it('keeps audit rows append-only', async () => {
      await control.query("INSERT INTO admin_audit_events (action, outcome) VALUES ('t', 'success')");
      await denied("UPDATE admin_audit_events SET action = 'x'");
      await denied('DELETE FROM admin_audit_events');
      await denied('TRUNCATE admin_audit_events');
    });

    it('cannot delete role history or touch game tables', async () => {
      await denied('DELETE FROM user_roles');
      await denied('SELECT * FROM sessions');
      await denied('CREATE TABLE control_owned (id int)');
    });
  });

  it('enforces one active row per user and role, and valid roles', async () => {
    const { rows } = await owner.query<{ id: string }>(`INSERT INTO users (email, name, provider) VALUES ('c@example.com', 'c', 'google') RETURNING id`);
    const id = rows[0]!.id;
    await owner.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'auditor')", [id]);
    await expect(owner.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'auditor')", [id])).rejects.toThrow(/user_roles_one_active_idx/);
    await expect(owner.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'root')", [id])).rejects.toThrow(/user_roles_role_check/);
    await expect(owner.query("INSERT INTO admin_audit_events (action, outcome) VALUES ('t', 'maybe')")).rejects.toThrow(/outcome_check/);
  });

  it('reports readiness through ping', async () => {
    await expect(store.ping()).resolves.toBeUndefined();
  });
});
