# ADR-0010 — Asset service: standalone service vs. evolving the embedded static server

Status: **Accepted** (Joel, 2026-07-03)

## Context (verified @ e522c00)
The current asset server is ~120 lines embedded in `server/index.ts` (~242, 1600–1718):
`ASSETS_PATH` env (default in-repo `static-assets/`), `GET /manifest.json`, `/search`,
`/category/:category`, express.static mounts. It serves **35 files / 14MB** today. Client
contract: `src/services/assetManager.ts` (`getAssetsByCategory(category, page, limit)` →
`{assets, hasMore}`, `searchAssets(q)`).

The Atlas backend must additionally own: the TMT library (**~16k files** — a ~450× jump),
user uploads (unbounded growth, C2), derivatives, and hash-diff release syncs (B3).

## Options

**A. Extract to a standalone service** (own container/stack in dockhand, beside doc-api,
`ASSET_API_URL` env following the `DOC_API_URL` precedent).
- ✅ Asset-library changes (TMT syncs, manifest rebuilds) never redeploy the VTT — important
  given the CI-freeze deploy quirk (failed builds silently keep prod stale).
- ✅ Memory/IO isolation: a 16k-entry search index and thumbnail traffic don't share the
  websocket server's event loop.
- ✅ NAS volume mounts on one purpose-built container.
- ❌ One more stack to operate; 5 routes migrate; assetManager needs an env-based base URL
  (kept back-compat via a thin VTT proxy for one release).

**B. Evolve in place** inside server/index.ts; extract later "when it hurts".
- ✅ Zero operational change now.
- ❌ Pays the migration twice; couples 16k-file serving to VTT deploys immediately (B3 lands
  sync jobs into the game server's container); the "later" extraction lands mid-program with
  more dependents.

**C. Greenfield service, migrate routes onto it** — same as A operationally but rewrites the
manifest/search code instead of extracting it. More effort, no additional benefit at this scale.

## Orchestrator recommendation: **A**
The 450× corpus jump and the CI-freeze deploy risk are the deciding drivers; B optimizes for
this week, A for the remaining 12 packets. Implementation note for C1: lift the existing
express code mostly as-is into `services/asset-service/` (new package), add manifest v2 fields
(sha256, source, dimensions), keep a VTT-side proxy at the old paths for one release.

## Decision
**Option A** (Extract to a standalone service) is selected to mitigate the CI-freeze deploy risk and isolate memory/IO.
