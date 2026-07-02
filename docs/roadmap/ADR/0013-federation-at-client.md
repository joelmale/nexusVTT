# ADR-0013 — Atlas federation happens at the client, not the server

Status: **Accepted** (Joel, 2026-07-02)

## Context
The Atlas presents assets from four+ sources: the asset service (base library + TMT + user
assets), bundled token/prop libraries (client-side, instant), and NexusCodex (read-only,
optional). A server-side aggregator was the alternative.

## Decision
Federation is a client concern: `useAtlasAssets` (C3) + per-source adapters normalize everything
into one `AtlasAsset` union (`{id:'<source>:<id>', source, name, thumbnailUrl,
resolveFullAsset(), …}`). Each source has independent loading/error/availability state; a source
being offline (Codex 503, asset service down) degrades exactly one dock tab. No server-side
consolidation endpoint; NexusCodex is queried over its existing API only (ADR-0001).

## Consequences
- Bundled sources work offline and cost zero network; no aggregator becomes a SPOF or a schema
  bottleneck.
- Pagination-shape normalization (skip/limit vs page/hasMore vs sync-slice) lives in adapters.
- Known gap accepted: Codex full-text search lacks thumbnail fields → codex tab search is a
  client-side filter over listed documents until Codex changes for its own reasons.
