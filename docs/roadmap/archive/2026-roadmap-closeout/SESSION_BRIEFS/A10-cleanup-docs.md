# A10 — Cleanup + docs truth-up

track: A · risk: Low · gate: none · depends_on: [A5, A6c, A7, A8b, A9] · unblocks: [] (Track A terminal)
budget_cap: 80k tokens (T1 ~30k / T3 ~30k)

## Objective
Close Track A: delete dead code/CSS left by the migration, consolidate any straggler coordinate
math onto sceneUtils, and rewrite the stale sections of CLAUDE.md so future sessions inherit
truth instead of archaeology.

## Ground truth (verified @ e29131b, 2026-07-02 — most targets accrue during A2–A9; re-inventory at execution)
Known-stale CLAUDE.md claims to fix (verified this date):
- §3/§11 claim canvas-based rendering → reality: SVG master + DOM tokens (+ canvas ink/fog post-A8/A9). Rewrite to the ADR-0005 layer table.
- `/src/utils/websocket.ts` → actual: `src/services/websocket.ts`.
- `drawingPersistenceV2.ts` referenced → does not exist (only `drawingPersistence.ts`).
- `'mask'` drawing type referenced → does not exist.
- `routeMessage()` server docs → dead code; live path is SocketManager + `server/socket/handlers/*` (already noted in memory; make CLAUDE.md say it).
Known dead files at baseline: `src/styles/initiative-tracker.backup.css`. Legacy drag/camera code paths deleted in A2/A3 — verify no orphans.

## Drift check
```bash
rg -n "utils/websocket|drawingPersistenceV2|'mask'" CLAUDE.md | head
ls src/styles/*.backup.css 2>/dev/null
rg -n "screenToScene|toWorldCoords" src --glob '!utils/sceneUtils.ts' -l | head  # stragglers
```

## Delegation plan
- T1: dead-CSS census (classes defined in the 35 global files with zero `rg` hits in src), orphaned-code scan post-A-track.
- T3: CLAUDE.md rewrite (judgment about what's durable), review deletions (every deletion needs a zero-references proof in the handoff).

## Exit criteria
- CLAUDE.md contains no known-false claims (the five above fixed; layer architecture section reflects ADR-0005; z-scale documented).
- Dead CSS deleted with per-file zero-reference proof; bundle size delta noted.
- `rg` for legacy coordinate helpers outside sceneUtils → 0.
- type-check / lint / test pass; full app smoke (create session, place token, draw, fog, dock panels).

## Rollback
Branch revert. Deletions are the risk — hence per-deletion proof requirement.

Handoff & close-out: RESUME_PROTOCOL.md §4–5.
