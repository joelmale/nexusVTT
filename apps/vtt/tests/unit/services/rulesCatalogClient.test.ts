import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getRulesCatalogClient,
  getRulesCatalogVersion,
  resetRulesCatalogClientForTests,
} from '@/services/rulesCatalogClient';

describe('rulesCatalogClient (frontend)', () => {
  beforeEach(() => {
    resetRulesCatalogClientForTests();
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetRulesCatalogClientForTests();
  });

  it('returns the catalog version on a successful sync', async () => {
    // First call returns the manifest; the client then asks for entities.
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/manifest')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ etag: 'W/"3"' }),
          json: async () => ({ catalogVersion: 3, publishedAt: null, etag: 'W/"3"', counts: {} }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ etag: 'W/"3"' }),
        json: async () => ({ catalogVersion: 3, since: 0, entities: [], removed: [], skipped: [] }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const version = await getRulesCatalogVersion();

    expect(version).toBe(3);
  });

  it('resolves null when the BFF is unreachable, never throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(getRulesCatalogVersion()).resolves.toBeNull();
  });

  it('resolves null when doc-api is down (BFF 503)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        headers: new Headers(),
        json: async () => ({ error: 'rules_catalog_unavailable', useBundled: true }),
      }),
    );

    await expect(getRulesCatalogVersion()).resolves.toBeNull();
  });

  it('shares one client instance across calls', () => {
    const a = getRulesCatalogClient();
    const b = getRulesCatalogClient();
    expect(a).toBe(b);
  });
});
