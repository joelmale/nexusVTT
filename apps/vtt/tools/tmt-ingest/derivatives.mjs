import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DATA_DIR = path.resolve(__dirname, '../../assets-data');

// Derivative spec version (ADR-0011: derivatives/v<specver>/<xx>/<hash>.webp).
// derivatives.mjs OWNS the derivative path, so it also stamps the matching
// thumbnail path into manifest-v2.json — normalize.mjs is version-agnostic and
// records an unversioned placeholder that MUST be rewritten here, or every
// library thumbnail 404s (the served manifest path wouldn't match disk). Bump
// this when the derivative pipeline output format changes.
const DERIV_VERSION = 'v1';

/** Versioned thumbnail path an asset's derivative is actually written to. */
function derivativeThumbnailPath(sha256) {
  return `derivatives/${DERIV_VERSION}/${sha256.substring(0, 2)}/${sha256}.webp`;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Process a single normalized asset: copy blob, generate webp derivative,
 * and create/refresh its browse-tree symlink. Idempotent (skips existing
 * blob/derivative files). Symlink creation is safe under concurrent batches:
 * on EEXIST from a name collision it falls back to an incrementing suffix
 * and retries, rather than pre-checking existence then creating (a
 * check-then-act race when multiple assets normalize to the same clean name
 * in the same batch).
 *
 * @param {object} asset - normalized asset record (id, category, name, sha256, sourcePath, ...)
 * @param {string} sourceDir - directory `asset.sourcePath` is relative to
 * @param {{blobsDir:string, derivativesDir:string, browseDir:string}} dirs
 * @returns {Promise<{ok:boolean, asset:object, error?:string}>}
 */
export async function processAsset(asset, sourceDir, dirs) {
  const { blobsDir, derivativesDir, browseDir } = dirs;
  const sourceFile = path.join(sourceDir, asset.sourcePath);
  if (!fs.existsSync(sourceFile)) {
    return { ok: false, asset, error: `Source file missing: ${sourceFile}` };
  }

  const hash = asset.sha256;
  const prefix = hash.substring(0, 2);
  const ext = path.extname(sourceFile).toLowerCase();

  const blobPrefixDir = path.join(blobsDir, prefix);
  const derivPrefixDir = path.join(derivativesDir, prefix);
  ensureDir(blobPrefixDir);
  ensureDir(derivPrefixDir);

  const destBlob = path.join(blobPrefixDir, `${hash}${ext}`);
  const destDeriv = path.join(derivPrefixDir, `${hash}.webp`);

  try {
    // 1. Copy blob if not exists
    if (!fs.existsSync(destBlob)) {
      fs.copyFileSync(sourceFile, destBlob);
    }

    // 2. Generate derivative if not exists
    if (!fs.existsSync(destDeriv)) {
      await sharp(sourceFile)
        .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(destDeriv);
    }

    // 3. Create browse tree symlink
    const categoryDir = path.join(browseDir, asset.category);
    ensureDir(categoryDir);

    // Clean name for file system (remove invalid chars)
    const cleanName = asset.name.replace(/[<>:"/\\|?*]+/g, '').trim();
    const relativeTarget = path.join('..', '..', 'blobs', prefix, `${hash}${ext}`);

    // Retry-on-EEXIST instead of check-then-symlink: avoids a TOCTOU race
    // when concurrent batches normalize to the same clean name.
    let counter = 0;
    for (;;) {
      const candidate =
        counter === 0
          ? path.join(categoryDir, `${cleanName}${ext}`)
          : path.join(categoryDir, `${cleanName}-${counter}${ext}`);
      try {
        fs.symlinkSync(relativeTarget, candidate);
        break;
      } catch (err) {
        if (err.code === 'EEXIST') {
          // If the existing link already points at our target, we're done.
          try {
            const existingTarget = fs.readlinkSync(candidate);
            if (existingTarget === relativeTarget) break;
          } catch {
            /* not a symlink or unreadable — fall through to retry with next suffix */
          }
          counter += 1;
          continue;
        }
        throw err;
      }
    }

    return { ok: true, asset };
  } catch (err) {
    return { ok: false, asset, error: err.message };
  }
}

/**
 * Process a batch of normalized assets (from a manifest) into blobs +
 * derivatives + browse symlinks. Returns per-asset results; failures are
 * collected, never thrown, so a bad file doesn't abort the whole batch.
 *
 * @param {object[]} assets
 * @param {string} sourceDir
 * @param {{blobsDir:string, derivativesDir:string, browseDir:string}} dirs
 * @param {{batchSize?: number, onProgress?: (done:number, total:number) => void}} [opts]
 */
export async function processAssets(assets, sourceDir, dirs, opts = {}) {
  const { batchSize = 50, onProgress } = opts;
  const results = [];
  for (let i = 0; i < assets.length; i += batchSize) {
    const batch = assets.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((a) => processAsset(a, sourceDir, dirs)));
    results.push(...batchResults);
    if (onProgress) onProgress(Math.min(i + batchSize, assets.length), assets.length);
  }
  return results;
}

/**
 * Full-release derivative generation: reads staging/<release>/normalized-manifest.json,
 * writes blobs/derivatives/browse trees + manifests/manifest-v2.json under
 * assets-data/. Writes a failure list file if any asset failed processing.
 * Clears the browse dir first (full-release semantics — sync.mjs uses
 * processAssets directly instead, to avoid nuking existing entries).
 */
export async function deriveRelease(release, { assetsDataDir = ASSETS_DATA_DIR } = {}) {
  const stagingDir = path.resolve(__dirname, `../../assets-data/staging/${release}`);
  const manifestPath = path.join(stagingDir, 'normalized-manifest.json');

  const blobsDir = path.join(assetsDataDir, 'blobs');
  const derivativesDir = path.join(assetsDataDir, 'derivatives', DERIV_VERSION);
  const browseDir = path.join(assetsDataDir, 'browse');
  const manifestsDir = path.join(assetsDataDir, 'manifests');

  [blobsDir, derivativesDir, browseDir, manifestsDir].forEach(ensureDir);

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Delete existing symlinks in browse dir to avoid stale ones (full-release only).
  if (fs.existsSync(browseDir)) {
    fs.rmSync(browseDir, { recursive: true, force: true });
    ensureDir(browseDir);
  }

  console.log(`Processing ${manifest.assets.length} assets...`);
  const results = await processAssets(
    manifest.assets,
    stagingDir,
    { blobsDir, derivativesDir, browseDir },
    {
      onProgress: (done, total) => process.stdout.write(`\rProcessed ${done} / ${total}`),
    },
  );
  console.log('\nAsset processing complete.');

  const failures = results.filter((r) => !r.ok);
  const failureListPath = path.join(manifestsDir, `failures-${release}.json`);
  if (failures.length > 0) {
    fs.writeFileSync(
      failureListPath,
      JSON.stringify(
        failures.map((f) => ({ id: f.asset.id, sourcePath: f.asset.sourcePath, error: f.error })),
        null,
        2,
      ),
    );
    console.warn(`${failures.length} asset(s) failed processing. See ${failureListPath}`);
  } else if (fs.existsSync(failureListPath)) {
    fs.unlinkSync(failureListPath);
  }

  // Stamp the versioned thumbnail path (matching where derivatives were
  // actually written) into every asset before persisting manifest-v2.json.
  // normalize.mjs records an unversioned `derivatives/<xx>/<hash>.webp`
  // placeholder; the served manifest MUST point at the real on-disk location.
  for (const asset of manifest.assets) {
    if (asset.sha256) {
      asset.thumbnail = derivativeThumbnailPath(asset.sha256);
    }
  }

  const destManifest = path.join(manifestsDir, 'manifest-v2.json');
  fs.writeFileSync(destManifest, JSON.stringify(manifest, null, 2));
  console.log(`Manifest written to ${destManifest}`);

  return { manifest, failures };
}

// Thin CLI wrapper
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const release = process.argv[2] || '1.1.1';
  deriveRelease(release).catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
