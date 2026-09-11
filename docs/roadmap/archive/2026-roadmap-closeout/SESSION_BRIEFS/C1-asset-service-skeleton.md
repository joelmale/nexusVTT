# C1 — Asset service skeleton

track: C · risk: Med · gate: **blocking 🔍** (API contract review) · depends_on: [C0] · unblocks: [C2, B3]
budget_cap: 180k tokens (T2 ~100k / T3 ~40k)

## Objective
Build the asset service per ADR-0010's decision (shape) with ADR-0011's storage layout: health
endpoint, manifest v2, search, category listing, thumbnail serving. The existing client
(`src/services/assetManager.ts`) keeps working — back-compat or a versioned path, per the ADR.

## Ground truth (verified @ e29131b, 2026-07-02 — ADR-0010/0011/0012 SUPERSEDE anything here that conflicts)
- Current routes to reproduce/evolve (in `server/index.ts` ~1600–1718): `GET /manifest.json`, `GET /search?q=`, `GET /category/:category` (+ express.static mounts for category assets/thumbnails and `tokens/custom`).
- Current client contract (`src/services/assetManager.ts`): `getAssetsByCategory(category, page, limit)` → `{assets: AssetMetadata[], hasMore}`; `searchAssets(q)` → `AssetMetadata[]`. AssetMetadata includes id, name, category, filename, thumbnail, size, tags (manifest schema in CLAUDE.md §4).
- Manifest v2 additions needed by downstream packets: per-asset `sha256` (B3 hash-diff), `source: 'base'|'tmt'|'user'` (C6 filtering), `dimensions` (C5 drop sizing), pagination metadata.
- Env/config precedent: `DOC_API_URL` pattern for service discovery; `ASSETS_PATH` for volume mount.
- Server code conventions: Express + TypeScript, `npm run build:server` (tsc), handlers under `server/` — follow whatever structure ADR-0010 chose.

## Drift check
```bash
cat docs/roadmap/ADR/0010-asset-service-shape.md | head -30   # MUST be Status: Accepted
rg -n "getAssetsByCategory" src/services/assetManager.ts
rg -n "/manifest.json'" server/index.ts | head -2
```
If ADR-0010 still says `Proposed` — STOP, C0 gate not passed.

## Delegation plan
- T2 #1: service skeleton + manifest v2 + category/search endpoints (with tests hitting a fixture asset tree).
- T2 #2: thumbnail serving + back-compat layer for assetManager.ts (or client bump if ADR chose versioned path).
- T3: API contract doc (`docs/roadmap/contracts/asset-service-v2.md` — request/response shapes, error codes incl. unavailable=503 to match the federation hook's source-availability handling), gate packet for Joel.

## Exit criteria (gate = contract review)
- Service runs locally (document the command in the contract doc); `GET /health` 200.
- Contract doc committed; all endpoints exercised by integration tests against fixtures.
- Existing app works unchanged pointing at the service (asset browser loads, tokens place) — proof: preview smoke.
- Manifest v2 validates against a committed JSON schema (`tools/asset-service/manifest.schema.json`).
- type-check / lint / test pass (client + server).

## Rollback
Per ADR-0010's shape: standalone service → don't switch the client, delete the stack; evolved-in-place → branch revert.

Handoff & close-out: RESUME_PROTOCOL.md §4–5. **Pause for Joel's contract review before C2/B3.**
