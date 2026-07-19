import {
  atlasOffset,
  errorMessage,
  type AtlasAsset,
  type AtlasCursor,
  type AtlasSourceAdapter,
  type PaginatedResult,
} from './types';
import { assetManager } from '@/services/assetManager';

export class MapsSourceAdapter implements AtlasSourceAdapter {
  source = 'maps' as const;
  isOffline = false;

  async search(
    query: string,
    cursor?: AtlasCursor,
    _signal?: AbortSignal,
    category?: string,
  ): Promise<PaginatedResult> {
    try {
      const searchResults = await assetManager.searchAssets(query);
      const results =
        category && category !== 'all'
          ? searchResults.filter((asset) => asset.category === category)
          : searchResults;

      const skip = atlasOffset(cursor);
      const limit = 20;
      const page = results.slice(skip, skip + limit);

      const assets: AtlasAsset[] = page.map((a) => ({
        id: `maps:${a.id}`,
        source: this.source,
        name: a.name,
        thumbnailUrl: assetManager.getThumbnailUrl(a),
        resolveFullAsset: async () => assetManager.getFullImageUrl(a),
        tags: a.tags,
        category: a.category,
      }));

      this.isOffline = false;
      return {
        assets,
        hasMore: skip + limit < results.length,
        total: results.length,
      };
    } catch (error: unknown) {
      const message = errorMessage(error);
      if (message.includes('fetch') || message.includes('network')) {
        this.isOffline = true;
        return { assets: [], hasMore: false, total: 0 };
      }
      throw error;
    }
  }

  async list(
    category: string,
    cursor?: AtlasCursor,
    _signal?: AbortSignal,
  ): Promise<PaginatedResult> {
    try {
      const pageNum = atlasOffset(cursor);
      const limit = 20;
      const result = await assetManager.getAssetsByCategory(
        category,
        pageNum,
        limit,
      );

      const assets: AtlasAsset[] = result.assets.map((a) => ({
        id: `maps:${a.id}`,
        source: this.source,
        name: a.name,
        thumbnailUrl: assetManager.getThumbnailUrl(a),
        resolveFullAsset: async () => assetManager.getFullImageUrl(a),
        tags: a.tags,
        category: a.category,
      }));

      this.isOffline = false;
      return {
        assets,
        hasMore: result.hasMore,
        // using next page as cursor
        total: result.total,
      };
    } catch (error: unknown) {
      const message = errorMessage(error);
      if (message.includes('fetch') || message.includes('network')) {
        this.isOffline = true;
        return { assets: [], hasMore: false, total: 0 };
      }
      throw error;
    }
  }
}
