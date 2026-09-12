import React from 'react';

/**
 * Matches the various messages browsers/bundlers use when a dynamically
 * imported (lazy) chunk fails to load. This almost always happens after a new
 * deploy when a stale, service-worker-cached index.html still references the
 * previous build's chunk hashes — those files no longer exist, so the lazy
 * import rejects.
 */
const CHUNK_ERROR_RE =
  /Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|dynamically imported module/i;

/**
 * sessionStorage key holding the timestamp of the last chunk-error-triggered
 * reload. We only auto-reload if the previous attempt was long enough ago,
 * which recovers from a stale deploy without ever looping.
 */
const RELOAD_TS_KEY = 'nexus-chunk-reload-ts';
const RELOAD_COOLDOWN_MS = 10_000;

interface RouteErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Top-level boundary for the lazily-loaded route tree.
 *
 * - On a chunk-load error (stale cached shell after a deploy) it force-reloads
 *   once to pull the fresh index.html + assets, guarded against reload loops.
 * - On any other render error it shows a self-contained fallback (inline-styled
 *   so it renders even if stylesheets failed to load) instead of leaving a
 *   blank/black page.
 */
export class RouteErrorBoundary extends React.Component<
  { children: React.ReactNode },
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    const isChunkError =
      error?.name === 'ChunkLoadError' || CHUNK_ERROR_RE.test(error?.message || '');

    if (isChunkError) {
      const last = Number(sessionStorage.getItem(RELOAD_TS_KEY) || 0);
      // Only reload if we haven't just reloaded — prevents an infinite loop if
      // the fresh assets still can't load for some reason.
      if (Date.now() - last > RELOAD_COOLDOWN_MS) {
        sessionStorage.setItem(RELOAD_TS_KEY, String(Date.now()));
        // The usual cause is a stale service-worker-cached index.html that
        // still points at the previous build's chunk hashes (they now 404). A
        // plain reload just re-serves that same cached shell, so the load fails
        // again — the "flash then blank" loop. Purge the SW + caches first so
        // the reload fetches the fresh shell and chunks from the network.
        void this.purgeCachesAndReload();
        return;
      }
    }

    console.error('Route error boundary caught:', error);
  }

  private async purgeCachesAndReload() {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch (err) {
      console.error('Failed to purge caches before reload:', err);
    } finally {
      window.location.reload();
    }
  }

  handleReload = () => {
    // Clear the guard so the manual reload always goes through.
    sessionStorage.removeItem(RELOAD_TS_KEY);
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          background: '#121417',
          color: '#f1e6d3',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '2rem' }}>⚠️</div>
        <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Something went wrong</h1>
        <p style={{ maxWidth: '28rem', opacity: 0.75, margin: 0, lineHeight: 1.5 }}>
          The page failed to load. This can happen right after an update — reloading
          usually fixes it.
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          style={{
            marginTop: '0.5rem',
            padding: '0.6rem 1.25rem',
            background: '#d97706',
            color: '#1c1e22',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
