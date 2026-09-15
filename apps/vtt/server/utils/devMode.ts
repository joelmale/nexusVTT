/**
 * Unified server-side development-mode flag.
 *
 * Gates development-only endpoints/behaviour behind a single switch: the
 * /api/dev/* seeding and teardown routes, and verbose diagnostics.
 *
 * The browser cannot read this directly (VITE_* values are baked in at image
 * build time), so GET /api/client-config reports it to the client at runtime.
 * That makes DEV_MODE on the backend the single switch for the dev tooling,
 * settable from a container manager's environment GUI with no rebuild.
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
