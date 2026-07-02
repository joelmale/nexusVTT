# B2 — TMT derivatives + storage layout

track: B · risk: Low · gate: none · depends_on: [B1, C0 (storage ADR)] · unblocks: [B3]
budget_cap: 50k tokens (T0 pipeline / T1 ~10k spot-check / T3 ~20k)

## Objective
T0 pipeline stage: generate derivatives (WebP thumbnails) for the normalized corpus and lay both
originals and derivatives into the ADR-0011 storage structure on the NAS volume, ready for
serving. Pure data processing; no service code.

## Ground truth (verified @ e29131b, 2026-07-02)
- Input: `normalized-manifest.json` (B1, gate-approved) + staged originals (B0).
- Layout: exactly per ADR-0011 (content-addressed vs category tree — whichever was decided; this brief must not assume).
- Derivative spec: 256px-max-edge WebP thumbnails, quality ~80 (matches the app's existing WebP-compression habit for maps); preserve aspect; skip if source ≤256px (copy as-is). Use `sharp` (add as devDependency of `tools/tmt-ingest/`, NOT the app bundle).
- Idempotency: derivative filename keyed by source sha256 + spec version → re-runs skip existing; changed spec version regenerates all.
- Update manifest entries with `thumbnailPath` + `derivativeSpecVersion`.

## Drift check
```bash
head -20 docs/roadmap/ADR/0011-storage-layout.md   # Accepted + layout matches script config?
ls tools/tmt-ingest/normalize.mjs && echo ok
grep -c '"id"' <staging>/normalized-manifest.json 2>/dev/null || echo "B1 output missing — blocked"
```

## Delegation plan
- T0: `derive.mjs` (streaming, concurrency-limited ~8, progress log, failure list) + `layout.mjs` (move/link into final tree, write final manifest to serving location).
- T1: spot-check 20 thumbnails (dimensions, visual sanity via file size heuristics, correct tree location).
- T3: review failure list (corrupt sources happen in 16k-file corpora — policy: exclude + record, don't fail the run) and idempotency proof.

## Exit criteria
- Full run completes; failure list < 0.5% of corpus, each failure recorded with reason.
- Re-run skips all existing derivatives (log proof: 0 regenerated).
- Final tree matches ADR-0011 layout (`tree -L 3` output in handoff); manifest at serving location validates against C1's JSON schema.

## Rollback
Regenerable artifacts; delete tree + re-run.

Handoff & close-out: RESUME_PROTOCOL.md §4–5.
