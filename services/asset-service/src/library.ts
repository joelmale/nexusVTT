import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import fs from 'fs';

export interface LibraryAsset {
  id: string;
  name: string;
  category: string;
  tags: string[];
  thumbnail: string;
  fullImage: string;
  size: number;
  sha256: string;
  source: string;
  dimensions?: { width: number; height: number };
  sourcePath?: string;
  duplicatePaths?: string[];
  removed?: boolean;
  removedInRelease?: string;
  [key: string]: unknown;
}

export interface LibraryManifest {
  version: string;
  generatedAt: string;
  totalAssets: number;
  categories: string[];
  assets: LibraryAsset[];
}

// Internal representation: manifest assets with precomputed lowercase
// search fields, built once at load time. See index.test.ts /
// library.test.ts for the latency measurement backing this choice: a
// precomputed-lowercase linear scan over 16k entries runs in ~1-3ms warm
// (measured on a dev laptop; see docs/roadmap/contracts/asset-service-v2.md
// "Search implementation" section), comfortably under the <100ms budget.
// An inverted index was considered and rejected as unnecessary complexity
// at this corpus size — revisit if the library grows an order of magnitude.
interface IndexedAsset extends LibraryAsset {
  _searchText: string; // lowercased name + tags, space-joined
}

export interface LibraryIndex {
  manifest: LibraryManifest;
  all: IndexedAsset[]; // includes removed, in manifest order
  byId: Map<string, IndexedAsset>;
  categoryCounts: Map<string, number>; // active (non-removed) only
  tagCounts: Map<string, number>; // active (non-removed) only
}

export function buildLibraryIndex(manifest: LibraryManifest): LibraryIndex {
  const all: IndexedAsset[] = manifest.assets.map((asset) => ({
    ...asset,
    _searchText: [asset.name, ...(asset.tags ?? [])].join(' ').toLowerCase(),
  }));

  const byId = new Map<string, IndexedAsset>();
  const categoryCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();

  for (const asset of all) {
    byId.set(asset.id, asset);
    if (asset.removed) continue;
    categoryCounts.set(
      asset.category,
      (categoryCounts.get(asset.category) ?? 0) + 1,
    );
    for (const tag of asset.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  return { manifest, all, byId, categoryCounts, tagCounts };
}

function loadManifestFromDisk(manifestPath: string): LibraryManifest | null {
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    console.error(`Failed to parse library manifest at ${manifestPath}:`, err);
    return null;
  }
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), 'utf8').toString('base64url');
}

function decodeCursor(cursor: unknown): number {
  if (typeof cursor !== 'string' || cursor.length === 0) return 0;
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const n = parseInt(decoded, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Builds the /library router. `getIndex` is a lazy accessor so the router
 * always sees the latest loaded index (support for POST /library/reload
 * without re-mounting routes), and `getSecret` reads the auth secret at
 * request time (matching index.ts's requireNexusAuth pattern for testability).
 */
export function createLibraryRouter(
  getIndex: () => LibraryIndex | null,
  requireAuth: (req: Request, res: Response, next: NextFunction) => void,
  reloadIndex: () => { ok: boolean; error?: string },
): express.Router {
  const router = express.Router();

  function requireIndex(req: Request, res: Response): LibraryIndex | null {
    const index = getIndex();
    if (!index) {
      res
        .status(503)
        .json({
          error: 'source-unavailable',
          message: 'Library manifest not loaded',
        });
      return null;
    }
    return index;
  }

  router.get('/library', (req, res) => {
    const index = requireIndex(req, res);
    if (!index) return;

    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit ?? ''), 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const offset = decodeCursor(req.query.cursor);
    const includeRemoved = req.query.includeRemoved === 'true';
    const category =
      typeof req.query.category === 'string' ? req.query.category : undefined;
    const q =
      typeof req.query.q === 'string'
        ? req.query.q.trim().toLowerCase()
        : undefined;

    let filtered = index.all;
    if (!includeRemoved) filtered = filtered.filter((a) => !a.removed);
    if (category) filtered = filtered.filter((a) => a.category === category);
    if (q) filtered = filtered.filter((a) => a._searchText.includes(q));

    const page = filtered.slice(offset, offset + limit);
    const nextOffset = offset + limit;
    const hasMore = nextOffset < filtered.length;

    res.json({
      assets: page.map(stripInternal),
      total: filtered.length,
      limit,
      cursor: hasMore ? encodeCursor(nextOffset) : null,
      hasMore,
    });
  });

  router.get('/library/facets', (req, res) => {
    const index = requireIndex(req, res);
    if (!index) return;

    const TOP_N_TAGS = 50;
    const categories = [...index.categoryCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const tags = [...index.tagCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, TOP_N_TAGS);

    res.json({ categories, tags });
  });

  router.get('/library/asset/:id', (req, res) => {
    const index = requireIndex(req, res);
    if (!index) return;

    const asset = index.byId.get(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json(stripInternal(asset));
  });

  router.post('/library/reload', requireAuth, (req, res) => {
    const result = reloadIndex();
    if (!result.ok) {
      return res
        .status(503)
        .json({ error: 'source-unavailable', message: result.error });
    }
    const index = getIndex();
    res.json({ success: true, totalAssets: index?.manifest.totalAssets ?? 0 });
  });

  return router;
}

function stripInternal(asset: IndexedAsset): LibraryAsset {
  const { _searchText, ...rest } = asset;
  void _searchText;
  return rest;
}

export { loadManifestFromDisk };
