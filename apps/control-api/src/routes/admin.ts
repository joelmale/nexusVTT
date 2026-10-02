import express, { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getCodexTableRows, getCodexTableSchema, isCodexTable, listCodexTables } from '../codex/databaseProvider.js';
import { RECENT_AUTH_MS, type AppDeps } from '../deps.js';
import { auditEvent, ctx, sendError } from '../http/context.js';
import { authorization, guard } from '../http/guard.js';
import { ROLES } from '../permissions.js';

const grantBody = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    role: z.enum(ROLES),
  })
  .strict();

const revokeBody = z
  .object({
    userId: z.string().uuid(),
    role: z.enum(ROLES),
  })
  .strict();

const auditQuery = z
  .object({
    limit: z.string().regex(/^\d{1,3}$/).optional(),
    before: z.string().regex(/^\d{1,19}$/).optional(),
  })
  .strict();

const tableRowsQuery = z
  .object({
    limit: z.string().regex(/^\d{1,3}$/).optional(),
    offset: z.string().regex(/^\d{1,9}$/).optional(),
    sortColumn: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/).optional(),
    sortDirection: z.enum(['asc', 'desc']).optional(),
  })
  .strict();

const jsonBody = express.json({ limit: '4kb', strict: true, type: 'application/json' });

/** Parses a small JSON body after authorization, so denials never touch it. */
function parseJson(req: Request, res: Response): Promise<boolean> {
  if (!req.is('application/json')) {
    sendError(res, 415, 'unsupported_media_type');
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    jsonBody(req, res, (error?: unknown) => {
      if (error) {
        const status = (error as { status?: number }).status === 413 ? 413 : 400;
        sendError(res, status, status === 413 ? 'payload_too_large' : 'invalid_json');
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

export function adminRouter(deps: AppDeps): Router {
  const router = Router();

  router.get('/me', guard(deps, { action: 'auth.me', resourceType: 'admin_session', quietWhenAnonymous: true }), (_req, res) => {
    const admin = ctx(res).admin!;
    res.json({
      user: {
        id: admin.user.id,
        email: admin.user.email,
        name: admin.user.name,
        displayName: admin.user.displayName,
      },
      roles: admin.roles,
      permissions: admin.permissions,
      csrfToken: admin.session.csrfToken,
      recentAuthUntil: new Date(admin.session.recentAuthAt.getTime() + RECENT_AUTH_MS).toISOString(),
      sessionExpiresAt: admin.session.expiresAt.toISOString(),
    });
  });

  router.get('/audit/events', guard(deps, { permission: ['audit:read'], action: 'audit.read', resourceType: 'audit_event' }), async (req, res) => {
    const query = auditQuery.safeParse(req.query);
    if (!query.success) return sendError(res, 400, 'invalid_query');
    const limit = Math.min(Math.max(Number(query.data.limit ?? 50), 1), 200);
    const events = await deps.store.listAuditEvents({ limit, beforeId: query.data.before });
    const last = events[events.length - 1];
    res.json({
      events: events.map((event) => ({ ...event, occurredAt: event.occurredAt.toISOString() })),
      nextCursor: events.length === limit && last ? last.id : null,
    });
  });

  router.get('/administrators', guard(deps, { permission: ['admins:manage'], action: 'admins.read', resourceType: 'user_role' }), async (_req, res) => {
    const administrators = await deps.store.listAdministrators();
    res.json({
      administrators: administrators.map(({ user, roles }) => ({
        userId: user.id,
        email: user.email,
        name: user.name,
        displayName: user.displayName,
        isActive: user.isActive,
        roles: roles.map((grant) => ({
          role: grant.role,
          grantedAt: grant.grantedAt.toISOString(),
          grantedBy: grant.grantedBy,
        })),
      })),
    });
  });

  router.post(
    '/administrators/grants',
    guard(deps, { permission: ['admins:manage'], recentAuth: true, action: 'admins.grant_role', resourceType: 'user_role' }),
    async (req, res) => {
      if (!(await parseJson(req, res))) return;
      const body = grantBody.safeParse(req.body);
      if (!body.success) {
        await deps.store.appendAudit(
          auditEvent(res, { action: 'admins.grant_role', outcome: 'failure', resourceType: 'user_role', roleUsed: authorization(res).roleUsed, summary: { reason: 'invalid_request' } }),
        );
        return sendError(res, 400, 'invalid_request');
      }
      const admin = ctx(res).admin!;
      const result = await deps.store.grantRole(
        { email: body.data.email, role: body.data.role, grantedBy: admin.user.id, at: deps.now() },
        {
          ...auditEvent(res, { action: 'admins.grant_role', outcome: 'success', resourceType: 'user_role', roleUsed: authorization(res).roleUsed }),
          summary: { role: body.data.role, targetEmail: body.data.email },
        },
      );
      if (result.status === 'user_not_found') return sendError(res, 404, 'user_not_found');
      if (result.status === 'already_active') return sendError(res, 409, 'already_granted');
      res.status(201).json({ userId: result.userId, role: body.data.role });
    },
  );

  router.post(
    '/administrators/revocations',
    guard(deps, { permission: ['admins:manage'], recentAuth: true, action: 'admins.revoke_role', resourceType: 'user_role' }),
    async (req, res) => {
      if (!(await parseJson(req, res))) return;
      const body = revokeBody.safeParse(req.body);
      if (!body.success) {
        await deps.store.appendAudit(
          auditEvent(res, { action: 'admins.revoke_role', outcome: 'failure', resourceType: 'user_role', roleUsed: authorization(res).roleUsed, summary: { reason: 'invalid_request' } }),
        );
        return sendError(res, 400, 'invalid_request');
      }
      const admin = ctx(res).admin!;
      const result = await deps.store.revokeRole(
        { userId: body.data.userId, role: body.data.role, revokedBy: admin.user.id, at: deps.now() },
        {
          ...auditEvent(res, { action: 'admins.revoke_role', outcome: 'success', resourceType: 'user_role', roleUsed: authorization(res).roleUsed }),
          summary: { role: body.data.role },
        },
      );
      if (result === 'not_active') return sendError(res, 404, 'role_not_active');
      if (result === 'last_platform_admin') return sendError(res, 409, 'last_platform_admin');
      res.status(200).json({ userId: body.data.userId, role: body.data.role });
    },
  );

  router.get('/database/tables', guard(deps, { permission: ['ops:read'], action: 'database.read', resourceType: 'database' }), async (_req, res) => {
    const pgTables = await deps.store.listDatabaseTables();
    const codexTables = await listCodexTables(deps);
    res.json({ tables: [...pgTables, ...codexTables] });
  });

  router.get('/database/tables/:table/schema', guard(deps, { permission: ['ops:read'], action: 'database.read', resourceType: 'database' }), async (req, res) => {
    const table = req.params.table;
    if (typeof table !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
      return sendError(res, 400, 'invalid_table_name');
    }
    const codexSchema = getCodexTableSchema(table);
    if (codexSchema) {
      return res.json(codexSchema);
    }
    const schema = await deps.store.getTableSchema(table);
    if (!schema) return sendError(res, 404, 'table_not_found');
    res.json(schema);
  });

  router.get('/database/tables/:table/rows', guard(deps, { permission: ['ops:read'], action: 'database.read', resourceType: 'database' }), async (req, res) => {
    const table = req.params.table;
    if (typeof table !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
      return sendError(res, 400, 'invalid_table_name');
    }
    const query = tableRowsQuery.safeParse(req.query);
    if (!query.success) return sendError(res, 400, 'invalid_query');

    const limit = Math.min(Math.max(Number(query.data.limit ?? 25), 1), 100);
    const offset = Math.max(Number(query.data.offset ?? 0), 0);

    if (isCodexTable(table)) {
      const codexResult = await getCodexTableRows(deps, table, {
        limit,
        offset,
        sortColumn: query.data.sortColumn,
        sortDirection: query.data.sortDirection,
      });
      if (codexResult) return res.json(codexResult);
    }

    const result = await deps.store.getTableRows(table, {
      limit,
      offset,
      sortColumn: query.data.sortColumn,
      sortDirection: query.data.sortDirection,
    });
    if (!result) return sendError(res, 404, 'table_not_found');
    res.json(result);
  });

  return router;
}
