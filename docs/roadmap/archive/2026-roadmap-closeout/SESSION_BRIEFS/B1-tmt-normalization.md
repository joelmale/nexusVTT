# B1 — TMT normalization & tagging pipeline

track: B · risk: Med · gate: **blocking 🔍** (rules affect 16k assets — Joel reviews a sample) · depends_on: [B0] · unblocks: [B2]
budget_cap: 100k tokens (T0 pipeline / T1 ~40k ambiguous-residue classification / T3 ~35k)

## Objective
Deterministic T0 pipeline transforming B0's raw inventory into `normalized-manifest.json`:
stable ids, display names, category/creature taxonomy, tags — derived from folder structure and
filename conventions. Model involvement ONLY for the ambiguous residue, batched at T1.

## Ground truth (verified @ e29131b, 2026-07-02)
- Input: `raw-inventory.json` + B0's T1 folder-structure report (read B0's handoff in SESSION_STATE log — it documents the actual conventions found; this brief cannot know them in advance).
- Output schema (align with C1's manifest v2): `{ id (content-hash-derived, stable across releases), name (humanized), category, creature?, tags[], sourcePath, sha256, dimensions }`. Dimensions via image headers (T0 — e.g. `image-size` npm package), not decoding full images.
- Determinism contract (ADR-0014): same input → byte-identical output (sorted keys, no timestamps in body); pipeline version field bumps when rules change.
- Dedupe: identical sha256 → one asset, multiple sourcePaths recorded.
- Residue rule: entries whose name/category can't be derived by rules go to `residue.json`; if residue > 10% of corpus, STOP and escalate to T3 (rules need work — don't classify 1600 files with a model).
- T1 residue classification: batched prompts (~100 filenames per call, filename→{name, category, tags}), temperature-stable, results merged with `source:'t1-classified'` marker for the sample review.

## Drift check
```bash
ls tools/tmt-ingest/acquire.mjs && head -5 <staging>/raw-inventory.json 2>/dev/null || echo "B0 outputs missing — blocked"
head -20 docs/roadmap/ADR/0014-tmt-ingestion.md
```

## Delegation plan
- T0: `normalize.mjs` (rules engine: path-segment → category map, filename slug → display name, dedupe, dimensions) + `verify.mjs` (determinism self-check: run twice, diff).
- T1: residue classification batches (only if residue ≤10%).
- T3: rules review, sample assembly for the gate: 200 random entries + ALL t1-classified entries rendered as a review table (`docs/roadmap/reviews/B1-sample.md`) — name/category/tags vs sourcePath.

## Exit criteria (gate evidence)
- `normalize.mjs` runs twice → identical output hash (recorded in handoff).
- Coverage: ≥90% rule-derived; residue classified and marked; 0 unnamed entries.
- Sample review file committed; **pause for Joel** to approve taxonomy/naming before B2 processes 16k files against these rules.
- Unit tests on the committed 50-entry fixture from B0 pass.

## Rollback
Pipeline outputs are regenerable artifacts; fix rules and re-run. Nothing user-facing yet.

Handoff & close-out: RESUME_PROTOCOL.md §4–5.
