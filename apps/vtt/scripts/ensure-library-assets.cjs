#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      options[key] = 'true';
    } else {
      options[key] = next;
      i += 1;
    }
  }
  return options;
}

function resolvePath(value, fallback) {
  const selected = value || fallback;
  return path.isAbsolute(selected) ? selected : path.resolve(repoRoot, selected);
}

function readManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return { ok: false, reason: `manifest missing at ${manifestPath}` };
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) {
      return { ok: false, reason: 'manifest has no assets' };
    }
    return { ok: true, manifest };
  } catch (error) {
    return { ok: false, reason: `manifest parse failed: ${error.message}` };
  }
}

function findSampleAsset(manifest) {
  return manifest.assets.find(
    (asset) =>
      !asset.removed &&
      typeof asset.thumbnail === 'string' &&
      typeof asset.fullImage === 'string',
  );
}

function validateLibraryTree(rootPath, manifestRelativePath) {
  const manifestPath = path.join(rootPath, manifestRelativePath);
  const manifestResult = readManifest(manifestPath);
  if (!manifestResult.ok) return manifestResult;

  const sampleAsset = findSampleAsset(manifestResult.manifest);
  if (!sampleAsset) {
    return { ok: false, reason: 'manifest has no active asset with image paths' };
  }

  const missingPaths = [sampleAsset.thumbnail, sampleAsset.fullImage]
    .map((assetPath) => path.join(rootPath, assetPath))
    .filter((assetPath) => !fs.existsSync(assetPath));

  if (missingPaths.length > 0) {
    return {
      ok: false,
      reason: `sample asset file missing: ${missingPaths[0]}`,
    };
  }

  return {
    ok: true,
    totalAssets: manifestResult.manifest.totalAssets ?? manifestResult.manifest.assets.length,
    sampleAsset: sampleAsset.id,
  };
}

function copySeedPack(sourcePath, targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
  fs.cpSync(sourcePath, targetPath, {
    recursive: true,
    force: true,
    errorOnExist: false,
    preserveTimestamps: true,
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourcePath = resolvePath(
    args.source || process.env.ASSET_SEED_SOURCE,
    'asset-packs/tmt',
  );
  const targetPath = resolvePath(
    args.target || process.env.LIBRARY_DATA_PATH,
    'assets-data',
  );
  const manifestRelativePath =
    args.manifest ||
    process.env.ASSET_SEED_MANIFEST ||
    'manifests/manifest-v2.json';

  const targetStatus = validateLibraryTree(targetPath, manifestRelativePath);
  if (targetStatus.ok) {
    console.log(
      `Library asset volume ready at ${targetPath} (${targetStatus.totalAssets} assets; sample ${targetStatus.sampleAsset}).`,
    );
    return;
  }

  if (!fs.existsSync(sourcePath)) {
    console.error(`Library asset volume is not ready: ${targetStatus.reason}`);
    console.error(`Seed source not found at ${sourcePath}.`);
    console.error('Populate asset-packs/tmt through Git LFS, or set ASSET_SEED_SOURCE to a valid seed pack.');
    process.exit(1);
  }

  const sourceStatus = validateLibraryTree(sourcePath, manifestRelativePath);
  if (!sourceStatus.ok) {
    console.error(`Seed source is not valid: ${sourceStatus.reason}`);
    process.exit(1);
  }

  if (path.resolve(sourcePath) === path.resolve(targetPath)) {
    console.error(`Library asset volume is not ready: ${targetStatus.reason}`);
    console.error('Seed source and target are the same path, so the script cannot repair the target.');
    process.exit(1);
  }

  console.log(`Seeding library assets from ${sourcePath} to ${targetPath}...`);
  copySeedPack(sourcePath, targetPath);

  const seededStatus = validateLibraryTree(targetPath, manifestRelativePath);
  if (!seededStatus.ok) {
    console.error(`Seed completed but target is still invalid: ${seededStatus.reason}`);
    process.exit(1);
  }

  console.log(
    `Library asset volume seeded at ${targetPath} (${seededStatus.totalAssets} assets; sample ${seededStatus.sampleAsset}).`,
  );
}

main();
