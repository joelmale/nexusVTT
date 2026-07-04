# Asset Service Contract — v2

Status: living document. This backfills the contract doc that C1 shipped without (see
`docs/roadmap/SESSION_BRIEFS/B3-sync-serve.md`). It documents every route currently served by
`services/asset-service/src/index.ts` (verified against source, 2026-07-03) plus the TMT library
endpoints added in B3 (`services/asset-service/src/library.ts`).

## Running the service locally

```bash
cd services/asset-service
npm install
npm run dev            # ts-node-dev --respawn src/index.ts (auto-restart on change)
# or
npm run build && npm start
```

Environment variables:

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `5003` | HTTP port |
| `ASSETS_PATH` | `<repo>/static-assets` | Root for legacy manifest/category/user-asset routes |
| `LIBRARY_MANIFEST_PATH` | `<repo>/assets-data/manifests/manifest-v2.json` | TMT library manifest (B3 endpoints) |
| `LIBRARY_DATA_PATH` | `<repo>/assets-data` | Root of the assets-data tree (parent of `manifests/`); serves the library's content-addressed `blobs/`/`derivatives/` files under `/library-assets` (C6). Resolved independently of `LIBRARY_MANIFEST_PATH` — set both if you relocate either piece separately. |
| `ASSET_SERVICE_SECRET` | *(none)* | Shared secret checked against the `x-nexus-auth` request header for all write/write-ish routes |

Auth model (ADR-0012): reads are public-within-deployment; writes (`POST`/`DELETE` under
`/user/*`, and `POST /library/reload`) require `x-nexus-auth: <ASSET_SERVICE_SECRET>`. The VTT
backend is the only expected caller of write routes — it injects the header after checking the
authenticated session, per `server/middleware/assetWriteGuard.ts`.

Tests: `npx tsc --noEmit && npx vitest run` (30+ tests across `src/index.test.ts` and
`src/library.test.ts`).

---

## Existing endpoints (legacy manifest / static asset serving)

These predate B3 and are unchanged; documented here for completeness since no contract doc
previously existed.

### `GET /health`
```json
{ "status": "ok", "uptime": 123.45 }
```

### `GET /manifest.json`
Serves `ASSETS_PATH/manifest.json` (the original, non-TMT asset manifest — maps/tokens/props/
backgrounds/ui bundled with the app). `Cache-Control: public, max-age=300`.
- `503 { "error": "Manifest not loaded" }` if the file is missing.

### `GET /search?q=term`
Linear filter over `manifest.json`'s `assets[]` by name/tag substring match (case-insensitive).
- `400 { "error": "Query must be at least 2 characters" }` if `q` is missing or too short.
- `200 { "query": "...", "results": [...], "total": n }`

### `GET /category/:category`
Paginated listing (`?page=0&limit=20`, limit capped at 100) filtered by category, or `all` for
everything.
```json
{ "category": "tokens", "page": 0, "limit": 20, "assets": [...], "hasMore": true, "total": 843 }
```

### `GET /asset/:id`
Single asset lookup by id from `manifest.json`. `404` if not found. `Cache-Control: immutable`.

### Static file mounts
- `GET /:category/assets/*`, `/:category/thumbnails/*` for `category` in `maps|tokens|props|backgrounds|ui`
- `GET /assets/tokens/custom/*`
- `GET /assets/*`
- `GET /users/*`
- `GET /thumbnails/*`

### User asset domain (`/user/:userId/*`)
- `GET /user/:userId/assets` — list a user's custom uploads.
- `POST /user/:userId/upload` (auth required) — multipart `file` field, `≤5MB`, `.png/.webp/.jpg/.jpeg`
  only, 50MB total quota per user. `413` on size/quota violations, `400` on invalid userId or file
  type, `401` on missing/wrong `x-nexus-auth`.
- `DELETE /user/:userId/asset/:assetId` (auth required) — removes the file + manifest entry.

### Error shape
- Unmatched routes → `404 { "error": "Not found", "availableEndpoints": [...] }`
- Uncaught errors / oversized uploads → 4-arg error handler, `500` or `413` with `{ "error": "..." }`

---

## TMT library endpoints (B3, new)

Source: `assets-data/manifests/manifest-v2.json`, produced by the `tools/tmt-ingest/` pipeline
(`acquire.mjs` → `normalize.mjs` → `derivatives.mjs`, then `sync.mjs` for subsequent releases).
Loaded into an in-memory index at service boot (`loadLibraryIndex()` in `index.ts`) and rebuildable
without a restart via `POST /library/reload`.

If the manifest file is absent or fails to parse, `libraryIndex` is `null` and every `/library*`
route (except `/library/reload`, which reports the same condition) returns:
```json
503 { "error": "source-unavailable", "message": "Library manifest not loaded" }
```
This matches the existing `/manifest.json` pattern (503 rather than empty-list, so clients can
distinguish "no manifest yet" from "manifest loaded, zero results").

### Search implementation (documented per brief requirement)

**Choice: linear scan over a precomputed-lowercase field, not an inverted index or a
dependency like `minisearch`.**

At load time (`buildLibraryIndex()` in `library.ts`), every asset gets a `_searchText` field —
`name + ' ' + tags.join(' ')`, lowercased once. A search request lowercases the query once and
does `array.filter(a => a._searchText.includes(q))`.

Measured (Node 26, dev laptop, `services/asset-service/src/library.test.ts` → "search over a
16k-entry synthetic index responds in well under 100ms"):
- Cold, unindexed (`.toLowerCase()` per asset per query, no precompute): **~4-8ms** over 16k entries.
- Warm, precomputed lowercase fields (the shipped implementation): **~1-3ms** over 16k entries,
  across single-char (`"a"`, ~85% of corpus matches) and multi-word queries alike.

Both are already an order of magnitude under the 100ms budget from the brief, so an inverted
index (or a dependency like `minisearch`) was rejected as unneeded complexity at this corpus
size (~16k). Revisit if the library grows another order of magnitude (~160k+), or if search
gains ranking/fuzzy-match requirements a substring scan can't satisfy cheaply.

### `GET /library`
Cursor-paginated listing with optional filters.

Query params:
| Param | Default | Notes |
|---|---|---|
| `cursor` | *(start)* | Opaque, base64url-encoded offset. Pass back the `cursor` from the previous response. |
| `limit` | `20` | Capped at `100`. |
| `q` | *(none)* | Case-insensitive substring match over name + tags. |
| `category` | *(none)* | Exact category match. |
| `includeRemoved` | `false` | When `true`, tombstoned assets (see below) are included. |

Response:
```json
{
  "assets": [ { "id": "tmt-...", "name": "...", "category": "...", "tags": [...], "thumbnail": "...", "fullImage": "...", "size": 12345, "sha256": "...", "source": "tmt", "dimensions": {"width":256,"height":256}, "sourcePath": "..." } ],
  "total": 15999,
  "limit": 20,
  "cursor": "MjA=",
  "hasMore": true
}
```
`cursor` is `null` when there is no next page. Filters (`q`, `category`, `includeRemoved`) apply
before pagination, and `total` reflects the filtered count (not the whole corpus).

`503` if the manifest isn't loaded (see above).

### `GET /library/facets`
```json
{
  "categories": [ { "name": "Ghoul", "count": 42 }, ... ],
  "tags": [ { "name": "undead", "count": 812 }, ... ]
}
```
- `categories`: every category present among **active** (non-removed) assets, sorted by count
  descending then name.
- `tags`: top 50 tags by count among active assets, same sort. (Cap exists because tag
  cardinality can be high; raise `TOP_N_TAGS` in `library.ts` if a consumer needs more.)
- Counts exclude removed/tombstoned assets — matches `GET /library`'s default view.

### `GET /library/asset/:id`
Single-asset lookup, **including removed assets** (unlike the listing endpoints, this does not
filter by `removed` — a client that already has an id, e.g. from a previously-synced local
cache, can still resolve metadata for a tombstoned asset).
- `404 { "error": "Asset not found" }` if the id was never in any release's manifest.

### `POST /library/reload`
Auth required (`x-nexus-auth`). Re-reads `LIBRARY_MANIFEST_PATH` from disk and rebuilds the
in-memory index. Intended to be called after `tools/tmt-ingest/sync.mjs` writes a new
`manifest-v2.json`, so B3 syncs take effect without restarting the service.
```json
200 { "success": true, "totalAssets": 16012 }
503 { "error": "source-unavailable", "message": "Library manifest not found or invalid at ..." }
401 { "error": "Unauthorized" }
```

### `GET /library-assets/*` (C6, new)

Static file mount serving the `assets-data/` tree directly (`express.static(LIBRARY_DATA_PATH)`,
`LIBRARY_DATA_PATH` defaulting to the parent of `LIBRARY_MANIFEST_PATH`'s default, i.e.
`<repo>/assets-data`). The manifest's `thumbnail` and `fullImage` fields are paths relative to
this root, so a client resolves an asset's image by concatenating:

```
GET /library-assets/<asset.thumbnail>   e.g. /library-assets/derivatives/4a/4a1b2c...webp
GET /library-assets/<asset.fullImage>   e.g. /library-assets/blobs/4a/4a1b2c....png
```

- Cache policy: `Cache-Control: public, max-age=86400, immutable` — same
  `setCacheHeaders(res, 86400, true)` helper used by `/asset/:id`. Safe because these paths are
  content-addressed (hash-named); a given path's bytes never change.
- No auth — public read, same as every other static mount in this service (`/assets`,
  `/thumbnails`, `/users`, etc.), per ADR-0012.
- `404` on a missing path is Express's default static-middleware fall-through (falls through to
  this service's catch-all 404 JSON handler: `{ "error": "Not found", "availableEndpoints": [...] }`),
  **not** a bare Express HTML 404 — because the static mount has no matching file, `express.static`
  calls `next()`, which reaches the catch-all defined later in `index.ts`.
- Proxied by the VTT backend (`server/index.ts` `setupAssetRoutes()`) alongside `/library`, using
  the same plain (non-write-guarded) `assetProxy`, since both are public reads.

---

## Tombstone semantics (removed assets)

`tools/tmt-ingest/sync.mjs` never deletes a manifest entry when a source file disappears from a
later TMT release. Instead it sets `removed: true` and `removedInRelease: "<tag>"` on the
existing asset object, leaving `id`, `sha256`, `thumbnail`, `fullImage`, etc. untouched.

**Why this is safe:** `PlacedToken` (src/types/token.ts) does not reference library assets by id
at render time. A `Token` (the library-backed template) has an `image: string` field that is
**copied** at token-creation/import time — it can be a URL, base64 blob, or an IndexedDB hash
checksum, but it is never a live pointer back into `assets-data/manifests/manifest-v2.json`.
`PlacedToken` in turn only stores `tokenId` (a reference to the already-materialized `Token`),
not anything asset-service-specific. So:
- Removing/tombstoning a TMT library asset cannot break a scene that already has tokens placed
  from it — those tokens carry their own copied image reference, resolved independently of the
  library's current state.
- The **only** effect of `removed: true` is that `GET /library` (browse/search/facets) stops
  surfacing the asset for **new** placements, while `GET /library/asset/:id` still resolves it
  (so a client holding a stale id — e.g. a cached token-picker entry — gets a graceful, correct
  answer instead of a 404).

This was verified by reading `src/types/token.ts` directly (not assumed): `Token.image` and
`Token.imageChecksum` are plain fields with no id-based join back to the asset service at
render/placement time.

## Sync + manifest merge semantics (for readers of `tools/tmt-ingest/sync.mjs`)

- **Added** (file present in the new release, absent from the stored manifest, or previously
  tombstoned): goes through the full normalize+derive pipeline and is inserted as a new entry.
- **Changed-hash** (same `sourcePath`, different sha256): re-normalized (produces a *new* id,
  since ids are hash-derived) and re-derived. The *old* id that used to own that `sourcePath` has
  the path stripped from it; if that leaves the old id with zero owned paths, it is tombstoned
  (`removed: true`) in the same pass — the content at that path no longer exists under the old
  hash, so the old id is superseded.
- **Removed** (`sourcePath` — and all `duplicatePaths`, if any — absent from the new release's
  raw inventory): tombstoned per above.
- **Unchanged**: left untouched, not re-processed (this is the point of hash-diffing — avoid
  re-running sharp/derivative generation over the whole 16k corpus on every release bump).

`--dry-run` computes and prints the diff summary (added/changed/removed/unchanged counts) without
writing anything — no staging normalize/derive calls, no manifest write.

## Schema

`tools/asset-service/manifest.schema.json` (Joel's C1) was extended in B3 to add optional
`sourcePath`, `duplicatePaths`, `removed`, `removedInRelease` properties to the `assets[]` item
schema — all were already being written by `normalize.mjs`/`sync.mjs` but were previously
undeclared. No required fields changed; existing manifests remain valid against the schema.
