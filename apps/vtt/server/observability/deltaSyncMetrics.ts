import type { ResyncReason } from '../../shared/sync/contracts.js';
import { createCommitLatencyHistogram } from './multiplayerMetrics.js';

/**
 * Delta-sync metrics accumulator.
 *
 * This object is deliberately shared mutable state: the game-state commit path
 * increments it in place and the metrics routes read the same instance. Pass
 * the single instance created at startup to both; do not clone it.
 *
 * ROLLOUT PROCEDURE:
 * 1. Flip VITE_DELTA_SYNC=true in a canary deployment.
 * 2. Monitor GET /api/metrics/delta-sync over 24–48 hours.
 * 3. Healthy steady state:
 *    - resyncRate near 0% (aside from reconnects)
 *    - resync['integrity-mismatch'] === 0 (nonzero = canonical serialization bug → STOP, investigate)
 *    - commits.patch > 0 (delta-sync is being used)
 *    - patchBytesSaved > 0 (compression is working)
 * 4. Enable by default only after a clean canary.
 *
 * If integrity-mismatch counter is nonzero, the client and server hashing
 * disagree on the canonical form. This is a determinism bug and MUST be
 * investigated before production rollout.
 */
export interface DeltaSyncMetrics {
  commits: { legacy: number; full: number; patch: number };
  durability: {
    committed: number;
    conflicts: number;
    failures: number;
    totalCommitLatencyMs: number;
    maxCommitLatencyMs: number;
    commitLatency: ReturnType<typeof createCommitLatencyHistogram>;
  };
  resync: Record<ResyncReason, number>;
  patchBytesSaved: number;
  totalUploads: number;
}

/** Creates a zeroed delta-sync metrics accumulator. */
export function createDeltaSyncMetrics(): DeltaSyncMetrics {
  return {
    commits: { legacy: 0, full: 0, patch: 0 },
    durability: {
      committed: 0,
      conflicts: 0,
      failures: 0,
      totalCommitLatencyMs: 0,
      maxCommitLatencyMs: 0,
      commitLatency: createCommitLatencyHistogram(),
    },
    resync: {
      'base-mismatch': 0,
      'integrity-mismatch': 0,
      'malformed-patch': 0,
      'payload-too-large': 0,
    },
    patchBytesSaved: 0,
    totalUploads: 0,
  };
}
