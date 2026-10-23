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

export function useSrdCatalog(targetRuleset = '2024'): UseSrdCatalogResult {
  const ruleset = targetRuleset === '2014' ? '2014' : '2024';
  const cached = catalogCache.get(ruleset);

  const [catalog, setCatalog] = useState<SrdItem[]>(cached?.items ?? []);
  const [loading, setLoading] = useState<boolean>(!cached);
  const [error, setError] = useState<string | undefined>();
  const [isFallback, setIsFallback] = useState<boolean>(Boolean(cached?.isFallback));
  const [catalogVersion, setCatalogVersion] = useState<number>(cached?.fetchedAt ?? 0);

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

      setLoading(true);
      setError(undefined);

      const result = await fetchSrdItems(ruleset);
      setLoading(false);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (result.items.length === 0) {
        const fallback = getFallbackSrdCatalog(ruleset);
        if (fallback.length > 0) {
          const now = Date.now();
          catalogCache.set(ruleset, { items: fallback, fetchedAt: now, isFallback: true });
          setCatalog(fallback);
          setIsFallback(true);
          setCatalogVersion(now);
          setError(undefined);
          return;
        }
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
    [ruleset],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(async () => {
    await load(true);
  }, [load]);

  const useFallbackCatalog = useCallback(() => {
    const fallback = getFallbackSrdCatalog(ruleset);
    const now = Date.now();
    catalogCache.set(ruleset, { items: fallback, fetchedAt: now, isFallback: true });
    setCatalog(fallback);
    setIsFallback(true);
    setCatalogVersion(now);
    setError(undefined);
  }, [ruleset]);

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
