import type { LibraryAsset, LibraryManifest } from '../library';
import { blobKey, derivativeKey } from './derivativeSpec';
import { isSafeRelativeKey } from './pathSafety';
import type { AdminAssetRecord, AdminState } from './state';

/**
 * Merges the ingest-owned manifest-v2 with the admin overlay.
 *
 * - `buildCatalog` is the admin view: every asset, including quarantined,
 *   deleted and ingest-tombstoned ones.
 * - `toPublicManifest` is what `/library` serves: quarantined and deleted
 *   assets are excluded and metadata overrides applied. With an empty
 *   overlay it returns the manifest object unchanged, so public behavior is
 *   byte-for-byte identical until an administrator changes something.
 */

export type AdminViewStatus = 'active' | 'quarantined' | 'deleted' | 'removed';

export interface CatalogEntry {
  id: string;
  origin: 'admin' | 'library';
  status: AdminViewStatus;
  version: number;
  name: string;
  category: string;
  tags: string[];
  attribution: string | null;
  license: string | null;
  source: string;
  sha256: string | null;
  size: number | null;
  mimeType: string | null;
  dimensions: { width: number; height: number } | null;
  originalKey: string | null;
  thumbnailKey: string | null;
  base?: LibraryAsset;
  record?: AdminAssetRecord;
  searchText: string;
}

export interface Catalog {
  entries: CatalogEntry[];
  byId: Map<string, CatalogEntry>;
  counts: Record<AdminViewStatus, number>;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function safeKeyOrNull(value: unknown): string | null {
  return isSafeRelativeKey(value) ? value : null;
}

/**
 * The ingest pipeline records `sourcePath` relative to the seed pack
 * (`Category/Name.png`). Anything that looks absolute or escaping is withheld
 * so a hand-edited manifest cannot leak a host path through the admin API.
 */
function relativeSourcePathOrNull(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (/[\0:]/.test(value) || value.startsWith('/') || value.startsWith('\\')) return null;
  if (value.split(/[\\/]/).includes('..')) return null;
  return value;
}

function withSearchText(entry: Omit<CatalogEntry, 'searchText'>): CatalogEntry {
  return {
    ...entry,
    searchText: [entry.id, entry.name, entry.category, ...entry.tags]
      .join(' ')
      .toLowerCase(),
  };
}

function libraryEntry(base: LibraryAsset, record?: AdminAssetRecord): CatalogEntry {
  let status: AdminViewStatus = base.removed ? 'removed' : 'active';
  if (record?.status === 'quarantined' || record?.status === 'deleted') {
    status = record.status;
  }
  return withSearchText({
    id: base.id,
    origin: 'library',
    status,
    version: record?.version ?? 0,
    name: record?.name ?? base.name,
    category: record?.category ?? base.category,
    tags: record?.tags ?? base.tags ?? [],
    attribution:
      record?.attribution !== undefined
        ? record.attribution
        : stringOrNull(base.attribution),
    license: record?.license !== undefined ? record.license : stringOrNull(base.license),
    source: typeof base.source === 'string' ? base.source : 'library',
    sha256: typeof base.sha256 === 'string' ? base.sha256 : null,
    size: typeof base.size === 'number' ? base.size : null,
    mimeType: null,
    dimensions: base.dimensions ?? null,
    originalKey: safeKeyOrNull(base.fullImage),
    thumbnailKey: safeKeyOrNull(base.thumbnail),
    base,
    record,
  });
}

function adminEntry(record: AdminAssetRecord): CatalogEntry | null {
  if (!record.sha256 || !record.ext) return null;
  return withSearchText({
    id: record.id,
    origin: 'admin',
    status: record.status,
    version: record.version,
    name: record.name ?? record.id,
    category: record.category ?? 'uncategorized',
    tags: record.tags ?? [],
    attribution: record.attribution ?? null,
    license: record.license ?? null,
    source: record.source ?? 'admin-upload',
    sha256: record.sha256,
    size: record.size ?? null,
    mimeType: record.mimeType ?? null,
    dimensions: record.dimensions ?? null,
    originalKey: blobKey(record.sha256, record.ext),
    thumbnailKey: derivativeKey(record.sha256),
    record,
  });
}

export function buildCatalog(base: LibraryManifest | null, state: AdminState): Catalog {
  const entries: CatalogEntry[] = [];
  const byId = new Map<string, CatalogEntry>();
  const counts: Record<AdminViewStatus, number> = {
    active: 0,
    quarantined: 0,
    deleted: 0,
    removed: 0,
  };

  const push = (entry: CatalogEntry) => {
    if (byId.has(entry.id)) return;
    entries.push(entry);
    byId.set(entry.id, entry);
    counts[entry.status] += 1;
  };

  for (const asset of base?.assets ?? []) {
    const record = state.records[asset.id];
    push(libraryEntry(asset, record?.origin === 'library' ? record : undefined));
  }

  const adminRecords = Object.values(state.records)
    .filter((record) => record.origin === 'admin')
    .sort((a, b) =>
      (a.provenance.createdAt ?? '').localeCompare(b.provenance.createdAt ?? '') ||
      a.id.localeCompare(b.id),
    );
  for (const record of adminRecords) {
    const entry = adminEntry(record);
    if (entry) push(entry);
  }

  return { entries, byId, counts };
}

function applyOverrides(asset: LibraryAsset, record: AdminAssetRecord): LibraryAsset {
  const next: LibraryAsset = { ...asset };
  if (record.name !== undefined) next.name = record.name;
  if (record.category !== undefined) next.category = record.category;
  if (record.tags !== undefined) next.tags = [...record.tags];
  if (record.attribution !== undefined) {
    if (record.attribution === null) delete next.attribution;
    else next.attribution = record.attribution;
  }
  if (record.license !== undefined) {
    if (record.license === null) delete next.license;
    else next.license = record.license;
  }
  return next;
}

function adminRecordToPublic(record: AdminAssetRecord): LibraryAsset | null {
  if (!record.sha256 || !record.ext) return null;
  const asset: LibraryAsset = {
    id: record.id,
    name: record.name ?? record.id,
    category: record.category ?? 'uncategorized',
    tags: [...(record.tags ?? [])],
    thumbnail: derivativeKey(record.sha256),
    fullImage: blobKey(record.sha256, record.ext),
    size: record.size ?? 0,
    sha256: record.sha256,
    source: 'admin',
  };
  if (record.dimensions) asset.dimensions = { ...record.dimensions };
  if (record.attribution) asset.attribution = record.attribution;
  if (record.license) asset.license = record.license;
  return asset;
}

export function toPublicManifest(
  base: LibraryManifest | null,
  state: AdminState,
): LibraryManifest | null {
  if (!base) return null;
  const records = Object.values(state.records);
  if (records.length === 0) return base;

  const assets: LibraryAsset[] = [];
  for (const asset of base.assets) {
    const record = state.records[asset.id];
    if (!record || record.origin !== 'library') {
      assets.push(asset);
      continue;
    }
    if (record.status !== 'active') continue;
    assets.push(applyOverrides(asset, record));
  }

  const seen = new Set(assets.map((asset) => asset.id));
  const adminRecords = records
    .filter((record) => record.origin === 'admin' && record.status === 'active')
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const record of adminRecords) {
    if (seen.has(record.id)) continue;
    const asset = adminRecordToPublic(record);
    if (asset) assets.push(asset);
  }

  const active = assets.filter((asset) => !asset.removed);
  return {
    ...base,
    totalAssets: active.length,
    categories: [...new Set(active.map((asset) => asset.category))].sort(),
    assets,
  };
}

export interface AdminAssetView {
  id: string;
  origin: 'admin' | 'library';
  status: AdminViewStatus;
  version: number;
  etag: string;
  name: string;
  category: string;
  tags: string[];
  attribution: string | null;
  license: string | null;
  source: string;
  sha256: string | null;
  size: number | null;
  mimeType: string | null;
  dimensions: { width: number; height: number } | null;
  /** Relative storage keys, never filesystem paths. */
  files: { original: string | null; thumbnail: string | null };
  /** Public URLs (relative to the asset service) while the asset is served. */
  publicUrls: { original: string; thumbnail: string } | null;
  derivative: AdminAssetRecord['derivative'] | null;
  provenance: {
    createdBy: string | null;
    createdAt: string | null;
    originalFilename: string | null;
    sourceUrl: string | null;
    sourcePath: string | null;
    duplicatePathCount: number;
    removedInRelease: string | null;
    updatedBy: string | null;
    updatedAt: string | null;
  };
  quarantine: AdminAssetRecord['quarantine'] | null;
  deletion: AdminAssetRecord['deletion'] | null;
  history: AdminAssetRecord['history'];
}

export function etagFor(entry: Pick<CatalogEntry, 'id' | 'version'>): string {
  return `"${entry.id}:${entry.version}"`;
}

export function toAdminView(entry: CatalogEntry): AdminAssetView {
  const record = entry.record;
  const base = entry.base;
  const served =
    entry.status === 'active' && entry.originalKey !== null && entry.thumbnailKey !== null;
  return {
    id: entry.id,
    origin: entry.origin,
    status: entry.status,
    version: entry.version,
    etag: etagFor(entry),
    name: entry.name,
    category: entry.category,
    tags: [...entry.tags],
    attribution: entry.attribution,
    license: entry.license,
    source: entry.source,
    sha256: entry.sha256,
    size: entry.size,
    mimeType: entry.mimeType,
    dimensions: entry.dimensions,
    files: { original: entry.originalKey, thumbnail: entry.thumbnailKey },
    publicUrls: served
      ? {
          original: `/library-assets/${entry.originalKey}`,
          thumbnail: `/library-assets/${entry.thumbnailKey}`,
        }
      : null,
    derivative: record?.derivative ?? null,
    provenance: {
      createdBy: record?.provenance.createdBy ?? null,
      createdAt: record?.provenance.createdAt ?? null,
      originalFilename: record?.provenance.originalFilename ?? null,
      sourceUrl: record?.provenance.sourceUrl ?? null,
      sourcePath: relativeSourcePathOrNull(base?.sourcePath),
      duplicatePathCount: Array.isArray(base?.duplicatePaths) ? base.duplicatePaths.length : 0,
      removedInRelease: stringOrNull(base?.removedInRelease),
      updatedBy: record?.provenance.updatedBy ?? null,
      updatedAt: record?.provenance.updatedAt ?? null,
    },
    quarantine: record?.quarantine ?? null,
    deletion: record?.deletion ?? null,
    history: record?.history ?? [],
  };
}
