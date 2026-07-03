# T3 Review — Joel's packets B1, B2, C1(implicit), C2, C3, C4 (commits b22691e, ac97cd2, 77cfd67)

Reviewed 2026-07-03 @ 77cfd67. Main repo: type-check clean, 446 tests passing.
This review doubles as the B1 and C1 gate reviews (fast-tracked). Verdicts below.

## Verdicts

| Packet | Verdict | Conditions |
|---|---|---|
| B1 normalization | **PASS** | minor improvements listed |
| B2 derivatives | **PASS** | symlink race + failure-list nits |
| C1 service skeleton | **PASS w/ fixes** | service fails its own type-check; port default collision |
| C2 user assets | **BLOCKED for exposure** | 2 must-fix bugs (security + dead path) before any UI uses upload |
| C3 federation hook | **PASS w/ gaps** | no pagination/loadMore; eager fetch violates ADR-0009 |
| C4 dock shell | **PASS w/ conditions** | no virtualization (required before C6); HTML5 DnD conflicts ADR-0008 |

## MUST-FIX (ranked)

1. **[C2/security] Proxy injects the write secret for ANY caller.** `server/index.ts:1605-1615`
   stamps `x-nexus-auth` onto every request hitting `/user/*` with no session validation and no
   check that the caller IS `:userId`. Any anonymous browser can upload to / delete from any
   user's space through the VTT. ADR-0012's design requires: VTT authenticates the session user
   first, then forwards — ideally deriving userId from the session and ignoring the path param.
2. **[C2] Upload client path mismatch — feature is dead E2E.** `tokenAssets.ts:632` posts to
   `/api/user/:id/upload`; the proxy mounts at `/user`. Nothing serves `/api/user/*` → 404.
   Symptom of no end-to-end test; add one when fixing.
3. **[C1] asset-service fails `tsc --noEmit`.** `src/index.ts:287` 4-arg handler uses undefined
   `NextFunction` + DOM `Request/Response` types. Also semantically wrong: a 4-arg Express
   handler is an ERROR handler, so unknown routes get the default HTML 404 and real errors get
   a misleading JSON "Not found". Make it a 3-arg catch-all + separate error handler; import
   types from express; add `build`/`type-check` to CI or root scripts.
4. **[C1] Port default collision / self-proxy loop.** Asset service defaults to PORT 5001 =
   the VTT's port; VTT's `ASSET_API_URL` defaults to `http://localhost:5001` = itself. Default
   config either fails to bind or self-proxies. Fix: service default 5003; `ASSET_API_URL`
   default `http://localhost:5003`; document in .env.example.

## SHOULD-FIX

5. **[C2] Auth after multer.** `upload.single('file')` runs before the secret check — an
   unauthenticated POST buffers 5MB to memory pre-rejection. Put the auth check first.
6. **[C4] ADR-0008 conflict: HTML5 draggable/dataTransfer on cards.** Ruling was pointer-events
   DnD (one gesture system with the canvas, styleable ghost). Decision recorded: keep ADR-0008 —
   C5 replaces the dataTransfer wiring with the pointer implementation (small code, correct time).
7. **[C4→C6 gate] No virtualization.** Plain `assets.map` is fine for ~100 bundled assets,
   not for 16k TMT. ADR-0008's content-visibility + IntersectionObserver sentinel becomes a C6
   entry criterion. Related: C3 has no cursor/loadMore — same packet of work.
8. **[C3/C4] Eager fetch violates ADR-0009 (lazy).** `useAtlasAssets()` fires on mount inside
   an always-mounted AtlasDock (GameUI renders it unflagged) — every session boot hits codex +
   maps endpoints with the dock closed. Gate the fetch on first open; consider flagging the
   dock (`atlas-dock`) per the A6a precedent until C5/C6 mature.
9. **[C2] Extension-only file validation.** Add magic-byte sniff (sharp metadata or file-type)
   on upload; extension lies.
10. **[B2] Symlink-name race in concurrent batch.** Two same-named assets in one 50-batch can
    both pass the exists-check then collide on `symlinkSync` (EEXIST → fatal). Precompute names
    sequentially or catch EEXIST in the loop. Also: record derivative failures to a file
    (brief wanted a failure list), and add `withoutEnlargement: true` so <256px art isn't upscaled.

## NICE-TO-HAVE

11. [B1] Canonical-duplicate selection is inventory-order-dependent — pick lexicographically
    smallest sourcePath so cross-release re-orders can't flip name/category of a deduped asset.
12. [B1] Taxonomy is category-only (`tags:[category]`); richer creature/tag extraction deferred — fine.
13. [C1] Boot-time manifest load: missing manifest = permanent 503 until restart; B3 wants a
    reload path anyway.
14. [C4] a11y gaps vs A6a precedent: no `inert` when closed (hidden panel is still tabbable),
    no `role`/`aria-expanded`, one inline style. Small polish pass.
15. [B0/B1] Scripts resolve `../../assets-data` from CWD — breaks unless run from
    tools/tmt-ingest; use `import.meta.url`-relative paths.

## Also recorded
- ADR-0010/0011/0012 flipped to **Accepted** with Joel's picks (A / A + mandatory browse tree /
  as-recommended). ADR-0011 quotas updated to match implementation: 50MB/user, 5MB/file.
- ADR-0012 carries a "known gap" note pointing at must-fix #1 until it lands.
- B1's determinism gate: verify.mjs double-run hash check is a correct mechanism; sample
  taxonomy review was skipped by Joel's own call (owner's prerogative, noted).
