import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { classifyTableDomain, redactRowData } from '../src/store/pgStore.js';
import { startHarness, type Harness } from './support/harness.js';

describe('Database Explorer routes and store logic', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await startHarness();
  });

  afterAll(async () => {
    await h.close();
  });

  beforeEach(() => {
    h.store.audit.length = 0;
    h.store.roles.length = 0;
    h.store.sessions.clear();
    h.store.users.clear();
  });

  describe('unit helpers', () => {
    it('correctly classifies database table domains', () => {
      expect(classifyTableDomain('users')).toBe('vtt');
      expect(classifyTableDomain('campaigns')).toBe('vtt');
      expect(classifyTableDomain('sessions')).toBe('vtt');
      expect(classifyTableDomain('room_events')).toBe('vtt');
      expect(classifyTableDomain('document')).toBe('codex');
      expect(classifyTableDomain('documentpage')).toBe('codex');
      expect(classifyTableDomain('structureddata')).toBe('codex');
      expect(classifyTableDomain('admin_identities')).toBe('control');
      expect(classifyTableDomain('user_roles')).toBe('control');
      expect(classifyTableDomain('admin_audit_events')).toBe('control');
      expect(classifyTableDomain('random_other_table')).toBe('other');
    });

    it('redacts sensitive fields in rows', () => {
      const row = {
        id: '123',
        email: 'user@example.com',
        passwordHash: 'secret_hash',
        passwordSalt: 'secret_salt',
        idHash: 'secret_id_hash',
        csrfToken: 'secret_token',
        name: 'Regular Name',
      };
      const redacted = redactRowData(row);
      expect(redacted.id).toBe('123');
      expect(redacted.email).toBe('user@example.com');
      expect(redacted.name).toBe('Regular Name');
      expect(redacted.passwordHash).toBe('[REDACTED]');
      expect(redacted.passwordSalt).toBe('[REDACTED]');
      expect(redacted.idHash).toBe('[REDACTED]');
      expect(redacted.csrfToken).toBe('[REDACTED]');
    });
  });

  describe('GET /database/tables', () => {
    it('returns list of tables with domains and row count estimates', async () => {
      const session = await h.sessionFor(['operator']);
      h.store.addUser({ email: 'alice@example.com' });
      h.store.addUser({ email: 'bob@example.com' });

      const res = await h.request('/control-api/v1/database/tables', { session });
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        tables: Array<{ tableName: string; schemaName: string; domain: string; estimatedRows: number }>;
      };
      expect(body.tables).toBeInstanceOf(Array);
      expect(body.tables.length).toBeGreaterThanOrEqual(2);

      const usersTable = body.tables.find((t) => t.tableName === 'users');
      expect(usersTable).toBeDefined();
      expect(usersTable?.domain).toBe('vtt');
      expect(usersTable?.estimatedRows).toBe(3);
    });
  });

  describe('GET /database/tables/:table/schema', () => {
    it('returns column details for existing table', async () => {
      const session = await h.sessionFor(['auditor']);
      const res = await h.request('/control-api/v1/database/tables/users/schema', { session });
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        tableName: string;
        columns: Array<{ columnName: string; keyType: string | null; dataType: string }>;
      };
      expect(body.tableName).toBe('users');
      expect(body.columns).toBeInstanceOf(Array);

      const idCol = body.columns.find((c) => c.columnName === 'id');
      expect(idCol?.keyType).toBe('PRIMARY KEY');

      const emailCol = body.columns.find((c) => c.columnName === 'email');
      expect(emailCol).toBeDefined();
    });

    it('returns 404 for unknown table', async () => {
      const session = await h.sessionFor(['platform_admin']);
      const res = await h.request('/control-api/v1/database/tables/non_existent_tbl/schema', { session });
      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ error: 'table_not_found' });
    });

    it('returns 400 for invalid table name characters (SQL injection prevention)', async () => {
      const session = await h.sessionFor(['platform_admin']);
      const res = await h.request('/control-api/v1/database/tables/users%3B%20DROP%20TABLE/schema', { session });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'invalid_table_name' });
    });
  });

  describe('GET /database/tables/:table/rows', () => {
    it('returns paginated and sorted rows with sensitive columns redacted', async () => {
      const session = await h.sessionFor(['platform_admin']);
      h.store.addUser({ email: 'zeta@example.com', name: 'Zeta' });
      h.store.addUser({ email: 'alpha@example.com', name: 'Alpha' });
      h.store.addUser({ email: 'beta@example.com', name: 'Beta' });

      // Request ascending sorted rows
      const resAsc = await h.request('/control-api/v1/database/tables/users/rows?sortColumn=email&sortDirection=asc&limit=2&offset=0', {
        session,
      });
      expect(resAsc.status).toBe(200);
      const dataAsc = (await resAsc.json()) as {
        tableName: string;
        rows: Array<{ email: string; passwordHash: string }>;
        totalCount: number;
        limit: number;
        offset: number;
        permissionDenied?: boolean;
      };
      expect(dataAsc.tableName).toBe('users');
      expect(dataAsc.totalCount).toBe(4);
      expect(dataAsc.rows).toHaveLength(2);
      expect(dataAsc.rows[0]?.email).toBe('alpha@example.com');
      expect(dataAsc.rows[1]?.email).toBe('beta@example.com');
      // Column without SELECT permission gets flagged [NO ACCESS]
      expect(dataAsc.rows[0]?.passwordHash).toBe('[NO ACCESS]');
      expect(dataAsc.permissionDenied).toBe(false);

      // Verify readable but sensitive fields get [REDACTED] in sessions
      h.store.sessions.set('test_session', {
        idHash: 'secret_hash',
        userId: '123',
        csrfToken: 'secret_token',
        createdAt: new Date(),
        lastSeenAt: new Date(),
        expiresAt: new Date(Date.now() + 3600_000),
        recentAuthAt: new Date(),
        sourceIp: '127.0.0.1',
      });
      const resSessions = await h.request('/control-api/v1/database/tables/sessions/rows', { session });
      expect(resSessions.status).toBe(200);
      const dataSessions = (await resSessions.json()) as { rows: Array<{ idHash: string; csrfToken: string }> };
      expect(dataSessions.rows[0]?.idHash).toBe('[REDACTED]');
      expect(dataSessions.rows[0]?.csrfToken).toBe('[REDACTED]');

      // Request page 2 (offset 2, limit 2)
      const resPage2 = await h.request('/control-api/v1/database/tables/users/rows?sortColumn=email&sortDirection=asc&limit=2&offset=2', {
        session,
      });
      expect(resPage2.status).toBe(200);
      const dataPage2 = (await resPage2.json()) as { rows: Array<{ email: string }> };
      expect(dataPage2.rows).toHaveLength(2);
      expect(dataPage2.rows[1]?.email).toBe('zeta@example.com');

      // Request descending sorted rows
      const resDesc = await h.request('/control-api/v1/database/tables/users/rows?sortColumn=email&sortDirection=desc&limit=1&offset=0', {
        session,
      });
      expect(resDesc.status).toBe(200);
      const dataDesc = (await resDesc.json()) as { rows: Array<{ email: string }> };
      expect(dataDesc.rows[0]?.email).toBe('zeta@example.com');
    });

    it('returns permissionDenied: true when user lacks SELECT permission on all columns', async () => {
      const session = await h.sessionFor(['platform_admin']);
      const res = await h.request('/control-api/v1/database/tables/restricted_table/rows', { session });
      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        tableName: string;
        rows: unknown[];
        totalCount: number;
        permissionDenied: boolean;
      };
      expect(data.tableName).toBe('restricted_table');
      expect(data.rows).toEqual([]);
      expect(data.totalCount).toBe(0);
      expect(data.permissionDenied).toBe(true);
    });

    it('returns 404 for unknown table', async () => {
      const session = await h.sessionFor(['platform_admin']);
      const res = await h.request('/control-api/v1/database/tables/unknown_table/rows', { session });
      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ error: 'table_not_found' });
    });

    it('returns 400 for invalid query parameters', async () => {
      const session = await h.sessionFor(['platform_admin']);
      const res = await h.request('/control-api/v1/database/tables/users/rows?sortDirection=invalid_direction', {
        session,
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'invalid_query' });
    });
  });
});
