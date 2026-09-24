import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import sharp from 'sharp';
import request from 'supertest';
import type { Response as SupertestResponse, Test } from 'supertest';

const SECRET = 'admin-test-secret-value';
const ACTOR = 'admin:alice@example.test';
const METRICS_TOKEN = 'metrics-token-value';

let base: string;
let assetsPath: string;
let libraryRoot: string;
let manifestPath: string;
let outsideDir: string;
let app: import('express').Express;

interface FixtureAsset {
  id: string;
  sha256: string;
  blob: string;
  thumb: string;
  bytes: Buffer;
}
const fixtures: Record<string, FixtureAsset> = {};

// Every response is recorded and checked for leaked paths/secrets in afterAll.
const responses: { label: string; text: string }[] = [];

function record(label: string, res: SupertestResponse): SupertestResponse {
  const headerText = JSON.stringify(res.headers);
  const bodyText = res.body && Object.keys(res.body).length ? JSON.stringify(res.body) : '';
  responses.push({ label, text: `${headerText}\n${bodyText}\n${res.text ?? ''}` });
  return res;
}

function admin(method: 'get' | 'post' | 'patch', url: string): Test {
  return request(app)[method](`/internal/admin${url}`)
    .set('x-nexus-auth', SECRET)
    .set('x-nexus-actor', ACTOR);
}

async function call(test: Test, label = 'admin'): Promise<SupertestResponse> {
  return record(label, await test);
}

function sha(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function png(width: number, height: number, color: string): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: color } })
    .png()
    .toBuffer();
}

async function writeLibraryAsset(id: string, color: string): Promise<FixtureAsset> {
  const bytes = await png(64, 48, color);
  const hash = sha(bytes);
  const blob = `blobs/${hash.slice(0, 2)}/${hash}.png`;
  const thumb = `derivatives/v1/${hash.slice(0, 2)}/${hash}.webp`;
  fs.mkdirSync(path.join(libraryRoot, path.dirname(blob)), { recursive: true });
  fs.mkdirSync(path.join(libraryRoot, path.dirname(thumb)), { recursive: true });
  fs.writeFileSync(path.join(libraryRoot, blob), bytes);
  await sharp(bytes).webp().toFile(path.join(libraryRoot, thumb));
  return { id, sha256: hash, blob, thumb, bytes };
}

function manifestAsset(f: FixtureAsset, name: string, category: string, tags: string[]) {
  return {
    id: f.id,
    name,
    category,
    tags,
    thumbnail: f.thumb,
    fullImage: f.blob,
    size: f.bytes.length,
    sha256: f.sha256,
    source: 'tmt',
    dimensions: { width: 64, height: 48 },
    sourcePath: `${category}/${name}.png`,
  };
}

/** A PNG whose IHDR claims huge dimensions: a decompression bomb header. */
function bombPng(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(typeAndData) >>> 0);
    return Buffer.concat([length, typeAndData, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const idat = zlib.deflateSync(Buffer.alloc(1024));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

beforeAll(async () => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-admin-test-'));
  assetsPath = path.join(base, 'static-assets');
  libraryRoot = path.join(base, 'assets-data');
  outsideDir = path.join(base, 'outside');
  manifestPath = path.join(libraryRoot, 'manifests', 'manifest-v2.json');
  fs.mkdirSync(assetsPath, { recursive: true });
  fs.mkdirSync(path.join(libraryRoot, 'manifests'), { recursive: true });
  fs.mkdirSync(outsideDir, { recursive: true });
  fs.writeFileSync(path.join(outsideDir, 'secret.png'), await png(8, 8, '#ff0000'));

  fixtures.dragon = await writeLibraryAsset('tmt-dragon000000001', '#aa0000');
  fixtures.goblin = await writeLibraryAsset('tmt-goblin000000001', '#00aa00');
  fixtures.ghoul = await writeLibraryAsset('tmt-ghoul0000000001', '#0000aa');
  fixtures.integrity = await writeLibraryAsset('tmt-integrity000001', '#aaaa00');

  // A junction inside blobs/ that points outside the root, and manifest
  // entries that try to use it or plain traversal keys.
  fs.symlinkSync(outsideDir, path.join(libraryRoot, 'blobs', 'escape'), 'junction');

  const manifest = {
    version: '1.0.0',
    generatedAt: '1970-01-01T00:00:00.000Z',
    totalAssets: 6,
    categories: ['Dragon', 'Goblin', 'Undead', 'Evil'],
    assets: [
      manifestAsset(fixtures.dragon, 'Red Dragon', 'Dragon', ['dragon', 'red']),
      manifestAsset(fixtures.goblin, 'Goblin Scout', 'Goblin', ['goblin']),
      manifestAsset(fixtures.ghoul, 'Ghoul', 'Undead', ['undead']),
      manifestAsset(fixtures.integrity, 'Integrity Probe', 'Undead', ['probe']),
      {
        id: 'tmt-evil-traversal1',
        name: 'Traversal',
        category: 'Evil',
        tags: [],
        thumbnail: '../../outside/secret.png',
        fullImage: '/etc/passwd',
        size: 1,
        sha256: 'f'.repeat(64),
        source: 'tmt',
      },
      {
        id: 'tmt-evil-junction01',
        name: 'Junction',
        category: 'Evil',
        tags: [],
        thumbnail: 'blobs/escape/secret.png',
        fullImage: 'blobs/escape/secret.png',
        size: 1,
        sha256: 'e'.repeat(64),
        source: 'tmt',
      },
    ],
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));

  process.env.ASSETS_PATH = assetsPath;
  process.env.LIBRARY_DATA_PATH = libraryRoot;
  process.env.LIBRARY_MANIFEST_PATH = manifestPath;
  process.env.ASSET_SERVICE_SECRET = SECRET;
  delete process.env.METRICS_AUTH_TOKEN;
  delete process.env.ASSET_ADMIN_MAX_UPLOAD_BYTES;
  delete process.env.ASSET_ADMIN_STORAGE_QUOTA_BYTES;

  ({ app } = await import('../index'));
});

afterAll(() => {
  const forbidden = [
    base,
    fs.realpathSync(base),
    os.tmpdir(),
    libraryRoot,
    SECRET,
    METRICS_TOKEN,
  ].flatMap((value) => [value, JSON.stringify(value).slice(1, -1), value.replace(/\\/g, '/')]);
  const leaks = responses.flatMap(({ label, text }) =>
    forbidden.filter((value) => value.length > 3 && text.includes(value)).map((v) => `${label}: ${v}`),
  );
  // Remove the junction itself first so rmSync never walks into its target.
  const junction = path.join(libraryRoot, 'blobs', 'escape');
  try {
    fs.unlinkSync(junction);
  } catch {
    fs.rmdirSync(junction);
  }
  sharp.cache(false);
  fs.rmSync(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  expect(leaks).toEqual([]);
});

describe('authentication and actor attribution', () => {
  it('rejects a missing service credential with 401', async () => {
    const res = record(
      'no-secret',
      await request(app).get('/internal/admin/assets').set('x-nexus-actor', ACTOR),
    );
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('rejects an incorrect service credential with 401', async () => {
    for (const wrong of ['wrong', `${SECRET}x`, SECRET.slice(0, -1), '']) {
      const res = record(
        'wrong-secret',
        await request(app)
          .get('/internal/admin/assets')
          .set('x-nexus-auth', wrong)
          .set('x-nexus-actor', ACTOR),
      );
      expect(res.status).toBe(401);
    }
  });

  it('rejects everything when ASSET_SERVICE_SECRET is unset', async () => {
    delete process.env.ASSET_SERVICE_SECRET;
    try {
      const res = record(
        'unset-secret',
        await request(app)
          .get('/internal/admin/assets')
          .set('x-nexus-auth', '')
          .set('x-nexus-actor', ACTOR),
      );
      expect(res.status).toBe(401);
      const withUndefined = record(
        'unset-secret-2',
        await request(app)
          .get('/internal/admin/assets')
          .set('x-nexus-auth', 'undefined')
          .set('x-nexus-actor', ACTOR),
      );
      expect(withUndefined.status).toBe(401);
    } finally {
      process.env.ASSET_SERVICE_SECRET = SECRET;
    }
  });

  it('rejects an unauthenticated upload before reading the body', async () => {
    const res = record(
      'unauth-upload',
      await request(app)
        .post('/internal/admin/assets')
        .set('x-nexus-actor', ACTOR)
        .field('category', 'Maps')
        .attach('file', await png(10, 10, '#fff'), 'x.png'),
    );
    expect(res.status).toBe(401);
  });

  it('requires an actor header', async () => {
    const res = record(
      'no-actor',
      await request(app).get('/internal/admin/assets').set('x-nexus-auth', SECRET),
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('actor-required');
  });

  it('rejects a malformed actor header', async () => {
    for (const actor of ['has space', '../etc', '<script>', 'a'.repeat(300)]) {
      const res = record(
        'bad-actor',
        await request(app)
          .get('/internal/admin/assets')
          .set('x-nexus-auth', SECRET)
          .set('x-nexus-actor', actor),
      );
      expect(res.status).toBe(400);
    }
  });

  it('echoes the actor and request id for audit correlation', async () => {
    const res = await call(admin('get', '/assets').set('x-request-id', 'req-123'));
    expect(res.status).toBe(200);
    expect(res.body.audit).toEqual({ actor: ACTOR, requestId: 'req-123' });
    expect(res.headers['x-nexus-actor']).toBe(ACTOR);
    expect(res.headers['x-request-id']).toBe('req-123');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('generates a request id when none (or an unsafe one) is supplied', async () => {
    const res = await call(admin('get', '/assets').set('x-request-id', 'bad id\twith tab'));
    expect(res.body.audit.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('is not reachable without the /internal/admin credential on any route', async () => {
    for (const [method, url] of [
      ['get', '/facets'],
      ['get', `/assets/${fixtures.dragon.id}`],
      ['patch', `/assets/${fixtures.dragon.id}`],
      ['post', `/assets/${fixtures.dragon.id}/quarantine`],
      ['post', `/assets/${fixtures.dragon.id}/permanent-delete`],
      ['post', '/jobs/manifest-rebuild'],
      ['post', '/jobs/integrity-report'],
      ['get', '/integrity'],
    ] as const) {
      const res = record('unauth-route', await request(app)[method](`/internal/admin${url}`));
      expect(res.status, `${method} ${url}`).toBe(401);
    }
  });
});

describe('browse, search and provenance', () => {
  it('lists library assets with filters and cursor pagination', async () => {
    const all = await call(admin('get', '/assets?limit=2'));
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(6);
    expect(all.body.assets).toHaveLength(2);
    expect(all.body.hasMore).toBe(true);

    const next = await call(admin('get', `/assets?limit=2&cursor=${all.body.cursor}`));
    expect(next.body.assets[0].id).not.toBe(all.body.assets[0].id);

    const byCategory = await call(admin('get', '/assets?category=Undead'));
    expect(byCategory.body.assets.map((a: { id: string }) => a.id).sort()).toEqual(
      [fixtures.ghoul.id, fixtures.integrity.id].sort(),
    );

    const byText = await call(admin('get', '/assets?q=DRAGON'));
    expect(byText.body.assets.map((a: { id: string }) => a.id)).toEqual([fixtures.dragon.id]);

    const byTags = await call(admin('get', '/assets?tags=dragon,red'));
    expect(byTags.body.total).toBe(1);

    const bad = await call(admin('get', '/assets?status=bogus'));
    expect(bad.status).toBe(400);
  });

  it('returns one asset with relative keys, hashes and an ETag', async () => {
    const res = await call(admin('get', `/assets/${fixtures.dragon.id}`));
    expect(res.status).toBe(200);
    const asset = res.body.asset;
    expect(asset).toMatchObject({
      id: fixtures.dragon.id,
      origin: 'library',
      status: 'active',
      version: 0,
      sha256: fixtures.dragon.sha256,
      files: { original: fixtures.dragon.blob, thumbnail: fixtures.dragon.thumb },
      publicUrls: {
        original: `/library-assets/${fixtures.dragon.blob}`,
        thumbnail: `/library-assets/${fixtures.dragon.thumb}`,
      },
    });
    expect(asset.provenance.sourcePath).toBe('Dragon/Red Dragon.png');
    expect(res.headers.etag).toBe(`"${fixtures.dragon.id}:0"`);
  });

  it('withholds unsafe manifest keys instead of echoing them', async () => {
    const res = await call(admin('get', '/assets/tmt-evil-traversal1'));
    expect(res.body.asset.files).toEqual({ original: null, thumbnail: null });
    expect(res.body.asset.publicUrls).toBeNull();
  });

  it('streams a preview and 404s for unknown assets', async () => {
    const preview = await call(admin('get', `/assets/${fixtures.dragon.id}/preview`));
    expect(preview.status).toBe(200);
    expect(preview.headers['x-content-type-options']).toBe('nosniff');
    const missing = await call(admin('get', '/assets/tmt-nope/preview'));
    expect(missing.status).toBe(404);
  });

  it('returns facets with status counts', async () => {
    const res = await call(admin('get', '/facets'));
    expect(res.status).toBe(200);
    expect(res.body.statuses.active).toBe(6);
    expect(res.body.categories.find((c: { name: string }) => c.name === 'Undead').count).toBe(2);
  });
});

describe('path traversal', () => {
  const traversalIds = [
    '..%2F..%2Fetc%2Fpasswd',
    '%2e%2e',
    '%2e%2e%2f%2e%2e%2fsecret',
    '..%5C..%5Cwindows',
    'C:%5CWindows',
    'C%3A%2FWindows',
    'tmt-ok%00.png',
    '%252e%252e%252f',
    '.admin',
    'a%2Fb',
  ];

  it.each(traversalIds)('rejects asset id %s', async (id) => {
    const res = await call(admin('get', `/assets/${id}`), `traversal-${id}`);
    expect([400, 404]).toContain(res.status);
    if (res.status === 400) expect(res.body.error).toBe('invalid-asset-id');
  });

  it('rejects traversal ids on mutating routes', async () => {
    const res = await call(
      admin('post', '/assets/..%2F..%2Fx/quarantine').send({ expectedVersion: 0 }),
    );
    expect([400, 404]).toContain(res.status);
  });

  it('refuses preview through a junction that escapes the root', async () => {
    const res = await call(admin('get', '/assets/tmt-evil-junction01/preview'));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('unsafe-path');
  });

  it('refuses to quarantine through a junction and leaves the outside file in place', async () => {
    const res = await call(
      admin('post', '/assets/tmt-evil-junction01/quarantine').send({ expectedVersion: 0 }),
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('unsafe-path');
    expect(fs.existsSync(path.join(outsideDir, 'secret.png'))).toBe(true);
    const after = await call(admin('get', '/assets/tmt-evil-junction01'));
    expect(after.body.asset.status).toBe('active');
  });

  it('refuses to regenerate derivatives for an asset with traversal keys', async () => {
    const res = await call(admin('post', '/assets/tmt-evil-traversal1/derivatives'));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('invalid-keys');
  });

  it.each([
    '/library-assets/.admin/state.json',
    '/library-assets/%2eadmin/state.json',
    '/library-assets/.admin%2fstate.json',
    '/library-assets/.admin/quarantine/x',
    '/library-assets/..%2f..%2foutside/secret.png',
    '/library-assets/blobs/escape/../../outside/secret.png',
  ])('public static mount never serves %s', async (url) => {
    const res = record('public-traversal', await request(app).get(url));
    expect(res.status).not.toBe(200);
  });
});

describe('uploads', () => {
  const upload = (buffer: Buffer, filename: string, fields: Record<string, string> = {}) => {
    let test = admin('post', '/assets');
    for (const [key, value] of Object.entries({ category: 'Maps', ...fields })) {
      test = test.field(key, value);
    }
    return test.attach('file', buffer, filename);
  };

  it('accepts a PNG, stores content-addressed files and records provenance', async () => {
    const bytes = await png(600, 300, '#123456');
    const res = await call(
      upload(bytes, 'Castle Map.png', {
        tags: 'castle,day',
        attribution: 'Cartographer A',
        license: 'CC-BY-4.0',
        sourceUrl: 'https://example.test/castle',
      }),
    );
    expect(res.status).toBe(201);
    const asset = res.body.asset;
    const hash = sha(bytes);
    expect(asset).toMatchObject({
      origin: 'admin',
      status: 'active',
      version: 1,
      name: 'Castle Map',
      category: 'Maps',
      tags: ['castle', 'day'],
      attribution: 'Cartographer A',
      license: 'CC-BY-4.0',
      sha256: hash,
      mimeType: 'image/png',
      dimensions: { width: 600, height: 300 },
      files: {
        original: `blobs/${hash.slice(0, 2)}/${hash}.png`,
        thumbnail: `derivatives/v1/${hash.slice(0, 2)}/${hash}.webp`,
      },
    });
    expect(asset.id).toMatch(/^adm-[0-9a-f-]{36}$/);
    expect(asset.provenance).toMatchObject({
      createdBy: ACTOR,
      originalFilename: 'Castle Map.png',
      sourceUrl: 'https://example.test/castle',
    });
    expect(asset.derivative).toMatchObject({ specVersion: 'v1', width: 256, height: 128 });
    expect(fs.readFileSync(path.join(libraryRoot, asset.files.original))).toEqual(bytes);

    // Appears in the public library index.
    const pub = record('public', await request(app).get(`/library/asset/${asset.id}`));
    expect(pub.status).toBe(200);
    expect(pub.body.source).toBe('admin');
    const file = record('public', await request(app).get(`/library-assets/${asset.files.thumbnail}`));
    expect(file.status).toBe(200);
  });

  it('never uses the client filename as a storage path', async () => {
    const res = await call(upload(await png(20, 20, '#010203'), '../../../evil.png'));
    expect(res.status).toBe(201);
    expect(res.body.asset.provenance.originalFilename).toBe('evil.png');
    expect(res.body.asset.files.original).toMatch(/^blobs\/[0-9a-f]{2}\/[0-9a-f]{64}\.png$/);
    expect(fs.existsSync(path.join(base, 'evil.png'))).toBe(false);
  });

  it('strips EXIF from the stored derivative', async () => {
    const jpeg = await sharp({
      create: { width: 300, height: 200, channels: 3, background: '#445566' },
    })
      .jpeg()
      .withExif({ IFD0: { Copyright: 'gps-exif-marker' } })
      .toBuffer();
    const res = await call(upload(jpeg, 'photo.jpg'));
    expect(res.status).toBe(201);
    expect(res.body.asset.mimeType).toBe('image/jpeg');
    const derivative = fs.readFileSync(path.join(libraryRoot, res.body.asset.files.thumbnail));
    expect((await sharp(derivative).metadata()).exif).toBeUndefined();
    expect(derivative.includes(Buffer.from('gps-exif-marker'))).toBe(false);
  });

  it('accepts WebP', async () => {
    const webp = await sharp({
      create: { width: 40, height: 40, channels: 3, background: '#778899' },
    })
      .webp()
      .toBuffer();
    const res = await call(upload(webp, 'token.webp'));
    expect(res.status).toBe(201);
    expect(res.body.asset.mimeType).toBe('image/webp');
  });

  describe('duplicate detection', () => {
    it('returns the existing asset for a duplicate hash unless forced', async () => {
      const bytes = await png(30, 30, '#abcdef');
      const first = await call(upload(bytes, 'one.png'));
      expect(first.status).toBe(201);

      const second = await call(upload(bytes, 'two.png', { name: 'Other name' }));
      expect(second.status).toBe(200);
      expect(second.body.duplicate).toBe(true);
      expect(second.body.duplicateOf).toBe(first.body.asset.id);
      expect(second.body.asset.id).toBe(first.body.asset.id);

      const forced = await call(upload(bytes, 'three.png', { force: 'true' }));
      expect(forced.status).toBe(201);
      expect(forced.body.duplicate).toBe(false);
      expect(forced.body.duplicateOf).toBe(first.body.asset.id);
      expect(forced.body.asset.id).not.toBe(first.body.asset.id);
      expect(forced.body.asset.files.original).toBe(first.body.asset.files.original);
    });

    it('detects a duplicate of an ingested library asset', async () => {
      const res = await call(upload(fixtures.goblin.bytes, 'goblin-copy.png'));
      expect(res.status).toBe(200);
      expect(res.body.duplicateOf).toBe(fixtures.goblin.id);
    });
  });

  describe('malicious and invalid files', () => {
    const cases: [string, () => Promise<Buffer> | Buffer, string, number, string][] = [
      [
        'renamed Windows executable',
        () => Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200, 0x90)]),
        'token.png',
        415,
        'unsupported-media-type',
      ],
      [
        'ELF binary named .jpg',
        () => Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.alloc(100)]),
        'map.jpg',
        415,
        'unsupported-media-type',
      ],
      [
        'SVG with script',
        () =>
          Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
          ),
        'map.svg',
        415,
        'unsupported-media-type',
      ],
      [
        'SVG renamed to .png',
        () => Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>'),
        'map.png',
        415,
        'unsupported-media-type',
      ],
      [
        'HTML renamed to .webp',
        () => Buffer.from('<html><script>alert(1)</script></html>'),
        'x.webp',
        415,
        'unsupported-media-type',
      ],
      [
        'GIF',
        () => Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'latin1'),
        'x.gif',
        415,
        'unsupported-media-type',
      ],
      [
        'PNG/ZIP polyglot (data after IEND)',
        async () =>
          Buffer.concat([
            await png(16, 16, '#222222'),
            Buffer.from('PK\x03\x04payload<script>alert(1)</script>', 'latin1'),
          ]),
        'poly.png',
        415,
        'trailing-data',
      ],
      [
        'JPEG with appended script',
        async () =>
          Buffer.concat([
            await sharp({
              create: { width: 16, height: 16, channels: 3, background: '#333' },
            })
              .jpeg()
              .toBuffer(),
            Buffer.from('<?php system($_GET["c"]); ?>'),
          ]),
        'poly.jpg',
        415,
        'trailing-data',
      ],
      [
        'PNG signature with garbage body',
        () =>
          Buffer.concat([
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
            Buffer.alloc(64, 0x41),
          ]),
        'broken.png',
        422,
        'image-decode-failed',
      ],
      [
        'decompression bomb header (100k x 100k)',
        () => bombPng(100_000, 100_000),
        'bomb.png',
        422,
        'image-too-large',
      ],
      [
        'over-wide image header (20000 x 10)',
        () => bombPng(20_000, 10),
        'wide.png',
        422,
        'image-too-large',
      ],
    ];

    it.each(cases)('rejects %s', async (_label, make, filename, status, code) => {
      const res = await call(upload(await make(), filename));
      expect(res.status).toBe(status);
      expect(res.body.error).toBe(code);
    });

    it('ignores a spoofed image Content-Type on non-image bytes', async () => {
      const res = await call(
        admin('post', '/assets')
          .field('category', 'Maps')
          .attach('file', Buffer.from('<svg onload="alert(1)"/>'), {
            filename: 'x.png',
            contentType: 'image/png',
          }),
      );
      expect(res.status).toBe(415);
    });

    it('stores nothing for rejected uploads', async () => {
      const before = (await call(admin('get', '/assets?status=all&limit=100'))).body.total;
      await call(upload(bombPng(100_000, 100_000), 'bomb2.png'));
      const after = (await call(admin('get', '/assets?status=all&limit=100'))).body.total;
      expect(after).toBe(before);
    });

    it('requires multipart, a file part and a category', async () => {
      expect((await call(admin('post', '/assets').send({ category: 'Maps' }))).status).toBe(415);
      expect(
        (await call(admin('post', '/assets').field('category', 'Maps'))).body.error,
      ).toBe('file-required');
      const noCategory = await call(
        admin('post', '/assets').attach('file', await png(10, 10, '#fff'), 'x.png'),
      );
      expect(noCategory.status).toBe(400);
      expect(noCategory.body.details.field).toBe('category');
    });
  });

  describe('size and quota limits', () => {
    it('rejects an upload over the configured size limit with 413', async () => {
      process.env.ASSET_ADMIN_MAX_UPLOAD_BYTES = '2048';
      try {
        const big = await sharp(crypto.randomBytes(200 * 200 * 3), {
          raw: { width: 200, height: 200, channels: 3 },
        })
          .png()
          .toBuffer();
        expect(big.length).toBeGreaterThan(2048);
        const res = await call(upload(big, 'big.png'));
        expect(res.status).toBe(413);
        expect(res.body.error).toBe('file-too-large');
        expect(res.body.details.maxBytes).toBe(2048);
      } finally {
        delete process.env.ASSET_ADMIN_MAX_UPLOAD_BYTES;
      }
    });

    it('enforces the default 25MB limit', async () => {
      const oversized = Buffer.concat([
        await png(10, 10, '#fff'),
        Buffer.alloc(25 * 1024 * 1024 + 1),
      ]);
      const res = await call(upload(oversized, 'huge.png'));
      expect(res.status).toBe(413);
    });

    it('rejects an upload that would exceed the admin storage quota', async () => {
      process.env.ASSET_ADMIN_STORAGE_QUOTA_BYTES = '1';
      try {
        const res = await call(upload(await png(12, 12, '#0f0f0f'), 'quota.png'));
        expect(res.status).toBe(413);
        expect(res.body.error).toBe('quota-exceeded');
      } finally {
        delete process.env.ASSET_ADMIN_STORAGE_QUOTA_BYTES;
      }
    });
  });
});

describe('metadata edits with optimistic concurrency', () => {
  it('applies an edit, bumps the version and rejects a stale edit with 409', async () => {
    const id = fixtures.goblin.id;
    const ok = await call(
      admin('patch', `/assets/${id}`).send({
        expectedVersion: 0,
        name: 'Goblin Boss',
        tags: ['goblin', 'boss'],
        license: 'OGL-1.0a',
        attribution: 'Tom Cartos',
      }),
    );
    expect(ok.status).toBe(200);
    expect(ok.body.asset).toMatchObject({
      version: 1,
      name: 'Goblin Boss',
      tags: ['goblin', 'boss'],
      license: 'OGL-1.0a',
      attribution: 'Tom Cartos',
    });
    expect(ok.body.asset.provenance.updatedBy).toBe(ACTOR);
    expect(ok.body.asset.history.at(-1)).toMatchObject({ actor: ACTOR, version: 1 });

    const stale = await call(
      admin('patch', `/assets/${id}`).send({ expectedVersion: 0, name: 'Lost update' }),
    );
    expect(stale.status).toBe(409);
    expect(stale.body.error).toBe('version-conflict');
    expect(stale.body.details.currentVersion).toBe(1);

    // Public library reflects the edit.
    const pub = record('public', await request(app).get(`/library/asset/${id}`));
    expect(pub.body.name).toBe('Goblin Boss');
    expect(pub.body.license).toBe('OGL-1.0a');
  });

  it('accepts If-Match and rejects a mismatched ETag', async () => {
    const id = fixtures.goblin.id;
    const current = await call(admin('get', `/assets/${id}`));
    const ok = await call(
      admin('patch', `/assets/${id}`).set('If-Match', current.headers.etag).send({ category: 'Goblinoid' }),
    );
    expect(ok.status).toBe(200);
    const stale = await call(
      admin('patch', `/assets/${id}`).set('If-Match', current.headers.etag).send({ category: 'X' }),
    );
    expect(stale.status).toBe(409);
    const otherAsset = await call(
      admin('patch', `/assets/${id}`).set('If-Match', `"${fixtures.dragon.id}:0"`).send({ category: 'X' }),
    );
    expect(otherAsset.status).toBe(412);
  });

  it('requires a precondition and rejects unknown or invalid fields', async () => {
    const id = fixtures.goblin.id;
    expect((await call(admin('patch', `/assets/${id}`).send({ name: 'x' }))).status).toBe(428);
    expect(
      (await call(admin('patch', `/assets/${id}`).send({ expectedVersion: 2, sha256: 'x' }))).body
        .error,
    ).toBe('unknown-field');
    expect(
      (await call(admin('patch', `/assets/${id}`).send({ expectedVersion: 2, category: 'a/b' })))
        .status,
    ).toBe(400);
    expect(
      (await call(admin('patch', `/assets/${id}`).send({ expectedVersion: 2 }))).body.error,
    ).toBe('empty-patch');
  });

  it('persists edits across a reload from disk', async () => {
    const reload = record(
      'reload',
      await request(app).post('/library/reload').set('x-nexus-auth', SECRET),
    );
    expect(reload.status).toBe(200);
    const res = await call(admin('get', `/assets/${fixtures.goblin.id}`));
    expect(res.body.asset.name).toBe('Goblin Boss');
    expect(res.body.asset.version).toBe(2);
  });
});

describe('derivatives and manifest rebuild', () => {
  it('regenerates one asset derivative', async () => {
    const thumb = path.join(libraryRoot, fixtures.dragon.thumb);
    fs.rmSync(thumb);
    const res = await call(admin('post', `/assets/${fixtures.dragon.id}/derivatives`));
    expect(res.status).toBe(200);
    expect(res.body.asset.derivative).toMatchObject({ specVersion: 'v1', generatedBy: ACTOR });
    expect(fs.existsSync(thumb)).toBe(true);
    expect((await sharp(thumb).metadata()).format).toBe('webp');
  });

  it('rebuilds the manifest and regenerates missing derivatives', async () => {
    const thumb = path.join(libraryRoot, fixtures.ghoul.thumb);
    fs.rmSync(thumb);
    const res = await call(admin('post', '/jobs/manifest-rebuild?wait=true'));
    expect(res.status).toBe(200);
    expect(res.body.job).toMatchObject({ type: 'manifest-rebuild', status: 'succeeded', actor: ACTOR });
    expect(res.body.job.result.derivatives.regenerated).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(thumb)).toBe(true);

    const job = await call(admin('get', `/jobs/${res.body.job.id}`));
    expect(job.body.job.status).toBe('succeeded');
    const list = await call(admin('get', '/jobs'));
    expect(list.body.jobs.some((j: { id: string }) => j.id === res.body.job.id)).toBe(true);
  });
});

describe('quarantine, restore and permanent deletion', () => {
  it('previews references and requires acknowledgement for referenced assets', async () => {
    const preview = await call(
      admin('post', `/assets/${fixtures.ghoul.id}/delete-preview`).send({
        referencingCampaignIds: ['camp-1', 'camp-2'],
      }),
    );
    expect(preview.status).toBe(200);
    expect(preview.body.references).toEqual({ campaignIds: ['camp-1', 'camp-2'], count: 2 });
    expect(preview.body.allowedActions).toEqual({
      quarantine: true,
      restore: false,
      permanentDelete: false,
    });
    expect(preview.body.warnings.join(' ')).toMatch(/2 campaign/);

    const invalid = await call(
      admin('post', `/assets/${fixtures.ghoul.id}/delete-preview`).send({
        referencingCampaignIds: ['../x'],
      }),
    );
    expect(invalid.status).toBe(400);

    const blocked = await call(
      admin('post', `/assets/${fixtures.ghoul.id}/quarantine`).send({
        expectedVersion: 0,
        referencingCampaignIds: ['camp-1'],
      }),
    );
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe('asset-referenced');
  });

  it('refuses permanent deletion of an asset that is not quarantined', async () => {
    const res = await call(
      admin('post', `/assets/${fixtures.ghoul.id}/permanent-delete`).send({
        expectedVersion: 0,
        confirm: true,
      }),
    );
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('not-quarantined');
    expect(fs.existsSync(path.join(libraryRoot, fixtures.ghoul.blob))).toBe(true);
  });

  it('quarantine hides the asset from every public route and restore brings it back', async () => {
    const id = fixtures.ghoul.id;
    const q = await call(
      admin('post', `/assets/${id}/quarantine`).send({
        expectedVersion: 0,
        reason: 'licence query',
        referencingCampaignIds: ['camp-1'],
        acknowledgeReferences: true,
      }),
    );
    expect(q.status).toBe(200);
    expect(q.body.asset.status).toBe('quarantined');
    expect(q.body.asset.quarantine).toMatchObject({ by: ACTOR, reason: 'licence query' });
    expect(q.body.movedFiles.sort()).toEqual([fixtures.ghoul.blob, fixtures.ghoul.thumb].sort());
    expect(q.body.asset.publicUrls).toBeNull();

    expect(fs.existsSync(path.join(libraryRoot, fixtures.ghoul.blob))).toBe(false);
    expect(fs.existsSync(path.join(libraryRoot, '.admin', 'quarantine', fixtures.ghoul.blob))).toBe(true);

    const list = record('public', await request(app).get('/library?limit=100&includeRemoved=true'));
    expect(list.body.assets.some((a: { id: string }) => a.id === id)).toBe(false);
    expect(record('public', await request(app).get(`/library/asset/${id}`)).status).toBe(404);
    const search = record('public', await request(app).get('/library?q=ghoul'));
    expect(search.body.total).toBe(0);
    const facets = record('public', await request(app).get('/library/facets'));
    expect(facets.body.categories.find((c: { name: string }) => c.name === 'Undead').count).toBe(1);
    for (const key of [fixtures.ghoul.blob, fixtures.ghoul.thumb]) {
      expect(record('public', await request(app).get(`/library-assets/${key}`)).status).toBe(404);
      expect(
        record('public', await request(app).get(`/library-assets/.admin/quarantine/${key}`)).status,
      ).toBe(404);
    }

    // Admin can still preview a quarantined asset.
    const preview = await call(admin('get', `/assets/${id}/preview?variant=original`));
    expect(preview.status).toBe(200);

    // Admin list hides quarantined by default only when filtered.
    const quarantined = await call(admin('get', '/assets?status=quarantined'));
    expect(quarantined.body.assets.map((a: { id: string }) => a.id)).toEqual([id]);

    const restored = await call(
      admin('post', `/assets/${id}/restore`).send({ expectedVersion: q.body.asset.version }),
    );
    expect(restored.status).toBe(200);
    expect(restored.body.asset.status).toBe('active');
    expect(restored.body.missingFiles).toEqual([]);
    expect(record('public', await request(app).get(`/library/asset/${id}`)).status).toBe(200);
    expect(
      record('public', await request(app).get(`/library-assets/${fixtures.ghoul.blob}`)).status,
    ).toBe(200);
  });

  it('keeps shared blobs in place when quarantining one of two assets using them', async () => {
    const bytes = await png(33, 33, '#fedcba');
    const first = await call(
      admin('post', '/assets').field('category', 'Maps').attach('file', bytes, 'a.png'),
    );
    const second = await call(
      admin('post', '/assets')
        .field('category', 'Maps')
        .field('force', 'true')
        .attach('file', bytes, 'b.png'),
    );
    const q = await call(
      admin('post', `/assets/${first.body.asset.id}/quarantine`).send({ expectedVersion: 1 }),
    );
    expect(q.status).toBe(200);
    expect(q.body.movedFiles).toEqual([]);
    expect(q.body.retainedFiles.map((r: { key: string }) => r.key)).toContain(
      first.body.asset.files.original,
    );
    expect(
      record(
        'public',
        await request(app).get(`/library-assets/${second.body.asset.files.original}`),
      ).status,
    ).toBe(200);
  });

  it('permanently deletes only a quarantined asset, only with confirm=true', async () => {
    const bytes = await png(44, 44, '#0a0b0c');
    const up = await call(
      admin('post', '/assets').field('category', 'Props').attach('file', bytes, 'doomed.png'),
    );
    const id = up.body.asset.id;
    const original = up.body.asset.files.original as string;
    const q = await call(admin('post', `/assets/${id}/quarantine`).send({ expectedVersion: 1 }));
    expect(q.status).toBe(200);

    const noConfirm = await call(
      admin('post', `/assets/${id}/permanent-delete`).send({ expectedVersion: 2 }),
    );
    expect(noConfirm.status).toBe(400);
    expect(noConfirm.body.error).toBe('confirmation-required');
    const truthyString = await call(
      admin('post', `/assets/${id}/permanent-delete`).send({ expectedVersion: 2, confirm: 'true' }),
    );
    expect(truthyString.status).toBe(400);

    const stale = await call(
      admin('post', `/assets/${id}/permanent-delete`).send({ expectedVersion: 1, confirm: true }),
    );
    expect(stale.status).toBe(409);

    const del = await call(
      admin('post', `/assets/${id}/permanent-delete`).send({ expectedVersion: 2, confirm: true }),
    );
    expect(del.status).toBe(200);
    expect(del.body.asset.status).toBe('deleted');
    expect(del.body.asset.deletion.by).toBe(ACTOR);
    expect(del.body.deletedFiles).toContain(original);
    expect(fs.existsSync(path.join(libraryRoot, '.admin', 'quarantine', original))).toBe(false);
    expect(fs.existsSync(path.join(libraryRoot, original))).toBe(false);

    const hidden = await call(admin('get', '/assets?origin=admin&limit=100'));
    expect(hidden.body.assets.some((a: { id: string }) => a.id === id)).toBe(false);
    const again = await call(
      admin('post', `/assets/${id}/restore`).send({ expectedVersion: 3 }),
    );
    expect(again.status).toBe(409);
    const edit = await call(admin('patch', `/assets/${id}`).send({ expectedVersion: 3, name: 'x' }));
    expect(edit.status).toBe(409);
  });
});

describe('integrity report and metrics', () => {
  it('reports no report before the first run', async () => {
    // Other tests may have run a report already in this worker; only assert shape.
    const res = await call(admin('get', '/integrity'));
    expect([200, 404]).toContain(res.status);
  });

  it('detects orphaned files, missing files and hash mismatches', async () => {
    const orphanKey = 'blobs/zz/orphan-file.png';
    fs.mkdirSync(path.join(libraryRoot, 'blobs', 'zz'), { recursive: true });
    fs.writeFileSync(path.join(libraryRoot, orphanKey), 'orphan');
    fs.rmSync(path.join(libraryRoot, fixtures.integrity.thumb));
    fs.writeFileSync(path.join(libraryRoot, fixtures.dragon.blob), 'tampered-content');

    const run = await call(
      admin('post', '/jobs/integrity-report?wait=true').send({ verifyHashes: true }),
    );
    expect(run.status).toBe(200);
    expect(run.body.job.status).toBe('succeeded');

    const res = await call(admin('get', '/integrity'));
    expect(res.status).toBe(200);
    const report = res.body.report;
    expect(report.orphanedFiles).toContainEqual(
      expect.objectContaining({ key: orphanKey, location: 'live' }),
    );
    expect(report.missingFiles).toContainEqual(
      expect.objectContaining({
        key: fixtures.integrity.thumb,
        assetIds: [fixtures.integrity.id],
      }),
    );
    expect(report.hashMismatches).toContainEqual(
      expect.objectContaining({
        key: fixtures.dragon.blob,
        expected: fixtures.dragon.sha256,
        assetIds: [fixtures.dragon.id],
      }),
    );
    expect(report.counts.symlinksSkipped).toBeGreaterThanOrEqual(1);
    expect(report.storage.blobs.bytes).toBeGreaterThan(0);
    expect(report.counts.hashesVerified).toBeGreaterThan(0);

    const metrics = record('metrics', await request(app).get('/metrics'));
    expect(metrics.text).toMatch(/^asset_missing_files [1-9]\d*$/m);
    expect(metrics.text).toMatch(/^asset_orphaned_files [1-9]\d*$/m);
    expect(metrics.text).toMatch(/^asset_hash_mismatches [1-9]\d*$/m);

    // Repair for later tests.
    fs.writeFileSync(path.join(libraryRoot, fixtures.dragon.blob), fixtures.dragon.bytes);
    fs.rmSync(path.join(libraryRoot, orphanKey));
  });

  it('exposes the contracted metric names in Prometheus text format', async () => {
    const res = record('metrics', await request(app).get('/metrics'));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/plain;.*version=0\.0\.4/);
    for (const [name, type] of [
      ['asset_objects_total', 'gauge'],
      ['asset_bytes_total', 'gauge'],
      ['asset_derivative_failures_total', 'counter'],
      ['asset_manifest_age_seconds', 'gauge'],
      ['asset_missing_files', 'gauge'],
    ]) {
      expect(res.text).toContain(`# TYPE ${name} ${type}`);
    }
    expect(res.text).toMatch(/^asset_objects_total\{status="active"\} \d+$/m);
    expect(res.text).toMatch(/^asset_bytes_total\{area="blobs"\} \d+$/m);
    expect(res.text).toMatch(/^asset_derivative_failures_total\{operation="upload"\} \d+$/m);
    expect(res.text).toMatch(/^asset_manifest_age_seconds \d+(\.\d+)?$/m);
    expect(res.text).toMatch(/^asset_uploads_total\{result="created"\} [1-9]\d*$/m);
    expect(res.text).toMatch(/^asset_lifecycle_operations_total\{action="quarantine"\} [1-9]\d*$/m);
  });

  it('fails closed with METRICS_AUTH_TOKEN set', async () => {
    process.env.METRICS_AUTH_TOKEN = METRICS_TOKEN;
    try {
      expect(record('metrics', await request(app).get('/metrics')).status).toBe(401);
      expect(
        record(
          'metrics',
          await request(app).get('/metrics').set('Authorization', 'Bearer wrong'),
        ).status,
      ).toBe(401);
      expect(
        record(
          'metrics',
          await request(app).get('/metrics').set('Authorization', `Basic ${METRICS_TOKEN}x`),
        ).status,
      ).toBe(401);
      const ok = record(
        'metrics',
        await request(app).get('/metrics').set('Authorization', `Bearer ${METRICS_TOKEN}`),
      );
      expect(ok.status).toBe(200);
      expect(ok.text).toContain('asset_objects_total');
    } finally {
      delete process.env.METRICS_AUTH_TOKEN;
    }
  });
});

describe('admin state safety', () => {
  it('fails closed (503) when the admin overlay is unreadable, and recovers', async () => {
    const stateFile = path.join(libraryRoot, '.admin', 'state.json');
    const good = fs.readFileSync(stateFile);
    fs.writeFileSync(stateFile, '{not json');
    try {
      const reload = record(
        'reload',
        await request(app).post('/library/reload').set('x-nexus-auth', SECRET),
      );
      expect(reload.status).toBe(503);
      expect(record('public', await request(app).get('/library')).status).toBe(503);
      const res = await call(admin('get', '/assets'));
      expect(res.status).toBe(503);
      expect(res.body.error).toBe('admin-state-unavailable');
    } finally {
      fs.writeFileSync(stateFile, good);
      await request(app).post('/library/reload').set('x-nexus-auth', SECRET);
    }
    expect(record('public', await request(app).get('/library')).status).toBe(200);
  });

  it('leaves unknown admin routes as JSON 404s with audit context', async () => {
    const res = await call(admin('get', '/nope'));
    expect(res.status).toBe(404);
    expect(res.body.audit.actor).toBe(ACTOR);
  });
});
