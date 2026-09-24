import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogEntitiesResponse, CatalogManifest } from '@nexus/rules-contracts';
import {
  DEFAULT_MAX_ENTITIES_ENTRIES,
  RulesCatalogCache,
  RulesCatalogUpstreamClient,
  createRulesCatalogUpstreamClient,
  type RulesCatalogUpstream,
} from '../../../../server/services/rulesCatalogClient.js';

function manifestBody(catalogVersion: number): CatalogManifest {
  return { catalogVersion, publishedAt: null, etag: `W/"${catalogVersion}"`, counts: {} as never };
}

function entitiesBody(catalogVersion: number, since = 0): CatalogEntitiesResponse {
  return { catalogVersion, since, entities: [], removed: [], skipped: [] };
}

describe('RulesCatalogUpstreamClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends If-None-Match and returns a validated manifest on 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ etag: 'W/"1"' }),
      json: async () => manifestBody(1),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new RulesCatalogUpstreamClient({ apiUrl: 'http://doc-api.test' });

    const result = await client.fetchManifest('W/"0"');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://doc-api.test/api/rules/catalog/manifest',
      expect.objectContaining({ headers: { 'If-None-Match': 'W/"0"' } }),
    );
    expect(result).toEqual({ status: 200, body: manifestBody(1), etag: 'W/"1"' });
  });

  it('returns 304 without parsing a body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 304, headers: new Headers({ etag: 'W/"1"' }) }),
    );
    const client = new RulesCatalogUpstreamClient({ apiUrl: 'http://doc-api.test' });

    const result = await client.fetchManifest('W/"1"');

    expect(result).toEqual({ status: 304, etag: 'W/"1"' });
  });

  it('rejects a manifest body that fails contract validation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ etag: 'W/"1"' }),
      json: async () => ({ catalogVersion: 'not-a-number' }),
    }));
    const client = new RulesCatalogUpstreamClient({ apiUrl: 'http://doc-api.test' });

    await expect(client.fetchManifest(null)).rejects.toThrow('failed contract validation');
  });

  it('throws on a non-ok, non-304 status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, headers: new Headers() }));
    const client = new RulesCatalogUpstreamClient({ apiUrl: 'http://doc-api.test' });

    await expect(client.fetchManifest(null)).rejects.toThrow('rules catalog upstream request failed: 500');
  });

  it('wraps an aborted request as a timeout error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    const client = new RulesCatalogUpstreamClient({ apiUrl: 'http://doc-api.test', timeout: 1 });

    await expect(client.fetchManifest(null)).rejects.toThrow('timed out');
  });

  it('builds the entities query string from fixed keys only', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ etag: 'W/"1"' }),
      json: async () => entitiesBody(1),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new RulesCatalogUpstreamClient({ apiUrl: 'http://doc-api.test' });

    await client.fetchEntities({ type: 'spell', ruleset: '2024', since: 3 }, null);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://doc-api.test/api/rules/catalog/entities?type=spell&ruleset=2024&since=3',
      expect.anything(),
    );
  });

  it('createRulesCatalogUpstreamClient builds an instance', () => {
    expect(createRulesCatalogUpstreamClient('http://doc-api.test')).toBeInstanceOf(RulesCatalogUpstreamClient);
  });
});

function fakeUpstream(overrides: Partial<RulesCatalogUpstream> = {}): RulesCatalogUpstream {
  return {
    fetchManifest: vi.fn(),
    fetchEntities: vi.fn(),
    ...overrides,
  };
}

describe('RulesCatalogCache', () => {
  it('fetches once and serves subsequent requests within the TTL from cache', async () => {
    const fetchManifest = vi.fn().mockResolvedValue({ status: 200, body: manifestBody(1), etag: 'W/"1"' });
    const cache = new RulesCatalogCache(fakeUpstream({ fetchManifest }), 60_000);

    const first = await cache.getManifest(null);
    const second = await cache.getManifest(null);

    expect(first).toEqual({ status: 200, body: manifestBody(1), etag: 'W/"1"' });
    expect(second).toEqual(first);
    expect(fetchManifest).toHaveBeenCalledTimes(1);
  });

  it('answers a matching client ETag with 304 from cache without an upstream call', async () => {
    const fetchManifest = vi.fn().mockResolvedValue({ status: 200, body: manifestBody(1), etag: 'W/"1"' });
    const cache = new RulesCatalogCache(fakeUpstream({ fetchManifest }), 60_000);
    await cache.getManifest(null);

    const result = await cache.getManifest('W/"1"');

    expect(result).toEqual({ status: 304 });
    expect(fetchManifest).toHaveBeenCalledTimes(1);
  });

  it('revalidates upstream after the TTL and extends the cache on a 304', async () => {
    const fetchManifest = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, body: manifestBody(1), etag: 'W/"1"' })
      .mockResolvedValueOnce({ status: 304, etag: 'W/"1"' });
    const cache = new RulesCatalogCache(fakeUpstream({ fetchManifest }), 0);

    await cache.getManifest(null);
    const second = await cache.getManifest(null);

    expect(second).toEqual({ status: 200, body: manifestBody(1), etag: 'W/"1"' });
    expect(fetchManifest).toHaveBeenCalledTimes(2);
    expect(fetchManifest).toHaveBeenNthCalledWith(2, 'W/"1"');
  });

  it('returns 503 when the upstream call fails, and does not throw', async () => {
    const cache = new RulesCatalogCache(
      fakeUpstream({ fetchManifest: vi.fn().mockRejectedValue(new Error('doc-api unreachable')) }),
      60_000,
    );

    await expect(cache.getManifest(null)).resolves.toEqual({ status: 503 });
  });

  it('returns 503 when the upstream omits an ETag instead of caching an unrevalidatable entry', async () => {
    const cache = new RulesCatalogCache(
      fakeUpstream({ fetchManifest: vi.fn().mockResolvedValue({ status: 200, body: manifestBody(1), etag: null }) }),
      60_000,
    );

    await expect(cache.getManifest(null)).resolves.toEqual({ status: 503 });
  });

  it('keys entities cache entries by the fixed type/ruleset/since combination', async () => {
    const fetchEntities = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, body: entitiesBody(1), etag: 'W/"a"' })
      .mockResolvedValueOnce({ status: 200, body: entitiesBody(2), etag: 'W/"b"' });
    const cache = new RulesCatalogCache(fakeUpstream({ fetchEntities }), 60_000);

    const spells = await cache.getEntities({ type: 'spell', since: 0 }, null);
    const items = await cache.getEntities({ type: 'item', since: 0 }, null);
    const spellsAgain = await cache.getEntities({ type: 'spell', since: 0 }, null);

    expect(spells).toEqual({ status: 200, body: entitiesBody(1), etag: 'W/"a"' });
    expect(items).toEqual({ status: 200, body: entitiesBody(2), etag: 'W/"b"' });
    expect(spellsAgain).toEqual(spells);
    expect(fetchEntities).toHaveBeenCalledTimes(2);
  });

  it('bounds the entities cache and evicts the least recently used query', async () => {
    const fetchEntities = vi.fn(async (query: { since: number }) => ({
      status: 200 as const,
      body: entitiesBody(100, query.since),
      etag: `W/"100-${query.since}"`,
    }));
    const cache = new RulesCatalogCache(fakeUpstream({ fetchEntities }), 60_000, 3);

    for (const since of [0, 1, 2]) await cache.getEntities({ since }, null);
    // Touch since=0 so since=1 becomes the least recently used.
    await cache.getEntities({ since: 0 }, null);
    expect(fetchEntities).toHaveBeenCalledTimes(3);
    await cache.getEntities({ since: 3 }, null);
    expect(cache.entitiesCacheSize).toBe(3);

    await cache.getEntities({ since: 0 }, null);
    expect(fetchEntities).toHaveBeenCalledTimes(4);
    await cache.getEntities({ since: 1 }, null);
    expect(fetchEntities).toHaveBeenCalledTimes(5);
  });

  it('never grows past the default bound under many distinct since values', async () => {
    const fetchEntities = vi.fn(async (query: { since: number }) => ({
      status: 200 as const,
      body: entitiesBody(1_000, query.since),
      etag: `W/"1000-${query.since}"`,
    }));
    const cache = new RulesCatalogCache(fakeUpstream({ fetchEntities }), 60_000);
    for (let since = 0; since < 500; since++) await cache.getEntities({ since }, null);
    expect(cache.entitiesCacheSize).toBe(DEFAULT_MAX_ENTITIES_ENTRIES);
  });

  it('answers but never caches a since beyond the published catalog version', async () => {
    const fetchEntities = vi.fn(async (query: { since: number }) => ({
      status: 200 as const,
      body: entitiesBody(5, query.since),
      etag: `W/"5-${query.since}"`,
    }));
    const cache = new RulesCatalogCache(fakeUpstream({ fetchEntities }), 60_000);

    for (const since of [6, 9_007_199_254_740_991, 6]) {
      const result = await cache.getEntities({ since }, null);
      expect(result).toMatchObject({ status: 200 });
    }
    expect(fetchEntities).toHaveBeenCalledTimes(3);
    expect(cache.entitiesCacheSize).toBe(0);

    await cache.getEntities({ since: 5 }, null);
    await cache.getEntities({ since: 5 }, null);
    expect(fetchEntities).toHaveBeenCalledTimes(4);
    expect(cache.entitiesCacheSize).toBe(1);
  });

  it('still revalidates an expired entry with its ETag after LRU bookkeeping', async () => {
    const fetchEntities = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, body: entitiesBody(2), etag: 'W/"a"' })
      .mockResolvedValueOnce({ status: 304, etag: 'W/"a"' });
    const cache = new RulesCatalogCache(fakeUpstream({ fetchEntities }), 0);

    await cache.getEntities({ since: 0 }, null);
    const second = await cache.getEntities({ since: 0 }, null);

    expect(second).toEqual({ status: 200, body: entitiesBody(2), etag: 'W/"a"' });
    expect(fetchEntities).toHaveBeenNthCalledWith(2, { since: 0 }, 'W/"a"');
    expect(cache.entitiesCacheSize).toBe(1);
  });

  it('returns 503 for entities when doc-api is down', async () => {
    const cache = new RulesCatalogCache(
      fakeUpstream({ fetchEntities: vi.fn().mockRejectedValue(new Error('timeout')) }),
      60_000,
    );

    await expect(cache.getEntities({ since: 0 }, null)).resolves.toEqual({ status: 503 });
  });
});
