import { useCallback, useEffect, useState } from 'react';

import { fetchSrdItems, type SrdItem } from '@/services/srd-items-api';
import { getFallbackSrdCatalog } from './srdFallbackCatalog';
export type { SrdItem } from '@/services/srd-items-api';

interface CachedCatalog {
  items: SrdItem[];
  fetchedAt: number;
  isFallback?: boolean;
}

const catalogCache = new Map<string, CachedCatalog>();

export interface UseSrdCatalogOptions {
  offlineOnly?: boolean;
}

export interface UseSrdCatalogResult {
  catalog: SrdItem[];
  loading: boolean;
  error?: string;
  isFallback?: boolean;
  ruleset: string;
  catalogVersion: number;
  reload: () => Promise<void>;
  useFallbackCatalog: () => void;
}

export function useSrdCatalog(
  targetRuleset = '2024',
  options?: UseSrdCatalogOptions | boolean,
): UseSrdCatalogResult {
  const ruleset = targetRuleset === '2014' ? '2014' : '2024';
  const offlineOnly =
    typeof options === 'boolean' ? options : Boolean(options?.offlineOnly);
  const cached = catalogCache.get(ruleset);

  const [catalog, setCatalog] = useState<SrdItem[]>(cached?.items ?? []);
  const [loading, setLoading] = useState<boolean>(!cached && !offlineOnly);
  const [error, setError] = useState<string | undefined>();
  const [isFallback, setIsFallback] = useState<boolean>(
    Boolean(cached?.isFallback || (!cached && offlineOnly)),
  );
  const [catalogVersion, setCatalogVersion] = useState<number>(cached?.fetchedAt ?? 0);

  const applyFallbackCatalog = useCallback(() => {
    const fallback = getFallbackSrdCatalog(ruleset);
    if (fallback.length === 0) return false;
    const now = Date.now();
    catalogCache.set(ruleset, { items: fallback, fetchedAt: now, isFallback: true });
    setCatalog(fallback);
    setIsFallback(true);
    setCatalogVersion(now);
    setLoading(false);
    setError(undefined);
    return true;
  }, [ruleset]);

  const load = useCallback(
    async (force = false) => {
      if (!force) {
        const existing = catalogCache.get(ruleset);
        if (existing) {
          setCatalog(existing.items);
          setIsFallback(Boolean(existing.isFallback));
          setCatalogVersion(existing.fetchedAt);
          setLoading(false);
          setError(undefined);
          return;
        }
      }

      if (offlineOnly && !force) {
        applyFallbackCatalog();
        return;
      }

      setLoading(true);
      setError(undefined);

      const result = await fetchSrdItems(ruleset);
      setLoading(false);

      if (!result.ok) {
        if (/\b(401|403)\b/.test(result.error) && applyFallbackCatalog()) {
          return;
        }
        setError(result.error);
        return;
      }

      if (result.items.length === 0) {
        if (applyFallbackCatalog()) return;
        setError(`No items found in the ${ruleset} catalog.`);
        return;
      }

      const now = Date.now();
      catalogCache.set(ruleset, { items: result.items, fetchedAt: now, isFallback: false });
      setCatalog(result.items);
      setIsFallback(false);
      setCatalogVersion(now);
      setError(undefined);
    },
    [ruleset, offlineOnly, applyFallbackCatalog],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(async () => {
    await load(true);
  }, [load]);

  const useFallbackCatalog = useCallback(() => {
    applyFallbackCatalog();
  }, [applyFallbackCatalog]);

  return {
    catalog,
    loading,
    error,
    isFallback,
    ruleset,
    catalogVersion,
    reload,
    useFallbackCatalog,
  };
}

/** Clear cache for testing */
export function clearCatalogCache(): void {
  catalogCache.clear();
}
