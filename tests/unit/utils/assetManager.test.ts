import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AssetManager } from '@/services/assetManager';

// Mock fetch
global.fetch = vi.fn();

// Mock IndexedDB
const mockDb = {
  transaction: () => ({
    objectStore: () => ({
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      getAll: vi.fn(),
    }),
  }),
};

global.indexedDB = {
  open: vi.fn(() => ({
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null,
    result: mockDb,
  })),
} as unknown as IDBFactory;


describe('AssetManager', () => {
  let assetManager: AssetManager;

  beforeEach(() => {
    assetManager = new AssetManager(); // Create a new instance for each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadAssetManifest', () => {
    it('should load and return the asset manifest', async () => {
      const mockManifest = { version: '1.0', assets: [] };
      (fetch as vi.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockManifest),
      });

      const manifest = await assetManager.loadAssetManifest();

      expect(fetch).toHaveBeenCalledWith('http://localhost:5001/manifest.json');
      expect(manifest).toEqual(mockManifest);
    });

    it('should return an empty manifest on fetch failure', async () => {
      (fetch as vi.Mock).mockRejectedValue(new Error('Network error'));

      const manifest = await assetManager.loadAssetManifest();

      expect(manifest.totalAssets).toBe(0);
      expect(manifest.assets).toEqual([]);
    });
  });

  describe('getAssetsByCategory', () => {
    it('should fetch assets by category', async () => {
      const mockAssets = { assets: [{ id: '1', name: 'asset1' }] };
      (fetch as vi.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockAssets),
      });

      const result = await assetManager.getAssetsByCategory('maps');

      expect(fetch).toHaveBeenCalledWith('http://localhost:5001/category/maps?page=0&limit=20');
      expect(result).toEqual(mockAssets);
    });

    it('should return an empty result on fetch failure', async () => {
      (fetch as vi.Mock).mockRejectedValue(new Error('Network error'));

      const result = await assetManager.getAssetsByCategory('maps');

      expect(result.assets).toEqual([]);
    });
  });

  describe('searchAssets', () => {
    it('should search for assets', async () => {
      const mockResults = { results: [{ id: '1', name: 'asset1' }] };
      (fetch as vi.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResults),
      });

      const result = await assetManager.searchAssets('query');

      expect(fetch).toHaveBeenCalledWith('http://localhost:5001/search?q=query');
      expect(result).toEqual(mockResults.results);
    });

    it('should return an empty array on fetch failure', async () => {
      (fetch as vi.Mock).mockRejectedValue(new Error('Network error'));

      const result = await assetManager.searchAssets('query');

      expect(result).toEqual([]);
    });
  });

  describe('loadAsset', () => {
    it('should load an asset from the server and cache it in memory', async () => {
      const mockAssetMetadata = { fullImage: 'path/to/image.png' };
      const mockBlob = new Blob(['image data'], { type: 'image/png' });
      global.URL.createObjectURL = vi.fn(() => 'blob:url');

      // Mock the private methods that use IndexedDB
      vi.spyOn(assetManager, 'getCachedAsset').mockResolvedValue(null);
      vi.spyOn(assetManager, 'cacheAsset').mockResolvedValue(undefined);

      (fetch as vi.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockAssetMetadata),
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: () => Promise.resolve(mockBlob),
        });

      const result = await assetManager.loadAsset('asset1');

      expect(fetch).toHaveBeenCalledWith('http://localhost:5001/asset/asset1');
      expect(fetch).toHaveBeenCalledWith('http://localhost:5001/path/to/image.png');
      expect(result).toBe('blob:url');

      // Check in-memory cache
      const cachedResult = await assetManager.loadAsset('asset1');
      expect(cachedResult).toBe('blob:url');
      expect(fetch).toHaveBeenCalledTimes(2); // Should not fetch again
    });
  });
});