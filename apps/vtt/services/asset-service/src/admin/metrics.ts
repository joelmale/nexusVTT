import { createHash, timingSafeEqual } from 'crypto';
import type { RequestHandler } from 'express';

/**
 * Prometheus text exposition for the asset service.
 *
 * Rendered by hand in the text format (version 0.0.4), the same approach the
 * VTT backend takes in server/observability/multiplayerMetrics.ts, so the
 * service gains no metrics dependency. Metric names are a contract with the
 * Phase 3 dashboards: asset_objects_total, asset_bytes_total,
 * asset_derivative_failures_total, asset_manifest_age_seconds and
 * asset_missing_files must not be renamed.
 */

export interface IntegrityMetricsSnapshot {
  finishedAtMs: number;
  durationMs: number;
  bytes: { blobs: number; derivatives: number; quarantine: number };
  missingFiles: number;
  orphanedFiles: number;
  hashMismatches: number;
}

type Labels = Record<string, string>;

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

function formatLabels(labels: Labels): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return '';
  return `{${entries.map(([k, v]) => `${k}="${escapeLabelValue(v)}"`).join(',')}}`;
}

function formatValue(value: number): string {
  if (Number.isNaN(value)) return 'NaN';
  if (value === Infinity) return '+Inf';
  if (value === -Infinity) return '-Inf';
  return String(value);
}

class LabelledCounter {
  private readonly values = new Map<string, number>();

  inc(labelValue: string, amount = 1): void {
    this.values.set(labelValue, (this.values.get(labelValue) ?? 0) + amount);
  }

  get(labelValue: string): number {
    return this.values.get(labelValue) ?? 0;
  }

  entries(): [string, number][] {
    return [...this.values.entries()].sort(([a], [b]) => a.localeCompare(b));
  }
}

export class AssetMetrics {
  readonly derivativeFailures = new LabelledCounter();
  readonly uploads = new LabelledCounter();
  readonly uploadRejections = new LabelledCounter();
  readonly lifecycleOperations = new LabelledCounter();
  readonly integrityRuns = new LabelledCounter();

  private manifestBuiltAtMs: number | null = null;
  private integrity: IntegrityMetricsSnapshot | null = null;
  private objectCounts: (() => Record<string, number> | null) | null = null;

  /** Records that the served library index was (re)built successfully. */
  markManifestBuilt(atMs = Date.now()): void {
    this.manifestBuiltAtMs = atMs;
  }

  markManifestUnavailable(): void {
    this.manifestBuiltAtMs = null;
  }

  setObjectCountSource(source: () => Record<string, number> | null): void {
    this.objectCounts = source;
  }

  recordIntegrity(snapshot: IntegrityMetricsSnapshot): void {
    this.integrity = snapshot;
  }

  render(nowMs = Date.now()): string {
    const lines: string[] = [];
    const family = (
      name: string,
      type: 'gauge' | 'counter',
      help: string,
      samples: [Labels, number][],
    ) => {
      lines.push(`# HELP ${name} ${help}`);
      lines.push(`# TYPE ${name} ${type}`);
      for (const [labels, value] of samples) {
        lines.push(`${name}${formatLabels(labels)} ${formatValue(value)}`);
      }
    };

    const counts = this.objectCounts?.() ?? null;
    family(
      'asset_objects_total',
      'gauge',
      'Library assets known to the asset service, by lifecycle status.',
      counts
        ? Object.entries(counts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([status, value]) => [{ status }, value])
        : [],
    );

    const integrity = this.integrity;
    family(
      'asset_bytes_total',
      'gauge',
      'Bytes stored on disk by storage area, from the latest integrity report.',
      integrity
        ? [
            [{ area: 'blobs' }, integrity.bytes.blobs],
            [{ area: 'derivatives' }, integrity.bytes.derivatives],
            [{ area: 'quarantine' }, integrity.bytes.quarantine],
          ]
        : [],
    );
    family(
      'asset_missing_files',
      'gauge',
      'Files referenced by the library that are missing on disk (latest integrity report).',
      integrity ? [[{}, integrity.missingFiles]] : [],
    );
    family(
      'asset_orphaned_files',
      'gauge',
      'Files on disk that no library asset references (latest integrity report).',
      integrity ? [[{}, integrity.orphanedFiles]] : [],
    );
    family(
      'asset_hash_mismatches',
      'gauge',
      'Original blobs whose SHA-256 differs from the manifest (latest integrity report).',
      integrity ? [[{}, integrity.hashMismatches]] : [],
    );
    family(
      'asset_integrity_last_run_timestamp_seconds',
      'gauge',
      'Unix time the latest integrity report finished.',
      integrity ? [[{}, integrity.finishedAtMs / 1000]] : [],
    );
    family(
      'asset_integrity_last_run_duration_seconds',
      'gauge',
      'Duration of the latest integrity report.',
      integrity ? [[{}, integrity.durationMs / 1000]] : [],
    );
    family(
      'asset_integrity_runs_total',
      'counter',
      'Integrity report runs by result.',
      this.integrityRuns.entries().map(([result, value]) => [{ result }, value]),
    );

    family(
      'asset_manifest_loaded',
      'gauge',
      '1 when the served library index is loaded, otherwise 0.',
      [[{}, this.manifestBuiltAtMs === null ? 0 : 1]],
    );
    family(
      'asset_manifest_age_seconds',
      'gauge',
      'Seconds since the served library index was last built from manifest-v2 and the admin overlay.',
      this.manifestBuiltAtMs === null
        ? []
        : [[{}, Math.max(0, (nowMs - this.manifestBuiltAtMs) / 1000)]],
    );

    family(
      'asset_derivative_failures_total',
      'counter',
      'Derivative (thumbnail) generation failures by operation.',
      ['upload', 'regenerate', 'rebuild'].map((operation) => [
        { operation },
        this.derivativeFailures.get(operation),
      ]),
    );
    family(
      'asset_uploads_total',
      'counter',
      'Admin uploads by result.',
      ['created', 'duplicate', 'rejected'].map((result) => [
        { result },
        this.uploads.get(result),
      ]),
    );
    family(
      'asset_upload_rejections_total',
      'counter',
      'Rejected admin uploads by reason code.',
      this.uploadRejections.entries().map(([reason, value]) => [{ reason }, value]),
    );
    family(
      'asset_lifecycle_operations_total',
      'counter',
      'Asset lifecycle operations by action.',
      this.lifecycleOperations.entries().map(([action, value]) => [{ action }, value]),
    );

    return `${lines.join('\n')}\n`;
  }
}

// Hashing first gives equal-length buffers, as timingSafeEqual requires.
export function secretsMatch(supplied: string | undefined, configured: string): boolean {
  if (supplied === undefined) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(supplied), digest(configured));
}

/**
 * `METRICS_AUTH_TOKEN` bearer guard, matching the VTT backend's /metrics:
 * open when the token is unset, fail closed (401) when it is set and the
 * request does not present it.
 */
export const requireMetricsToken: RequestHandler = (req, res, next) => {
  const configuredToken = process.env.METRICS_AUTH_TOKEN;
  const suppliedToken = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (configuredToken && !secretsMatch(suppliedToken, configuredToken)) {
    res.status(401).type('text/plain').send('Unauthorized\n');
    return;
  }
  next();
};
