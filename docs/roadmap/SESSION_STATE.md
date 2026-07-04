# SESSION_STATE — machine-parseable save file
# Update per RESUME_PROTOCOL.md §5. Append-friendly: edit only your packet's row; append log rows.

## ⚠️ ACTIVE HANDOFF (2026-07-03 — read this FIRST, then RESUME_PROTOCOL.md)
Session S5 ended mid-flight (operator token budget). State on branch `packet/A5-A6b-B3`:
1. **A6b: DONE + committed (29acb84).** T2-verified. Still owed: T3 visual review in browser
   (flag ON/OFF screenshots @1280x800, emoji legibility @36px — 🗺️/⚙️/🔊 risk glyphs,
   idle-fade contrast on glass+solid themes) → then Joel's gate. Flag: set localStorage
   `nexus-flags` = `{"floating-panels":true}` + reload. Brief drift to fix in
   SESSION_BRIEFS/A6b: ConnectionStatus was never in main header; Leave Room was a
   standalone header button (both corrected in code, brief text stale).
2. **A5: IN-PROGRESS, UNCOMMITTED partial work in tree** (src/components/Scene/**,
   src/stores/scene/**). Builder crashed on API overload after 64 tool calls, was resumed,
   session ended before completion. Next orchestrator: `git status` + `git diff` the A5
   domain; if coherent, dispatch a T2 to finish from tree state (brief: A5-subscription-surgery
   + deltas listed in S5 log row); if torn, stash/discard ONLY Scene+stores/scene files and
   re-run the packet. Exit = render-spy tests + live profiler trace (grid/background 0 renders
   during token drag).
3. **B3: IN-PROGRESS, UNCOMMITTED partial work in tree** (tools/tmt-ingest/**,
   services/asset-service/**, docs/roadmap/contracts/**). Builder never returned a handoff.
   Same salvage procedure, scoped to those paths. Exit criteria in SESSION_BRIEFS/B3 (+ deltas:
   no contract doc existed — B3 creates it; service exports app w/ supertest suite to extend).
4. Uncommitted A5/B3 files are NOT broken-by-default — they may be near-complete. Assess
   before discarding. Root `npm run type-check && npm run test` tells you tree health fast.
5. After A5+B3 land: per-packet commits, merge branch → master (Joel tests off master),
   then next wave C5 + A7 + A8a (collision-free only AFTER A5 is merged).

last_updated: 2026-07-03
last_verified_commit: 77cfd67 (master — all packet branches merged)
roadmap_version: 1

## Packet ledger
# status: todo | in-progress | done | blocked | split
# gate: none | advisory | pending | approved  (blocking-gate packets need `approved` before dependents dispatch)

| packet | status | gate | depends_on | last_commit | notes |
|--------|--------|------|------------|-------------|-------|
| A1  | done | approved (Joel, 2026-07-03) | — | 47d7a55 | audit clean; 13 approved local literals + critical.css exempt (T3 ruling); A6a/C4 unblocked |
| A2  | done | n/a | — | 73ff143 | one store write/gesture proven by test; profiler + two-tab smoke deferred to A5 gate evidence |
| A3  | done | n/a | A2 | 37443fe | zero mid-gesture re-renders; NOTE: camera/update has NO server relay (pre-existing — see deferred) |
| A4  | done | n/a | — | d0891ed | T3 ruling: realized as ADDITIVE narrow-selector modules (src/stores/scene/) — gameStore.ts diff is ZERO; isolation via Immer structural sharing, proven by sliceIsolation.test.ts; physical monolith split deferred as optional cleanup. A5 imports from stores/scene/index.ts |
| A5  | todo | none→pending-on-done | A4 | — | A3 soft-dep; NOTE: A4's narrow hooks are additive/dormant — A5 wires them into layer components (that's where the re-render win lands) |
| A6a | done | approved (Joel, 2026-07-03) | A1(approved) | 68db393+19ef427 | flag 'floating-panels' default OFF; first CSS Module; live-verified both states (found+fixed 1fr min-content blowout); A6b/A7 unblocked |
| A6b | todo | none→pending-on-done | A6a | — | |
| A6c | todo | n/a | A6b | — | |
| A7  | todo | advisory | A6a | — | |
| A8a | todo | n/a | A4 | — | flag stays off |
| A8b | todo | none→pending-on-done | A8a | — | cutover |
| A9  | todo | none→pending-on-done | A4, A5(approved) | — | server change: fog/* relay events |
| A10 | todo | n/a | A5,A6c,A7,A8b,A9 | — | Track A terminal |
| C0  | done | approved (Joel, 2026-07-03) | — | (drafted) | ADR-0010/0011/0012 fully updated with Joel's picks (A / A+symlinks / as-recommended); C1/C2/B0 unblocked |
| C1  | done | approved via T3 review w/ fixes required | C0(approved) | b22691e | services/asset-service; T3 REVIEW: service fails own tsc (404-handler types) + port-5001 default collision — see reviews/S3 must-fix #3/#4 |
| C2  | done | unblocked (S4 fix-pack) | C0(approved), C1(approved) | b22691e+fixpack | upload/delete + 50MB quota; S4 fix-pack resolved all must-fixes: assetWriteGuard (session+guest-exclusion+userId match, ADR-0012 amendment), /api/user pathRewrite, auth-before-multer, ports 5003, 9-test supertest suite. Guests = localStorage only (Joel ruling) |
| C3  | done | n/a | — | b22691e | useAtlasAssets + 4 adapters; T3 REVIEW: no pagination/loadMore, eager fetch violates ADR-0009 (lazy) — reviews/S3 #8 |
| C4  | done | n/a | C3, A1(approved) | b22691e | AtlasDock CSS Modules, fixed+translateY (ADR-0007 ✓); T3 REVIEW: no virtualization (C6 entry criterion), HTML5 DnD conflicts ADR-0008 (C5 replaces), no inert/aria — reviews/S3 #6/#7/#14 |
| C5  | todo | advisory | C4 | — | |
| C6  | todo | none→pending-on-done | C4, B3(approved) | — | program capstone |
| B0  | done | n/a | C0(approved) | b22691e | source pinned: IsThisMyRealName/too-many-tokens-dnd @ 1.1.1 (recorded in ADR-0014) |
| B1  | done | approved via T3 review | B0 | b22691e | normalize.mjs deterministic (fixed generatedAt, sorted, hash ids, 10% residue abort) + verify.mjs double-run check; sample taxonomy review waived by Joel; improvements: canonical-dup ordering, richer tags — reviews/S3 #11/#12 |
| B2  | done | n/a | B1(approved), C0(approved) | b22691e | blobs/ + derivatives/v1/ + browse/ symlink tree per ADR-0011(+Joel's pick); idempotent; improvements: symlink batch race, failure list, withoutEnlargement — reviews/S3 #10 |
| B3  | todo | none→pending-on-done | B2, C1(approved) | — | |

## Open T3 rulings pending
(none)

## Deferred / unscheduled
- Token-vision fog (post-A9; product decision needed — see ADR-0009).
- Map/document drop routing from Atlas dock (C5 open_question: background-set + handout-share flows).
- Hover-peek for Atlas dock (C4 recommends click-only first).
- **Server camera/update relay** (found in A3): 'camera/update' is not in EntitySyncHandler
  RELAY_EVENTS — Follow-DM cross-client sync is broken end-to-end, pre-existing. Needs a small
  server packet: add relay + decide host-only enforcement (DM_ONLY precedent). Scout-Data's
  claim that EntitySyncHandler handles camera/* was WRONG.
- Transform-formula duplication: SceneCanvas declarative template + cameraGestureEngine
  imperative write compute the same string — extract shared helper in A10.
- PropRenderer still uses the pre-A2 mousemove drag pattern — candidate A2-style follow-up.
- Zoom-at-cursor does not exist (zoom is center-anchored) — potential UX packet.
- **Session recovery hangs forever** on "Loading game…" when the stored room is dead server-side;
  recovery uses an UNDOCUMENTED `nexus-room` cookie (plus localStorage nexus-session/
  nexus-connection-context + IndexedDB) that stuck pages re-write, making escape impossible
  without clearing the cookie. Chip filed (task_c85a53e7). Document cookie in CLAUDE.md (A10).
- Flaky pre-existing test: gameStore.test.ts token/move updatedAt toBeGreaterThan on
  same-millisecond timestamps. Chip filed (task_da58aa9c).
- vitest mockReset:true gotcha: vi.mock factory mockResolvedValue is wiped per-test; re-arm in
  beforeEach (see sliceIsolation.test.ts / gameStore.persistence.test.ts convention).

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
| 2026-07-03 | S4 | fix-pack (S3 must-fixes #1-4 + #5/#8) | done | T2 155k (over informal ~80k estimate — thorough test work: 18 new tests incl. 9-test service supertest suite) · T3 review ~25k | Branch packet/fixpack-S3 → master. Security guard landed + verified line-by-line (mount at server/index.ts:1648). Joel ruling mid-flight: guests localStorage-only (ADR-0012 amendment). Root 455 tests + service 9/9 green, both tsc clean. C2 unblocked for UI exposure. Remaining from S3 review: should-fixes #9/#10/#14 + nice-to-haves → fold into C5/C6/B3 briefs. Next: C5 or A5; camera-relay chip still in flight. |
| 2026-07-03 | S3 | B0-B2, C1-C4 (executed by JOEL solo) + T3 review | done | Joel: human execution (no model spend) · T3 review pass ~40k | Commits b22691e/ac97cd2/77cfd67 direct to master. T3 review = docs/roadmap/reviews/S3-review-B1-B2-C2-C3-C4.md: B1/B2 PASS, C1 pass-w/-fixes (service fails own tsc; port collision), C2 BLOCKED for UI exposure (secret-injection hole + dead client path), C3/C4 pass-w/-gaps (no pagination/virtualization — C6 entry criteria; HTML5 DnD → C5 replaces per ADR-0008). ADR-0010/11/12 Accepted w/ Joel's picks; 0011 quotas synced to implementation; 0012 carries known-gap note. Next: fix-pack for must-fixes #1-4, then A5 or C5. |
| 2026-07-03 | S2 | A4+A6a (batched by Joel, parallel T2 builds) | done | A4: T2 109k (~under 180k cap) · A6a: T2 105k + T3 preview verification (~cap) | Branch packet/A4-A6a stacked on packet/A1-A3. A4 accepted via T3 ruling (additive, zero gameStore diff — exit criteria all met). A6a live-verified both flag states; T3 preview caught+fixed real grid blowout bug (minmax(0,1fr)). 446 tests passing. New findings: nexus-room cookie (undocumented persistence layer), dead-room recovery hang (chip filed), flaky gameStore test (chip filed). A6a gate PENDING Joel review. Next: A5 (unblocked), C0/C3; A6b/A7 blocked on A6a gate. |
| 2026-07-03 | S1 | A1+A2+A3 (batched by Joel) | done | A1: T0+T3 inline (~within cap) · A2: T2 172k (OVER 120k cap — builder hit lint-rule fights + found/fixed 2 real bugs; work complete, no split) · A3: T2 122k (~cap) · T3 review/verify throughout | Single branch packet/A1-A3 (deviation from branch-per-packet: Joel batched; per-packet commits preserved). Drift found: scout errors (DrawingTools inline z never existed; EntitySync does NOT relay camera/*). Baseline: database.test.ts fails pre-existing (needs live PostgreSQL). A1 gate PENDING Joel review. Exit-criteria deferrals: profiler trace + two-tab smoke need running backend — folded into A5's gate evidence per T3 ruling. Next: A4 (unblocked) or C0/C3; A6a/C4 blocked on A1 gate approval. |
