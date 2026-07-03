export interface AtlasAsset {
  id: string; // Format: 'source:id'
  source: 'codex' | 'maps' | 'tokens' | 'props' | 'user';
  name: string;
  thumbnailUrl: string;
  resolveFullAsset: () => Promise<string>;
  width?: number;
  height?: number;
  tags?: string[];
  category?: string;
}

export interface AtlasSourceError extends Error {
  source: AtlasAsset['source'];
  status?: number;
}

export interface PaginatedResult {
  assets: AtlasAsset[];
  hasMore: boolean;
  total?: number;
}

export interface AtlasSourceAdapter {
  source: AtlasAsset['source'];
  isOffline: boolean;
  search(query: string, cursor?: any, signal?: AbortSignal): Promise<PaginatedResult>;
  list(category: string, cursor?: any, signal?: AbortSignal): Promise<PaginatedResult>;
}
