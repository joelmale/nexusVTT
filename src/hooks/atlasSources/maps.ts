import { AtlasSourceAdapter, PaginatedResult, AtlasAsset } from './types';
import { assetManager } from '@/services/assetManager';

export class MapsSourceAdapter implements AtlasSourceAdapter {
  source = 'maps' as const;
  isOffline = false;

  async search(query: string, cursor?: any, _signal?: AbortSignal): Promise<PaginatedResult> {
    try {
      const results = await assetManager.searchAssets(query);
      
      const skip = cursor || 0;
      const limit = 20;
      const page = results.slice(skip, skip + limit);
      
      const assets: AtlasAsset[] = page.map(a => ({
        id: `maps:${a.id}`,
        source: this.source,
        name: a.name,
        thumbnailUrl: a.thumbnail,
        resolveFullAsset: async () => a.fullImage,
        tags: a.tags,
        category: a.category
      }));

      this.isOffline = false;
      return {
        assets,
        hasMore: skip + limit < results.length,
        total: results.length
      };
    } catch (err: any) {
      if (err.message?.includes('fetch') || err.message?.includes('network')) {
        this.isOffline = true;
        return { assets: [], hasMore: false, total: 0 };
      }
      throw err;
    }
  }

  async list(category: string, cursor?: any, _signal?: AbortSignal): Promise<PaginatedResult> {
    try {
      const pageNum = cursor || 0;
      const limit = 20;
      const result = await assetManager.getAssetsByCategory(category, pageNum, limit);
      
      const assets: AtlasAsset[] = result.assets.map((a: any) => ({
        id: `maps:${a.id}`,
        source: this.source,
        name: a.name,
        thumbnailUrl: a.thumbnail,
        resolveFullAsset: async () => a.fullImage,
        tags: a.tags,
        category: a.category
      }));

      this.isOffline = false;
      return {
        assets,
        hasMore: result.hasMore,
        // using next page as cursor
        total: result.total
      };
    } catch (err: any) {
      if (err.message?.includes('fetch') || err.message?.includes('network')) {
        this.isOffline = true;
        return { assets: [], hasMore: false, total: 0 };
      }
      throw err;
    }
  }
}
