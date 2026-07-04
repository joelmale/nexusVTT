import fs from 'fs';
import path from 'path';
import sizeOf from 'image-size';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const validExts = new Set(['.png', '.webp', '.jpg', '.jpeg']);

export function humanizeName(filename) {
  let name = filename.replace(/\.(png|jpg|jpeg|webp)$/i, '');
  // Replace AarakocraArcticTern (1) -> Aarakocra Arctic Tern 1
  name = name.replace(/\s*\((\d+)\)\s*/g, ' $1');
  // Camel case split
  name = name.replace(/([a-z])([A-Z])/g, '$1 $2');
  name = name.replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
  // Replace underscores and hyphens
  name = name.replace(/[_-]/g, ' ');
  // Collapse spaces
  name = name.replace(/\s+/g, ' ').trim();
  return name;
}

/**
 * Normalize a raw inventory (relPath -> {size, hash}) into a deterministic
 * manifest of unique assets. Pure function over in-memory data + a
 * `resolveFile(relPath)` callback used only for image dimension probing, so
 * it's reusable both for full-release normalization and targeted re-normalize
 * of a subset of files (sync.mjs).
 *
 * @param {Record<string, {size:number, hash:string}>} rawInventory
 * @param {(relPath: string) => string} resolveFile - returns absolute path for dimension probing
 * @returns {{ manifest: object, residue: Record<string, unknown> }}
 */
export function normalizeInventory(rawInventory, resolveFile) {
  const assets = [];
  const residue = {};
  const seenHashes = new Map();

  for (const [relPath, info] of Object.entries(rawInventory)) {
    const ext = path.extname(relPath).toLowerCase();
    if (!validExts.has(ext)) {
      continue; // Ignore non-images
    }

    const parts = relPath.split(path.sep);
    if (parts.length < 2) {
      residue[relPath] = info;
      continue;
    }

    const category = parts[0];
    const filename = parts[parts.length - 1];
    const name = humanizeName(filename);

    // Deduplication
    if (seenHashes.has(info.hash)) {
      const existing = seenHashes.get(info.hash);
      if (!existing.duplicatePaths) existing.duplicatePaths = [];
      existing.duplicatePaths.push(relPath);
      continue;
    }

    let dimensions = { width: 0, height: 0 };
    try {
      const fullPath = resolveFile(relPath);
      const d = sizeOf(fullPath);
      dimensions = { width: d.width, height: d.height };
    } catch (err) {
      console.warn(`Could not get dimensions for ${relPath}: ${err.message}`);
    }

    // Stable ID based on hash
    const id = `tmt-${info.hash.substring(0, 16)}`;

    const asset = {
      id,
      name,
      category,
      tags: [category.toLowerCase()],
      thumbnail: `derivatives/${info.hash.substring(0, 2)}/${info.hash}.webp`,
      fullImage: `blobs/${info.hash.substring(0, 2)}/${info.hash}${ext}`,
      size: info.size,
      sha256: info.hash,
      source: 'tmt',
      dimensions,
      sourcePath: relPath,
    };

    assets.push(asset);
    seenHashes.set(info.hash, asset);
  }

  // Sort assets deterministically
  assets.sort((a, b) => a.id.localeCompare(b.id));

  const manifest = {
    version: '1.0.0',
    generatedAt: '1970-01-01T00:00:00.000Z', // Fixed for determinism
    totalAssets: assets.length,
    categories: [...new Set(assets.map((a) => a.category))].sort(),
    assets,
  };

  return { manifest, residue };
}

/**
 * Full-release normalize: reads staging/<release>/raw-inventory.json, writes
 * normalized-manifest.json (+ residue.json if any) into the same staging dir.
 * Exits the process on residue >10% (CLI-only behavior); returns
 * { manifest, residue, residuePercent } for programmatic callers.
 */
export function normalizeRelease(release, { exitOnResidue = false } = {}) {
  const stagingDir = path.resolve(__dirname, `../../assets-data/staging/${release}`);
  const rawInventoryPath = path.join(stagingDir, 'raw-inventory.json');

  if (!fs.existsSync(rawInventoryPath)) {
    throw new Error(`Missing raw-inventory.json in ${stagingDir}`);
  }

  const rawInventory = JSON.parse(fs.readFileSync(rawInventoryPath, 'utf8'));
  const { manifest, residue } = normalizeInventory(rawInventory, (relPath) =>
    path.join(stagingDir, relPath),
  );

  fs.writeFileSync(
    path.join(stagingDir, 'normalized-manifest.json'),
    JSON.stringify(manifest, null, 2),
  );

  const residueKeys = Object.keys(residue);
  if (residueKeys.length > 0) {
    fs.writeFileSync(path.join(stagingDir, 'residue.json'), JSON.stringify(residue, null, 2));
  } else if (fs.existsSync(path.join(stagingDir, 'residue.json'))) {
    fs.unlinkSync(path.join(stagingDir, 'residue.json'));
  }

  const residuePercent =
    (residueKeys.length / (manifest.assets.length + residueKeys.length)) * 100 || 0;
  console.log(`Processed ${manifest.assets.length} unique assets.`);
  console.log(`Residue: ${residueKeys.length} files (${residuePercent.toFixed(2)}%).`);

  if (residuePercent > 10) {
    console.error('Residue exceeds 10%! Rules need improvement.');
    if (exitOnResidue) process.exit(1);
  }

  return { manifest, residue, residuePercent };
}

// Thin CLI wrapper — only runs when invoked directly (`node normalize.mjs`).
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const release = process.argv[2] || '1.1.1';
  normalizeRelease(release, { exitOnResidue: true });
}
