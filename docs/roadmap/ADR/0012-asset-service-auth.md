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

> ⚠️ **Known implementation gap (2026-07-03, must-fix before upload UI ships):** the current
> proxy (`server/index.ts` ~1605) injects the secret for ANY caller of `/user/*` without
> validating the session user or matching them to `:userId` — the "VTT authenticates first"
> half of this decision is not yet implemented. Implemented header is `x-nexus-auth` (not
> `X-Asset-Service-Key`). See [reviews/S3-review-B1-B2-C2-C3-C4.md](../reviews/S3-review-B1-B2-C2-C3-C4.md) must-fix #1.
