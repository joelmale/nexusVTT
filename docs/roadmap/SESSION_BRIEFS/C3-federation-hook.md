# C3 — useAtlasAssets federation hook

track: C · risk: Low-Med · gate: none · depends_on: [] (dependency-free — builds against EXISTING sources) · unblocks: [C4]
budget_cap: 140k tokens (T2 ~80k / T3 ~30k)

## Objective
Build the client-side federation layer (ADR-0013): `src/hooks/useAtlasAssets.ts` normalizing all
sources into one `AtlasAsset` union with per-source loading/error/availability, debounced search,
cursor pagination, and abort-on-change. Ships with unit tests + a dev harness page; no dock UI
(that's C4). The new asset service slots in later as a config change, not a rewrite.

## Ground truth (verified @ e29131b, 2026-07-02)
- Sources to federate (day one):
  1. **NexusCodex (read-only)** — `src/services/documentService.ts`: `listDocuments({skip, limit})` → `{documents, pagination:{total,skip,limit}}`; `searchDocuments(...)`; thumbnails `GET /api/documents/{id}/thumbnail`; content `GET /api/documents/{id}/content`. **Caveats:** service is optional — 503 surfaces as an Error whose *message* contains the status (no typed error today; wrap in a typed `AtlasSourceError`); search responses lack thumbnail fields → codex search = client-side filter over listed docs for MVP (known gap, recorded in ADR-0013).
  2. **Static asset server (maps/art)** — `src/services/assetManager.ts`: `getAssetsByCategory(category, page, limit)` → `{assets, hasMore}`; `searchAssets(q)`; blob-URL cache.
  3. **Bundled tokens** — `src/services/tokenAssets.ts` (`tokenAssetManager`): sync after `initialize()`; `searchTokens(q)`; localStorage customizations.
  4. **Bundled props** — `src/services/propAssets.ts` (mirror tokenAssets API — verify exact export names via drift check).
- **No AbortController usage exists in any service** — abort support is net-new in the hook layer.
- Three different pagination shapes (skip/limit+total, page+hasMore, sync-slice) normalize behind one cursor interface.
- `AtlasAsset` = `{ id: '<source>:<id>', source: 'codex'|'maps'|'tokens'|'props' (+'library' later), name, thumbnailUrl, resolveFullAsset(): Promise<string>, width?, height?, tags? }` — full-res resolution deferred to drop time.
- Fetch policy (ADR-0009): lazy — nothing fetches until first consumer demand; local sync sources are instant.

## Drift check
```bash
rg -n "listDocuments|searchDocuments" src/services/documentService.ts | head -4
rg -n "getAssetsByCategory|searchAssets" src/services/assetManager.ts | head -4
rg -n "searchTokens|export" src/services/tokenAssets.ts | head -6
rg -n "export" src/services/propAssets.ts | head -6
rg -n "AbortController" src/services/*.ts | head -3   # expect: none
```

## Delegation plan
- T2: the hook + `AtlasSourceError` + source adapters (one module per source under `src/hooks/atlasSources/`), unit tests with mocked services (offline codex → `available:false`, not error; abort race → no stale writes; debounce 250ms), dev harness route (dev-only) listing federated results.
- T3: review the race/abort logic and the union type's fitness for C4/C5/C6 consumers.

## Exit criteria
- Unit tests green: per-source pagination, merged results, debounce, abort-on-query-change, codex-503→availability-flag.
- Dev harness: search "goblin" returns bundled token hits with codex offline (kill doc-api) — no error banner, source marked offline.
- Zero UI dependencies (hook + adapters importable headless). type-check / lint / test pass.

## Rollback
Purely additive files; branch revert.

Handoff & close-out: RESUME_PROTOCOL.md §4–5.
