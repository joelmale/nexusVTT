import { AtlasSourceAdapter, PaginatedResult } from './types';
import { documentService } from '@/services/documentService';

export class CodexSourceAdapter implements AtlasSourceAdapter {
  source = 'codex' as const;
  isOffline = false;

  async search(query: string, cursor?: any, _signal?: AbortSignal): Promise<PaginatedResult> {
    try {
      const skip = cursor || 0;
      const limit = 20;
      // In MVP, we might just list and filter, or use search if the API supports it
      const result = await documentService.searchDocuments({ query, tags: [] });
      
      // Document service doesn't return paginated search in this stub, so we paginate locally
      const assets = result.documents.slice(skip, skip + limit).map(doc => ({
        id: `codex:${doc.id}`,
        source: this.source,
        name: doc.title,
        thumbnailUrl: `/api/documents/${doc.id}/thumbnail`,
        resolveFullAsset: async () => {
          return `/api/documents/${doc.id}/content`;
        },
        tags: doc.tags
      }));

      this.isOffline = false;
      return {
        assets,
        hasMore: skip + limit < result.documents.length,
        total: result.documents.length
      };
    } catch (err: any) {
      if (err.message?.includes('503') || err.message?.includes('fetch')) {
        this.isOffline = true;
        return { assets: [], hasMore: false, total: 0 };
      }
      throw err;
    }
  }

  async list(category: string, cursor?: any, _signal?: AbortSignal): Promise<PaginatedResult> {
    try {
      const skip = cursor || 0;
      const limit = 20;
      const result = await documentService.listDocuments({ skip, limit });
      
      const assets = result.documents.map(doc => ({
        id: `codex:${doc.id}`,
        source: this.source,
        name: doc.title,
        thumbnailUrl: `/api/documents/${doc.id}/thumbnail`,
        resolveFullAsset: async () => `/api/documents/${doc.id}/content`,
        tags: doc.tags
      }));

      this.isOffline = false;
      return {
        assets,
        hasMore: skip + limit < result.pagination.total,
        total: result.pagination.total
      };
    } catch (err: any) {
      if (err.message?.includes('503') || err.message?.includes('fetch')) {
        this.isOffline = true;
        return { assets: [], hasMore: false, total: 0 };
      }
      throw err;
    }
  }
}
