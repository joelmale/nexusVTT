import type { Response } from 'express';
import type { Permission, Role } from '../permissions.js';
import type { AdminUser, AuditEventInput, AuditOutcome, SessionRecord } from '../store/types.js';

export interface AdminContext {
  user: AdminUser;
  roles: Role[];
  permissions: Permission[];
  session: SessionRecord;
}

export type SessionState = 'none' | 'invalid' | 'expired' | 'active';

export interface RequestContext {
  requestId: string;
  sourceIp: string | null;
  sessionState: SessionState;
  /** True when the request carried a session cookie at all. */
  sessionPresented: boolean;
  admin: AdminContext | null;
}

export function ctx(res: Response): RequestContext {
  return res.locals.ctx as RequestContext;
}

export function sendError(res: Response, status: number, error: string): void {
  if (res.headersSent) return;
  res.status(status).json({ error, requestId: ctx(res).requestId });
}

export interface AuditFields {
  action: string;
  outcome: AuditOutcome;
  resourceType?: string | null;
  resourceId?: string | null;
  roleUsed?: Role | null;
  summary?: Record<string, unknown>;
}

/** Builds an audit event attributed to the current request's administrator. */
export function auditEvent(res: Response, fields: AuditFields): AuditEventInput {
  const context = ctx(res);
  return {
    requestId: context.requestId,
    actorUserId: context.admin?.user.id ?? null,
    actorEmail: context.admin?.user.email ?? null,
    identityProvider: context.admin ? 'google' : null,
    roleUsed: fields.roleUsed ?? null,
    action: fields.action,
    resourceType: fields.resourceType ?? null,
    resourceId: fields.resourceId ?? null,
    priorVersion: null,
    sourceIp: context.sourceIp,
    outcome: fields.outcome,
    summary: fields.summary ?? {},
  };
}
