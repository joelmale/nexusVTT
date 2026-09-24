import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { safeEqual } from '../auth/tokens.js';
import { API_RATE_LIMIT, IDLE_TIMEOUT_MS, RECENT_AUTH_MS, type AppDeps } from '../deps.js';
import { authorizingRole, permissionsFor, type Permission, type Role } from '../permissions.js';
import { auditEvent, ctx, sendError } from './context.js';
import { clearHostCookie, readCookie, SESSION_COOKIE } from './cookies.js';
import { FixedWindowLimiter } from './rateLimit.js';

const SAFE_METHODS = new Set(['GET', 'HEAD']);

/**
 * Resolves the session cookie to an administrator. Expired sessions (idle or
 * absolute) are deleted. Never rejects on its own; `authorize` decides.
 */
export function loadSession(deps: AppDeps): RequestHandler {
  return async (req, res, next) => {
    const context = ctx(res);
    const cookie = readCookie(req, SESSION_COOKIE);
    context.sessionPresented = cookie !== undefined;
    const idHash = deps.cookieCrypto.sessionHashFromCookie(cookie);
    if (!idHash) {
      context.sessionState = cookie === undefined ? 'none' : 'invalid';
      return next();
    }
    const found = await deps.store.getSessionContext(idHash);
    if (!found) {
      context.sessionState = 'invalid';
      return next();
    }
    const now = deps.now();
    const idleExpired = now.getTime() - found.session.lastSeenAt.getTime() >= IDLE_TIMEOUT_MS;
    const absoluteExpired = now.getTime() >= found.session.expiresAt.getTime();
    if (idleExpired || absoluteExpired || !found.user.isActive) {
      await deps.store.deleteSession(idHash);
      context.sessionState = 'expired';
      clearHostCookie(res, SESSION_COOKIE, 'Strict');
      return next();
    }
    await deps.store.touchSession(idHash, now);
    context.sessionState = 'active';
    context.admin = {
      user: found.user,
      roles: found.roles,
      permissions: permissionsFor(found.roles),
      session: found.session,
    };
    return next();
  };
}

/** 300 requests per session (or per client address without one) per minute. */
export function apiRateLimit(deps: AppDeps): RequestHandler {
  const limiter = new FixedWindowLimiter(API_RATE_LIMIT, 60_000, () => deps.now().getTime());
  return (_req, res, next) => {
    const context = ctx(res);
    const key = context.admin ? `s:${context.admin.session.idHash}` : `ip:${context.sourceIp ?? 'unknown'}`;
    const retryAfter = limiter.hit(key);
    if (retryAfter > 0) {
      deps.logger.warn('rate limit exceeded', { requestId: context.requestId, scope: 'api' });
      res.setHeader('Retry-After', String(retryAfter));
      return sendError(res, 429, 'rate_limited');
    }
    return next();
  };
}

export interface GuardSpec {
  /** Any-of. Omit for routes that only need a session. */
  permission?: readonly Permission[];
  recentAuth?: boolean;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  /** Skip auditing an unauthenticated probe (GET /me without any cookie). */
  quietWhenAnonymous?: boolean;
}

export interface Authorization {
  roleUsed: Role | null;
}

/**
 * Enforces Origin + CSRF for unsafe methods, a live session, an active role,
 * the declared permission, and recent authentication. Every refusal is
 * audited and answered here; callers proceed only on a non-null result.
 */
export async function authorize(
  deps: AppDeps,
  req: Request,
  res: Response,
  spec: GuardSpec,
): Promise<Authorization | null> {
  const context = ctx(res);
  const deny = async (status: number, error: string, reason: string, extra: Record<string, unknown> = {}) => {
    await deps.store.appendAudit(
      auditEvent(res, {
        action: spec.action,
        outcome: 'denied',
        resourceType: spec.resourceType ?? null,
        resourceId: spec.resourceId ?? null,
        summary: { reason, method: req.method, ...extra },
      }),
    );
    sendError(res, status, error);
    return null;
  };

  const unsafe = !SAFE_METHODS.has(req.method);
  if (unsafe && req.headers.origin !== deps.config.adminOrigin) {
    return deny(403, 'origin_mismatch', 'origin_mismatch');
  }
  const admin = context.admin;
  if (!admin) {
    if (spec.quietWhenAnonymous && !context.sessionPresented) {
      sendError(res, 401, 'unauthenticated');
      return null;
    }
    return deny(401, 'unauthenticated', context.sessionState === 'expired' ? 'session_expired' : 'no_session');
  }
  if (unsafe) {
    const header = req.headers['x-csrf-token'];
    if (typeof header !== 'string' || !safeEqual(header, admin.session.csrfToken)) {
      return deny(403, 'csrf_failed', 'csrf_failed');
    }
  }
  if (admin.roles.length === 0) {
    return deny(403, 'forbidden', 'no_active_role');
  }
  let roleUsed: Role | null = null;
  if (spec.permission) {
    roleUsed = authorizingRole(admin.roles, spec.permission);
    if (!roleUsed) {
      return deny(403, 'forbidden', 'missing_permission', { permission: [...spec.permission] });
    }
  }
  if (spec.recentAuth) {
    const age = deps.now().getTime() - admin.session.recentAuthAt.getTime();
    if (age > RECENT_AUTH_MS) {
      return deny(401, 'reauth_required', 'reauth_required');
    }
  }
  return { roleUsed };
}

/** Express adapter for statically declared routes. */
export function guard(deps: AppDeps, spec: GuardSpec): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const result = await authorize(deps, req, res, spec);
    if (!result) return;
    res.locals.authorization = result;
    next();
  };
}

export function authorization(res: Response): Authorization {
  return (res.locals.authorization as Authorization | undefined) ?? { roleUsed: null };
}
