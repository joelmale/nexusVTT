import type { RequestHandler } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Browser mutation protection, including legacy GET logout. CLI clients without
 * cookies remain supported; credentialed browser requests must prove origin. */
export function createBrowserMutationGuard(
  allowedOrigins: string[],
  nodeEnv = process.env.NODE_ENV,
): RequestHandler {
  const trusted = (value: string): boolean => {
    try {
      const origin = new URL(value).origin;
      return (
        allowedOrigins.includes(origin) ||
        (nodeEnv !== 'production' &&
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
      );
    } catch {
      return false;
    }
  };
  return (req, res, next) => {
    const path = req.originalUrl
      .split('?')[0]
      .toLowerCase()
      .replace(/\/+$/, '');
    if (SAFE_METHODS.has(req.method) && path !== '/auth/logout') return next();
    const origin = req.get('origin');
    const site = req.get('sec-fetch-site');
    const referer = req.get('referer');
    const allowed =
      origin !== undefined
        ? trusted(origin) && new URL(origin).origin === origin
        : site === 'same-origin' ||
          (!site && (referer ? trusted(referer) : !req.get('cookie')));
    if (!allowed) {
      res.status(403).json({ error: 'Request origin could not be verified' });
      return;
    }
    next();
  };
}

interface Bucket {
  count: number;
  expiresAt: number;
}
interface RateLimitOptions {
  now?: () => number;
  maxKeys?: number;
}

/** Bounded, per-replica fixed-window admission limits before body/session work.
 * Aggregate allowance is multiplied by replica count. This is defense in depth;
 * a shared edge limiter is still needed for a deployment-wide abuse budget. */
export function createRequestRateLimiter({
  now = Date.now,
  maxKeys = 10_000,
}: RateLimitOptions = {}): RequestHandler {
  const buckets = new Map<string, Bucket>();
  return (req, res, next) => {
    const path = req.originalUrl
      .split('?')[0]
      .toLowerCase()
      .replace(/\/+$/, '');
    if (
      req.method === 'OPTIONS' ||
      ((req.method === 'GET' || req.method === 'HEAD') &&
        path === '/api/system/health')
    ) {
      return next();
    }
    const time = now();
    const client = req.ip || req.socket.remoteAddress || 'unknown';
    const policies = [{ id: 'api', limit: 600, windowMs: 60_000 }];
    if (path === '/auth/login' || path === '/auth/register') {
      policies.push({ id: 'credentials', limit: 20, windowMs: 15 * 60_000 });
    }
    if (path === '/api/guest-users') {
      policies.push({ id: 'guest', limit: 120, windowMs: 15 * 60_000 });
    }
    for (const policy of policies) {
      const key = `${policy.id}:${client}`;
      let bucket = buckets.get(key);
      if (!bucket || bucket.expiresAt <= time) {
        if (buckets.size >= maxKeys) {
          for (const [candidate, entry] of buckets) {
            if (entry.expiresAt <= time) buckets.delete(candidate);
          }
          if (buckets.size >= maxKeys && !bucket) {
            res.set('Retry-After', '60');
            res
              .status(503)
              .json({ error: 'Request capacity exceeded; retry later' });
            return;
          }
        }
        bucket = { count: 0, expiresAt: time + policy.windowMs };
        buckets.set(key, bucket);
      }
      if (bucket.count >= policy.limit) {
        res.set(
          'Retry-After',
          String(Math.max(1, Math.ceil((bucket.expiresAt - time) / 1000))),
        );
        res.status(429).json({ error: 'Too many requests; retry later' });
        return;
      }
      bucket.count++;
    }
    next();
  };
}
