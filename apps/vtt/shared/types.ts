// Shared types between frontend and asset server

export interface AssetMetadata {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  tags: string[];
  thumbnail: string; // Relative path: Maps/thumbnails/abc123_thumb.webp
  fullImage: string; // Relative path: Maps/assets/abc123.webp
  dimensions: {
    width: number;
    height: number;
  };
  fileSize: number; // Original file size in bytes
  format: 'jpg' | 'jpeg' | 'png' | 'webp' | 'gif';
}

export interface AssetManifest {
  version: string;
  generatedAt: string;
  totalAssets: number;
  categories: string[];
  subcategories?: Record<string, string[]>;
  assets: AssetMetadata[];
}

export interface AssetSearchResult {
  query: string;
  results: AssetMetadata[];
  total: number;
}

export interface AssetCategoryResult {
  category: string;
  page: number;
  limit: number;
  assets: AssetMetadata[];
  hasMore: boolean;
  total: number;
}

// Asset server configuration
export interface AssetServerConfig {
  baseUrl: string;
  timeout: number;
  maxRetries: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === 'string')
  );
}

export function isAssetMetadata(value: unknown): value is AssetMetadata {
  if (!isRecord(value) || !isRecord(value.dimensions)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.category === 'string' &&
    (value.subcategory === undefined ||
      typeof value.subcategory === 'string') &&
    isStringArray(value.tags) &&
    typeof value.thumbnail === 'string' &&
    typeof value.fullImage === 'string' &&
    typeof value.dimensions.width === 'number' &&
    typeof value.dimensions.height === 'number' &&
    typeof value.fileSize === 'number' &&
    ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(String(value.format))
  );
}

export function parseAssetManifest(value: unknown): AssetManifest {
  if (
    !isRecord(value) ||
    typeof value.version !== 'string' ||
    typeof value.generatedAt !== 'string' ||
    typeof value.totalAssets !== 'number' ||
    !isStringArray(value.categories) ||
    !Array.isArray(value.assets) ||
    !value.assets.every(isAssetMetadata)
  ) {
    throw new TypeError('Invalid asset manifest');
  }
  return value as unknown as AssetManifest;
}

export function parseAssetSearchResult(value: unknown): AssetSearchResult {
  if (
    !isRecord(value) ||
    typeof value.query !== 'string' ||
    typeof value.total !== 'number' ||
    !Array.isArray(value.results) ||
    !value.results.every(isAssetMetadata)
  ) {
    throw new TypeError('Invalid asset search result');
  }
  return value as unknown as AssetSearchResult;
}

export function parseAssetCategoryResult(value: unknown): AssetCategoryResult {
  if (
    !isRecord(value) ||
    typeof value.category !== 'string' ||
    typeof value.page !== 'number' ||
    typeof value.limit !== 'number' ||
    typeof value.hasMore !== 'boolean' ||
    typeof value.total !== 'number' ||
    !Array.isArray(value.assets) ||
    !value.assets.every(isAssetMetadata)
  ) {
    throw new TypeError('Invalid asset category result');
  }
  return value as unknown as AssetCategoryResult;
}
