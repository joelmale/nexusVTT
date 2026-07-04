import fs from 'fs';
import path from 'path';
import { parseArgs } from 'util';
import { fileURLToPath } from 'url';
import { normalizeInventory } from './normalize.mjs';
import { processAssets } from './derivatives.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DATA_DIR = path.resolve(__dirname, '../../assets-data');

/**
 * Build a relPath -> sha256 map for every file path a stored manifest knows
 * about, including duplicate paths that were folded into a single asset
 * during normalization. This is the file-level view the diff operates over.
 *
 * @param {object} manifest - manifest-v2.json shape
 * @returns {Map<string, {hash:string, assetId:string, removed:boolean}>}
 */
export function buildStoredFileIndex(manifest) {
  const index = new Map();
  for (const asset of manifest.assets ?? []) {
    const removed = asset.removed === true;
    index.set(asset.sourcePath, { hash: asset.sha256, assetId: asset.id, removed });
    for (const dupPath of asset.duplicatePaths ?? []) {
      index.set(dupPath, { hash: asset.sha256, assetId: asset.id, removed });
    }
  }
  return index;
}

/**
 * Pure diff function: compares a new release's raw inventory (relPath ->
 * {hash, size}) against the stored manifest's known file index, classifying
 * every path into added / changed / removed / unchanged. Testable without
 * touching disk.
 *
 * @param {Record<string, {hash:string, size:number}>} newInventory
 * @param {object} storedManifest - manifest-v2.json shape (may be empty/null for first sync)
 * @returns {{
 *   added: string[],
 *   changed: string[],
 *   removed: string[],
 *   unchanged: string[],
 *   storedIndex: Map<string, {hash:string, assetId:string, removed:boolean}>,
 * }}
 */
export function diffInventories(newInventory, storedManifest) {
  const storedIndex = buildStoredFileIndex(storedManifest ?? { assets: [] });

  const added = [];
  const changed = [];
  const unchanged = [];

  for (const [relPath, info] of Object.entries(newInventory)) {
    const stored = storedIndex.get(relPath);
    if (!stored || stored.removed) {
      // Either never seen, or previously tombstoned and now reappearing —
      // treat as added (full pipeline re-adds it, clearing any tombstone).
      added.push(relPath);
    } else if (stored.hash !== info.hash) {
      changed.push(relPath);
    } else {
      unchanged.push(relPath);
    }
  }

  const newPaths = new Set(Object.keys(newInventory));
  const removed = [];
  for (const [relPath, stored] of storedIndex.entries()) {
    if (!stored.removed && !newPaths.has(relPath)) {
      removed.push(relPath);
    }
  }

  added.sort();
  changed.sort();
  removed.sort();
  unchanged.sort();

  return { added, changed, removed, unchanged, storedIndex };
}

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function summarize(diff) {
  return {
    added: diff.added.length,
    changed: diff.changed.length,
    removed: diff.removed.length,
    unchanged: diff.unchanged.length,
  };
}

/**
 * Merge freshly (re-)normalized assets for added/changed paths into the
 * stored manifest, and tombstone assets whose sourcePath disappeared.
 * Assets are keyed by id (hash-derived), so a changed-hash file produces a
 * NEW id for that sourcePath. The old id that previously owned the path has
 * that path stripped from it (and from duplicatePaths); if the old id ends
 * up owning zero sourcePaths, it is tombstoned too — its content is gone
 * from this sourcePath's perspective, superseded by the new hash.
 *
 * @param {object} storedManifest - existing manifest-v2.json (or null)
 * @param {object} freshPartialManifest - normalizeInventory() output over ONLY added+changed paths
 * @param {string[]} removedPaths - relPaths absent from the new release
 * @param {string} releaseTag
 * @returns {object} merged manifest
 */
export function mergeManifest(storedManifest, freshPartialManifest, removedPaths, releaseTag) {
  const base = storedManifest
    ? JSON.parse(JSON.stringify(storedManifest))
    : { version: '1.0.0', generatedAt: '1970-01-01T00:00:00.000Z', totalAssets: 0, categories: [], assets: [] };

  const byId = new Map(base.assets.map((a) => [a.id, a]));

  // Reverse index: sourcePath -> id currently claiming it (primary or dup),
  // kept in sync as we reassign paths below.
  const pathOwner = new Map();
  for (const asset of byId.values()) {
    pathOwner.set(asset.sourcePath, asset.id);
    for (const p of asset.duplicatePaths ?? []) pathOwner.set(p, asset.id);
  }

  function stripPathFromAsset(relPath, ownerId) {
    const owner = byId.get(ownerId);
    if (!owner) return;
    if (owner.sourcePath === relPath) {
      // Primary path is moving elsewhere; promote a duplicate if one exists,
      // otherwise this id owns nothing and will be tombstoned below.
      const [nextPrimary, ...rest] = owner.duplicatePaths ?? [];
      if (nextPrimary) {
        owner.sourcePath = nextPrimary;
        owner.duplicatePaths = rest.length > 0 ? rest : undefined;
        if (owner.duplicatePaths === undefined) delete owner.duplicatePaths;
      } else {
        owner.sourcePath = null; // orphaned — tombstoned in the pass below
      }
    } else if (owner.duplicatePaths?.includes(relPath)) {
      owner.duplicatePaths = owner.duplicatePaths.filter((p) => p !== relPath);
      if (owner.duplicatePaths.length === 0) delete owner.duplicatePaths;
    }
  }

  // 1. Apply added/changed assets from the fresh partial normalize pass.
  for (const freshAsset of freshPartialManifest.assets) {
    // If this sourcePath was previously owned by a different id (changed-hash
    // case), strip it from that old asset first so ownership doesn't fork.
    const previousOwnerId = pathOwner.get(freshAsset.sourcePath);
    if (previousOwnerId && previousOwnerId !== freshAsset.id) {
      stripPathFromAsset(freshAsset.sourcePath, previousOwnerId);
    }

    const existing = byId.get(freshAsset.id);
    if (existing) {
      // Same content hash already known under this id (e.g. added path that
      // dedupes against something already stored) — merge duplicatePaths,
      // clear any stale tombstone.
      const mergedDupPaths = new Set([
        ...(existing.duplicatePaths ?? []),
        ...(freshAsset.duplicatePaths ?? []),
      ]);
      if (existing.sourcePath !== freshAsset.sourcePath) mergedDupPaths.add(freshAsset.sourcePath);
      if (mergedDupPaths.size > 0) existing.duplicatePaths = [...mergedDupPaths].sort();
      if (!existing.sourcePath) existing.sourcePath = freshAsset.sourcePath;
      delete existing.removed;
      delete existing.removedInRelease;
    } else {
      byId.set(freshAsset.id, { ...freshAsset });
    }
    pathOwner.set(freshAsset.sourcePath, freshAsset.id);
  }

  // 2. Tombstone removed/orphaned assets — an asset is tombstoned once none
  //    of its known sourcePaths (primary + duplicates) survive in the new
  //    release's file set (explicitly removed, or reassigned to another id
  //    above, leaving this asset with sourcePath === null).
  const removedSet = new Set(removedPaths);
  for (const asset of byId.values()) {
    if (asset.sourcePath === null) {
      asset.removed = true;
      asset.removedInRelease = releaseTag;
      continue;
    }
    const allPaths = [asset.sourcePath, ...(asset.duplicatePaths ?? [])];
    // "Still present" = at least one of this asset's known sourcePaths is
    // NOT in the removed set, i.e. still part of the current release.
    const stillPresent = allPaths.some((p) => !removedSet.has(p));
    if (!stillPresent) {
      asset.removed = true;
      asset.removedInRelease = releaseTag;
    }
  }

  const mergedAssets = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  const activeAssets = mergedAssets.filter((a) => !a.removed);

  return {
    version: base.version || '1.0.0',
    generatedAt: '1970-01-01T00:00:00.000Z',
    totalAssets: activeAssets.length,
    categories: [...new Set(activeAssets.map((a) => a.category))].sort(),
    assets: mergedAssets,
  };
}

/**
 * End-to-end sync for a release tag: diff -> targeted normalize (added+changed
 * paths only) -> targeted derive (blobs/derivatives/symlinks for those assets)
 * -> merged manifest write (including tombstones for removed paths).
 *
 * @param {string} release
 * @param {{dryRun?: boolean, assetsDataDir?: string}} [opts]
 */
export async function syncRelease(release, opts = {}) {
  const { dryRun = false, assetsDataDir = ASSETS_DATA_DIR } = opts;

  const stagingDir = path.join(assetsDataDir, 'staging', release);
  const rawInventoryPath = path.join(stagingDir, 'raw-inventory.json');
  const manifestPath = path.join(assetsDataDir, 'manifests', 'manifest-v2.json');

  const newInventory = loadJson(rawInventoryPath);
  if (!newInventory) {
    throw new Error(
      `Missing raw-inventory.json for release ${release} at ${rawInventoryPath}. Run acquire.mjs first.`,
    );
  }
  const storedManifest = loadJson(manifestPath);

  const diff = diffInventories(newInventory, storedManifest);
  const summary = summarize(diff);

  console.log(`Sync diff for release ${release}:`);
  console.log(`  added:     ${summary.added}`);
  console.log(`  changed:   ${summary.changed}`);
  console.log(`  removed:   ${summary.removed}`);
  console.log(`  unchanged: ${summary.unchanged}`);

  if (dryRun) {
    console.log('Dry run — no files written.');
    return { diff, summary, written: false };
  }

  const pathsToProcess = [...diff.added, ...diff.changed];
  if (pathsToProcess.length === 0 && diff.removed.length === 0) {
    console.log('No changes to apply.');
    return { diff, summary, written: false };
  }

  // Targeted normalize: only added+changed paths, sourced from the new
  // release's staging dir (files must already be present there via acquire.mjs).
  const subsetInventory = {};
  for (const relPath of pathsToProcess) subsetInventory[relPath] = newInventory[relPath];

  const { manifest: freshPartialManifest, residue } = normalizeInventory(subsetInventory, (relPath) =>
    path.join(stagingDir, relPath),
  );
  const residueKeys = Object.keys(residue);
  if (residueKeys.length > 0) {
    console.warn(`${residueKeys.length} path(s) in the diff fell into residue (skipped):`, residueKeys);
  }

  // Targeted derive: blobs/derivatives/symlinks for the freshly (re-)normalized assets only.
  const blobsDir = path.join(assetsDataDir, 'blobs');
  const derivativesDir = path.join(assetsDataDir, 'derivatives', 'v1');
  const browseDir = path.join(assetsDataDir, 'browse');
  [blobsDir, derivativesDir, browseDir, path.dirname(manifestPath)].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  const results = await processAssets(freshPartialManifest.assets, stagingDir, {
    blobsDir,
    derivativesDir,
    browseDir,
  });
  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    const failureListPath = path.join(assetsDataDir, 'manifests', `sync-failures-${release}.json`);
    fs.writeFileSync(
      failureListPath,
      JSON.stringify(
        failures.map((f) => ({ id: f.asset.id, sourcePath: f.asset.sourcePath, error: f.error })),
        null,
        2,
      ),
    );
    console.warn(`${failures.length} asset(s) failed during sync derive. See ${failureListPath}`);
  }

  const merged = mergeManifest(storedManifest, freshPartialManifest, diff.removed, release);
  fs.writeFileSync(manifestPath, JSON.stringify(merged, null, 2));
  console.log(`Merged manifest written to ${manifestPath} (${merged.totalAssets} active assets).`);

  return { diff, summary, written: true, manifest: merged, failures };
}

// Thin CLI wrapper
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const { values } = parseArgs({
    options: {
      release: { type: 'string', default: '1.1.1' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });

  if (values.help) {
    console.log(`Usage: node sync.mjs --release <tag> [--dry-run]

  --release   TMT release tag to sync against the stored manifest (default: 1.1.1)
  --dry-run   Print the diff summary and exit without writing any files
  --help      Show this message

Requires staging/<release>/raw-inventory.json to already exist (run acquire.mjs first).`);
    process.exit(0);
  }

  syncRelease(values.release, { dryRun: values['dry-run'] }).catch((err) => {
    console.error('Sync failed:', err);
    process.exit(1);
  });
}
