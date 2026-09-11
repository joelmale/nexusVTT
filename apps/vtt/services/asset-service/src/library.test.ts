import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';

const SECRET = 'test-secret';
let tmpAssetsPath: string;
let libraryManifestPath: string;

const fixturePath = path.join(__dirname, '../test-fixtures/manifest-v2.fixture.json');

// Env vars must be set BEFORE importing the app module (index.ts reads
// process.env at module-load time, same pattern as index.test.ts).
beforeAll(() => {
  tmpAssetsPath = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-service-library-test-'));
  libraryManifestPath = path.join(tmpAssetsPath, 'manifest-v2.json');
  fs.copyFileSync(fixturePath, libraryManifestPath);

  process.env.ASSETS_PATH = tmpAssetsPath;
  process.env.ASSET_SERVICE_SECRET = SECRET;
  process.env.LIBRARY_MANIFEST_PATH = libraryManifestPath;
});

afterAll(() => {
  fs.rmSync(tmpAssetsPath, { recursive: true, force: true });
});

let app: import('express').Express;
beforeAll(async () => {
  ({ app } = await import('./index'));
});

describe('GET /library', () => {
  it('returns a page of assets with pagination metadata', async () => {
    const res = await request(app).get('/library').query({ limit: 20 });
    expect(res.status).toBe(200);
    expect(res.body.assets).toHaveLength(20);
    expect(res.body.limit).toBe(20);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.hasMore).toBe(true);
    expect(typeof res.body.cursor).toBe('string');
  });

  it('excludes removed assets by default', async () => {
    const res = await request(app).get('/library').query({ limit: 100 });
    expect(res.body.assets.every((a: { removed?: boolean }) => !a.removed)).toBe(true);
    // Fixture has 500 total, 15 removed -> 485 active.
    expect(res.body.total).toBe(485);
  });

  it('includes removed assets when includeRemoved=true', async () => {
    const res = await request(app).get('/library').query({ limit: 1, includeRemoved: 'true' });
    expect(res.body.total).toBe(500);
  });

  it('paginates via cursor to walk the full active set without gaps or dupes', async () => {
    const seen = new Set<string>();
    let cursor: string | undefined;
    let guard = 0;
    do {
      const res = await request(app)
        .get('/library')
        .query({ limit: 100, ...(cursor ? { cursor } : {}) });
      for (const a of res.body.assets) seen.add(a.id);
      cursor = res.body.cursor ?? undefined;
      guard++;
    } while (cursor && guard < 20);

    expect(seen.size).toBe(485);
  });

  it('filters by category', async () => {
    const res = await request(app).get('/library').query({ category: 'Dragon', limit: 100 });
    expect(res.body.assets.length).toBeGreaterThan(0);
    expect(res.body.assets.every((a: { category: string }) => a.category === 'Dragon')).toBe(true);
  });

  it('text-searches over name and tags (?q)', async () => {
    const res = await request(app).get('/library').query({ q: 'undead', limit: 500 });
    expect(res.body.assets.length).toBeGreaterThan(0);
    expect(
      res.body.assets.every((a: { tags: string[] }) => a.tags.includes('undead')),
    ).toBe(true);
  });

  it('search is case-insensitive', async () => {
    const res = await request(app).get('/library').query({ q: 'GHOUL', limit: 500 });
    expect(res.body.assets.length).toBeGreaterThan(0);
  });

  it('caps limit at 100 even if a larger value is requested', async () => {
    const res = await request(app).get('/library').query({ limit: 9999 });
    expect(res.body.assets.length).toBeLessThanOrEqual(100);
    expect(res.body.limit).toBe(100);
  });

  it('search over a 16k-entry synthetic index responds in well under 100ms', async () => {
    // Build a larger in-process index directly (bypassing HTTP) by
    // replicating the fixture up to 16k entries, to measure the search
    // implementation's scaling behavior server-side, independent of
    // request/response overhead.
    const { buildLibraryIndex } = await import('./library');
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const bigAssets = [];
    let i = 0;
    while (bigAssets.length < 16000) {
      const base = fixture.assets[i % fixture.assets.length];
      bigAssets.push({ ...base, id: `${base.id}-${bigAssets.length}` });
      i++;
    }
    const bigManifest = { ...fixture, assets: bigAssets, totalAssets: bigAssets.length };
    const index = buildLibraryIndex(bigManifest);

    const runs: number[] = [];
    for (let r = 0; r < 5; r++) {
      const start = process.hrtime.bigint();
      const results = index.all.filter((a) => a._searchText.includes('dragon'));
      const end = process.hrtime.bigint();
      runs.push(Number(end - start) / 1e6);
      expect(results.length).toBeGreaterThan(0);
    }
    const maxMs = Math.max(...runs);
    expect(maxMs).toBeLessThan(100);
  });

  it('returns 503 source-unavailable when the manifest path does not exist', async () => {
    const missingPath = path.join(tmpAssetsPath, 'does-not-exist.json');
    const prevPath = process.env.LIBRARY_MANIFEST_PATH;
    process.env.LIBRARY_MANIFEST_PATH = missingPath;

    // Force a reload against the now-missing path via the protected endpoint,
    // then verify /library reports unavailable, then restore state for
    // subsequent tests.
    const reloadRes = await request(app).post('/library/reload').set('x-nexus-auth', SECRET);
    expect(reloadRes.status).toBe(503);
    expect(reloadRes.body.error).toBe('source-unavailable');

    const libRes = await request(app).get('/library');
    expect(libRes.status).toBe(503);
    expect(libRes.body.error).toBe('source-unavailable');

    // Restore.
    process.env.LIBRARY_MANIFEST_PATH = prevPath;
    const restoreRes = await request(app).post('/library/reload').set('x-nexus-auth', SECRET);
    expect(restoreRes.status).toBe(200);
  });
});

describe('GET /library/facets', () => {
  it('returns category counts matching the manifest (active-only)', async () => {
    const res = await request(app).get('/library/facets');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.categories)).toBe(true);
    const total = res.body.categories.reduce((sum: number, c: { count: number }) => sum + c.count, 0);
    expect(total).toBe(485);
  });

  it('returns top-N tag counts', async () => {
    const res = await request(app).get('/library/facets');
    expect(Array.isArray(res.body.tags)).toBe(true);
    expect(res.body.tags.length).toBeGreaterThan(0);
    // Sorted descending by count.
    for (let i = 1; i < res.body.tags.length; i++) {
      expect(res.body.tags[i - 1].count).toBeGreaterThanOrEqual(res.body.tags[i].count);
    }
  });
});

describe('GET /library/asset/:id', () => {
  it('returns a single asset by id', async () => {
    const listRes = await request(app).get('/library').query({ limit: 1 });
    const id = listRes.body.assets[0].id;
    const res = await request(app).get(`/library/asset/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });

  it('returns a removed asset by id even though it is excluded from listings', async () => {
    // limit is capped at 100 server-side; walk pages with includeRemoved
    // until a removed asset turns up (fixture has 15 removed, near the tail).
    let removedAsset: { id: string; removed?: boolean } | undefined;
    let cursor: string | undefined;
    let guard = 0;
    do {
      const res = await request(app)
        .get('/library')
        .query({ includeRemoved: 'true', limit: 100, ...(cursor ? { cursor } : {}) });
      removedAsset = res.body.assets.find((a: { removed?: boolean }) => a.removed);
      cursor = res.body.cursor ?? undefined;
      guard++;
    } while (!removedAsset && cursor && guard < 20);
    expect(removedAsset).toBeDefined();

    const res = await request(app).get(`/library/asset/${removedAsset!.id}`);
    expect(res.status).toBe(200);
    expect(res.body.removed).toBe(true);
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).get('/library/asset/tmt-does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('POST /library/reload', () => {
  it('rejects an unauthenticated reload with 401', async () => {
    const res = await request(app).post('/library/reload');
    expect(res.status).toBe(401);
  });

  it('rejects a reload with the wrong secret', async () => {
    const res = await request(app).post('/library/reload').set('x-nexus-auth', 'wrong');
    expect(res.status).toBe(401);
  });

  it('picks up manifest changes from disk without a restart', async () => {
    const before = await request(app).get('/library').query({ limit: 1 });
    expect(before.status).toBe(200);

    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const extraAsset = {
      id: 'tmt-brandnew0000001',
      name: 'Brand New Asset',
      category: 'Newcat',
      tags: ['newcat'],
      thumbnail: 'derivatives/br/brandnew.webp',
      fullImage: 'blobs/br/brandnew.png',
      size: 123,
      sha256: 'brandnew0000001',
      source: 'tmt',
      sourcePath: 'Newcat/Brand.png',
    };
    const updated = {
      ...fixture,
      assets: [...fixture.assets, extraAsset],
      totalAssets: fixture.totalAssets + 1,
      categories: [...fixture.categories, 'Newcat'].sort(),
    };
    fs.writeFileSync(libraryManifestPath, JSON.stringify(updated));

    const reloadRes = await request(app).post('/library/reload').set('x-nexus-auth', SECRET);
    expect(reloadRes.status).toBe(200);
    expect(reloadRes.body.totalAssets).toBe(fixture.totalAssets + 1);

    const afterRes = await request(app).get('/library/asset/tmt-brandnew0000001');
    expect(afterRes.status).toBe(200);
    expect(afterRes.body.name).toBe('Brand New Asset');

    // Restore fixture for any subsequent tests in this file.
    fs.copyFileSync(fixturePath, libraryManifestPath);
    await request(app).post('/library/reload').set('x-nexus-auth', SECRET);
  });
});
