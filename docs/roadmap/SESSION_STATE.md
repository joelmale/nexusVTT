# SESSION_STATE — machine-parseable save file
# Update per RESUME_PROTOCOL.md §5. Append-friendly: edit only your packet's row; append log rows.

last_updated: 2026-07-02
last_verified_commit: e29131b
roadmap_version: 1

## Packet ledger
# status: todo | in-progress | done | blocked | split
# gate: none | advisory | pending | approved  (blocking-gate packets need `approved` before dependents dispatch)

| packet | status | gate | depends_on | last_commit | notes |
|--------|--------|------|------------|-------------|-------|
| A1  | todo | none→pending-on-done | — | — | entry point |
| A2  | todo | n/a | — | — | entry point |
| A3  | todo | n/a | A2 | — | |
| A4  | todo | n/a | — | — | entry point |
| A5  | todo | none→pending-on-done | A4 | — | A3 soft-dep (cleaner profiling) |
| A6a | todo | none→pending-on-done | A1 | — | introduces feature-flag util |
| A6b | todo | none→pending-on-done | A6a | — | |
| A6c | todo | n/a | A6b | — | |
| A7  | todo | advisory | A6a | — | |
| A8a | todo | n/a | A4 | — | flag stays off |
| A8b | todo | none→pending-on-done | A8a | — | cutover |
| A9  | todo | none→pending-on-done | A4, A5(approved) | — | server change: fog/* relay events |
| A10 | todo | n/a | A5,A6c,A7,A8b,A9 | — | Track A terminal |
| C0  | todo | none→pending-on-done | — | — | entry point; unblocks 7 packets |
| C1  | todo | none→pending-on-done | C0(approved) | — | |
| C2  | todo | n/a | C0(approved), C1(approved) | — | |
| C3  | todo | n/a | — | — | entry point |
| C4  | todo | n/a | C3, A1(approved) | — | |
| C5  | todo | advisory | C4 | — | |
| C6  | todo | none→pending-on-done | C4, B3(approved) | — | program capstone |
| B0  | todo | n/a | C0(approved) | — | ⚠️ requires TMT repo+tag from Joel |
| B1  | todo | none→pending-on-done | B0 | — | sample review gate |
| B2  | todo | n/a | B1(approved), C0(approved) | — | |
| B3  | todo | none→pending-on-done | B2, C1(approved) | — | |

## Open T3 rulings pending
(none)

## Deferred / unscheduled
- Token-vision fog (post-A9; product decision needed — see ADR-0009).
- Map/document drop routing from Atlas dock (C5 open_question: background-set + handout-share flows).
- Hover-peek for Atlas dock (C4 recommends click-only first).

## Known drift (codebase facts that contradict older docs — trust these, fix docs in A10)
- CLAUDE.md §3/§11 claim canvas rendering → actually SVG master + DOM tokens (verified e29131b).
- CLAUDE.md says `src/utils/websocket.ts` → actually `src/services/websocket.ts`.
- CLAUDE.md references `drawingPersistenceV2.ts` and `'mask'` drawing type → neither exists.
- `server/index.ts` `routeMessage()` is dead code; live path = SocketManager + `server/socket/handlers/*`.
- No feature-flag infrastructure exists (A6a introduces it).

## Session log (append-only)
| date | session | packet | outcome | spend (approx, by tier) | notes |
|------|---------|--------|---------|--------------------------|-------|
| 2026-07-02 | S0 | roadmap bootstrap | done | T1 ~193k (3 scouts, prior session) · T2 ~187k (3 specialists, prior session) · T3 planning + this package | Blueprint + Roadmap Package created. Ground truth pinned @ e29131b. Next: A1 / C0 / C3 (any order, parallel-safe). |
