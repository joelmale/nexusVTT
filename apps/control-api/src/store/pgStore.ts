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
  GrantResult,
  RevokeResult,
  SessionContext,
  SessionRecord,
} from './types.js';

type Queryable = Pick<pg.PoolClient, 'query'>;

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

  async findGoogleUserByEmail(email: string): Promise<AdminUser | null> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users u
        WHERE lower(u.email) = lower($1) AND u.provider = 'google'
        ORDER BY u.id LIMIT 2`,
      [email],
    );
    // Two Google rows for one address would make the match ambiguous; refuse.
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
          WHERE lower(u.email) = lower($1) AND u.provider = 'google' AND u."isActive" IS TRUE
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

  async close(): Promise<void> {
    await this.pool.end();
  }
}
