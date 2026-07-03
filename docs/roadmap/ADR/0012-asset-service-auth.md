# ADR-0012 — Auth between VTT (backend/clients) and the asset service

Status: **Accepted** (Joel, 2026-07-03)

## Context (verified @ e522c00)
Current asset routes are fully public static serving (no auth of any kind). The service adds
writes (user uploads/deletes, C2) and high-volume reads (players browsing a 16k-item library —
thumbnail fetches should NOT funnel through the VTT websocket server's process). Precedents
in-house: NexusCodex is reached via VTT server proxy (`DOC_API_URL`); doc-api mints signed
upload URLs (`POST /api/documents`).

## Recommended split (decide reads and writes separately)

**Reads — public-within-deployment, served direct.**
Thumbnails/originals/manifest are GET-only, non-secret content. Clients hit the asset service
directly (via the reverse proxy path in prod, e.g. `/asset-api/*` → asset container). No
tokens, full HTTP caching (`Cache-Control: immutable` works perfectly with content-addressed
paths from ADR-0011). Rationale: browse-scale read traffic bypasses the VTT process entirely;
there is nothing confidential in a token image. If private user assets later need read
protection, add signed thumbnail URLs *for the `/users/*` partition only* — deferred until
someone actually asks for private assets.

**Writes — VTT-proxied with a shared service secret.**
Client → VTT backend (which already knows the authenticated session user) → asset service with
`X-Asset-Service-Key: <env secret>` + the acting userId. The asset service accepts writes ONLY
with the key (and only from the docker network). One mechanism, no token infrastructure, quota
enforcement lives asset-service-side keyed on the forwarded userId. Signed direct-upload URLs
(the doc-api pattern) are the *upgrade path* if proxying uploads ever measurably hurts —
explicitly not needed at 10MB-max files.

## Rejected alternatives
- Everything proxied through VTT: turns the game server into a thumbnail CDN.
- Full token auth on reads: ceremony without a threat model; hurts caching.
- Signed URLs everywhere now: two mechanisms on day one; C2 gets slower to ship.

## Decision
**Approved as recommended.** Reads remain public-within-deployment (served direct), and writes will be proxied through the VTT with a shared service secret.

**Amendment (Joel, 2026-07-03): uploads are for authenticated non-guest users only.**
Guest users (provider `'guest'`) cannot upload/delete server-side assets — they keep the
existing localStorage-only custom-token path. The VTT write guard enforces: unauthenticated
→ 401; guest → 403 (`guest-upload-forbidden`); session user ≠ path userId → 403.

> ✅ **Gap resolved (2026-07-03, S4 fix-pack):** `assetWriteGuard`
> (`server/middleware/assetWriteGuard.ts`, mounted at `/api/user` before the proxy) now
> enforces session auth + guest exclusion + userId match before the secret is injected.
> Implemented header is `x-nexus-auth` (not `X-Asset-Service-Key`). Guest identity note:
> guests never call `req.login()`, so `req.isAuthenticated()` excludes them structurally;
> the provider check is defense-in-depth.
