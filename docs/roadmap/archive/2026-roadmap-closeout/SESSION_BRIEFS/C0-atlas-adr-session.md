# C0 — Atlas backend ADR session (×3 decisions)

track: C · risk: Low (no code) · gate: **blocking 🔍** (human sign-off on all three ADRs) · depends_on: [] · unblocks: [C1, C2, B0]
budget_cap: 100k tokens (T1 ~20k fact-checks / T3 ~60k)

## Objective
Decide and record three interlocking ADRs, replacing the stubs ADR-0010/0011/0012:
1. **Asset service shape** — evolve the embedded static server out of `server/index.ts` vs. new standalone service.
2. **Storage layout** on the NAS volume (base library + TMT + user assets + derivatives).
3. **Auth** between VTT backend/clients and the asset service.
This is T3 planning work; no implementation. The session ends with Joel signing all three.

## Ground truth (verified @ e29131b, 2026-07-02)
- The existing static asset server is **embedded in the VTT server**, `server/index.ts`:
  - `ASSETS_PATH = process.env.ASSETS_PATH || path.join(__dirname, '../static-assets/assets')` (line ~242)
  - Routes: `GET /manifest.json` (~1600), `GET /search` (~1608), `GET /category/:category` (~1628)
  - `express.static` mounts per category assets/thumbnails (~1674–1711), custom tokens at `tokens/custom` (~1693).
- Client consumer: `src/services/assetManager.ts` — `getAssetsByCategory(category, page, limit)` → `{assets, hasMore}`; `searchAssets(q)`; blob-URL cache. Its API is the compatibility contract C1 must honor or version.
- `static-assets/` directory exists in-repo (bundled library + `manifest.json` per CLAUDE.md §4).
- Deployment: prod deploys via dockhand UI force-recreate (CI freeze quirk — see memory/deploy notes); a new service means a new container/stack in dockhand.
- NexusCodex precedent for a sibling microservice: doc-api reached via server-side proxy (`server/routes/documents.ts` → `DOC_API_URL` env). The asset service would follow the same proxy-or-direct decision.
- Scale input: TMT adds ~16k files + derivatives (ADR-0014); user uploads (C2) add unbounded growth → NAS-backed volume, not in-repo `static-assets/`.
- No auth exists on current asset routes (public static serving).

## Drift check
```bash
rg -n "ASSETS_PATH|/manifest.json'|/category" server/index.ts | head -8
rg -n "getAssetsByCategory|searchAssets" src/services/assetManager.ts | head -4
rg -n "DOC_API_URL" server/ -l
```

## Decision drivers to weigh (T3, in the ADRs)
- Shape: release-cadence independence (asset service changes shouldn't redeploy the VTT), memory/IO isolation for 16k-file manifest + thumbnail serving, dockhand operational cost of another stack, migration cost of moving 5 routes + client back-compat. **Orchestrator's prior lean (validate, don't assume): extract to a standalone service beside doc-api, keeping `assetManager.ts`'s API shape via a thin proxy for one release.**
- Storage: content-addressed (`/blobs/<sha256>` + manifest mapping) vs. category tree (human-browsable, matches current layout); derivatives beside originals vs. separate `/derivatives` tree; TMT release staging area for hash-diff sync (B3 needs: current + incoming + diff workspace).
- Auth: options = network-trust inside docker network + public read via VTT proxy; shared-secret header for writes; signed URLs for user uploads (doc-api's signed-upload pattern at `POST /api/documents` is the in-house precedent). Reads are public-ish (players need thumbnails without ceremony); writes must be authenticated.

## Delegation plan
- T1: pin any facts above that drifted; measure `static-assets/` current size + file count; list dockhand stacks currently deployed (ask Joel if tooling unavailable).
- T3: write the three ADRs with options/drivers/decision/consequences; present to Joel in-session.

## Exit criteria
- ADR-0010, ADR-0011, ADR-0012 rewritten from stub → `Status: Accepted (Joel, <date>)` with explicit decisions.
- SESSION_STATE.md: C0 done, gate approved; C1/C2/B0 unblocked; ROADMAP.md updated if the decision changes packet scopes (e.g. "evolve in place" shrinks C1).

## Rollback
Decisions are files; supersede with a new ADR if reversed later. Never edit an accepted ADR's decision silently.

Handoff & close-out: RESUME_PROTOCOL.md §4–5.
