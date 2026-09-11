import {
  atlasOffset,
  errorMessage,
  type AtlasCursor,
  type AtlasSourceAdapter,
  type PaginatedResult,
} from './types';
import { documentService } from '@/services/documentService';

export class CodexSourceAdapter implements AtlasSourceAdapter {
  source = 'codex' as const;
  isOffline = false;

  async search(
    query: string,
    cursor?: AtlasCursor,
    _signal?: AbortSignal,
    category?: string,
  ): Promise<PaginatedResult> {
    try {
      if (category && category !== 'all') {
        return { assets: [], hasMore: false, total: 0 };
      }

      const skip = atlasOffset(cursor);
      const limit = 20;
      const result = await documentService.searchDocuments({
        query,
        tags: [],
        from: skip,
        size: limit,
      });

      const assets = result.results.map((doc) => ({
        id: `codex:${doc.documentId}`,
        source: this.source,
        name: doc.source.title,
        thumbnailUrl: `/api/documents/${doc.documentId}/thumbnail`,
        resolveFullAsset: async () =>
          `/api/documents/${doc.documentId}/content`,
        tags: doc.source.tags,
      }));

      this.isOffline = false;
      return {
        assets,
        hasMore: skip + limit < result.total,
        total: result.total,
      };
    } catch (error: unknown) {
      const message = errorMessage(error);
      if (message.includes('503') || message.includes('fetch')) {
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
      const skip = atlasOffset(cursor);
      const limit = 20;
      const result = await documentService.listDocuments({ skip, limit });

      const assets = result.documents.map((doc) => ({
        id: `codex:${doc.id}`,
        source: this.source,
        name: doc.title,
        thumbnailUrl: `/api/documents/${doc.id}/thumbnail`,
        resolveFullAsset: async () => `/api/documents/${doc.id}/content`,
        tags: doc.tags,
      }));

      this.isOffline = false;
      return {
        assets,
        hasMore: skip + limit < result.pagination.total,
        total: result.pagination.total,
      };
    } catch (error: unknown) {
      const message = errorMessage(error);
      if (message.includes('503') || message.includes('fetch')) {
        this.isOffline = true;
        return { assets: [], hasMore: false, total: 0 };
      }
      throw error;
    }
  }
}
