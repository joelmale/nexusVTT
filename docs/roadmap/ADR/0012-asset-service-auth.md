# ADR-0012 — Auth between VTT (backend/clients) and the asset service

Status: **Proposed — DECIDED IN PACKET C0** (do not implement against this stub)

## Context
Current asset routes are public static serving (no auth). The asset service adds writes
(user uploads, C2) and possibly direct-from-browser reads (thumbnails at scale). NexusCodex
precedent: reached via server-side proxy (`server/routes/documents.ts` → `DOC_API_URL`), and
`POST /api/documents` returns a signed upload URL.

## Options (reads and writes decided separately)
Reads: public within deployment · VTT-proxied only · signed thumbnail URLs.
Writes: VTT-proxied with session auth (VTT validates the user, forwards with shared secret) ·
signed upload URLs minted by VTT (Codex precedent) · asset service validates VTT-issued tokens.

## Decision drivers
Player thumbnail fetch volume (16k-library browsing should not funnel through the VTT process) ·
docker-network trust boundary in the dockhand deployment · guest-user model (users table:
google|discord|guest) · C2 quota enforcement point · simplicity (one auth mechanism, not three).

## Decision
_(pending C0 — record here, set Status: Accepted (Joel, date))_
