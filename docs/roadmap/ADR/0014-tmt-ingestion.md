# ADR-0014 — Too Many Tokens ingestion: T0-first, release-pinned, hash-diff synced

Status: **Accepted** (Joel, 2026-07-02) — source refs pending (B0)

## Context
The Too Many Tokens library (~16k token images) becomes the Atlas base library, landing in the
asset service (NEVER NexusCodex, per ADR-0001). Processing 16k files through model context would
cost ~13M+ tokens; deterministic scripts cost ~zero.

## Decision
1. **T0-first**: acquisition (B0), normalization (B1), derivatives (B2), sync (B3) are
   deterministic scripts under `tools/tmt-ingest/`. Model usage is capped at: B1's ambiguous
   residue (≤10% of corpus, batched T1 classification — if residue exceeds 10%, fix rules, don't
   classify harder) and small T1 spot-checks/QA samples (≤300 assets program-wide).
2. **Release-pinned**: ingest only immutable release tags, recorded in `release.lock.json`
   (tag + archive sha256 + file count). Never track a branch.
3. **Hash-diff sync**: subsequent releases diff per-file sha256 against the stored manifest;
   only added/changed/removed entries re-enter the pipeline. Removed assets tombstone in the
   manifest; placed tokens referencing them must not break.
4. **Determinism contract**: same input → byte-identical manifests; pipeline-version field bumps
   on rule changes.

## Pinned source (fill at B0 — CONFIRM WITH JOEL, do not guess)
- TMT_SOURCE_REPO: _(pending)_
- TMT_RELEASE_TAG: _(pending)_
- License/attribution requirement + credit placement: _(record at B0; surfaced in UI at C6)_

## Consequences
- B-track budgets are tiny relative to corpus size; the pipeline is re-runnable and auditable.
- C1's manifest v2 must carry sha256 + source fields to make the diffing possible.
