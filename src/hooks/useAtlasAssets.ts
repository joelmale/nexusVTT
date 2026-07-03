import { useState, useEffect, useRef, useCallback } from 'react';
import { AtlasAsset, AtlasSourceAdapter, PaginatedResult } from './atlasSources/types';
import { CodexSourceAdapter } from './atlasSources/codex';
import { MapsSourceAdapter } from './atlasSources/maps';
import { TokensSourceAdapter } from './atlasSources/tokens';
import { PropsSourceAdapter } from './atlasSources/props';

const adapters: AtlasSourceAdapter[] = [
  new CodexSourceAdapter(),
  new MapsSourceAdapter(),
  new TokensSourceAdapter(),
  new PropsSourceAdapter()
];

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
  const [offlineSources, setOfflineSources] = useState<string[]>([]);
  
  const abortControllerRef = useRef<AbortController | null>(null);

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
          result = await adapter.search(q, 0, controller.signal);
        } else {
          result = await adapter.list(cat, 0, controller.signal);
        }
        return { adapter, result };
      });

      const settled = await Promise.allSettled(promises);
      if (controller.signal.aborted) return;

      const newAssets: AtlasAsset[] = [];
      const newOffline: string[] = [];

      for (const p of settled) {
        if (p.status === 'fulfilled') {
          newAssets.push(...p.value.result.assets);
          if (p.value.adapter.isOffline) {
            newOffline.push(p.value.adapter.source);
          }
        } else {
          // Identify source from promise failure if possible, otherwise generic handle
          console.error('Adapter fetch failed:', p.reason);
        }
      }

      setAssets(newAssets);
      setOfflineSources(newOffline);
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

  useEffect(() => {
    if (!enabled) return;

    const handler = setTimeout(() => {
      fetchAssets(query, category);
    }, 250); // 250ms debounce

    return () => clearTimeout(handler);
  }, [enabled, query, category, fetchAssets]);

  return {
    query,
    setQuery,
    category,
    setCategory,
    assets,
    loading,
    offlineSources,
    refresh: () => fetchAssets(query, category)
  };
}
