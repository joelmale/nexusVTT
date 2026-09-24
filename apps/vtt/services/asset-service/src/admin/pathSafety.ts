import fs from 'fs';
import path from 'path';
import { AdminError } from './errors';

/**
 * Path safety for every admin read, write, move and delete.
 *
 * Storage keys are relative, forward-slash paths such as
 * `blobs/ab/<sha256>.png`. They come from the manifest (which an operator or
 * the ingest pipeline may have produced) or are generated server-side; client
 * filenames are never used as keys. Every key is validated lexically and then
 * resolved with realpath so a symlink or junction cannot redirect an operation
 * outside the configured root.
 */

const MAX_KEY_LENGTH = 512;
const SEGMENT_PATTERN = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

export function isSafeRelativeKey(key: unknown): key is string {
  if (typeof key !== 'string') return false;
  if (key.length === 0 || key.length > MAX_KEY_LENGTH) return false;
  // NUL, backslashes (Windows separators), colons (drive letters, NTFS
  // alternate data streams, URL schemes) and percent signs (encoded
  // traversal) never appear in generated keys.
  if (/[\0\\:%]/.test(key)) return false;
  if (key.startsWith('/') || path.isAbsolute(key)) return false;
  const segments = key.split('/');
  return segments.every(
    (segment) =>
      segment !== '.' &&
      segment !== '..' &&
      // Leading dots are rejected so `.admin/` state and quarantine areas
      // cannot be addressed through a manifest key.
      SEGMENT_PATTERN.test(segment),
  );
}

export function assertSafeRelativeKey(key: unknown): string {
  if (!isSafeRelativeKey(key)) {
    throw new AdminError(400, 'unsafe-path', 'Storage key is not a safe relative path');
  }
  return key;
}

/** True when `candidate` is `root` itself or strictly beneath it. */
export function isWithinRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  if (relative === '') return true;
  return (
    !relative.startsWith('..') &&
    !path.isAbsolute(relative) &&
    relative.split(path.sep)[0] !== '..'
  );
}

async function realpathOrNull(target: string): Promise<string | null> {
  try {
    return await fs.promises.realpath(target);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return null;
    throw error;
  }
}

export interface ResolvedKey {
  /** Absolute, realpath-verified location. Never returned to clients. */
  absolutePath: string;
  exists: boolean;
}

/**
 * Resolves `key` beneath `root`, verifying with realpath that neither the
 * target nor its nearest existing ancestor escapes the root. Rejects a key
 * whose final component is itself a symlink so callers never move or delete
 * a link (or whatever it points at).
 */
export async function resolveWithinRoot(root: string, key: string): Promise<ResolvedKey> {
  const safeKey = assertSafeRelativeKey(key);
  const rootReal = await realpathOrNull(root);
  if (!rootReal) {
    throw new AdminError(503, 'storage-unavailable', 'Asset storage root is unavailable');
  }

  const candidate = path.resolve(rootReal, ...safeKey.split('/'));
  if (!isWithinRoot(rootReal, candidate)) {
    throw new AdminError(400, 'unsafe-path', 'Storage key escapes the asset root');
  }

  let leafStat: fs.Stats | null = null;
  try {
    leafStat = await fs.promises.lstat(candidate);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' && code !== 'ENOTDIR') throw error;
  }

  if (leafStat?.isSymbolicLink()) {
    throw new AdminError(400, 'unsafe-path', 'Storage key resolves to a symbolic link');
  }

  if (leafStat) {
    const real = await fs.promises.realpath(candidate);
    if (!isWithinRoot(rootReal, real)) {
      throw new AdminError(400, 'unsafe-path', 'Storage key escapes the asset root');
    }
    return { absolutePath: real, exists: true };
  }

  // Not present yet: the nearest existing ancestor must still be inside the
  // root, otherwise a junction/symlinked directory would redirect the write.
  let ancestor = path.dirname(candidate);
  for (;;) {
    const real = await realpathOrNull(ancestor);
    if (real) {
      if (!isWithinRoot(rootReal, real)) {
        throw new AdminError(400, 'unsafe-path', 'Storage key escapes the asset root');
      }
      break;
    }
    const parent = path.dirname(ancestor);
    if (parent === ancestor) {
      throw new AdminError(400, 'unsafe-path', 'Storage key escapes the asset root');
    }
    ancestor = parent;
  }
  return { absolutePath: candidate, exists: false };
}

/** Identifier pattern shared by asset ids, campaign ids and actor ids. */
export const ASSET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
