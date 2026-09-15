/**
 * Unified server-side development-mode flag.
 *
 * Gates development-only endpoints/behaviour (mock campaign+character seeding,
 * verbose diagnostics, …) behind a single switch.
 *
 * Resolution order:
 *   1. Explicit override via `DEV_MODE` ('true' | 'false').
 *   2. When unset, fall back to `NODE_ENV !== 'production'`.
 *
 * NOTE: this deliberately does NOT gate security-sensitive behaviour (session
 * secret enforcement, secure cookies, CORS origins) — those remain tied to
 * NODE_ENV directly and must not be toggleable from a dev flag.
 */
export function isDevMode(): boolean {
  const flag = process.env.DEV_MODE;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

/**
 * Opt-in switch for the developer tooling endpoints (quick start, test-data
 * seeding, and the clear-all teardown).
 *
 * DEFAULTS TO OFF. Unlike `isDevMode()`, this is NOT inferred from NODE_ENV:
 * these routes create and destroy real rows in the caller's account and accept
 * guest identities, so they must be switched on deliberately rather than
 * appearing by default in every non-production environment.
 *
 * Enable with `ENABLE_DEV_TOOLS=true`. The matching client-side flag is
 * `VITE_ENABLE_DEV_TOOLS` (see src/services/devSeed.ts) -- both must be set for
 * the UI affordances to appear AND function, and they are independent so a
 * stale client build can never reach a server that has the tooling disabled.
 */
export function isDevToolsEnabled(): boolean {
  const enabled = process.env.ENABLE_DEV_TOOLS === 'true';

  if (enabled && process.env.NODE_ENV === 'production') {
    console.warn(
      '⚠️ ENABLE_DEV_TOOLS=true in a production environment. Dev seeding and teardown routes are EXPOSED. Unset this unless you intend it.',
    );
  }

  return enabled;
}
