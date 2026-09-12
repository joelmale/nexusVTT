# NexusCodex Intelligent Codex Upgrade Plan

This document tracks the upgrade phases described in `codex_backlog.json` and references baseline metrics produced by the benchmark harness.

## Baseline Metrics

- Ingestion benchmark command: `node scripts/benchmark-ingest.js --file /path/to/document.pdf --api http://localhost:3005`
- Metrics captured: render, OCR, extract, index, assets (thumbnail/page images)
- Store benchmark output in a shared log or issue for comparison across phases.

## Phases Overview

### P0: Program Setup & Baselines
- Benchmark harness and documentation scaffolding.

### P1: Performance & Pipeline Hardening
- Staged ingestion with checkpoint/resume and fast-path OCR detection.

### P2: Layout-aware Extraction & Parser Modularization
- Column-aware reconstruction and parser confidence scoring.

### P3: Chunk Store + Hybrid Semantic Search
- Chunk storage, embeddings interface, and hybrid retrieval endpoint.

### P4: RAG Q&A with Strict Grounding
- Ask endpoint with citations and grounding guarantees.

### P5: Canonical Entity Registry + Cross-Document Linking
- Canonical entities and graph-based linking between rules/monsters/spells.

### P6: Global Command Palette UX
- Unified search + ask in a DM-focused command palette.

### P7: VTT Integration + Real-time Entity Push
- VTT entity schema, adapters, and websocket push events.

### P8: Quality Gates, Evaluation, and Scaling
- Regression testing for ingestion + retrieval + grounded answers.

## Decision Records
- See `docs/adr/` for Architecture Decision Records (ADRs).
