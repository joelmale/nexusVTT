import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const release = process.argv[2] || '1.1.1';
const stagingDir = path.resolve(`../../assets-data/staging/${release}`);
const manifestPath = path.join(stagingDir, 'normalized-manifest.json');
const assetsDataDir = path.resolve('../../assets-data');

const blobsDir = path.join(assetsDataDir, 'blobs');
const derivativesDir = path.join(assetsDataDir, 'derivatives', 'v1');
const browseDir = path.join(assetsDataDir, 'browse');
const manifestsDir = path.join(assetsDataDir, 'manifests');

// Ensure directories exist
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDir(blobsDir);
ensureDir(derivativesDir);
ensureDir(browseDir);
ensureDir(manifestsDir);

if (!fs.existsSync(manifestPath)) {
  console.error(`Missing ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Delete existing symlinks in browse dir to avoid stale ones
if (fs.existsSync(browseDir)) {
  fs.rmSync(browseDir, { recursive: true, force: true });
  ensureDir(browseDir);
}

async function processAsset(asset) {
  const sourceFile = path.join(stagingDir, asset.sourcePath);
  if (!fs.existsSync(sourceFile)) {
    console.warn(`Source file missing: ${sourceFile}`);
    return;
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

  // 1. Copy blob if not exists
  if (!fs.existsSync(destBlob)) {
    fs.copyFileSync(sourceFile, destBlob);
  }

  // 2. Generate derivative if not exists
  if (!fs.existsSync(destDeriv)) {
    try {
      await sharp(sourceFile)
        .resize(256, 256, { fit: 'inside' })
        .webp({ quality: 80 })
        .toFile(destDeriv);
    } catch (err) {
      console.warn(`Failed to generate derivative for ${sourceFile}: ${err.message}`);
    }
  }

  // 3. Create browse tree symlink
  const categoryDir = path.join(browseDir, asset.category);
  ensureDir(categoryDir);
  
  // Clean name for file system (remove invalid chars)
  const cleanName = asset.name.replace(/[<>:"/\\|?*]+/g, '').trim();
  const symlinkPath = path.join(categoryDir, `${cleanName}${ext}`);
  
  // Use relative path for symlink to keep it portable
  // symlink is at: browse/<cat>/<name.ext>
  // target is at: blobs/<prefix>/<hash.ext>
  // relative from browse/<cat> to blobs/<prefix> is ../../blobs/<prefix>/<hash.ext>
  const relativeTarget = path.join('..', '..', 'blobs', prefix, `${hash}${ext}`);
  
  // Only create if it doesn't exist (handle duplicate names by appending index)
  let finalSymlinkPath = symlinkPath;
  let counter = 1;
  while (fs.existsSync(finalSymlinkPath) || fs.lstatSync(finalSymlinkPath, { throwIfNoEntry: false })) {
    finalSymlinkPath = path.join(categoryDir, `${cleanName}-${counter}${ext}`);
    counter++;
  }
  
  fs.symlinkSync(relativeTarget, finalSymlinkPath);
}

async function main() {
  console.log(`Processing ${manifest.assets.length} assets...`);
  
  // Process in batches to avoid overwhelming IO/memory
  const BATCH_SIZE = 50;
  for (let i = 0; i < manifest.assets.length; i += BATCH_SIZE) {
    const batch = manifest.assets.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(processAsset));
    process.stdout.write(`\rProcessed ${Math.min(i + BATCH_SIZE, manifest.assets.length)} / ${manifest.assets.length}`);
  }
  console.log('\nAsset processing complete.');

  // Copy manifest
  const destManifest = path.join(manifestsDir, 'manifest-v2.json');
  fs.writeFileSync(destManifest, JSON.stringify(manifest, null, 2));
  console.log(`Manifest written to ${destManifest}`);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
