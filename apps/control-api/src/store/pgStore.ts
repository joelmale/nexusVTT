import pg from 'pg';
import { finalizeAudit } from '../audit.js';
import { isRole, type Role } from '../permissions.js';
import type {
  AdministratorRecord,
  AdminUser,
  AuditDraft,
  AuditEventInput,
  AuditEventRecord,
  CompleteLoginInput,
  ControlStore,
  DatabaseDomain,
  DatabaseRowsResult,
  DatabaseTableSchema,
  DatabaseTableSummary,
  GrantResult,
  RevokeResult,
  SessionContext,
  SessionRecord,
} from './types.js';

type Queryable = Pick<pg.PoolClient, 'query'>;

const VTT_TABLES = new Set([
  'users',
  'campaigns',
  'characters',
  'sessions',
  'room_events',
  'room_entity_versions',
  'players',
  'hosts',
  'chat_messages',
]);

const CODEX_TABLES = new Set([
  'document',
  'documentpage',
  'documentchunk',
  'documententity',
  'structureddata',
  'entitylink',
  'processingjob',
  'documentcollection',
  'syncstatus',
]);

const CONTROL_TABLES = new Set([
  'admin_identities',
  'user_roles',
  'admin_sessions',
  'admin_audit_events',
]);

export function classifyTableDomain(tableName: string): DatabaseDomain {
  const lower = tableName.toLowerCase();
  if (VTT_TABLES.has(lower)) return 'vtt';
  if (CODEX_TABLES.has(lower)) return 'codex';
  if (CONTROL_TABLES.has(lower)) return 'control';
  return 'other';
}

const REDACTED_COLUMNS = new Set([
  'passwordhash',
  'password_hash',
  'passwordsalt',
  'password_salt',
  'idhash',
  'id_hash',
  'csrftoken',
  'csrf_token',
]);

export function redactRowData(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (REDACTED_COLUMNS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** Serializes role changes so the last-platform_admin check cannot race. */
const ROLE_CHANGE_LOCK = "hashtext('nexus_control.user_roles')";

const USER_COLUMNS = `u.id, u.email, u.name, u."displayName", u.provider, u."isActive"`;

interface UserRow {
  id: string;
  email: string;
  name: string;
  displayName: string | null;
  provider: string;
  isActive: boolean | null;
}

function toUser(row: UserRow): AdminUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    displayName: row.displayName,
    provider: row.provider,
    // users."isActive" defaults to TRUE but is nullable; NULL is not active.
    isActive: row.isActive === true,
  };
}

function toRoles(values: unknown[]): Role[] {
  return values.filter(isRole);
}

async function insertAudit(client: Queryable, input: AuditEventInput): Promise<void> {
  const event = finalizeAudit(input);
  await client.query(
    `INSERT INTO admin_audit_events (
       request_id, actor_user_id, actor_email, identity_provider, role_used,
       action, resource_type, resource_id, prior_version, source_ip, outcome, summary
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)`,
    [
      event.requestId,
      event.actorUserId,
      event.actorEmail,
      event.identityProvider,
      event.roleUsed,
      event.action,
      event.resourceType,
      event.resourceId,
      event.priorVersion,
      event.sourceIp,
      event.outcome,
      JSON.stringify(event.summary),
    ],
  );
}

export class PgControlStore implements ControlStore {
  constructor(private readonly pool: pg.Pool) {}

  static fromUrl(connectionString: string): PgControlStore {
    const pool = new pg.Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      application_name: 'nexus-control-api',
    });
    return new PgControlStore(pool);
  }

  private async transaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async findAdminEligibleUserByEmail(email: string): Promise<AdminUser | null> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users u
        WHERE lower(u.email) = lower($1) AND u.provider IN ('google', 'local')
        ORDER BY u.id LIMIT 2`,
      [email],
    );
    // Two eligible rows for one address would make the match ambiguous; refuse.
    return rows.length === 1 && rows[0] ? toUser(rows[0]) : null;
  }

  async getIdentitySubject(userId: string): Promise<string | null> {
    const { rows } = await this.pool.query<{ subject: string }>(
      'SELECT subject FROM admin_identities WHERE user_id = $1',
      [userId],
    );
    return rows[0]?.subject ?? null;
  }

  async findUserIdBySubject(subject: string): Promise<string | null> {
    const { rows } = await this.pool.query<{ user_id: string }>(
      'SELECT user_id FROM admin_identities WHERE subject = $1',
      [subject],
    );
    return rows[0]?.user_id ?? null;
  }

  async getActiveRoles(userId: string): Promise<Role[]> {
    return this.activeRoles(this.pool, userId);
  }

  private async activeRoles(client: Queryable, userId: string): Promise<Role[]> {
    const { rows } = await client.query<{ role: string }>(
      'SELECT role FROM user_roles WHERE user_id = $1 AND revoked_at IS NULL ORDER BY role',
      [userId],
    );
    return toRoles(rows.map((row) => row.role));
  }

  async completeLogin(input: CompleteLoginInput): Promise<'ok' | 'subject_conflict'> {
    return this.transaction(async (client) => {
      if (input.bindSubject !== null) {
        const bound = await client.query(
          `INSERT INTO admin_identities (user_id, provider, subject, first_seen_at)
           VALUES ($1, 'google', $2, $3)
           ON CONFLICT DO NOTHING`,
          [input.userId, input.bindSubject, input.session.createdAt],
        );
        if (bound.rowCount !== 1) {
          const { rows } = await client.query<{ user_id: string; subject: string }>(
            'SELECT user_id, subject FROM admin_identities WHERE user_id = $1 OR subject = $2',
            [input.userId, input.bindSubject],
          );
          const consistent = rows.length === 1 && rows[0]?.user_id === input.userId && rows[0]?.subject === input.bindSubject;
          if (!consistent) return 'subject_conflict';
        }
      }
      if (input.replaceSessionHash) {
        await client.query('DELETE FROM admin_sessions WHERE id = $1', [input.replaceSessionHash]);
      }
      const s = input.session;
      await client.query(
        `INSERT INTO admin_sessions
           (id, user_id, csrf_token, created_at, last_seen_at, expires_at, recent_auth_at, source_ip)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [s.idHash, s.userId, s.csrfToken, s.createdAt, s.lastSeenAt, s.expiresAt, s.recentAuthAt, s.sourceIp],
      );
      await insertAudit(client, input.audit);
      return 'ok';
    });
  }

  async getSessionContext(idHash: string): Promise<SessionContext | null> {
    const { rows } = await this.pool.query<
      UserRow & {
        session_id: string;
        csrf_token: string;
        created_at: Date;
        last_seen_at: Date;
        expires_at: Date;
        recent_auth_at: Date;
        source_ip: string | null;
        roles: string[] | null;
      }
    >(
      `SELECT s.id AS session_id, s.csrf_token, s.created_at, s.last_seen_at, s.expires_at,
              s.recent_auth_at, s.source_ip, ${USER_COLUMNS},
              ARRAY(SELECT r.role FROM user_roles r
                     WHERE r.user_id = s.user_id AND r.revoked_at IS NULL
                     ORDER BY r.role) AS roles
         FROM admin_sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = $1`,
      [idHash],
    );
    const row = rows[0];
    if (!row) return null;
    const session: SessionRecord = {
      idHash: row.session_id,
      userId: row.id,
      csrfToken: row.csrf_token,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      expiresAt: row.expires_at,
      recentAuthAt: row.recent_auth_at,
      sourceIp: row.source_ip,
    };
    return { session, user: toUser(row), roles: toRoles(row.roles ?? []) };
  }

  async touchSession(idHash: string, at: Date): Promise<void> {
    await this.pool.query(
      'UPDATE admin_sessions SET last_seen_at = GREATEST(last_seen_at, $2) WHERE id = $1',
      [idHash, at],
    );
  }

  async deleteSession(idHash: string, audit?: AuditEventInput): Promise<void> {
    await this.transaction(async (client) => {
      await client.query('DELETE FROM admin_sessions WHERE id = $1', [idHash]);
      if (audit) await insertAudit(client, audit);
    });
  }

  async grantRole(
    input: { email: string; role: Role; grantedBy: string | null; at: Date },
    audit: AuditDraft,
  ): Promise<GrantResult> {
    return this.transaction(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(${ROLE_CHANGE_LOCK})`);
      const { rows } = await client.query<UserRow>(
        `SELECT ${USER_COLUMNS} FROM users u
          WHERE lower(u.email) = lower($1)
            AND u.provider IN ('google', 'local')
            AND u."isActive" IS TRUE
          ORDER BY u.id LIMIT 2`,
        [input.email],
      );
      if (rows.length !== 1 || !rows[0]) {
        await insertAudit(client, { ...audit, resourceId: null, outcome: 'failure', summary: { ...audit.summary, result: 'user_not_found' } });
        return { status: 'user_not_found' };
      }
      const userId = rows[0].id;
      const inserted = await client.query(
        `INSERT INTO user_roles (user_id, role, granted_by, granted_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, role) WHERE revoked_at IS NULL DO NOTHING`,
        [userId, input.role, input.grantedBy, input.at],
      );
      if (inserted.rowCount !== 1) {
        await insertAudit(client, { ...audit, resourceId: userId, outcome: 'conflict', summary: { ...audit.summary, result: 'already_active' } });
        return { status: 'already_active', userId };
      }
      // Privilege change: force the target to sign in again (session rotation).
      await client.query('DELETE FROM admin_sessions WHERE user_id = $1', [userId]);
      await insertAudit(client, { ...audit, resourceId: userId, outcome: 'success', summary: { ...audit.summary, result: 'granted' } });
      return { status: 'granted', userId };
    });
  }

  async revokeRole(
    input: { userId: string; role: Role; revokedBy: string | null; at: Date },
    audit: AuditDraft,
  ): Promise<RevokeResult> {
    return this.transaction(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(${ROLE_CHANGE_LOCK})`);
      const active = await client.query<{ id: string }>(
        'SELECT id FROM user_roles WHERE user_id = $1 AND role = $2 AND revoked_at IS NULL',
        [input.userId, input.role],
      );
      if (active.rowCount !== 1) {
        await insertAudit(client, { ...audit, resourceId: input.userId, outcome: 'failure', summary: { ...audit.summary, result: 'not_active' } });
        return 'not_active';
      }
      if (input.role === 'platform_admin') {
        const { rows } = await client.query<{ count: string }>(
          `SELECT count(*) AS count FROM user_roles r
             JOIN users u ON u.id = r.user_id
            WHERE r.role = 'platform_admin' AND r.revoked_at IS NULL
              AND u."isActive" IS TRUE AND r.user_id <> $1`,
          [input.userId],
        );
        if (Number(rows[0]?.count ?? 0) < 1) {
          await insertAudit(client, { ...audit, resourceId: input.userId, outcome: 'conflict', summary: { ...audit.summary, result: 'last_platform_admin' } });
          return 'last_platform_admin';
        }
      }
      await client.query(
        'UPDATE user_roles SET revoked_at = GREATEST($2::timestamptz, granted_at), revoked_by = $3 WHERE id = $1',
        [active.rows[0]?.id, input.at, input.revokedBy],
      );
      await client.query('DELETE FROM admin_sessions WHERE user_id = $1', [input.userId]);
      await insertAudit(client, { ...audit, resourceId: input.userId, outcome: 'success', summary: { ...audit.summary, result: 'revoked' } });
      return 'revoked';
    });
  }

  async listAdministrators(): Promise<AdministratorRecord[]> {
    const { rows } = await this.pool.query<UserRow & { role: string; granted_at: Date; granted_by: string | null }>(
      `SELECT ${USER_COLUMNS}, r.role, r.granted_at, r.granted_by
         FROM user_roles r JOIN users u ON u.id = r.user_id
        WHERE r.revoked_at IS NULL
        ORDER BY lower(u.email), r.role`,
    );
    const byUser = new Map<string, AdministratorRecord>();
    for (const row of rows) {
      if (!isRole(row.role)) continue;
      let record = byUser.get(row.id);
      if (!record) {
        record = { user: toUser(row), roles: [] };
        byUser.set(row.id, record);
      }
      record.roles.push({ role: row.role, grantedAt: row.granted_at, grantedBy: row.granted_by });
    }
    return [...byUser.values()];
  }

  async listAuditEvents(options: { limit: number; beforeId?: string }): Promise<AuditEventRecord[]> {
    const params: unknown[] = [options.limit];
    let where = '';
    if (options.beforeId) {
      params.push(options.beforeId);
      where = 'WHERE id < $2::bigint';
    }
    const { rows } = await this.pool.query<{
      id: string;
      occurred_at: Date;
      request_id: string | null;
      actor_user_id: string | null;
      actor_email: string | null;
      identity_provider: string | null;
      role_used: string | null;
      action: string;
      resource_type: string | null;
      resource_id: string | null;
      prior_version: string | null;
      source_ip: string | null;
      outcome: AuditEventRecord['outcome'];
      summary: Record<string, unknown>;
    }>(
      `SELECT id::text AS id, occurred_at, request_id, actor_user_id, actor_email, identity_provider,
              role_used, action, resource_type, resource_id, prior_version, source_ip, outcome, summary
         FROM admin_audit_events ${where}
        ORDER BY id DESC
        LIMIT $1`,
      params,
    );
    return rows.map((row) => ({
      id: row.id,
      occurredAt: row.occurred_at,
      requestId: row.request_id,
      actorUserId: row.actor_user_id,
      actorEmail: row.actor_email,
      identityProvider: row.identity_provider,
      roleUsed: isRole(row.role_used) ? row.role_used : null,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      priorVersion: row.prior_version,
      sourceIp: row.source_ip,
      outcome: row.outcome,
      summary: row.summary,
    }));
  }

  async appendAudit(event: AuditEventInput): Promise<void> {
    await insertAudit(this.pool, event);
  }

  async listDatabaseTables(): Promise<DatabaseTableSummary[]> {
    const { rows } = await this.pool.query<{
      table_name: string;
      table_schema: string;
      estimated_rows: string;
      total_bytes: string;
      total_size: string;
    }>(
      `SELECT
         t.table_name,
         t.table_schema,
         COALESCE(c.reltuples, 0)::bigint AS estimated_rows,
         COALESCE(pg_total_relation_size(quote_ident(t.table_schema) || '.' || quote_ident(t.table_name)), 0)::bigint AS total_bytes,
         pg_size_pretty(COALESCE(pg_total_relation_size(quote_ident(t.table_schema) || '.' || quote_ident(t.table_name)), 0)) AS total_size
       FROM information_schema.tables t
       LEFT JOIN pg_class c
         ON c.relname = t.table_name
        AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = t.table_schema)
       WHERE t.table_schema = 'public'
         AND t.table_type = 'BASE TABLE'
       ORDER BY t.table_name ASC`,
    );

    return rows.map((r) => ({
      tableName: r.table_name,
      schemaName: r.table_schema,
      domain: classifyTableDomain(r.table_name),
      estimatedRows: Math.max(0, Math.floor(Number(r.estimated_rows))),
      totalBytes: Number(r.total_bytes),
      totalSize: r.total_size,
    }));
  }

  async getTableSchema(tableName: string): Promise<DatabaseTableSchema | null> {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      return null;
    }

    const tableCheck = await this.pool.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name = $1`,
      [tableName],
    );
    if (tableCheck.rowCount === 0) {
      return null;
    }

    const { rows } = await this.pool.query<{
      column_name: string;
      ordinal_position: number;
      is_nullable: string;
      data_type: string;
      udt_name: string;
      column_default: string | null;
      character_maximum_length: number | null;
      key_type: 'PRIMARY KEY' | 'UNIQUE' | null;
      foreign_key_target: string | null;
    }>(
      `SELECT
         c.column_name,
         c.ordinal_position,
         c.is_nullable,
         c.data_type,
         c.udt_name,
         c.column_default,
         c.character_maximum_length,
         pk_info.constraint_type AS key_type,
         fk_info.foreign_key_target
       FROM information_schema.columns c
       LEFT JOIN (
         SELECT kcu.column_name, tc.constraint_type
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
          AND tc.table_name = kcu.table_name
         WHERE tc.table_schema = 'public'
           AND tc.table_name = $1
           AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
       ) pk_info ON c.column_name = pk_info.column_name
       LEFT JOIN (
         SELECT
           kcu.column_name,
           ccu.table_name || '(' || ccu.column_name || ')' AS foreign_key_target
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
         JOIN information_schema.constraint_column_usage ccu
           ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
         WHERE tc.table_schema = 'public'
           AND tc.table_name = $1
           AND tc.constraint_type = 'FOREIGN KEY'
       ) fk_info ON c.column_name = fk_info.column_name
       WHERE c.table_schema = 'public' AND c.table_name = $1
       ORDER BY c.ordinal_position ASC`,
      [tableName],
    );

    return {
      tableName,
      columns: rows.map((r) => ({
        columnName: r.column_name,
        ordinalPosition: Number(r.ordinal_position),
        isNullable: r.is_nullable === 'YES',
        dataType: r.data_type,
        udtName: r.udt_name,
        columnDefault: r.column_default,
        characterMaximumLength: r.character_maximum_length ? Number(r.character_maximum_length) : null,
        keyType: r.key_type,
        foreignKeyTarget: r.foreign_key_target,
      })),
    };
  }

  async getTableRows(
    tableName: string,
    options: {
      limit: number;
      offset: number;
      sortColumn?: string;
      sortDirection?: 'asc' | 'desc';
    },
  ): Promise<DatabaseRowsResult | null> {
    const schema = await this.getTableSchema(tableName);
    if (!schema) {
      return null;
    }

    const limit = Math.min(Math.max(Number(options.limit) || 25, 1), 100);
    const offset = Math.max(Number(options.offset) || 0, 0);

    let sortCol = schema.columns[0]?.columnName ?? 'ctid';
    if (options.sortColumn && schema.columns.some((c) => c.columnName === options.sortColumn)) {
      sortCol = options.sortColumn;
    } else {
      const pk = schema.columns.find((c) => c.keyType === 'PRIMARY KEY');
      if (pk) sortCol = pk.columnName;
    }

    const sortDir = options.sortDirection === 'desc' ? 'DESC' : 'ASC';

    const safeTable = `"${tableName.replace(/"/g, '""')}"`;
    const safeSortCol = `"${sortCol.replace(/"/g, '""')}"`;

    const countRes = await this.pool.query<{ count: string }>(
      `SELECT count(*)::bigint AS count FROM public.${safeTable}`,
    );
    const totalCount = Number(countRes.rows[0]?.count ?? 0);

    const rowsRes = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM public.${safeTable} ORDER BY ${safeSortCol} ${sortDir} LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    return {
      tableName,
      rows: rowsRes.rows.map((row) => redactRowData(row)),
      totalCount,
      limit,
      offset,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
