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
