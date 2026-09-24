import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { LoginChecks, VerifiedClaims } from '../auth/oidc.js';
import { randomToken, safeEqual } from '../auth/tokens.js';
import {
  ABSOLUTE_LIFETIME_MS,
  LOGIN_RATE_LIMIT,
  LOGIN_STATE_TTL_MS,
  type AppDeps,
} from '../deps.js';
import { auditEvent, ctx, sendError } from '../http/context.js';
import {
  clearHostCookie,
  LOGIN_COOKIE,
  readCookie,
  SESSION_COOKIE,
  setHostCookie,
} from '../http/cookies.js';
import { guard } from '../http/guard.js';
import { FixedWindowLimiter } from '../http/rateLimit.js';
import type { AdminUser, AuditEventInput } from '../store/types.js';

const LOGIN_ACTION = 'auth.login';

const sealedLoginState = z.object({
  s: z.string().min(16).max(256),
  n: z.string().min(16).max(256),
  v: z.string().min(43).max(128),
  r: z.string().max(512).nullable(),
  t: z.number().int(),
});

/** Same-origin relative path only: no scheme, no `//host`, no backslashes. */
export function safeReturnTo(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return null;
  if (!/^\/(?![/\\])[\x21-\x7e]*$/.test(value) || value.includes('\\')) return null;
  return value;
}

type LoginFailureReason =
  | 'invalid_login_state'
  | 'idp_error'
  | 'state_mismatch'
  | 'token_validation_failed'
  | 'email_unverified'
  | 'unknown_user'
  | 'subject_mismatch'
  | 'no_active_role';

const FAILURE_STATUS: Record<LoginFailureReason, { status: number; outcome: 'failure' | 'denied' }> = {
  invalid_login_state: { status: 400, outcome: 'failure' },
  idp_error: { status: 400, outcome: 'failure' },
  state_mismatch: { status: 400, outcome: 'failure' },
  token_validation_failed: { status: 400, outcome: 'failure' },
  email_unverified: { status: 403, outcome: 'denied' },
  unknown_user: { status: 403, outcome: 'denied' },
  subject_mismatch: { status: 403, outcome: 'denied' },
  no_active_role: { status: 403, outcome: 'denied' },
};

/** Login start and callback: no session required, per-client login limit. */
export function loginRouter(deps: AppDeps): Router {
  const router = Router();
  const loginLimiter = new FixedWindowLimiter(LOGIN_RATE_LIMIT, 60_000, () => deps.now().getTime());

  const limitLogin = (_req: Request, res: Response): boolean => {
    const retryAfter = loginLimiter.hit(ctx(res).sourceIp ?? 'unknown');
    if (retryAfter === 0) return true;
    deps.logger.warn('rate limit exceeded', { requestId: ctx(res).requestId, scope: 'login' });
    res.setHeader('Retry-After', String(retryAfter));
    sendError(res, 429, 'rate_limited');
    return false;
  };

  router.get('/auth/login', async (req, res) => {
    if (!limitLogin(req, res)) return;
    const returnTo = safeReturnTo(req.query.returnTo);
    let begun: { url: URL; checks: LoginChecks };
    try {
      begun = await deps.identityProvider.beginLogin();
    } catch (error) {
      deps.logger.error('identity provider discovery failed', { requestId: ctx(res).requestId, error });
      return sendError(res, 503, 'identity_provider_unavailable');
    }
    const sealed = deps.cookieCrypto.seal({
      s: begun.checks.state,
      n: begun.checks.nonce,
      v: begun.checks.codeVerifier,
      r: returnTo,
      t: deps.now().getTime(),
    });
    // Lax, not Strict: the callback is a top-level navigation from Google.
    setHostCookie(res, LOGIN_COOKIE, sealed, { maxAgeSeconds: LOGIN_STATE_TTL_MS / 1000, sameSite: 'Lax' });
    res.redirect(302, begun.url.href);
  });

  router.get('/auth/google/callback', async (req, res) => {
    if (!limitLogin(req, res)) return;
    const context = ctx(res);
    clearHostCookie(res, LOGIN_COOKIE, 'Lax');

    const fail = async (
      reason: LoginFailureReason,
      actor: { user?: AdminUser | null; email?: string | null } = {},
    ) => {
      const { status, outcome } = FAILURE_STATUS[reason];
      const event: AuditEventInput = {
        ...auditEvent(res, { action: LOGIN_ACTION, outcome, resourceType: 'admin_session', summary: { reason } }),
        actorUserId: actor.user?.id ?? null,
        actorEmail: actor.user?.email ?? actor.email ?? null,
        identityProvider: 'google',
      };
      await deps.store.appendAudit(event);
      deps.logger.info('admin login refused', { requestId: context.requestId, reason });
      sendError(res, status, reason);
    };

    const parsed = sealedLoginState.safeParse(deps.cookieCrypto.open(readCookie(req, LOGIN_COOKIE)));
    if (!parsed.success || deps.now().getTime() - parsed.data.t > LOGIN_STATE_TTL_MS || parsed.data.t > deps.now().getTime() + 60_000) {
      return fail('invalid_login_state');
    }
    const loginState = parsed.data;
    if (req.query.error !== undefined) {
      return fail('idp_error');
    }
    const returnedState = req.query.state;
    if (typeof returnedState !== 'string' || !safeEqual(returnedState, loginState.s)) {
      return fail('state_mismatch');
    }

    // Build the callback URL from configuration, not from Host headers.
    const callbackUrl = new URL(deps.config.googleCallbackUrl);
    const queryIndex = req.originalUrl.indexOf('?');
    callbackUrl.search = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';

    let claims: VerifiedClaims;
    try {
      claims = await deps.identityProvider.completeLogin(callbackUrl, {
        state: loginState.s,
        nonce: loginState.n,
        codeVerifier: loginState.v,
      });
    } catch (error) {
      deps.logger.warn('ID token exchange or validation failed', { requestId: context.requestId, error });
      return fail('token_validation_failed');
    }

    if (!claims.emailVerified || !claims.email) return fail('email_unverified');
    const email = claims.email.toLowerCase();
    const user = await deps.store.findGoogleUserByEmail(email);
    if (!user || !user.isActive) return fail('unknown_user', { email });

    const boundSubject = await deps.store.getIdentitySubject(user.id);
    if (boundSubject !== null && !safeEqual(boundSubject, claims.subject)) {
      return fail('subject_mismatch', { user });
    }
    if (boundSubject === null) {
      const owner = await deps.store.findUserIdBySubject(claims.subject);
      if (owner !== null && owner !== user.id) return fail('subject_mismatch', { user });
    }

    const roles = await deps.store.getActiveRoles(user.id);
    if (roles.length === 0) return fail('no_active_role', { user });

    const now = deps.now();
    const { cookieValue, idHash } = deps.cookieCrypto.newSessionId();
    const replaceSessionHash = deps.cookieCrypto.sessionHashFromCookie(readCookie(req, SESSION_COOKIE));
    const result = await deps.store.completeLogin({
      userId: user.id,
      bindSubject: boundSubject === null ? claims.subject : null,
      replaceSessionHash,
      session: {
        idHash,
        userId: user.id,
        csrfToken: randomToken(32),
        createdAt: now,
        lastSeenAt: now,
        expiresAt: new Date(now.getTime() + ABSOLUTE_LIFETIME_MS),
        recentAuthAt: now,
        sourceIp: context.sourceIp,
      },
      audit: {
        ...auditEvent(res, {
          action: LOGIN_ACTION,
          outcome: 'success',
          resourceType: 'admin_session',
          summary: { roles, firstAdminLogin: boundSubject === null },
        }),
        actorUserId: user.id,
        actorEmail: user.email,
        identityProvider: 'google',
      },
    });
    if (result === 'subject_conflict') return fail('subject_mismatch', { user });

    setHostCookie(res, SESSION_COOKIE, cookieValue, {
      maxAgeSeconds: ABSOLUTE_LIFETIME_MS / 1000,
      sameSite: 'Strict',
    });
    deps.logger.info('admin login', { requestId: context.requestId, userId: user.id });
    res.redirect(302, loginState.r ?? '/');
  });

  return router;
}

/** Mounted after the session loader. */
export function logoutRouter(deps: AppDeps): Router {
  const router = Router();
  router.post('/auth/logout', guard(deps, { action: 'auth.logout', resourceType: 'admin_session' }), async (_req, res) => {
    const admin = ctx(res).admin!;
    await deps.store.deleteSession(
      admin.session.idHash,
      auditEvent(res, { action: 'auth.logout', outcome: 'success', resourceType: 'admin_session' }),
    );
    clearHostCookie(res, SESSION_COOKIE, 'Strict');
    res.status(204).end();
  });

  return router;
}
