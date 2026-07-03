import { AtlasSourceAdapter, PaginatedResult, AtlasAsset } from './types';
import { propAssetManager } from '@/services/propAssets';

export class PropsSourceAdapter implements AtlasSourceAdapter {
  source = 'props' as const;
  isOffline = false;

  async initIfNeeded() {
    if (!(propAssetManager as any).isInitialized) {
      await propAssetManager.initialize();
    }
  }

  async search(query: string, cursor?: any, _signal?: AbortSignal): Promise<PaginatedResult> {
    await this.initIfNeeded();
    const results = propAssetManager.searchProps(query);
    
    const skip = cursor || 0;
    const limit = 20;
    const page = results.slice(skip, skip + limit);
    
    const assets: AtlasAsset[] = page.map(p => ({
      id: `props:${p.id}`,
      source: this.source,
      name: p.name,
      thumbnailUrl: p.image,
      resolveFullAsset: async () => p.image,
      tags: p.tags,
      category: p.category
    }));

    return {
      assets,
      hasMore: skip + limit < results.length,
      total: results.length
    };
  }

  async list(category: string, cursor?: any, _signal?: AbortSignal): Promise<PaginatedResult> {
    await this.initIfNeeded();
    const results = category === 'all' || !category 
      ? propAssetManager.getAllProps()
      : propAssetManager.getPropsByCategory(category as any);
      
    const skip = cursor || 0;
    const limit = 20;
    const page = results.slice(skip, skip + limit);
    
    const assets: AtlasAsset[] = page.map(p => ({
      id: `props:${p.id}`,
      source: this.source,
      name: p.name,
      thumbnailUrl: p.image,
      resolveFullAsset: async () => p.image,
      tags: p.tags,
      category: p.category
    }));

    return {
      assets,
      hasMore: skip + limit < results.length,
      total: results.length
    };
  }
}
