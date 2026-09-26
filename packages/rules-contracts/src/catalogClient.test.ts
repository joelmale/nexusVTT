import { describe, expect, it, vi } from 'vitest';
import {
  createBrowserCatalogStorage,
  createHttpCatalogTransport,
  createInMemoryCatalogStorage,
  overlayCatalog,
  parseStoredRulesCatalogState,
  RulesCatalogClient,
  type CatalogEntitiesFetchResult,
  type CatalogManifestFetchResult,
  type RulesCatalogTransport,
  type SyncKeyValueStorage,
} from './catalogClient.js';
import type { CatalogEntity, CatalogRemovedEntity } from './entity.js';

function makeEntity(overrides: Partial<CatalogEntity> & { slug: string }): CatalogEntity {
  return {
    id: `id-${overrides.slug}`,
    entityType: 'spell',
    ruleset: '2014',
    schemaVersion: 1,
    revisionId: `rev-${overrides.slug}`,
    revisionNumber: 1,
    catalogVersion: 1,
    publishedAt: '2026-01-01T00:00:00.000Z',
    sourceLicense: 'CC-BY-4.0',
    sourceDocumentId: null,
    summary: 'test entity',
    data: { name: overrides.slug } as unknown as CatalogEntity['data'],
    ...overrides,
  };
}

function makeRemoved(overrides: Partial<CatalogRemovedEntity> & { slug: string }): CatalogRemovedEntity {
  return {
    id: `id-${overrides.slug}`,
    entityType: 'spell',
    ruleset: '2014',
    catalogVersion: 1,
    ...overrides,
  };
}

interface BundledSpell {
  slug: string;
  name: string;
}

describe('overlayCatalog', () => {
  const bundled: BundledSpell[] = [
    { slug: 'fireball', name: 'Fireball (SRD)' },
    { slug: 'magic-missile', name: 'Magic Missile (SRD)' },
  ];

  function overlay(published: CatalogEntity[], removed: CatalogRemovedEntity[] = []) {
    return overlayCatalog<BundledSpell>({
      entityType: 'spell',
      ruleset: '2014',
      bundled,
      keyOf: (item) => item.slug,
      published,
      removed,
      fromCatalogEntity: (entity) => ({ slug: entity.slug, name: (entity.data as { name: string }).name }),
    });
  }

  it('replaces a bundled item with a published revision of the same slug', () => {
    const result = overlay([makeEntity({ slug: 'fireball', data: { name: 'Fireball (Published)' } as never })]);
    expect(result).toEqual([
      { slug: 'fireball', name: 'Fireball (Published)' },
      { slug: 'magic-missile', name: 'Magic Missile (SRD)' },
    ]);
  });

  it('appends custom published content with no bundled counterpart', () => {
    const result = overlay([makeEntity({ slug: 'homebrew-bolt', data: { name: 'Homebrew Bolt' } as never })]);
    expect(result).toEqual([
      { slug: 'fireball', name: 'Fireball (SRD)' },
      { slug: 'magic-missile', name: 'Magic Missile (SRD)' },
      { slug: 'homebrew-bolt', name: 'Homebrew Bolt' },
    ]);
  });

  it('hides a bundled slug that was archived and never republished', () => {
    const result = overlay([], [makeRemoved({ slug: 'fireball' })]);
    expect(result).toEqual([{ slug: 'magic-missile', name: 'Magic Missile (SRD)' }]);
  });

  it('lets a live publish win over a stale removal tombstone for the same slug', () => {
    const result = overlay(
      [makeEntity({ slug: 'fireball', data: { name: 'Fireball (Republished)' } as never })],
      [makeRemoved({ slug: 'fireball' })],
    );
    expect(result).toEqual([
      { slug: 'fireball', name: 'Fireball (Republished)' },
      { slug: 'magic-missile', name: 'Magic Missile (SRD)' },
    ]);
  });

  it('ignores published entities and tombstones of a different entityType or ruleset', () => {
    const result = overlay(
      [makeEntity({ slug: 'fireball', ruleset: '2024', data: { name: 'wrong ruleset' } as never })],
      [makeRemoved({ slug: 'magic-missile', entityType: 'item' })],
    );
    expect(result).toEqual(bundled);
  });
});

describe('parseStoredRulesCatalogState', () => {
  it('accepts a well-formed state', () => {
    const entity = makeEntity({ slug: 'fireball' });
    const state = {
      catalogVersion: 3,
      manifestEtag: 'W/"3"',
      entities: { [entity.id]: entity },
      removed: {},
    };
    expect(parseStoredRulesCatalogState(state)).toEqual(state);
  });

  it('rejects garbage shapes instead of throwing', () => {
    expect(parseStoredRulesCatalogState('not even an object')).toBeNull();
    expect(parseStoredRulesCatalogState({ catalogVersion: 'nope' })).toBeNull();
    expect(parseStoredRulesCatalogState(null)).toBeNull();
    expect(parseStoredRulesCatalogState(undefined)).toBeNull();
  });
});

describe('createInMemoryCatalogStorage', () => {
  it('round-trips state and clears it', async () => {
    const storage = createInMemoryCatalogStorage();
    expect(await storage.load()).toBeNull();

    const state = { catalogVersion: 1, manifestEtag: null, entities: {}, removed: {} };
    await storage.save(state);
    expect(await storage.load()).toEqual(state);

    await storage.clear();
    expect(await storage.load()).toBeNull();
  });
});

function createFakeLocalStorage(): SyncKeyValueStorage & { backing: Map<string, string> } {
  const backing = new Map<string, string>();
  return {
    backing,
    getItem: (key) => backing.get(key) ?? null,
    setItem: (key, value) => {
      backing.set(key, value);
    },
    removeItem: (key) => {
      backing.delete(key);
    },
  };
}

describe('createBrowserCatalogStorage', () => {
  it('round-trips through JSON', async () => {
    const fake = createFakeLocalStorage();
    const storage = createBrowserCatalogStorage(fake);
    const state = { catalogVersion: 2, manifestEtag: 'W/"2"', entities: {}, removed: {} };
    await storage.save(state);
    expect(await storage.load()).toEqual(state);
  });

  it('treats corrupted JSON as an empty cache instead of throwing', async () => {
    const fake = createFakeLocalStorage();
    fake.backing.set('nexus-rules-catalog', '{not json');
    const storage = createBrowserCatalogStorage(fake);
    await expect(storage.load()).resolves.toBeNull();
  });

  it('treats a well-formed but schema-invalid payload as an empty cache', async () => {
    const fake = createFakeLocalStorage();
    fake.backing.set('nexus-rules-catalog', JSON.stringify({ catalogVersion: 'nope' }));
    const storage = createBrowserCatalogStorage(fake);
    await expect(storage.load()).resolves.toBeNull();
  });

  it('swallows a quota-exceeded save instead of throwing', async () => {
    const fake = createFakeLocalStorage();
    fake.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const storage = createBrowserCatalogStorage(fake);
    await expect(
      storage.save({ catalogVersion: 1, manifestEtag: null, entities: {}, removed: {} }),
    ).resolves.toBeUndefined();
  });
});

function makeManifestResult(catalogVersion: number, etag: string): CatalogManifestFetchResult {
  return {
    status: 200,
    etag,
    manifest: { catalogVersion, publishedAt: '2026-01-01T00:00:00.000Z', etag, counts: {} as never },
  };
}

describe('RulesCatalogClient.sync', () => {
  it('applies the first full sync and reports "updated"', async () => {
    const storage = createInMemoryCatalogStorage();
    const entity = makeEntity({ slug: 'fireball' });
    const transport: RulesCatalogTransport = {
      fetchManifest: vi.fn(async () => makeManifestResult(1, 'W/"1"')),
      fetchEntities: vi.fn(
        async (): Promise<CatalogEntitiesFetchResult> => ({
          status: 200,
          etag: 'W/"1"',
          entities: { catalogVersion: 1, since: 0, entities: [entity], removed: [], skipped: [] },
        }),
      ),
    };
    const client = new RulesCatalogClient({ storage, transport });

    const result = await client.sync();

    expect(result.status).toBe('updated');
    expect(result.catalogVersion).toBe(1);
    expect(result.entities).toEqual([entity]);
    expect(transport.fetchEntities).toHaveBeenCalledWith({ since: 0 }, null);
  });

  it('reports "unchanged" and skips the entities fetch on a 304 manifest', async () => {
    const storage = createInMemoryCatalogStorage();
    await storage.save({ catalogVersion: 1, manifestEtag: 'W/"1"', entities: {}, removed: {} });
    const fetchEntities = vi.fn();
    const transport: RulesCatalogTransport = {
      fetchManifest: vi.fn(async (): Promise<CatalogManifestFetchResult> => ({ status: 304, etag: 'W/"1"' })),
      fetchEntities,
    };
    const client = new RulesCatalogClient({ storage, transport });

    const result = await client.sync();

    expect(result.status).toBe('unchanged');
    expect(result.catalogVersion).toBe(1);
    expect(fetchEntities).not.toHaveBeenCalled();
  });

  it('reports "unchanged" when the manifest catalogVersion has not advanced', async () => {
    const storage = createInMemoryCatalogStorage();
    await storage.save({ catalogVersion: 1, manifestEtag: 'W/"1"', entities: {}, removed: {} });
    const fetchEntities = vi.fn();
    const transport: RulesCatalogTransport = {
      fetchManifest: vi.fn(async () => makeManifestResult(1, 'W/"1"')),
      fetchEntities,
    };
    const client = new RulesCatalogClient({ storage, transport });

    const result = await client.sync();

    expect(result.status).toBe('unchanged');
    expect(fetchEntities).not.toHaveBeenCalled();
  });

  it('fetches the delta since the last applied version and applies removals', async () => {
    const existing = makeEntity({ slug: 'existing-spell' });
    const storage = createInMemoryCatalogStorage();
    await storage.save({
      catalogVersion: 1,
      manifestEtag: 'W/"1"',
      entities: { [existing.id]: existing },
      removed: {},
    });
    const added = makeEntity({ slug: 'new-spell' });
    const tombstone = makeRemoved({ slug: 'existing-spell', id: existing.id });
    const transport: RulesCatalogTransport = {
      fetchManifest: vi.fn(async () => makeManifestResult(2, 'W/"2"')),
      fetchEntities: vi.fn(async () => ({
        status: 200 as const,
        etag: 'W/"2"',
        entities: { catalogVersion: 2, since: 1, entities: [added], removed: [tombstone], skipped: [] },
      })),
    };
    const client = new RulesCatalogClient({ storage, transport });

    const result = await client.sync();

    expect(result.status).toBe('updated');
    expect(result.catalogVersion).toBe(2);
    expect(result.entities).toEqual([added]);
    expect(result.removed).toEqual([tombstone]);
    expect(transport.fetchEntities).toHaveBeenCalledWith({ since: 1 }, null);
  });

  it('leaves skipped rows out of both entities and removed (keeps whatever was cached)', async () => {
    const cached = makeEntity({ slug: 'stale-schema-spell' });
    const storage = createInMemoryCatalogStorage();
    await storage.save({
      catalogVersion: 1,
      manifestEtag: 'W/"1"',
      entities: { [cached.id]: cached },
      removed: {},
    });
    const transport: RulesCatalogTransport = {
      fetchManifest: vi.fn(async () => makeManifestResult(2, 'W/"2"')),
      fetchEntities: vi.fn(async () => ({
        status: 200 as const,
        etag: 'W/"2"',
        entities: {
          catalogVersion: 2,
          since: 1,
          entities: [],
          removed: [],
          skipped: [
            {
              id: cached.id,
              entityType: 'spell' as const,
              ruleset: '2014' as const,
              slug: cached.slug,
              revisionId: 'rev-x',
              reason: 'bad data',
            },
          ],
        },
      })),
    };
    const client = new RulesCatalogClient({ storage, transport });

    const result = await client.sync();

    expect(result.entities).toEqual([cached]);
    expect(result.removed).toEqual([]);
  });

  it('falls back to "offline" without mutating the cache when the manifest fetch throws', async () => {
    const storage = createInMemoryCatalogStorage();
    const cached = makeEntity({ slug: 'cached-spell' });
    await storage.save({ catalogVersion: 5, manifestEtag: 'W/"5"', entities: { [cached.id]: cached }, removed: {} });
    const onError = vi.fn();
    const transport: RulesCatalogTransport = {
      fetchManifest: vi.fn(async () => {
        throw new Error('network down');
      }),
      fetchEntities: vi.fn(),
    };
    const client = new RulesCatalogClient({ storage, transport, onError });

    const result = await client.sync();

    expect(result.status).toBe('offline');
    expect(result.catalogVersion).toBe(5);
    expect(result.entities).toEqual([cached]);
    expect(onError).toHaveBeenCalled();
    // The cache on disk must still be exactly what it was before the failed sync.
    expect(await storage.load()).toEqual({
      catalogVersion: 5,
      manifestEtag: 'W/"5"',
      entities: { [cached.id]: cached },
      removed: {},
    });
  });

  it('falls back to "offline" without a partial write when the entities fetch throws after a version bump', async () => {
    const storage = createInMemoryCatalogStorage();
    await storage.save({ catalogVersion: 1, manifestEtag: 'W/"1"', entities: {}, removed: {} });
    const transport: RulesCatalogTransport = {
      fetchManifest: vi.fn(async () => makeManifestResult(2, 'W/"2"')),
      fetchEntities: vi.fn(async () => {
        throw new Error('timeout');
      }),
    };
    const client = new RulesCatalogClient({ storage, transport });

    const result = await client.sync();

    expect(result.status).toBe('offline');
    expect(result.catalogVersion).toBe(1);
    expect(await storage.load()).toEqual({ catalogVersion: 1, manifestEtag: 'W/"1"', entities: {}, removed: {} });
  });

  it('starts from bundled-only behavior (empty result) when nothing has ever synced and the transport is unreachable', async () => {
    const storage = createInMemoryCatalogStorage();
    const transport: RulesCatalogTransport = {
      fetchManifest: vi.fn(async () => {
        throw new Error('offline');
      }),
      fetchEntities: vi.fn(),
    };
    const client = new RulesCatalogClient({ storage, transport });

    const result = await client.sync();

    expect(result.status).toBe('offline');
    expect(result.catalogVersion).toBe(0);
    expect(result.entities).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it('recovers from a corrupted on-disk cache by starting a fresh sync', async () => {
    const fake = createFakeLocalStorage();
    fake.backing.set('nexus-rules-catalog', 'not json at all');
    const storage = createBrowserCatalogStorage(fake);
    const entity = makeEntity({ slug: 'fireball' });
    const transport: RulesCatalogTransport = {
      fetchManifest: vi.fn(async () => makeManifestResult(1, 'W/"1"')),
      fetchEntities: vi.fn(async () => ({
        status: 200 as const,
        etag: 'W/"1"',
        entities: { catalogVersion: 1, since: 0, entities: [entity], removed: [], skipped: [] },
      })),
    };
    const client = new RulesCatalogClient({ storage, transport });

    const result = await client.sync();

    expect(result.status).toBe('updated');
    expect(result.entities).toEqual([entity]);
    // fetchEntities must have been called with since: 0, proving the corrupted
    // cache was treated as empty rather than partially trusted.
    expect(transport.fetchEntities).toHaveBeenCalledWith({ since: 0 }, null);
  });

  it('getCached returns the last-synced snapshot without contacting the transport', async () => {
    const storage = createInMemoryCatalogStorage();
    const entity = makeEntity({ slug: 'cached-only' });
    await storage.save({ catalogVersion: 1, manifestEtag: 'W/"1"', entities: { [entity.id]: entity }, removed: {} });
    const transport: RulesCatalogTransport = {
      fetchManifest: vi.fn(),
      fetchEntities: vi.fn(),
    };
    const client = new RulesCatalogClient({ storage, transport });

    const result = await client.getCached();

    expect(result.entities).toEqual([entity]);
    expect(transport.fetchManifest).not.toHaveBeenCalled();
  });
});

describe('createHttpCatalogTransport', () => {
  function makeFetchImpl(handler: (url: string, init?: RequestInit) => Promise<Response>): typeof fetch {
    return handler as unknown as typeof fetch;
  }

  it('sends If-None-Match and parses a 200 manifest response', async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    const fetchImpl = makeFetchImpl(async (url, init) => {
      calls.push({ url, headers: (init?.headers as Record<string, string>) ?? {} });
      return new Response(JSON.stringify({ catalogVersion: 4, publishedAt: null, etag: 'W/"4"', counts: {} }), {
        status: 200,
        headers: { etag: 'W/"4"' },
      });
    });
    const transport = createHttpCatalogTransport({ baseUrl: 'http://vtt.local/api', fetchImpl });

    const result = await transport.fetchManifest('W/"3"');

    expect(calls[0].url).toBe('http://vtt.local/api/rules/catalog/manifest');
    expect(calls[0].headers['If-None-Match']).toBe('W/"3"');
    expect(result.status).toBe(200);
    expect(result.manifest?.catalogVersion).toBe(4);
    expect(result.etag).toBe('W/"4"');
  });

  it('returns status 304 without a body when the server says unchanged', async () => {
    const fetchImpl = makeFetchImpl(async () => new Response(null, { status: 304, headers: { etag: 'W/"4"' } }));
    const transport = createHttpCatalogTransport({ baseUrl: 'http://vtt.local/api', fetchImpl });

    const result = await transport.fetchManifest('W/"4"');

    expect(result.status).toBe(304);
    expect(result.manifest).toBeUndefined();
  });

  it('builds the entities query string from fixed keys only', async () => {
    const calls: string[] = [];
    const fetchImpl = makeFetchImpl(async (url) => {
      calls.push(url);
      return new Response(
        JSON.stringify({ catalogVersion: 1, since: 0, entities: [], removed: [], skipped: [] }),
        { status: 200, headers: { etag: 'W/"1"' } },
      );
    });
    const transport = createHttpCatalogTransport({ baseUrl: 'http://vtt.local/api', fetchImpl });

    await transport.fetchEntities({ type: 'spell', ruleset: '2024', since: 7 }, null);

    expect(calls[0]).toBe('http://vtt.local/api/rules/catalog/entities?type=spell&ruleset=2024&since=7');
  });

  it('throws on a non-ok, non-304 response so the client can fall back to offline', async () => {
    const fetchImpl = makeFetchImpl(async () => new Response('boom', { status: 503 }));
    const transport = createHttpCatalogTransport({ baseUrl: 'http://vtt.local/api', fetchImpl });

    await expect(transport.fetchManifest(null)).rejects.toThrow('rules catalog request failed: 503');
  });
});
