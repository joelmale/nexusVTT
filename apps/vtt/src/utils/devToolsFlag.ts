/**
 * @file devToolsFlag.ts
 * @description Runtime switch for the developer seeding tooling (Quick Start,
 * Seed Test Data, Clear All).
 *
 * Read from the SERVER at runtime rather than from a VITE_* build variable,
 * because VITE_* values are compiled into the bundle when the image is built
 * (docker/frontend.Dockerfile runs `npm run build` in a builder stage and
 * copies only the static output into nginx). A build-time flag cannot be
 * toggled by setting an environment variable on a running container.
 *
 * So one `DEV_MODE` variable on the BACKEND drives both the /api/dev/* routes
 * and the UI that calls them -- settable from a container manager's environment
 * GUI, effective on restart, no image rebuild. (VITE_DEV_MODE cannot do this:
 * it is read at build time and is why that variable shows as unused on a
 * running frontend container.)
 *
 * Fails closed: any error, non-OK response, or missing field yields false.
 */

import { useEffect, useState } from 'react';

let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;

/** Fetches (once) whether the server has dev tooling enabled. */
export async function fetchDevToolsEnabled(): Promise<boolean> {
  if (cached !== null) return cached;

  if (!inflight) {
    inflight = fetch('/api/client-config', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((config: { devToolsEnabled?: boolean } | null) => {
        cached = config?.devToolsEnabled === true;
        return cached;
      })
      .catch(() => {
        cached = false;
        return false;
      });
  }

  return inflight;
}

/**
 * Last known value without triggering a fetch. False until the first
 * fetchDevToolsEnabled() resolves, so only use it where a false-negative is
 * safe (guards that are backed by a server-side check anyway).
 */
export function devToolsEnabledSync(): boolean {
  return cached === true;
}

/** Resets the cache. Test-only. */
export function resetDevToolsFlagCache(): void {
  cached = null;
  inflight = null;
}

/** React binding: false on first paint, re-renders once the server answers. */
export function useDevToolsEnabled(): boolean {
  const [enabled, setEnabled] = useState(devToolsEnabledSync());

  useEffect(() => {
    let alive = true;
    void fetchDevToolsEnabled().then((value) => {
      if (alive) setEnabled(value);
    });
    return () => {
      alive = false;
    };
  }, []);

  return enabled;
}
