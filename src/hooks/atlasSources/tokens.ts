import {
  atlasOffset,
  type AtlasAsset,
  type AtlasCursor,
  type AtlasSourceAdapter,
  type PaginatedResult,
} from './types';
import { tokenAssetManager } from '@/services/tokenAssets';
import { isTokenCategory } from '@/types/token';

export class TokensSourceAdapter implements AtlasSourceAdapter {
  source = 'tokens' as const;
  isOffline = false;

  async initIfNeeded(): Promise<void> {
    await tokenAssetManager.initialize();
  }

  async search(
    query: string,
    cursor?: AtlasCursor,
    _signal?: AbortSignal,
    category?: string,
  ): Promise<PaginatedResult> {
    await this.initIfNeeded();
    const searchResults = tokenAssetManager.searchTokens(query);
    const results =
      category && category !== 'all'
        ? searchResults.filter((token) => token.category === category)
        : searchResults;

    // Simulate pagination for local sync sources
    const skip = atlasOffset(cursor);
    const limit = 20;
    const page = results.slice(skip, skip + limit);

    const assets: AtlasAsset[] = page.map((t) => ({
      id: `tokens:${t.id}`,
      source: this.source,
      name: t.name,
      thumbnailUrl: t.image,
      resolveFullAsset: async () => t.image,
      tags: t.tags,
      category: t.category,
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
        ? tokenAssetManager.getAllTokens()
        : isTokenCategory(category)
          ? tokenAssetManager.getTokensByCategory(category)
          : [];

    const skip = atlasOffset(cursor);
    const limit = 20;
    const page = results.slice(skip, skip + limit);

    const assets: AtlasAsset[] = page.map((t) => ({
      id: `tokens:${t.id}`,
      source: this.source,
      name: t.name,
      thumbnailUrl: t.image,
      resolveFullAsset: async () => t.image,
      tags: t.tags,
      category: t.category,
    }));

    return {
      assets,
      hasMore: skip + limit < results.length,
      total: results.length,
    };
  }
}
