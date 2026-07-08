import { AtlasSourceAdapter, PaginatedResult, AtlasAsset } from './types';

// Same DEV/prod split as src/services/assetManager.ts: relative URLs in
// production (nginx/VTT backend proxies /library-assets and /library),
// localhost:5001 in dev unless overridden.
const ASSET_SERVER_URL = import.meta.env.DEV
  ? import.meta.env.VITE_ASSET_SERVER_URL || 'http://localhost:5001'
  : '';

const DEFAULT_LIMIT = 20;

export interface LibraryFacetEntry {
  name: string;
  count: number;
}

export interface LibraryFacets {
  categories: LibraryFacetEntry[];
  tags: LibraryFacetEntry[];
}

interface RawLibraryAsset {
  id: string;
  name: string;
  category: string;
  tags: string[];
  thumbnail: string;
  fullImage: string;
  size: number;
  sha256: string;
  source: 'tmt';
  dimensions?: { width: number; height: number };
  sourcePath?: string;
}

interface RawLibraryResponse {
  assets: RawLibraryAsset[];
  total: number;
  limit: number;
  cursor: string | null;
  hasMore: boolean;
}

function toLibraryAssetUrl(manifestPath: string): string {
  return `${ASSET_SERVER_URL}/library-assets/${manifestPath}`;
}

function mapAsset(raw: RawLibraryAsset): AtlasAsset {
  return {
    id: `library:${raw.id}`,
    source: 'library',
    name: raw.name,
    thumbnailUrl: toLibraryAssetUrl(raw.thumbnail),
    resolveFullAsset: async () => toLibraryAssetUrl(raw.fullImage),
    width: raw.dimensions?.width,
    height: raw.dimensions?.height,
    tags: raw.tags,
    category: raw.category,
  };
}

function isNetworkError(err: any): boolean {
  return Boolean(
    err?.message?.includes('fetch') ||
      err?.message?.includes('network') ||
      err?.name === 'TypeError',
  );
}

export class LibrarySourceAdapter implements AtlasSourceAdapter {
  source = 'library' as const;
  isOffline = false;

  private async fetchLibrary(params: Record<string, string>, signal?: AbortSignal): Promise<PaginatedResult> {
    const search = new URLSearchParams(params);
    try {
      const response = await fetch(`${ASSET_SERVER_URL}/library?${search.toString()}`, { signal });

      if (response.status === 503) {
        this.isOffline = true;
        return { assets: [], hasMore: false, total: 0, cursor: null };
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: RawLibraryResponse = await response.json();
      this.isOffline = false;

      return {
        assets: data.assets.map(mapAsset),
        hasMore: data.hasMore,
        total: data.total,
        cursor: data.cursor,
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw err;
      }
      if (isNetworkError(err)) {
        this.isOffline = true;
        return { assets: [], hasMore: false, total: 0, cursor: null };
      }
      throw err;
    }
  }

  async search(
    query: string,
    cursor?: string | null,
    signal?: AbortSignal,
    category?: string,
  ): Promise<PaginatedResult> {
    const params: Record<string, string> = {
      q: query,
      limit: String(DEFAULT_LIMIT),
    };
    if (category && category !== 'all') params.category = category;
    if (cursor) params.cursor = cursor;
    return this.fetchLibrary(params, signal);
  }

  async list(category: string, cursor?: string | null, signal?: AbortSignal): Promise<PaginatedResult> {
    const params: Record<string, string> = {
      limit: String(DEFAULT_LIMIT),
    };
    if (category && category !== 'all') params.category = category;
    if (cursor) params.cursor = cursor;
    return this.fetchLibrary(params, signal);
  }

  async fetchFacets(signal?: AbortSignal): Promise<LibraryFacets> {
    try {
      const response = await fetch(`${ASSET_SERVER_URL}/library/facets`, { signal });

      if (response.status === 503) {
        this.isOffline = true;
        return { categories: [], tags: [] };
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: LibraryFacets = await response.json();
      this.isOffline = false;
      return data;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw err;
      }
      if (isNetworkError(err)) {
        this.isOffline = true;
        return { categories: [], tags: [] };
      }
      throw err;
    }
  }
}
