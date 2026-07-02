# ADR-0001 — NexusCodex remains an independent document microservice

Status: **Accepted** (Joel, 2026-07-02)

## Context
NexusCodex (doc-api REST + doc-websocket) manages campaign documents, reached via the VTT
backend proxy (`server/routes/documents.ts` → `DOC_API_URL`). The Atlas needs asset browsing;
temptation existed to extend NexusCodex into general asset management.

## Decision
NexusCodex stays a document library. It gains NO asset semantics, no thumbnail/asset schema
extensions, no merge into the Atlas. The Atlas queries it **read-only over its existing API**
as just another federated source (see ADR-0013).

## Consequences
- Asset domain lives in a dedicated asset service (ADR-0010).
- Codex full-text search lacks thumbnail fields → Atlas codex search is a client-side filter
  over listed documents until/unless Codex adds fields for its own reasons.
- Clean failure isolation: Codex offline = one dock tab badged offline, nothing else affected.
