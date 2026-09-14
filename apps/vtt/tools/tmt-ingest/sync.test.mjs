import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { diffInventories, mergeManifest, buildStoredFileIndex, syncRelease } from './sync.mjs';

function makeManifestFixture(overrides = {}) {
  return {
    version: '1.0.0',
    generatedAt: '1970-01-01T00:00:00.000Z',
    totalAssets: 2,
    categories: ['Ghoul', 'Zombie'],
    assets: [
      {
        id: 'tmt-aaaa000000000001',
        name: 'Ghoul One',
        category: 'Ghoul',
        tags: ['ghoul'],
        thumbnail: 'derivatives/aa/aaaa1.webp',
        fullImage: 'blobs/aa/aaaa1.png',
        size: 100,
        sha256: 'aaaa000000000001hash',
        source: 'tmt',
        dimensions: { width: 0, height: 0 },
        sourcePath: 'Ghoul/GhoulOne.png',
      },
      {
        id: 'tmt-bbbb000000000002',
        name: 'Zombie One',
        category: 'Zombie',
        tags: ['zombie'],
        thumbnail: 'derivatives/bb/bbbb2.webp',
        fullImage: 'blobs/bb/bbbb2.png',
        size: 200,
        sha256: 'bbbb000000000002hash',
        source: 'tmt',
        dimensions: { width: 0, height: 0 },
        sourcePath: 'Zombie/ZombieOne.png',
      },
    ],
    ...overrides,
  };
}

describe('buildStoredFileIndex', () => {
  it('indexes primary sourcePath and duplicatePaths', () => {
    const manifest = makeManifestFixture();
    manifest.assets[0].duplicatePaths = ['Ghoul/GhoulOneDup.png'];
    const index = buildStoredFileIndex(manifest);
    expect(index.get('Ghoul/GhoulOne.png')).toMatchObject({ assetId: 'tmt-aaaa000000000001' });
    expect(index.get('Ghoul/GhoulOneDup.png')).toMatchObject({ assetId: 'tmt-aaaa000000000001' });
  });
});

describe('diffInventories', () => {
  it('produces an empty diff when the new inventory exactly matches the stored manifest', () => {
    const manifest = makeManifestFixture();
    const newInventory = {
      'Ghoul/GhoulOne.png': { hash: 'aaaa000000000001hash', size: 100 },
      'Zombie/ZombieOne.png': { hash: 'bbbb000000000002hash', size: 200 },
    };
    const diff = diffInventories(newInventory, manifest);
    expect(diff.added).toEqual([]);
    expect(diff.changed).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.unchanged).toEqual(['Ghoul/GhoulOne.png', 'Zombie/ZombieOne.png']);
  });

  it('classifies exactly N changed-hash files', () => {
    const assets = [];
    for (let i = 0; i < 20; i++) {
      assets.push({
        id: `tmt-${String(i).padStart(16, '0')}`,
        name: `Asset ${i}`,
        category: 'Cat',
        tags: ['cat'],
        thumbnail: `derivatives/x/${i}.webp`,
        fullImage: `blobs/x/${i}.png`,
        size: 10,
        sha256: `hash-${i}-old`,
        source: 'tmt',
        sourcePath: `Cat/Asset${i}.png`,
      });
    }
    const manifest = { version: '1.0.0', assets };

    const newInventory = {};
    for (let i = 0; i < 20; i++) {
      // First 10 files get a new hash (changed); rest stay the same.
      const hash = i < 10 ? `hash-${i}-new` : `hash-${i}-old`;
      newInventory[`Cat/Asset${i}.png`] = { hash, size: 10 };
    }

    const diff = diffInventories(newInventory, manifest);
    expect(diff.changed).toHaveLength(10);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.unchanged).toHaveLength(10);
  });

  it('classifies a new file as added', () => {
    const manifest = makeManifestFixture();
    const newInventory = {
      'Ghoul/GhoulOne.png': { hash: 'aaaa000000000001hash', size: 100 },
      'Zombie/ZombieOne.png': { hash: 'bbbb000000000002hash', size: 200 },
      'Ghoul/GhoulTwo.png': { hash: 'cccc-new-hash', size: 150 },
    };
    const diff = diffInventories(newInventory, manifest);
    expect(diff.added).toEqual(['Ghoul/GhoulTwo.png']);
  });

  it('classifies a missing file as removed', () => {
    const manifest = makeManifestFixture();
    const newInventory = {
      'Ghoul/GhoulOne.png': { hash: 'aaaa000000000001hash', size: 100 },
      // ZombieOne.png absent from the new release
    };
    const diff = diffInventories(newInventory, manifest);
    expect(diff.removed).toEqual(['Zombie/ZombieOne.png']);
  });

  it('treats a previously-tombstoned path reappearing as added, not unchanged', () => {
    const manifest = makeManifestFixture();
    manifest.assets[1].removed = true;
    manifest.assets[1].removedInRelease = '1.1.0';
    const newInventory = {
      'Ghoul/GhoulOne.png': { hash: 'aaaa000000000001hash', size: 100 },
      'Zombie/ZombieOne.png': { hash: 'bbbb000000000002hash', size: 200 },
    };
    const diff = diffInventories(newInventory, manifest);
    expect(diff.added).toEqual(['Zombie/ZombieOne.png']);
    expect(diff.unchanged).toEqual(['Ghoul/GhoulOne.png']);
  });

  it('handles an empty/null stored manifest (first sync) by treating everything as added', () => {
    const newInventory = {
      'Ghoul/GhoulOne.png': { hash: 'x', size: 1 },
    };
    const diff = diffInventories(newInventory, null);
    expect(diff.added).toEqual(['Ghoul/GhoulOne.png']);
    expect(diff.removed).toEqual([]);
  });
});

describe('mergeManifest', () => {
  it('tombstones removed assets without deleting their manifest entry', () => {
    const manifest = makeManifestFixture();
    const merged = mergeManifest(manifest, { assets: [] }, ['Zombie/ZombieOne.png'], '1.2.0');

    const zombie = merged.assets.find((a) => a.id === 'tmt-bbbb000000000002');
    expect(zombie).toBeDefined();
    expect(zombie.removed).toBe(true);
    expect(zombie.removedInRelease).toBe('1.2.0');
    // Still present in the full asset list (not deleted).
    expect(merged.assets).toHaveLength(2);
    // But excluded from totalAssets/categories (active-only accounting).
    expect(merged.totalAssets).toBe(1);
    expect(merged.categories).toEqual(['Ghoul']);
  });

  it('adds new assets from a fresh partial manifest', () => {
    const manifest = makeManifestFixture();
    const fresh = {
      assets: [
        {
          id: 'tmt-cccc000000000003',
          name: 'New Asset',
          category: 'Newcat',
          tags: ['newcat'],
          thumbnail: 'derivatives/cc/cccc3.webp',
          fullImage: 'blobs/cc/cccc3.png',
          size: 50,
          sha256: 'cccc-hash',
          source: 'tmt',
          sourcePath: 'Newcat/New.png',
        },
      ],
    };
    const merged = mergeManifest(manifest, fresh, [], '1.2.0');
    expect(merged.assets).toHaveLength(3);
    expect(merged.totalAssets).toBe(3);
    expect(merged.categories).toContain('Newcat');
  });

  it('clears a stale tombstone when a re-added asset comes back with the same id', () => {
    const manifest = makeManifestFixture();
    manifest.assets[1].removed = true;
    manifest.assets[1].removedInRelease = '1.1.0';

    const fresh = { assets: [{ ...manifest.assets[1], removed: undefined }] };
    delete fresh.assets[0].removed;
    const merged = mergeManifest(manifest, fresh, [], '1.2.0');
    const zombie = merged.assets.find((a) => a.id === 'tmt-bbbb000000000002');
    expect(zombie.removed).toBeUndefined();
    expect(merged.totalAssets).toBe(2);
  });
});

describe('syncRelease (integration, tmp dirs)', () => {
  let tmpRoot;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tmt-sync-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  function writePng(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    // Minimal PNG header + padding — enough for fs.copyFileSync; sharp may
    // fail to decode it, which processAsset tolerates by recording a failure
    // rather than throwing.
    fs.writeFileSync(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }

  it('dry-run against the same release produces an empty effective diff and writes nothing', async () => {
    const release = '1.1.1';
    const stagingDir = path.join(tmpRoot, 'staging', release);
    writePng(path.join(stagingDir, 'Ghoul', 'GhoulOne.png'));

    const inventory = {
      'Ghoul/GhoulOne.png': { hash: 'deadbeef00000001', size: 8 },
    };
    fs.writeFileSync(path.join(stagingDir, 'raw-inventory.json'), JSON.stringify(inventory));

    const manifestsDir = path.join(tmpRoot, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });
    const storedManifest = {
      version: '1.0.0',
      totalAssets: 1,
      categories: ['Ghoul'],
      assets: [
        {
          id: 'tmt-deadbeef000000',
          name: 'Ghoul One',
          category: 'Ghoul',
          tags: ['ghoul'],
          thumbnail: 'derivatives/de/deadbeef00000001.webp',
          fullImage: 'blobs/de/deadbeef00000001.png',
          size: 8,
          sha256: 'deadbeef00000001',
          source: 'tmt',
          sourcePath: 'Ghoul/GhoulOne.png',
        },
      ],
    };
    fs.writeFileSync(path.join(manifestsDir, 'manifest-v2.json'), JSON.stringify(storedManifest));

    const result = await syncRelease(release, { dryRun: true, assetsDataDir: tmpRoot });
    expect(result.written).toBe(false);
    expect(result.summary).toEqual({ added: 0, changed: 0, removed: 0, unchanged: 1 });

    // Nothing written: manifest file untouched, no blobs dir created.
    const manifestAfter = fs.readFileSync(path.join(manifestsDir, 'manifest-v2.json'), 'utf8');
    expect(JSON.parse(manifestAfter)).toEqual(storedManifest);
    expect(fs.existsSync(path.join(tmpRoot, 'blobs'))).toBe(false);
  });

  it('a simulated release bump with 10 changed files re-processes exactly those 10', async () => {
    const release = '1.1.2';
    const stagingDir = path.join(tmpRoot, 'staging', release);
    const manifestsDir = path.join(tmpRoot, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });

    const storedAssets = [];
    const inventory = {};
    const TOTAL = 15;
    const CHANGED = 10;
    for (let i = 0; i < TOTAL; i++) {
      const relPath = `Cat/Asset${i}.png`;
      writePng(path.join(stagingDir, relPath));
      // Vary the hash within the first 16 chars (the id-derivation window)
      // so each asset gets a distinct id — a realistic sha256 would too.
      const oldHash = `old${String(i).padStart(13, '0')}hash`;
      storedAssets.push({
        id: `tmt-${oldHash.slice(0, 16)}`,
        name: `Asset ${i}`,
        category: 'Cat',
        tags: ['cat'],
        thumbnail: `derivatives/xx/${oldHash}.webp`,
        fullImage: `blobs/xx/${oldHash}.png`,
        size: 8,
        sha256: oldHash,
        source: 'tmt',
        sourcePath: relPath,
      });
      const hash = i < CHANGED ? `new${String(i).padStart(13, '0')}hash` : oldHash;
      inventory[relPath] = { hash, size: 8 };
    }

    fs.writeFileSync(path.join(stagingDir, 'raw-inventory.json'), JSON.stringify(inventory));
    fs.writeFileSync(
      path.join(manifestsDir, 'manifest-v2.json'),
      JSON.stringify({ version: '1.0.0', totalAssets: TOTAL, categories: ['Cat'], assets: storedAssets }),
    );

    const result = await syncRelease(release, { assetsDataDir: tmpRoot });
    expect(result.summary.changed).toBe(CHANGED);
    expect(result.summary.added).toBe(0);
    expect(result.written).toBe(true);

    // Exactly CHANGED assets now carry a "new..." sha256; the rest keep "old...".
    const newHashCount = result.manifest.assets.filter((a) => a.sha256.startsWith('new')).length;
    expect(newHashCount).toBe(CHANGED);
    expect(result.manifest.totalAssets).toBe(TOTAL);
  });

  it('tombstones a removed file end-to-end without deleting its manifest entry', async () => {
    const release = '1.1.3';
    const stagingDir = path.join(tmpRoot, 'staging', release);
    const manifestsDir = path.join(tmpRoot, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });

    writePng(path.join(stagingDir, 'Cat', 'Keep.png'));
    // 'Cat/Gone.png' intentionally NOT written to the new staging dir/inventory.

    const inventory = {
      'Cat/Keep.png': { hash: 'keephash0000001', size: 8 },
    };
    fs.writeFileSync(path.join(stagingDir, 'raw-inventory.json'), JSON.stringify(inventory));

    const storedManifest = {
      version: '1.0.0',
      totalAssets: 2,
      categories: ['Cat'],
      assets: [
        {
          id: 'tmt-keephash000000',
          name: 'Keep',
          category: 'Cat',
          tags: ['cat'],
          thumbnail: 'derivatives/ke/keephash0000001.webp',
          fullImage: 'blobs/ke/keephash0000001.png',
          size: 8,
          sha256: 'keephash0000001',
          source: 'tmt',
          sourcePath: 'Cat/Keep.png',
        },
        {
          id: 'tmt-gonehash000000',
          name: 'Gone',
          category: 'Cat',
          tags: ['cat'],
          thumbnail: 'derivatives/go/gonehash0000001.webp',
          fullImage: 'blobs/go/gonehash0000001.png',
          size: 8,
          sha256: 'gonehash0000001',
          source: 'tmt',
          sourcePath: 'Cat/Gone.png',
        },
      ],
    };
    fs.writeFileSync(path.join(manifestsDir, 'manifest-v2.json'), JSON.stringify(storedManifest));

    const result = await syncRelease(release, { assetsDataDir: tmpRoot });
    expect(result.summary.removed).toBe(1);

    const gone = result.manifest.assets.find((a) => a.id === 'tmt-gonehash000000');
    expect(gone).toBeDefined(); // entry preserved, not deleted
    expect(gone.removed).toBe(true);
    expect(gone.removedInRelease).toBe(release);
    expect(result.manifest.totalAssets).toBe(1); // active count excludes tombstoned
    expect(result.manifest.assets).toHaveLength(2); // full list still has both
  });
});
