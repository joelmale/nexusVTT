export interface AtlasAsset {
  id: string; // Format: 'source:id'
  source: 'codex' | 'maps' | 'tokens' | 'props' | 'user' | 'library';
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
  /**
   * Opaque cursor for sources whose pagination isn't a numeric offset (e.g.
   * the Library/TMT adapter, which threads the asset service's base64url
   * cursor back verbatim). When present, callers must pass this value back
   * as the `cursor` argument on the next page request instead of computing
   * `skip + limit`. Numeric-offset sources (maps/tokens/props/codex) leave
   * this undefined and continue to use their own skip/limit math.
   */
  cursor?: string | null;
}

export interface AtlasSourceAdapter {
  source: AtlasAsset['source'];
  isOffline: boolean;
  search(query: string, cursor?: any, signal?: AbortSignal): Promise<PaginatedResult>;
  list(category: string, cursor?: any, signal?: AbortSignal): Promise<PaginatedResult>;
}
