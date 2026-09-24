import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Admin overlay state, persisted at `<LIBRARY_DATA_PATH>/.admin/state.json`.
 *
 * `manifests/manifest-v2.json` stays owned by the TMT ingest pipeline
 * (`tools/tmt-ingest/sync.mjs` rewrites it and would tombstone anything it
 * did not ingest). Admin uploads, metadata edits and quarantine flags
 * therefore live in this overlay, and the served library index is
 * `manifest-v2.json` with the overlay applied (see catalog.ts).
 *
 * The `.admin/` directory is never served: `/library-assets` rejects any
 * dot-prefixed path segment before reaching express.static.
 */
export const ADMIN_DIR = '.admin';
export const STATE_FILE = 'state.json';
export const QUARANTINE_DIR = 'quarantine';

export type AdminRecordStatus = 'active' | 'quarantined' | 'deleted';

export interface AdminHistoryEntry {
  at: string;
  actor: string;
  action: string;
  version: number;
}

export interface AdminAssetRecord {
  id: string;
  /** `admin` = uploaded through this API; `library` = overlay on a manifest-v2 asset. */
  origin: 'admin' | 'library';
  version: number;
  status: AdminRecordStatus;
  // Metadata. For `admin` records these are the values; for `library`
  // records they override the manifest-v2 values when present.
  name?: string;
  category?: string;
  tags?: string[];
  attribution?: string | null;
  license?: string | null;
  // Content fields (admin-origin only).
  sha256?: string;
  ext?: string;
  mimeType?: string;
  size?: number;
  dimensions?: { width: number; height: number };
  source?: string;
  provenance: {
    createdBy?: string;
    createdAt?: string;
    originalFilename?: string;
    sourceUrl?: string;
    updatedBy?: string;
    updatedAt?: string;
  };
  derivative?: {
    specVersion: string;
    generatedAt: string;
    generatedBy: string;
    width: number;
    height: number;
    bytes: number;
  };
  quarantine?: {
    at: string;
    by: string;
    reason?: string;
    referencingCampaignIds?: string[];
  };
  deletion?: { at: string; by: string };
  history: AdminHistoryEntry[];
}

export interface AdminState {
  schemaVersion: 1;
  records: Record<string, AdminAssetRecord>;
}

export const MAX_HISTORY_ENTRIES = 25;

export function emptyAdminState(): AdminState {
  return { schemaVersion: 1, records: {} };
}

export function adminDir(libraryRoot: string): string {
  return path.join(libraryRoot, ADMIN_DIR);
}

export function quarantineRoot(libraryRoot: string): string {
  return path.join(libraryRoot, ADMIN_DIR, QUARANTINE_DIR);
}

function isAdminState(value: unknown): value is AdminState {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { schemaVersion?: unknown; records?: unknown };
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.records === 'object' &&
    candidate.records !== null &&
    !Array.isArray(candidate.records)
  );
}

/**
 * Loads the overlay. A missing file is an empty overlay; an unreadable or
 * malformed file throws, so callers fail closed rather than silently
 * re-publishing quarantined assets.
 */
export function loadAdminState(libraryRoot: string): AdminState {
  const file = path.join(adminDir(libraryRoot), STATE_FILE);
  if (!fs.existsSync(file)) return emptyAdminState();
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!isAdminState(parsed)) {
    throw new TypeError('Invalid asset admin state file');
  }
  return parsed;
}

export async function writeFileAtomic(target: string, data: Buffer | string): Promise<void> {
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.tmp-${crypto.randomUUID()}`;
  try {
    await fs.promises.writeFile(temp, data);
    await fs.promises.rename(temp, target);
  } catch (error) {
    await fs.promises.rm(temp, { force: true });
    throw error;
  }
}

export async function saveAdminState(libraryRoot: string, state: AdminState): Promise<void> {
  await writeFileAtomic(
    path.join(adminDir(libraryRoot), STATE_FILE),
    JSON.stringify(state, null, 2),
  );
}

/** Moves a file, falling back to copy+unlink across filesystems. */
export async function moveFile(from: string, to: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(to), { recursive: true });
  try {
    await fs.promises.rename(from, to);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
    await fs.promises.copyFile(from, to, fs.constants.COPYFILE_EXCL);
    await fs.promises.unlink(from);
  }
}

/** Serializes state mutations (and the file moves that accompany them). */
export class Mutex {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task, task);
    this.tail = result.catch(() => undefined);
    return result;
  }
}
