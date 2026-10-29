import { createContext, useContext, useEffect, useState } from 'react';

import type { ServerBundleBackend } from './bundleStore';
import { loadServerBundleBackend } from './serverStoreStub';

/**
 * Optional injection point. `undefined` (no provider): use the dynamically
 * loaded backend. `null`: explicitly no backend. An object: use it (tests).
 */
export const ServerBackendContext = createContext<
  ServerBundleBackend | null | undefined
>(undefined);

let cached: Promise<ServerBundleBackend | undefined> | undefined;
function loadOnce() {
  cached ??= loadServerBundleBackend().catch(() => undefined);
  return cached;
}

/**
 * Resolves the server backend. `backend` is `undefined` when none is available
 * or it has not resolved yet; `resolved` distinguishes the two.
 */
export function useServerBackend(): {
  backend: ServerBundleBackend | undefined;
  resolved: boolean;
} {
  const injected = useContext(ServerBackendContext);
  const [loaded, setLoaded] = useState<{
    backend: ServerBundleBackend | undefined;
  } | null>(null);

  useEffect(() => {
    if (injected !== undefined) return undefined;
    let cancelled = false;
    void loadOnce().then((backend) => {
      if (!cancelled) setLoaded({ backend });
    });
    return () => {
      cancelled = true;
    };
  }, [injected]);

  if (injected !== undefined) {
    return { backend: injected ?? undefined, resolved: true };
  }
  return { backend: loaded?.backend, resolved: loaded !== null };
}
