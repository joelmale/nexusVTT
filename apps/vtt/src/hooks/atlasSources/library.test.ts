import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LibrarySourceAdapter } from './library';

describe('LibrarySourceAdapter', () => {
  let adapter: LibrarySourceAdapter;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    adapter = new LibrarySourceAdapter();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('maps a /library list response to AtlasAsset with correct /library-assets URLs', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        assets: [
          {
            id: 'tmt-abc123',
            name: 'Goblin Scout',
            category: 'Goblin',
            tags: ['goblin', 'humanoid'],
            thumbnail: 'derivatives/ab/hash1.webp',
            fullImage: 'blobs/ab/hash1.png',
            size: 12345,
            sha256: 'hash1',
            source: 'tmt',
            dimensions: { width: 256, height: 256 },
            sourcePath: 'goblins/scout.png',
          },
        ],
        total: 1,
        limit: 20,
        cursor: null,
        hasMore: false,
      }),
    });

    const result = await adapter.list('all');

    expect(result.assets).toHaveLength(1);
    const asset = result.assets[0];
    expect(asset.id).toBe('library:tmt-abc123');
    expect(asset.source).toBe('library');
    expect(asset.name).toBe('Goblin Scout');
    expect(asset.category).toBe('Goblin');
    expect(asset.tags).toEqual(['goblin', 'humanoid']);
    expect(asset.width).toBe(256);
    expect(asset.height).toBe(256);
    expect(asset.thumbnailUrl).toBe('http://localhost:5001/library-assets/derivatives/ab/hash1.webp');
    await expect(asset.resolveFullAsset()).resolves.toBe(
      'http://localhost:5001/library-assets/blobs/ab/hash1.png',
    );
    expect(result.hasMore).toBe(false);
    expect(adapter.isOffline).toBe(false);
  });

  it('passes the opaque cursor through verbatim on list() and search()', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ assets: [], total: 0, limit: 20, cursor: 'MjA=', hasMore: true }),
    });

    const result = await adapter.list('Goblin', 'abc123cursor');
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('cursor=abc123cursor');
    expect(calledUrl).toContain('category=Goblin');
    expect(result.cursor).toBe('MjA=');
    expect(result.hasMore).toBe(true);

    fetchSpy.mockClear();
    await adapter.search('goblin', 'MjA=');
    const searchUrl = fetchSpy.mock.calls[0][0] as string;
    expect(searchUrl).toContain('q=goblin');
    expect(searchUrl).toContain('cursor=MjA%3D');

    fetchSpy.mockClear();
    await adapter.search('goblin', undefined, undefined, 'Goblin');
    const filteredSearchUrl = fetchSpy.mock.calls[0][0] as string;
    expect(filteredSearchUrl).toContain('q=goblin');
    expect(filteredSearchUrl).toContain('category=Goblin');
  });

  it('omits the cursor param on the initial request', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ assets: [], total: 0, limit: 20, cursor: null, hasMore: false }),
    });

    await adapter.list('all');
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('cursor=');
  });

  it('sets isOffline and returns an empty result on 503 source-unavailable', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'source-unavailable', message: 'Library manifest not loaded' }),
    });

    const result = await adapter.list('all');

    expect(result).toEqual({ assets: [], hasMore: false, total: 0, cursor: null });
    expect(adapter.isOffline).toBe(true);
  });

  it('sets isOffline on a network error (fetch throws)', async () => {
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await adapter.search('goblin');

    expect(result).toEqual({ assets: [], hasMore: false, total: 0, cursor: null });
    expect(adapter.isOffline).toBe(true);
  });

  it('fetchFacets returns categories/tags and marks offline on 503', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        categories: [{ name: 'Goblin', count: 42 }],
        tags: [{ name: 'undead', count: 812 }],
      }),
    });

    const facets = await adapter.fetchFacets();
    expect(facets.categories).toEqual([{ name: 'Goblin', count: 42 }]);
    expect(facets.tags).toEqual([{ name: 'undead', count: 812 }]);

    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: 'source-unavailable' }),
    });
    const offlineFacets = await adapter.fetchFacets();
    expect(offlineFacets).toEqual({ categories: [], tags: [] });
    expect(adapter.isOffline).toBe(true);
  });
});
