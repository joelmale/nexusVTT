/**
 * Runtime configuration for the internal asset-administration API.
 *
 * Read from `process.env` on every call (not cached at module load) so tests
 * and operators can change limits without re-importing the service, matching
 * how `requireNexusAuth` reads `ASSET_SERVICE_SECRET` at request time.
 */
export interface AdminConfig {
  /** Largest accepted upload, in bytes. */
  maxUploadBytes: number;
  /** Largest accepted width or height, in pixels. */
  maxImageDimension: number;
  /** Largest accepted decoded pixel count (width * height * frames). */
  maxImagePixels: number;
  /** Total bytes of admin-uploaded originals; 0 disables the quota. */
  storageQuotaBytes: number;
  /** Scheduled integrity-report interval; 0 disables the schedule. */
  integrityIntervalMs: number;
  /** Whether scheduled integrity reports re-hash every original blob. */
  integrityVerifyHashes: boolean;
}

const MIB = 1024 * 1024;

export const ADMIN_CONFIG_DEFAULTS: AdminConfig = {
  maxUploadBytes: 25 * MIB,
  maxImageDimension: 16384,
  maxImagePixels: 100_000_000,
  storageQuotaBytes: 10 * 1024 * MIB,
  integrityIntervalMs: 24 * 60 * 60 * 1000,
  integrityVerifyHashes: true,
};

function nonNegativeIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function positiveIntEnv(name: string, fallback: number): number {
  const value = nonNegativeIntEnv(name, fallback);
  return value > 0 ? value : fallback;
}

function booleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return fallback;
}

export function loadAdminConfig(): AdminConfig {
  const d = ADMIN_CONFIG_DEFAULTS;
  return {
    maxUploadBytes: positiveIntEnv('ASSET_ADMIN_MAX_UPLOAD_BYTES', d.maxUploadBytes),
    maxImageDimension: positiveIntEnv(
      'ASSET_ADMIN_MAX_IMAGE_DIMENSION',
      d.maxImageDimension,
    ),
    maxImagePixels: positiveIntEnv('ASSET_ADMIN_MAX_IMAGE_PIXELS', d.maxImagePixels),
    storageQuotaBytes: nonNegativeIntEnv(
      'ASSET_ADMIN_STORAGE_QUOTA_BYTES',
      d.storageQuotaBytes,
    ),
    integrityIntervalMs: nonNegativeIntEnv(
      'ASSET_INTEGRITY_INTERVAL_MS',
      d.integrityIntervalMs,
    ),
    integrityVerifyHashes: booleanEnv(
      'ASSET_INTEGRITY_VERIFY_HASHES',
      d.integrityVerifyHashes,
    ),
  };
}
