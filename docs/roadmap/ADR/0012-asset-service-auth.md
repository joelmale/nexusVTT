# ADR-0012 — Auth between VTT (backend/clients) and the asset service

Status: **Proposed — drafted 2026-07-03, awaiting Joel's decision** (reply "0012: as recommended" or edits)

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
_(pending Joel — on approval set: Status: Accepted (Joel, date); then C1 adds the key check +
network binding, C2 builds on the proxy path)_
