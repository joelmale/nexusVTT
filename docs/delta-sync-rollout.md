# Delta-Sync Rollout Procedure

## Overview

The delta-sync feature optimizes game state synchronization by sending JSON patches instead of full snapshots. This document provides the rollout procedure and health check guidelines.

## Feature Flag

- **Location:** `VITE_DELTA_SYNC` environment variable
- **Default:** `false` (feature disabled; legacy path always taken)
- **Canary Phase:** Set to `true` in a staging deployment
- **Production Rollout:** Enable only after a clean canary period (24–48 hours)

## Metrics Endpoint

```
GET /api/metrics/delta-sync
```

Returns JSON with the following structure:

```json
{
  "commits": {
    "legacy": 42,
    "full": 15,
    "patch": 128
  },
  "totalCommits": 185,
  "durability": {
    "committed": 185,
    "conflicts": 2,
    "failures": 0,
    "totalCommitLatencyMs": 740,
    "maxCommitLatencyMs": 18,
    "averageCommitLatencyMs": 4.0
  },
  "resync": {
    "base-mismatch": 2,
    "integrity-mismatch": 0,
    "malformed-patch": 0,
    "payload-too-large": 1
  },
  "totalResyncs": 3,
  "patchBytesSaved": 2847392,
  "totalUploads": 188,
  "resyncRate": 1.59,
  "timestamp": 1688123456789
}
```

## Monitoring & Health Criteria

### 1. Resync Rate (Primary Health Indicator)

**Metric:** `resyncRate = (totalResyncs / totalUploads) * 100`; every attempt,
including a rejected attempt, is already counted in `totalUploads`.

- **Healthy:** Near 0% (aside from reconnects)
- **Warning:** > 5% (indicates frequent upload rejections)
- **Critical:** > 10% (investigate immediately)

### 2. Integrity Mismatch Counter (Canary)

**Metric:** `resync['integrity-mismatch']`

**Critical Rule:** This counter MUST remain at 0 throughout the canary.

- **Nonzero value means:** Client and server hashing algorithms disagree on canonical state form
- **Action:** Stop rollout, investigate canonical serialization in both `hashSync()` (server) and `hashState()` (client)
- **Likely causes:**
  - Floating-point formatting differences
  - Object key ordering inconsistencies
  - Undefined/null handling divergence
  - String escaping differences

### 3. Patch Effectiveness (Secondary Metric)

**Metric:** `patchBytesSaved` vs. total committed bytes

- **Expected:** Patch uploads save 80–95% of bytes vs. full snapshots
- **Low savings:** May indicate game state is too volatile for patch optimization

### 4. Commit Distribution

**Metrics:** `commits.legacy`, `commits.full`, `commits.patch`

- **Legacy:** Clients not yet using delta-sync (expected to decrease)
- **Full:** Tagged full snapshots (e.g., after reconnect)
- **Patch:** Delta patches (should grow as legacy decreases)

### 5. Durability

- `durability.failures` must remain zero. A failure is not ACKed, so the client
  keeps its in-flight update and retries through timeout/reconnect recovery.
- `durability.conflicts` may be nonzero during legitimate concurrent co-host
  edits; correlate spikes with `resync['base-mismatch']`.
- Identical full snapshots sent during reconnect are version-neutral. A version
  increase must correspond to changed canonical content and replica fanout.
- Track `averageCommitLatencyMs` and `maxCommitLatencyMs` because PostgreSQL
  commit latency is intentionally on the ACK path.

## Rollout Stages

### Stage 1: Canary (24 hours)

1. Deploy to staging with `VITE_DELTA_SYNC=true`
2. Run typical game scenarios (token moves, scene edits, drawing strokes)
3. Monitor endpoint every few minutes:
   ```bash
   watch -n 5 'curl http://localhost:5001/api/metrics/delta-sync | jq .'
   ```
4. **Abort if:** `resync['integrity-mismatch'] > 0`
5. **Continue if:** All metrics healthy (resyncRate near 0%, patch compression working)

### Stage 2: Staged Rollout (48 hours)

1. Canary clean; deploy to 25% production traffic with `VITE_DELTA_SYNC=true`
2. Monitor prod metrics; watch for spikes in resync counters
3. Expand to 50% → 75% → 100% over next 24 hours

### Stage 3: Default Enable

Only after both stages pass, update `VITE_DELTA_SYNC` default in code:

```typescript
// server/index.ts or client config
const DELTA_SYNC_ENABLED = process.env.VITE_DELTA_SYNC === 'true'; // change default
```

## Rollback Procedure

If integrity-mismatch is nonzero at any time:

1. **Immediately:** Disable `VITE_DELTA_SYNC` in the canary deployment
2. **Investigate:** Check canonical serialization (`canonicalStringify` in contracts.ts)
3. **Example debug:**
   - Log both client and server hashes for the same state
   - Compare canonical forms byte-by-byte
4. **DO NOT re-enable** until root cause is found and fixed

## Implementation Details

### Metrics Accumulator (server/index.ts)

- **Field:** `NexusServer.deltaSyncMetrics`
- **Type:** Strongly typed (no `any`)
- **Counters:**
  - `commits: { legacy, full, patch }` — incremented on successful commit
  - `durability` — committed CAS operations, conflicts, failures, and latency
  - `resync: Record<ResyncReason, number>` — incremented on resync (by reason)
  - `patchBytesSaved: number` — cumulative bytes saved by patches
  - `totalUploads: number` — total upload attempts

Successful commit counters advance only after
`SessionRepository.commitGameState()` commits. `sendResync()` increments reason
counters, while database conflicts and failures increment the durability
counters separately.

### Derivation

```
resyncRate (%) = (totalResyncs / max(1, totalUploads)) * 100
healthScore = (resync['integrity-mismatch'] === 0) &&
              (durability.failures === 0) && (resyncRate < 5)
```

## Key Assumptions

1. **No canary/rollback switch needed in the code itself** — the metrics endpoint makes feature health observable
2. **Legacy path remains enabled and unchanged** — if delta-sync is disabled, clients fall back to full snapshots automatically
3. **Hashing is deterministic** — `hashSync()` and `hashState()` MUST produce identical results for the same state across client and server

## References

- **Delta-sync contracts:** `shared/sync/contracts.ts`
- **Server hashing:** `shared/sync/hashSync.ts`
- **Client hashing:** `shared/sync/hashState.ts` (client-only async variant)
- **Metrics endpoint:** `server/index.ts` (`/api/metrics/delta-sync`)
- **Durable CAS:** `server/repositories/SessionRepository.ts`
- **Schema migration:** `server/migrations/2026-07-19-add-durable-game-state-commits.sql`
- **Combined SLOs and alerts:** `docs/operations/multiplayer-observability.md`
