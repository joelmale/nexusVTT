import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';

const SECRET = 'test-secret';
let tmpAssetsPath: string;
let tmpLibraryDataPath: string;

// ASSETS_PATH and ASSET_SERVICE_SECRET must be set BEFORE importing the app
// module, since index.ts reads process.env at module-load time.
beforeAll(() => {
  tmpAssetsPath = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-service-test-'));
  process.env.ASSETS_PATH = tmpAssetsPath;
  process.env.ASSET_SERVICE_SECRET = SECRET;

  // Fixture dir for the /library-assets static mount (C6): a tiny fake
  // derivative file at the shape the real assets-data tree uses
  // (derivatives/<xx>/<hash>.webp), so GET /library-assets/derivatives/ab/abc.webp
  // resolves without needing the real (large) assets-data tree in tests.
  tmpLibraryDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-service-library-data-test-'));
  fs.mkdirSync(path.join(tmpLibraryDataPath, 'derivatives', 'ab'), { recursive: true });
  fs.writeFileSync(path.join(tmpLibraryDataPath, 'derivatives', 'ab', 'abc.webp'), Buffer.from([0x00, 0x01, 0x02]));
  process.env.LIBRARY_DATA_PATH = tmpLibraryDataPath;
});

afterAll(() => {
  fs.rmSync(tmpAssetsPath, { recursive: true, force: true });
  fs.rmSync(tmpLibraryDataPath, { recursive: true, force: true });
});

// Dynamic import after env vars are set so the module picks them up.
let app: import('express').Express;
beforeAll(async () => {
  ({ app } = await import('./index'));
});

function pngBuffer(sizeBytes = 100): Buffer {
  // Minimal valid-enough PNG header + padding; the service does not
  // magic-byte sniff, so any buffer with a .png filename is accepted.
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const padding = Buffer.alloc(Math.max(0, sizeBytes - header.length));
  return Buffer.concat([header, padding]);
}

describe('asset-service user asset routes', () => {
  const userId = 'user123';

  beforeEach(() => {
    // Clean the user's dir between tests to keep quota/manifest assertions isolated.
    const userDir = path.join(tmpAssetsPath, 'users', userId);
    fs.rmSync(userDir, { recursive: true, force: true });
  });

  describe('POST /user/:userId/upload', () => {
    it('rejects an unauthenticated upload with 401 (no auth header)', async () => {
      const res = await request(app)
        .post(`/user/${userId}/upload`)
        .attach('file', pngBuffer(), 'test.png');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Unauthorized' });
    });

    it('rejects an upload with the wrong secret', async () => {
      const res = await request(app)
        .post(`/user/${userId}/upload`)
        .set('x-nexus-auth', 'wrong-secret')
        .attach('file', pngBuffer(), 'test.png');

      expect(res.status).toBe(401);
    });

    it('accepts an upload with the correct secret, writes the file, and updates the manifest', async () => {
      const res = await request(app)
        .post(`/user/${userId}/upload`)
        .set('x-nexus-auth', SECRET)
        .field('name', 'My Token')
        .attach('file', pngBuffer(), 'test.png');

      expect(res.status).toBe(200);
      expect(res.body.asset).toMatchObject({
        name: 'My Token',
        source: 'user',
      });

      const filename = path.basename(res.body.asset.fullImage);
      const filePath = path.join(tmpAssetsPath, 'users', userId, filename);
      expect(fs.existsSync(filePath)).toBe(true);

      const manifestPath = path.join(tmpAssetsPath, 'users', userId, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      expect(manifest.assets).toHaveLength(1);
      expect(manifest.assets[0].id).toBe(res.body.asset.id);
    });

    it('rejects a path-traversal userId with 400', async () => {
      const res = await request(app)
        .post('/user/..%2Fevil/upload')
        .set('x-nexus-auth', SECRET)
        .attach('file', pngBuffer(), 'test.png');

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid userId' });
    });

    it('rejects an upload once the user quota (50MB) would be exceeded', async () => {
      const userDir = path.join(tmpAssetsPath, 'users', userId);
      fs.mkdirSync(userDir, { recursive: true });
      // Seed the dir with a file close to the 50MB quota.
      fs.writeFileSync(path.join(userDir, 'existing.png'), Buffer.alloc(49 * 1024 * 1024));

      const res = await request(app)
        .post(`/user/${userId}/upload`)
        .set('x-nexus-auth', SECRET)
        .attach('file', pngBuffer(2 * 1024 * 1024), 'test.png');

      expect(res.status).toBe(413);
      expect(res.body).toEqual({ error: 'Quota exceeded (50MB max)' });
    });

    it('rejects a file over the 5MB per-file limit via the 4-arg error handler (413)', async () => {
      const res = await request(app)
        .post(`/user/${userId}/upload`)
        .set('x-nexus-auth', SECRET)
        .attach('file', pngBuffer(6 * 1024 * 1024), 'toobig.png');

      expect(res.status).toBe(413);
      expect(res.body.error).toMatch(/too large/i);
    });
  });

  describe('DELETE /user/:userId/asset/:assetId', () => {
    it('deletes an uploaded asset (full flow: upload then delete)', async () => {
      const uploadRes = await request(app)
        .post(`/user/${userId}/upload`)
        .set('x-nexus-auth', SECRET)
        .attach('file', pngBuffer(), 'delete-me.png');

      expect(uploadRes.status).toBe(200);
      const assetId = uploadRes.body.asset.id;
      const filename = path.basename(uploadRes.body.asset.fullImage);
      const filePath = path.join(tmpAssetsPath, 'users', userId, filename);
      expect(fs.existsSync(filePath)).toBe(true);

      const deleteRes = await request(app)
        .delete(`/user/${userId}/asset/${assetId}`)
        .set('x-nexus-auth', SECRET);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body).toEqual({ success: true });
      expect(fs.existsSync(filePath)).toBe(false);

      const manifestPath = path.join(tmpAssetsPath, 'users', userId, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      expect(manifest.assets.find((a: { id: string }) => a.id === assetId)).toBeUndefined();
    });

    it('rejects an unauthenticated delete with 401', async () => {
      const res = await request(app).delete(`/user/${userId}/asset/some-id`);
      expect(res.status).toBe(401);
    });
  });

  describe('unmatched routes and error handling', () => {
    it('returns a JSON 404 for unknown routes', async () => {
      const res = await request(app).get('/this-route-does-not-exist');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
      expect(Array.isArray(res.body.availableEndpoints)).toBe(true);
    });
  });

  describe('GET /library-assets (C6: static mount over LIBRARY_DATA_PATH)', () => {
    it('serves a known fixture file with immutable cache headers', async () => {
      const res = await request(app).get('/library-assets/derivatives/ab/abc.webp');
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('public, max-age=86400, immutable');
      expect(res.body).toEqual(Buffer.from([0x00, 0x01, 0x02]));
    });

    it('falls through to the service-wide JSON 404 for a nonexistent path', async () => {
      // express.static finds no match under LIBRARY_DATA_PATH and calls
      // next(), which reaches this service's catch-all 404 handler further
      // down the middleware chain (registered after all app.use/app.get
      // routes) — so this is the same JSON shape as any other unknown route,
      // not a bare Express HTML 404.
      const res = await request(app).get('/library-assets/derivatives/zz/does-not-exist.webp');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
      expect(Array.isArray(res.body.availableEndpoints)).toBe(true);
    });
  });
});
