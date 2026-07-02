# B3 — TMT hash-diff sync + service endpoints

track: B · risk: Med · gate: **blocking 🔍** (integration review) · depends_on: [B2, C1] · unblocks: [C6]
budget_cap: 110k tokens (T2 ~60k / T0 sync script / T3 ~30k)

## Objective
Two halves: (1) T0 sync job — when a new TMT release is pinned, hash-diff against the stored
corpus and re-process ONLY changed/added/removed files through the B1/B2 pipeline; (2) asset
service endpoints exposing the TMT library (search over 16k with facets), extending C1's
contract.

## Ground truth (verified @ e29131b, 2026-07-02 — C1's landed contract supersedes)
- Sync inputs: `release.lock.json` (B0), stored manifest with per-file sha256; diff classes: added (full pipeline), changed hash (re-normalize + re-derive), removed (tombstone in manifest — don't break placed tokens referencing old assets; ADR-0014 note: placed tokens copy image refs at placement, verify this holds via `createPlacedToken` shape in src/types/token.ts).
- Endpoints (extend `docs/roadmap/contracts/asset-service-v2.md`): library listing with cursor pagination, text search, facet endpoint (categories/tags + counts), single-asset metadata. Search over 16k: in-memory index built at service start from the manifest (simple inverted index or `minisearch` — service-side dependency choice per C1's conventions; document it).
- Service registration: TMT library appears in manifest v2 with `source:'tmt'`.

## Drift check
```bash
cat docs/roadmap/contracts/asset-service-v2.md | head -30   # C1 landed + contract exists
ls tools/tmt-ingest/{acquire,normalize,derive}.mjs
rg -n "image|url" src/types/token.ts | head -5   # placed-token image ref semantics
```

## Delegation plan
- T0: `sync.mjs` (diff computation, targeted pipeline re-runs, manifest merge with tombstones, dry-run mode printing the diff summary).
- T2: service endpoints + search index + integration tests (fixture corpus of 500 entries; latency assertion <100ms per search server-side).
- T3: review tombstone semantics vs placed-token references, and the gate packet.

## Exit criteria (gate evidence)
- Dry-run sync against same release → empty diff. Simulated release bump (fixture with 10 changed files) → exactly 10 files re-processed (log proof).
- Endpoints serve the real corpus: search latency measured over 16k; facets correct against manifest counts.
- Removed-asset test: tombstoned asset no longer listed, but a scene with it placed still renders (image ref intact or graceful fallback — record which).
- Contract doc updated; integration tests green; type-check / lint pass.

## Rollback
Endpoints additive to C1's service; sync job is offline tooling. Branch revert; corpus untouched.

Handoff & close-out: RESUME_PROTOCOL.md §4–5. **Pause for Joel's integration review before C6.**
