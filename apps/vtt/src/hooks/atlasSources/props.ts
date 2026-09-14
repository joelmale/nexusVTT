import {
  atlasOffset,
  type AtlasAsset,
  type AtlasCursor,
  type AtlasSourceAdapter,
  type PaginatedResult,
} from './types';
import { propAssetManager } from '@/services/propAssets';
import { isPropCategory } from '@/types/prop';

export class PropsSourceAdapter implements AtlasSourceAdapter {
  source = 'props' as const;
  isOffline = false;

  async initIfNeeded(): Promise<void> {
    await propAssetManager.initialize();
  }

  async search(
    query: string,
    cursor?: AtlasCursor,
    _signal?: AbortSignal,
    category?: string,
  ): Promise<PaginatedResult> {
    await this.initIfNeeded();
    const searchResults = propAssetManager.searchProps(query);
    const results =
      category && category !== 'all'
        ? searchResults.filter((prop) => prop.category === category)
        : searchResults;

    const skip = atlasOffset(cursor);
    const limit = 20;
    const page = results.slice(skip, skip + limit);

    const assets: AtlasAsset[] = page.map((p) => ({
      id: `props:${p.id}`,
      source: this.source,
      name: p.name,
      thumbnailUrl: p.image,
      resolveFullAsset: async () => p.image,
      tags: p.tags,
      category: p.category,
    }));

    return {
      assets,
      hasMore: skip + limit < results.length,
      total: results.length,
    };
  }

  async list(
    category: string,
    cursor?: AtlasCursor,
    _signal?: AbortSignal,
  ): Promise<PaginatedResult> {
    await this.initIfNeeded();
    const results =
      category === 'all' || !category
        ? propAssetManager.getAllProps()
        : isPropCategory(category)
          ? propAssetManager.getPropsByCategory(category)
          : [];

    const skip = atlasOffset(cursor);
    const limit = 20;
    const page = results.slice(skip, skip + limit);

    const assets: AtlasAsset[] = page.map((p) => ({
      id: `props:${p.id}`,
      source: this.source,
      name: p.name,
      thumbnailUrl: p.image,
      resolveFullAsset: async () => p.image,
      tags: p.tags,
      category: p.category,
    }));

    return {
      assets,
      hasMore: skip + limit < results.length,
      total: results.length,
    };
  }
}
