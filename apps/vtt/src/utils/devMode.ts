/**
 * Unified client-side development-mode flag.
 *
 * Gates development-only behaviours (verbose delta-sync resync logging, the
 * lobby dev tools, mock-data seeding UI, …) behind a single switch instead of
 * scattered `import.meta.env.DEV` / `process.env.NODE_ENV` checks.
 *
 * Resolution order:
 *   1. Explicit override via `VITE_DEV_MODE` ('true' | 'false').
 *   2. When unset, fall back to Vite's build mode (`import.meta.env.DEV`, which
 *      is true under `npm run dev` and false in a production build).
 *
 * NOTE: this deliberately does NOT gate security-sensitive behaviour (session
 * secrets, secure cookies, CORS) — those remain tied to NODE_ENV and must not
 * be toggleable from a dev flag.
 */
export function isDevMode(): boolean {
  const flag = import.meta.env.VITE_DEV_MODE;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return import.meta.env.DEV === true;
}

/**
 * Opt-in switch for the lobby/dashboard developer tooling (Quick Start, Quick
 * DM/Player, Admin Panel, test-data seeding and the clear-all teardown).
 *
 * DEFAULTS TO OFF. Unlike `isDevMode()`, this does NOT fall back to
 * `import.meta.env.DEV`: this tooling creates and deletes real campaigns and
 * characters, so it must be switched on deliberately rather than appearing in
 * every dev build.
 *
 * Enable with `VITE_ENABLE_DEV_TOOLS=true`. The server has an independent gate
 * (`ENABLE_DEV_TOOLS`, see server/utils/devMode.ts); BOTH must be set for the
 * tooling to appear and function. Keeping them separate means a stale client
 * build can never reach a server that has the routes disabled.
 */
export function isDevToolsEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_DEV_TOOLS === 'true';
}
