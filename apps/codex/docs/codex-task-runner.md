# Codex Task Runner Checklist

This checklist tracks the full upgrade plan in `codex_backlog.json`. Each task entry includes a status block to log progress as Codex runs.

## Status Legend
- [ ] Not started
- [~] In progress
- [x] Completed
- [!] Blocked

## How to Use
1) Pick the next task in dependency order.
2) Paste the `agent_prompt` for that task to Codex.
3) Update the task status and log section below.
4) Commit in small, reviewable increments.

## Global Run Log
| Date | Phase | Task | Status | Notes |
| --- | --- | --- | --- | --- |
| 2025-12-20 | P0 | P0-T1 | Completed | Benchmark harness + README instructions added |
| 2025-12-20 | P0 | P0-T2 | Completed | Upgrade plan doc + ADR template added |
| 2025-12-20 | P1 | P1-T1 | Completed | Staged ingestion pipeline + checkpoints + asset queue split |
| 2025-12-20 | P1 | P1-T2 | Completed | OCR pool + configurable detection thresholds |
| 2025-12-20 | P1 | P1-T3 | Completed | Batched structured data writes with cleanup |
| 2025-12-20 | P2 | P2-T1 | Completed | Layout-aware text reconstruction + per-page confidence |
| 2025-12-20 | P2 | P2-T2 | Completed | Modular parsers with confidence + needs_review fallback |
| 2025-12-20 | P3 | P3-T1 | Completed | Chunk store model + chunking pipeline |
| 2025-12-20 | P3 | P3-T2 | Completed | Embeddings provider + chunk embeddings |
| 2025-12-20 | P3 | P3-T3 | Completed | Hybrid semantic search endpoint |
| 2025-12-20 | P4 | P4-T1 | Completed | Grounded ask endpoint with citations |
| 2025-12-20 | P5 | P5-T1 | Completed | Canonical entity registry + resolver |
| 2025-12-20 | P5 | P5-T2 | Completed | Entity mentions + spell link worker |
| 2025-12-20 | P6 | P6-T1 | Completed | Command palette for global search + ask |
| 2025-12-20 | P7 | P7-T1 | Completed | VTT export + websocket push events |
| 2025-12-20 | P8 | P8-T1 | Completed | Eval suite scripts for retrieval, ask, ingest |

## P0: Program Setup & Baselines

### P0-T1: Add ingestion benchmark harness
- [x] Status
- Log:
  - Start: 2025-12-20
  - End: 2025-12-20
  - Commit: pending
  - Tests/Commands: `node scripts/benchmark-ingest.js --file /path/to/document.pdf --api http://localhost:3005`
  - Notes: Adds benchmark harness and README instructions.

### P0-T2: Create docs/upgrade-plan.md + ADR folder
- [x] Status
- Log:
  - Start: 2025-12-20
  - End: 2025-12-20
  - Commit: pending
  - Tests/Commands: n/a
  - Notes: Adds upgrade plan doc and ADR template.

## P1: Performance & Pipeline Hardening

### P1-T1: Refactor ingestion into staged jobs with checkpoint/resume
- [x] Status
- Log:
  - Start: 2025-12-20
  - End: 2025-12-20
  - Commit: pending
  - Tests/Commands: not run (tests added in doc-processor)
  - Notes: Staged ingestion with checkpoints; assets moved to separate queue.

### P1-T2: Parallel OCR worker pool + fast-path detection
- [x] Status
- Log:
  - Start: 2025-12-20
  - End: 2025-12-20
  - Commit: pending
  - Tests/Commands: not run (tests added in doc-processor)
  - Notes: OCR pool with configurable concurrency and detection thresholds.

### P1-T3: Batch DB writes to avoid write amplification
- [x] Status
- Log:
  - Start: 2025-12-20
  - End: 2025-12-20
  - Commit: pending
  - Tests/Commands: not run
  - Notes: Structured data uses deleteMany + createMany batches.

## P2: Layout-aware Extraction & Parser Modularization

### P2-T1: Layout-aware PDF text reconstruction
- [x] Status
- Log:
  - Start: 2025-12-20
  - End: 2025-12-20
  - Commit: pending
  - Tests/Commands: not run (tests added in doc-processor)
  - Notes: Layout service reconstructs columns, stores per-page confidence.

### P2-T2: Modular parsers + confidence scoring + fallback storage
- [x] Status
- Log:
  - Start: 2025-12-20
  - End: 2025-12-20
  - Commit: pending
  - Tests/Commands: not run (tests added in doc-processor)
  - Notes: Parsed entities include confidence, rawSnippet, and needsReview flags.

## P3: Chunk Store + Hybrid Semantic Search (BM25 + Vectors)

### P3-T1: Introduce chunk storage model and chunking pipeline
- [x] Status
- Log:
  - Start: 2025-12-20
  - End: 2025-12-20
  - Commit: pending
  - Tests/Commands: not run (tests added in doc-processor)
  - Notes: Document chunks stored with page ranges and hashes.

### P3-T2: Embeddings provider interface and embedding generation
- [x] Status
- Log:
  - Start: 2025-12-20
  - End: 2025-12-20
  - Commit: pending
  - Tests/Commands: not run
  - Notes: Hash embeddings provider with batching; embeddings stored on chunks when enabled.

### P3-T3: Hybrid semantic search endpoint returning ranked chunks + citations
- [x] Status
- Log:
  - Start: 2025-12-20
  - End: 2025-12-20
  - Commit: pending
  - Tests/Commands: not run
  - Notes: `/api/search/semantic` returns ranked chunks with citations.

## P4: RAG Q&A with Strict Grounding + Citations

### P4-T1: Implement /api/search/ask with strict grounding and structured citations
- [x] Status
- Log:
  - Start: 2025-12-20
  - End: 2025-12-20
  - Commit: pending
  - Tests/Commands: `node scripts/eval-ask.js --api http://localhost:3005`
  - Notes: Ask endpoint returns citations; eval script checks citations.

## P5: Canonical Entity Registry + Cross-Document Linking + Graph

### P5-T1: Create canonical entity registry models and resolver
- [x] Status
- Log:
  - Start: 2025-12-20
  - End: 2025-12-20
  - Commit: pending
  - Tests/Commands: not run
  - Notes: Entities and aliases added; structured data links to entityId.

### P5-T2: Reference extraction + resolution worker to create typed links
- [x] Status
- Log:
  - Start: 2025-12-20
  - End: 2025-12-20
  - Commit: pending
  - Tests/Commands: not run
  - Notes: Spell mentions extracted from monster snippets and linked.

## P6: Global Command Palette UX

### P6-T1: Implement command palette integrating keyword search, semantic search, and ask
- [x] Status
- Log:
  - Start: 2025-12-20
  - End: 2025-12-20
  - Commit: pending
  - Tests/Commands: not run
  - Notes: Cmd/Ctrl+K opens palette with quick/semantic/ask results.

## P7: VTT Integration + Real-time Entity Push

### P7-T1: Define VTTEntity schema + conversion adapters + push events
- [x] Status
- Log:
  - Start: 2025-12-20
  - End: 2025-12-20
  - Commit: pending
  - Tests/Commands: not run
  - Notes: VTT export endpoint + websocket events for entity push.

## P8: Quality Gates, Evaluation, and Scaling

### P8-T1: Automated eval suite for retrieval, RAG grounding, and ingestion regression
- [x] Status
- Log:
  - Start: 2025-12-20
  - End: 2025-12-20
  - Commit: pending
  - Tests/Commands: `node scripts/eval-suite.js --api http://localhost:3005`
  - Notes: Adds eval scripts for retrieval, ask, and ingest regression.
