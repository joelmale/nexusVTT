import { useState, useEffect, useRef, useCallback } from 'react';
import { AtlasAsset, AtlasSourceAdapter, PaginatedResult } from './atlasSources/types';
import { CodexSourceAdapter } from './atlasSources/codex';
import { MapsSourceAdapter } from './atlasSources/maps';
import { TokensSourceAdapter } from './atlasSources/tokens';
import { PropsSourceAdapter } from './atlasSources/props';
import { LibrarySourceAdapter, LibraryFacets } from './atlasSources/library';

const librarySourceAdapter = new LibrarySourceAdapter();

const adapters: AtlasSourceAdapter[] = [
  new CodexSourceAdapter(),
  new MapsSourceAdapter(),
  new TokensSourceAdapter(),
  new PropsSourceAdapter(),
  librarySourceAdapter,
];

// Per-source pagination cursor. Numeric-offset sources (maps/tokens/props/
// codex) track "next skip" as a number; opaque-cursor sources (library)
// track the string the server handed back. `null` means "no next page".
type SourceCursor = number | string | null;

interface SourceState {
  cursor: SourceCursor;
  hasMore: boolean;
}

const emptyResult: PaginatedResult = { assets: [], hasMore: false, total: 0 };

export interface UseAtlasAssetsOptions {
  /**
   * When false, no fetch is performed and no debounce timer is scheduled
   * (ADR-0009: lazy fetch). Defaults to true for back-compat with callers
   * that don't opt into lazy behavior (e.g. AtlasDevHarness).
   */
  enabled?: boolean;
}

export function useAtlasAssets(options?: UseAtlasAssetsOptions) {
  const enabled = options?.enabled ?? true;
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [assets, setAssets] = useState<AtlasAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offlineSources, setOfflineSources] = useState<string[]>([]);
  const [libraryFacets, setLibraryFacets] = useState<LibraryFacets>({ categories: [], tags: [] });
  const [hasMore, setHasMore] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  // Per-adapter pagination state, keyed by adapter.source. Reset on every
  // fresh (non-loadMore) fetch since query/category changed. This is a ref
  // (not state) because it's bookkeeping consumed only inside callbacks
  // (fetchAssets/loadMore), never read during render — `hasMore` state above
  // is the render-facing derivative, kept in sync wherever this ref changes.
  const sourceStateRef = useRef<Map<string, SourceState>>(new Map());

  const computeHasMore = () =>
    Array.from(sourceStateRef.current.values()).some(s => s.hasMore);

  const fetchAssets = useCallback(async (q: string, cat: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    try {
      const promises = adapters.map(async adapter => {
        let result: PaginatedResult;
        if (q.trim()) {
          result = await adapter.search(q, undefined, controller.signal);
        } else {
          result = await adapter.list(cat, undefined, controller.signal);
        }
        return { adapter, result };
      });

      const settled = await Promise.allSettled(promises);
      if (controller.signal.aborted) return;

      const newAssets: AtlasAsset[] = [];
      const newOffline: string[] = [];
      const nextSourceState = new Map<string, SourceState>();

      for (const p of settled) {
        if (p.status === 'fulfilled') {
          const { adapter, result } = p.value;
          newAssets.push(...result.assets);
          if (adapter.isOffline) {
            newOffline.push(adapter.source);
          }
          // Numeric-offset sources: next cursor is "items fetched so far".
          // Opaque-cursor sources (result.cursor present): thread it back verbatim.
          const nextCursor: SourceCursor =
            result.cursor !== undefined ? result.cursor : result.assets.length;
          nextSourceState.set(adapter.source, {
            cursor: nextCursor,
            hasMore: result.hasMore,
          });
        } else {
          // Identify source from promise failure if possible, otherwise generic handle
          console.error('Adapter fetch failed:', p.reason);
        }
      }

      sourceStateRef.current = nextSourceState;
      setAssets(newAssets);
      setOfflineSources(newOffline);
      setHasMore(computeHasMore());
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Atlas fetch error:', err);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const loadMore = useCallback(async () => {
    const entries = Array.from(sourceStateRef.current.entries()).filter(
      ([, state]) => state.hasMore,
    );
    if (entries.length === 0 || loadingMore) return;

    setLoadingMore(true);
    try {
      const q = query;
      const cat = category;

      const promises = entries.map(async ([sourceName, state]) => {
        const adapter = adapters.find(a => a.source === sourceName);
        if (!adapter) return null;
        const result = q.trim()
          ? await adapter.search(q, state.cursor as any)
          : await adapter.list(cat, state.cursor as any);
        return { adapter, result };
      });

      const settled = await Promise.allSettled(promises);

      const appended: AtlasAsset[] = [];
      for (const p of settled) {
        if (p.status === 'fulfilled' && p.value) {
          const { adapter, result } = p.value;
          appended.push(...result.assets);
          const nextCursor: SourceCursor =
            result.cursor !== undefined
              ? result.cursor
              : ((sourceStateRef.current.get(adapter.source)?.cursor as number) || 0) +
                result.assets.length;
          sourceStateRef.current.set(adapter.source, {
            cursor: nextCursor,
            hasMore: result.hasMore,
          });
        } else if (p.status === 'rejected') {
          console.error('Adapter loadMore failed:', p.reason);
        }
      }

      if (appended.length > 0) {
        setAssets(prev => [...prev, ...appended]);
      }
      setHasMore(computeHasMore());
    } finally {
      setLoadingMore(false);
    }
  }, [query, category, loadingMore]);

  const refreshLibraryFacets = useCallback(async () => {
    const facets = await librarySourceAdapter.fetchFacets();
    setLibraryFacets(facets);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handler = setTimeout(() => {
      fetchAssets(query, category);
    }, 250); // 250ms debounce

    return () => clearTimeout(handler);
  }, [enabled, query, category, fetchAssets]);

  useEffect(() => {
    if (!enabled) return;
    // Deferred via setTimeout(…, 0) rather than invoked synchronously in the
    // effect body, matching the debounced-fetch effect above and avoiding
    // react-hooks/set-state-in-effect's cascading-render lint.
    const handle = setTimeout(() => {
      refreshLibraryFacets();
    }, 0);
    return () => clearTimeout(handle);
  }, [enabled, refreshLibraryFacets]);

  return {
    query,
    setQuery,
    category,
    setCategory,
    assets,
    loading,
    loadingMore,
    offlineSources,
    loadMore,
    hasMore,
    libraryFacets,
    refresh: () => fetchAssets(query, category),
  };
}

// Re-exported so callers/tests that only import from useAtlasAssets can
// reference the shared empty-result shape without duplicating it.
export { emptyResult as EMPTY_PAGINATED_RESULT };
