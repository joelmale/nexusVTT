# B0 — TMT acquisition & release pinning

track: B · risk: Low · gate: none · depends_on: [C0 (storage ADR)] · unblocks: [B1]
budget_cap: 60k tokens (T0 scripts / T1 ~15k spot-check / T3 ~25k)

## REQUIRED INPUT (pin before executing — do not invent)
- `TMT_SOURCE_REPO`: ⚠️ **CONFIRM WITH JOEL** — upstream Too Many Tokens repository/distribution URL.
- `TMT_RELEASE_TAG`: the release to pin (immutable ref, not a branch).
These were established in a prior session whose notes did not survive; re-confirm rather than guess.
Record both in ADR-0014 once confirmed.

## Objective
T0-first acquisition: script downloads the pinned TMT release, verifies integrity, and emits a
deterministic raw inventory (`raw-inventory.json`: path, size, sha256 per file, ~16k entries) into
the staging area defined by ADR-0011. No model touches asset files (ADR-0014).

## Ground truth (verified @ e29131b, 2026-07-02)
- Staging location: per ADR-0011 (NAS layout — drift-check that it's Accepted). Scratch fallback for dry runs only.
- Tooling conventions: Node scripts (repo is Node/TS; put pipeline under `tools/tmt-ingest/` with its own README), `npm` runnable (`node tools/tmt-ingest/acquire.mjs --release <tag> --dest <path>`).
- Expected scale: ~16k files (mostly PNG/WebP token images) — size the download/hashing for streaming, not in-memory.

## Drift check
```bash
head -20 docs/roadmap/ADR/0011-storage-layout.md    # MUST be Accepted
head -20 docs/roadmap/ADR/0014-tmt-ingestion.md     # source repo + tag recorded?
```

## Delegation plan
- T0: `acquire.mjs` (download release archive → extract → per-file sha256 → raw-inventory.json + top-level `release.lock.json` {tag, archiveSha256, fileCount, acquiredAt}).
- T1: spot-check 20 random entries (file exists, hash matches, extension expected) + eyeball the folder-structure conventions for B1's parser design — report structure patterns in the handoff.
- T3: review determinism + lock file; update ADR-0014 with the pinned refs.

## Exit criteria
- Re-running acquire against the same tag is idempotent: identical `raw-inventory.json` (byte-equal, sorted keys).
- `release.lock.json` committed (inventory itself stays on the NAS/staging — it's data, not source; only the lock + a 50-entry sample fixture are committed for B1 tests).
- File count recorded (~16k expected; large deviation → open_question, stop).
- T1's folder-structure report in the handoff (B1's parser spec input).

## Rollback
Delete staging dir; nothing entered the app.

Handoff & close-out: RESUME_PROTOCOL.md §4–5.
