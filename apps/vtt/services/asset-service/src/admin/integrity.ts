import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { CatalogEntry } from './catalog';
import { resolveWithinRoot } from './pathSafety';

/**
 * Storage-integrity scan over the content-addressed library tree.
 *
 * Reports are expressed in relative storage keys and asset ids only. The
 * walk never follows symbolic links (they are counted and skipped), so a
 * link planted in the tree cannot make the scan read outside the root.
 */

const SCANNED_AREAS = ['blobs', 'derivatives'] as const;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export interface IntegrityFileRef {
  key: string;
  location: 'live' | 'quarantine';
  bytes?: number;
  assetIds?: string[];
}

export interface IntegrityReport {
  id: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  verifyHashes: boolean;
  storage: {
    blobs: { files: number; bytes: number };
    derivatives: { files: number; bytes: number };
    quarantine: { files: number; bytes: number };
    totalBytes: number;
  };
  assets: Record<'active' | 'quarantined' | 'removed' | 'deleted', number>;
  counts: {
    orphanedFiles: number;
    missingFiles: number;
    hashMismatches: number;
    invalidKeys: number;
    symlinksSkipped: number;
    hashesVerified: number;
  };
  orphanedFiles: IntegrityFileRef[];
  missingFiles: IntegrityFileRef[];
  hashMismatches: { key: string; location: 'live' | 'quarantine'; assetIds: string[]; expected: string; actual: string }[];
  invalidKeys: { assetId: string; field: 'original' | 'thumbnail' }[];
  /** True when any list above was capped at `listLimit` entries. */
  truncated: boolean;
}

interface WalkResult {
  files: Map<string, number>;
  symlinks: number;
}

async function walk(root: string, prefix: string, result: WalkResult): Promise<void> {
  let dir: fs.Dir;
  try {
    dir = await fs.promises.opendir(path.join(root, ...prefix.split('/').filter(Boolean)));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return;
    throw error;
  }
  for await (const dirent of dir) {
    const key = prefix ? `${prefix}/${dirent.name}` : dirent.name;
    if (dirent.isSymbolicLink()) {
      result.symlinks += 1;
    } else if (dirent.isDirectory()) {
      await walk(root, key, result);
    } else if (dirent.isFile()) {
      const stat = await fs.promises.lstat(path.join(root, ...key.split('/')));
      result.files.set(key, stat.size);
    }
  }
}

async function sha256File(file: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

function addRef(map: Map<string, string[]>, key: string | null, id: string): void {
  if (!key) return;
  const ids = map.get(key);
  if (ids) ids.push(id);
  else map.set(key, [id]);
}

function sumBytes(files: Map<string, number>, predicate: (key: string) => boolean) {
  let count = 0;
  let bytes = 0;
  for (const [key, size] of files) {
    if (!predicate(key)) continue;
    count += 1;
    bytes += size;
  }
  return { files: count, bytes };
}

export interface IntegrityScanOptions {
  id: string;
  libraryRoot: string;
  quarantineRoot: string;
  entries: CatalogEntry[];
  verifyHashes: boolean;
  listLimit?: number;
}

export async function runIntegrityScan(options: IntegrityScanOptions): Promise<IntegrityReport> {
  const started = Date.now();
  const listLimit = options.listLimit ?? 500;
  let truncated = false;
  const capped = <T>(list: T[], item: T) => {
    if (list.length < listLimit) list.push(item);
    else truncated = true;
  };

  const live: WalkResult = { files: new Map(), symlinks: 0 };
  for (const area of SCANNED_AREAS) await walk(options.libraryRoot, area, live);
  const quarantine: WalkResult = { files: new Map(), symlinks: 0 };
  await walk(options.quarantineRoot, '', quarantine);

  const activeRefs = new Map<string, string[]>();
  const quarantinedRefs = new Map<string, string[]>();
  const removedRefs = new Map<string, string[]>();
  const expectedHash = new Map<string, string>();
  const invalidKeys: IntegrityReport['invalidKeys'] = [];
  const assets = { active: 0, quarantined: 0, removed: 0, deleted: 0 };

  for (const entry of options.entries) {
    assets[entry.status] += 1;
    if (entry.status === 'deleted') continue;
    const target =
      entry.status === 'active'
        ? activeRefs
        : entry.status === 'quarantined'
          ? quarantinedRefs
          : removedRefs;
    if (entry.status !== 'removed') {
      if (!entry.originalKey) capped(invalidKeys, { assetId: entry.id, field: 'original' });
      if (!entry.thumbnailKey) capped(invalidKeys, { assetId: entry.id, field: 'thumbnail' });
    }
    addRef(target, entry.originalKey, entry.id);
    addRef(target, entry.thumbnailKey, entry.id);
    if (
      entry.status !== 'removed' &&
      entry.originalKey?.startsWith('blobs/') &&
      entry.sha256 &&
      SHA256_PATTERN.test(entry.sha256)
    ) {
      expectedHash.set(entry.originalKey, entry.sha256);
    }
  }

  const isScannedKey = (key: string) =>
    SCANNED_AREAS.some((area) => key.startsWith(`${area}/`));

  const liveExists = async (key: string): Promise<boolean> => {
    if (live.files.has(key)) return true;
    if (isScannedKey(key)) return false;
    try {
      return (await resolveWithinRoot(options.libraryRoot, key)).exists;
    } catch {
      return false;
    }
  };

  const missingFiles: IntegrityFileRef[] = [];
  let missingCount = 0;
  for (const [key, ids] of activeRefs) {
    if (await liveExists(key)) continue;
    missingCount += 1;
    capped(missingFiles, { key, location: 'live', assetIds: ids });
  }
  for (const [key, ids] of quarantinedRefs) {
    if (activeRefs.has(key)) continue;
    if (quarantine.files.has(key) || (await liveExists(key))) continue;
    missingCount += 1;
    capped(missingFiles, { key, location: 'quarantine', assetIds: ids });
  }

  const orphanedFiles: IntegrityFileRef[] = [];
  let orphanCount = 0;
  for (const [key, bytes] of live.files) {
    if (activeRefs.has(key) || quarantinedRefs.has(key) || removedRefs.has(key)) continue;
    orphanCount += 1;
    capped(orphanedFiles, { key, location: 'live', bytes });
  }
  for (const [key, bytes] of quarantine.files) {
    if (quarantinedRefs.has(key)) continue;
    orphanCount += 1;
    capped(orphanedFiles, { key, location: 'quarantine', bytes });
  }

  const hashMismatches: IntegrityReport['hashMismatches'] = [];
  let mismatchCount = 0;
  let hashesVerified = 0;
  if (options.verifyHashes) {
    for (const [key, expected] of expectedHash) {
      let location: 'live' | 'quarantine' | null = null;
      if (live.files.has(key)) location = 'live';
      else if (quarantine.files.has(key)) location = 'quarantine';
      if (!location) continue;
      const root = location === 'live' ? options.libraryRoot : options.quarantineRoot;
      let actual: string;
      try {
        const resolved = await resolveWithinRoot(root, key);
        if (!resolved.exists) continue;
        actual = await sha256File(resolved.absolutePath);
      } catch {
        continue;
      }
      hashesVerified += 1;
      if (actual !== expected) {
        mismatchCount += 1;
        capped(hashMismatches, {
          key,
          location,
          assetIds: [...(activeRefs.get(key) ?? []), ...(quarantinedRefs.get(key) ?? [])],
          expected,
          actual,
        });
      }
    }
  }

  const blobs = sumBytes(live.files, (key) => key.startsWith('blobs/'));
  const derivatives = sumBytes(live.files, (key) => key.startsWith('derivatives/'));
  const quarantined = sumBytes(quarantine.files, () => true);
  const finished = Date.now();

  return {
    id: options.id,
    startedAt: new Date(started).toISOString(),
    finishedAt: new Date(finished).toISOString(),
    durationMs: finished - started,
    verifyHashes: options.verifyHashes,
    storage: {
      blobs,
      derivatives,
      quarantine: quarantined,
      totalBytes: blobs.bytes + derivatives.bytes + quarantined.bytes,
    },
    assets,
    counts: {
      orphanedFiles: orphanCount,
      missingFiles: missingCount,
      hashMismatches: mismatchCount,
      invalidKeys: invalidKeys.length,
      symlinksSkipped: live.symlinks + quarantine.symlinks,
      hashesVerified,
    },
    orphanedFiles,
    missingFiles,
    hashMismatches,
    invalidKeys,
    truncated,
  };
}
