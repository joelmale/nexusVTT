# C6 — Base Library tab (TMT in the Atlas)

track: C · risk: Low · gate: **blocking 🔍** (go-live: first user-visible TMT surface) · depends_on: [C4, B3] · unblocks: [] (program capstone)
budget_cap: 100k tokens (T2 ~50k / T3 ~25k)

## Objective
Surface the ingested Too Many Tokens library in the Atlas dock as a "Library" source tab: a new
federated source adapter against the asset service's TMT endpoints (B3), with tag/category
filtering sized for ~16k assets.

## Ground truth (verified @ e29131b, 2026-07-02 — B3's landed API contract supersedes)
- Source adapter pattern: `src/hooks/atlasSources/` (C3); add `librarySource.ts` mapping the asset service's TMT endpoints (per `docs/roadmap/contracts/asset-service-v2.md` from C1, extended by B3) into `AtlasAsset` with `source:'library'`.
- 16k items means: server-side search/filter (the manifest v2 search endpoint), never client-side full-list; category/tag facets come from B1's normalized taxonomy (contract doc lists the facet endpoint).
- C4's grid already virtualizes and paginates via cursor `loadMore` — the adapter just implements the cursor.
- Availability: asset service unreachable → source tab offline badge (C3's `AtlasSourceError` pattern), never an error banner.

## Drift check
```bash
ls src/hooks/atlasSources/
cat docs/roadmap/contracts/asset-service-v2.md | head -40   # TMT endpoints documented?
curl -s <asset-service>/health || echo "service not running locally — start per contract doc"
```

## Delegation plan
- T2: adapter + Library tab registration + facet UI (category chips from the facet endpoint; combined with text search).
- T3: go-live review packet — perf numbers (search latency over 16k, grid scroll), licensing/attribution check (TMT's license requires attribution — confirm placement of the credit per ADR-0014 notes; surface in dock footer or About).

## Exit criteria (gate evidence)
- Search "goblin" over the library returns server-filtered results < 500ms locally; grid scrolls smoothly through 1k+ results.
- Facet filtering works (pick 2 categories, combined with text query).
- Drag-drop from Library tab places tokens (if C5 landed; else note deferred).
- Attribution visible per license. Offline behavior correct. type-check / lint / test pass.

## Rollback
Adapter is additive — remove the source registration.

Handoff & close-out: RESUME_PROTOCOL.md §4–5. **Pause for Joel's go-live review.**
