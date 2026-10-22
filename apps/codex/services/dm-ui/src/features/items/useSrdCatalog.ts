import { useCallback, useEffect, useState } from 'react';

import { fetchSrdItems, type SrdItem } from '@/services/srd-items-api';

interface CachedCatalog {
  items: SrdItem[];
  fetchedAt: number;
}

const catalogCache = new Map<string, CachedCatalog>();

export interface UseSrdCatalogResult {
  catalog: SrdItem[];
  loading: boolean;
  error?: string;
  ruleset: string;
  catalogVersion: number;
  reload: () => Promise<void>;
}

export function useSrdCatalog(targetRuleset = '2024'): UseSrdCatalogResult {
  const ruleset = targetRuleset === '2014' ? '2014' : '2024';
  const cached = catalogCache.get(ruleset);

  const [catalog, setCatalog] = useState<SrdItem[]>(cached?.items ?? []);
  const [loading, setLoading] = useState<boolean>(!cached);
  const [error, setError] = useState<string | undefined>();
  const [catalogVersion, setCatalogVersion] = useState<number>(cached?.fetchedAt ?? 0);

  const load = useCallback(
    async (force = false) => {
      if (!force) {
        const existing = catalogCache.get(ruleset);
        if (existing) {
          setCatalog(existing.items);
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
        setError(`No items found in the ${ruleset} catalog.`);
        return;
      }

      const now = Date.now();
      catalogCache.set(ruleset, { items: result.items, fetchedAt: now });
      setCatalog(result.items);
      setCatalogVersion(now);
    },
    [ruleset],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(async () => {
    await load(true);
  }, [load]);

  return {
    catalog,
    loading,
    error,
    ruleset,
    catalogVersion,
    reload,
  };
}

/** Clear cache for testing */
export function clearCatalogCache(): void {
  catalogCache.clear();
}
