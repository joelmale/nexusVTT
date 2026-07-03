import type { Request, Response, NextFunction } from 'express';

interface SessionUserRecord {
  id: string;
  /** DB `users.provider`: 'google' | 'discord' | 'guest' (see UserRepository). */
  provider?: string;
}

/**
 * Parses the `:userId` path segment out of a request path mounted at
 * '/api/user/:userId/...'. Since this middleware runs before the proxy's
 * pathRewrite, req.path here is relative to the '/api/user' mount point
 * (e.g. '/abc123/upload'), so the userId is the first path segment.
 */
function parseUserIdFromPath(reqPath: string): string | null {
  const segments = reqPath.split('/').filter(Boolean);
  return segments[0] || null;
}

/**
 * Session-validated guard for the user asset write proxy (ADR-0012).
 *
 * Product ruling (Joel): uploads/deletes are for AUTHENTICATED NON-GUEST
 * users only. Guests keep the existing localStorage-only custom-token path
 * and must not be able to reach the asset service.
 *
 * Ground truth on guest identity: guest users are created via
 * POST /api/guest-users (server/index.ts), which stores
 * `req.session.guestUser` directly and never calls `req.login()`. Guests
 * therefore NEVER satisfy `req.isAuthenticated()` and `req.user` is never
 * set for them — passport's `req.isAuthenticated()` is exclusively true for
 * OAuth (Google/Discord) logins. `req.user` is the full `users` table row
 * attached by passport.deserializeUser -> db.getUserById (SELECT *), so
 * `req.user.provider` is populated and can only be 'google' | 'discord'
 * for any request that reaches this guard (a persisted 'guest' provider
 * row would still fail here since guests never call req.login()). The
 * explicit provider === 'guest' check below is defense-in-depth in case
 * that assumption ever changes.
 *
 * Guard order: unauthenticated -> 401; guest -> 403 (distinct body so the
 * client can silently fall back to localStorage); userId mismatch -> 403.
 * Only once this middleware calls next() should the proxy inject the
 * shared secret and forward the request to the asset service.
 */
export function assetWriteGuard(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const user = req.user as SessionUserRecord | undefined;

  if (!user?.id) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (user.provider === 'guest') {
    res.status(403).json({
      error: 'guest-upload-forbidden',
      message: 'Sign in to upload assets',
    });
    return;
  }

  const pathUserId = parseUserIdFromPath(req.path);

  if (!pathUserId || user.id !== pathUserId) {
    res.status(403).json({ error: 'Forbidden: cannot act on behalf of another user' });
    return;
  }

  next();
}
