// Asset management system for external map assets
import type {
  AssetMetadata,
  AssetManifest,
  AssetSearchResult,
  AssetCategoryResult,
} from '../../shared/types';
import type { Scene } from '@/types/game';

// Re-export types for use in components
export type {
  AssetMetadata,
  AssetManifest,
  AssetSearchResult,
  AssetCategoryResult,
};

// Asset server configuration
// In production, use relative path (nginx proxy handles routing)
// In development, use localhost with port
const ASSET_SERVER_URL = import.meta.env.DEV
  ? import.meta.env.VITE_ASSET_SERVER_URL || 'http://localhost:5001'
  : ''; // Empty string = relative URLs in production

/**
 * Asset Manager for handling external map assets efficiently
 */
export class AssetManager {
  private static instance: AssetManager;
  private manifest: AssetManifest | null = null;
  private cache = new Map<string, string>(); // assetId -> blob URL
  private loadingPromises = new Map<string, Promise<string>>();

  static getInstance(): AssetManager {
    if (!AssetManager.instance) {
      AssetManager.instance = new AssetManager();
    }
    return AssetManager.instance;
  }

  /**
   * Load the asset manifest from the asset server
   */
  async loadAssetManifest(): Promise<AssetManifest> {
    if (this.manifest) return this.manifest as AssetManifest;

    try {
      const response = await fetch(`${ASSET_SERVER_URL}/manifest.json`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const manifestData = await response.json();
      if (!manifestData) {
        throw new Error('Received empty manifest data from server');
      }
      return (this.manifest = manifestData);
    } catch (error) {
      console.error('Failed to load asset manifest:', error);
      // Fallback to empty manifest
      return {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        totalAssets: 0,
        categories: [],
        assets: [],
      };
    }
  }

  /**
   * Get assets by category with pagination
   */
  async getAssetsByCategory(
    category: string,
    page = 0,
    limit = 20,
  ): Promise<AssetCategoryResult> {
    try {
      const response = await fetch(
        `${ASSET_SERVER_URL}/category/${encodeURIComponent(category)}?page=${page}&limit=${limit}`,
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to get assets by category:', error);
      return {
        category,
        page,
        limit,
        assets: [],
        hasMore: false,
        total: 0,
      };
    }
  }

  /**
   * Search assets by name or tags
   */
  async searchAssets(query: string): Promise<AssetMetadata[]> {
    try {
      const response = await fetch(
        `${ASSET_SERVER_URL}/search?q=${encodeURIComponent(query)}`,
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result: AssetSearchResult = await response.json();
      return result.results;
    } catch (error) {
      console.error('Failed to search assets:', error);
      return [];
    }
  }

  /**
   * Load and cache a full-resolution asset
   */
  async loadAsset(assetId: string): Promise<string> {
    // Check memory cache first
    if (this.cache.has(assetId)) {
      return this.cache.get(assetId)!;
    }

    // Check if already loading
    if (this.loadingPromises.has(assetId)) {
      return this.loadingPromises.get(assetId)!;
    }

    // Check IndexedDB cache
    const cachedBlob = await this.getCachedAsset(assetId);
    if (cachedBlob) {
      const blobUrl = URL.createObjectURL(cachedBlob);
      this.cache.set(assetId, blobUrl);
      return blobUrl;
    }

    // Load from server
    const loadPromise = this.loadAssetFromServer(assetId);
    this.loadingPromises.set(assetId, loadPromise);

    try {
      const blobUrl = await loadPromise;
      this.cache.set(assetId, blobUrl);
      return blobUrl;
    } finally {
      this.loadingPromises.delete(assetId);
    }
  }

  /**
   * Load asset from server and cache it
   */
  private async loadAssetFromServer(assetId: string): Promise<string> {
    try {
      const response = await fetch(
        `${ASSET_SERVER_URL}/asset/${encodeURIComponent(assetId)}`,
      );
      if (!response.ok) {
        throw new Error(`Asset metadata not found: ${response.status}`);
      }

      const asset: AssetMetadata = await response.json();

      // Now fetch the actual image
      const imageResponse = await fetch(
        `${ASSET_SERVER_URL}/${asset.fullImage}`,
      );
      if (!imageResponse.ok) {
        throw new Error(`Failed to load asset image: ${imageResponse.status}`);
      }

      const blob = await imageResponse.blob();

      // Cache in IndexedDB for offline use
      await this.cacheAsset(assetId, blob);

      return URL.createObjectURL(blob);
    } catch (error) {
      console.error(`Failed to load asset ${assetId}:`, error);
      throw error;
    }
  }

  /**
   * Cache asset in IndexedDB
   */
  private async cacheAsset(assetId: string, blob: Blob): Promise<void> {
    try {
      const db = await this.openCacheDB();
      const transaction = db.transaction(['assets'], 'readwrite');
      const store = transaction.objectStore('assets');

      await store.put({
        id: assetId,
        blob: blob,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.warn('Failed to cache asset:', error);
    }
  }

  /**
   * Get cached asset from IndexedDB
   */
  private async getCachedAsset(assetId: string): Promise<Blob | null> {
    try {
      const db = await this.openCacheDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['assets'], 'readonly');
        const store = transaction.objectStore('assets');
        const request = store.get(assetId);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const result = request.result as
            | { id: string; blob: Blob; timestamp: number }
            | undefined;
          if (result && result.timestamp) {
            // Check if cache is expired (e.g., 7 days)
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
            if (Date.now() - result.timestamp > maxAge) {
              this.deleteCachedAsset(assetId).finally(() => resolve(null)); // Expired
            } else {
              resolve(result.blob); // Valid
            }
          } else {
            resolve(null); // Not found
          }
        };
      });
    } catch (error) {
      console.warn('Failed to get cached asset:', error);
      return null;
    }
  }

  /**
   * Open IndexedDB for asset caching
   */
  private async openCacheDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('NexusAssetCache', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('assets')) {
          db.createObjectStore('assets', { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Delete cached asset
   */
  private async deleteCachedAsset(assetId: string): Promise<void> {
    try {
      const db = await this.openCacheDB();
      const transaction = db.transaction(['assets'], 'readwrite');
      const store = transaction.objectStore('assets');
      await store.delete(assetId);
    } catch (error) {
      console.warn('Failed to delete cached asset:', error);
    }
  }

  /**
   * Get cache storage size
   */
  async getCacheSize(): Promise<number> {
    try {
      const db = await this.openCacheDB();
      const transaction = db.transaction(['assets'], 'readonly');
      const store = transaction.objectStore('assets');
      const request = store.getAll();

      return new Promise((resolve, reject) => {
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const assets = request.result;
          const totalSize = assets.reduce(
            (sum, asset) => sum + asset.blob.size,
            0,
          );
          resolve(totalSize);
        };
      });
    } catch (error) {
      console.warn('Failed to get cache size:', error);
      return 0;
    }
  }

  /**
   * Clear all cached assets
   */
  async clearCache(): Promise<void> {
    try {
      // Clear memory cache
      this.cache.forEach((blobUrl) => URL.revokeObjectURL(blobUrl));
      this.cache.clear();

      // Clear IndexedDB cache
      const db = await this.openCacheDB();
      const transaction = db.transaction(['assets'], 'readwrite');
      const store = transaction.objectStore('assets');
      await store.clear();
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  /**
   * Preload assets for a scene (for better performance)
   */
  async preloadSceneAssets(scene: Scene): Promise<void> {
    if (scene.backgroundImage?.url.startsWith('asset://')) {
      const assetId = scene.backgroundImage.url.replace('asset://', '');
      try {
        await this.loadAsset(assetId);
      } catch (error) {
        console.warn(`Failed to preload asset ${assetId}:`, error);
      }
    }
  }

  /**
   * Get available categories
   */
  async getCategories(): Promise<string[]> {
    const manifest = await this.loadAssetManifest();
    return manifest.categories;
  }

  /**
   * Get thumbnail URL for immediate display
   */
  getThumbnailUrl(asset: AssetMetadata): string {
    return `${ASSET_SERVER_URL}/${asset.thumbnail}`;
  }
}

// Export singleton instance
export const assetManager = AssetManager.getInstance();
