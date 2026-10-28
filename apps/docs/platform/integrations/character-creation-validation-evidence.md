---
title: Character creator validation execution ledger
description: Implemented validation repairs, reproducible evidence, unresolved rules work, and manual acceptance tasks.
---

# Character creator validation execution ledger

> **Documentation status (2026-10-27):** the player and engineering guides were refreshed against `6d187098`. This page is a historical planning/evidence record; for current behavior use the [engineering guide](character-creation.md) and the [coverage matrix](character-creation-docs-coverage.md).

Updated **2026-10-26**. Baseline: `248fedf9`; this entry describes subsequent
working-tree changes, not a deployed release. Implements the
[validation completion plan](character-creation-validation-plan.md).
Certification flags remain false and the broad guide refresh remains deferred.

Following publication of this tranche as `38ba9856`, the
[remaining implementation tranches](character-creation-remaining-tranches.md)
define the next resource, progression, reference, host, security and manual
acceptance work. The results below remain the historical execution record.
The subsequent [T-01–03 implementation record](character-creation-tranches-1-3-evidence.md)
tracks the subsequent repairs separately from these historical results.

The portable summary at
`apps/docs/static/validation/character-creation-2026-10-26.json` preserves report
hashes, container image identities, scoped scan counts, selected soak results and
SHA-256 hashes for the 53 changed code/fixture files. It identifies an uncommitted
working-tree candidate, not a release commit. Raw local reports remain separate.

## Inventory and scope correction

The live catalogs expose **13 classes in each edition**, including Artificer.
The original 12-class manifest was incomplete. The current minimum is **26
reviewed builds and 104 host/mode completion cases**. Artificer now appears in
the manifest as uncertified supplemental content. It is no longer incorrectly
attributed to the SRD; SRD-only policies reject it. Neither its source edition
nor its complete casting/progression support is independently approved.

Reproducible inventory and input captures, from the repository root:

```text
node --import tsx packages/character-creator/scripts/capture-support-inventory.ts
node --import tsx packages/character-creator/scripts/capture-validation-inputs.ts
```

The outputs are `packages/character-creator/src/tests/fixtures/supportInventory.json`
and `classValidationInputs.json`. The inventory records class sources, casting
metadata, subclass timing, species/background/spell/feat/subclass/equipment IDs,
and pending review status. The input capture generates **inputs only**. It must
not generate expected numeric answers or count as independent rules evidence.
Review fixture changes explicitly rather than regenerating expectations to pass.

The creator currently authors a single class. A separate rules-engine multiclass
test suite exists; that does not prove multiclass authoring in the shared wizard
or lossless imported/manual multiclass preservation. The latter acceptance is
still **not run**. A source-policy decision is needed for supplemental candidates.

## Implemented repairs and regression coverage

| Case group          | Change                                                                                                                                       | Evidence boundary                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RULES-001           | Revised invocation counts at every Warlock level 1–20; reject unknown/duplicate IDs and unmet dependencies                                   | Literal independent count table, missing/excess and prerequisite regression cases                                                                                      |
| RULES-002           | Repeatable cantrip/Origin-feat targets count separately and survive draft/host serialization                                                 | Eligible/unknown/duplicate/stale targets, Tome-granted cantrips, feat effects and source policy                                                                        |
| RULES-003           | Shared invocation selector at later levels; replace the competing revised level-one widget                                                   | Real component interactions, dependency removal preserves visible answers for repair                                                                                   |
| RULES-004           | Revised Warlock higher-level table replaces legacy patron/invocation/pact-boon schedule                                                      | Accumulated invocation choices at every level, subclass timing, Epic Boon and recovery metadata                                                                        |
| RULES-005           | Exact revised Fighter/Barbarian mastery counts by level, including excess-choice rejection                                                   | Every level 1–20, proficient weapons and duplicate/unknown weapon tests                                                                                                |
| RULES-006           | Shared edition-specific subclass entry in wizard/high-level helpers; correct revised Cleric/Druid/Sorcerer metadata                          | All advertised revised classes at level three; legacy early-subclass boundaries                                                                                        |
| RULES-007           | Artificer inventory/provenance correction                                                                                                    | All 26 catalog/recommendation/serialization cases; SRD-only rejection in both editions                                                                                 |
| REF-WL14 / REF-WL24 | Fixed Human Warlock references with literal expected abilities, HP, AC, initiative, speed, skills, casting and currency                      | Evaluation, durable host serialization and managed browser fixtures; independent human sign-off remains open                                                           |
| REF-VALUES          | Assert currency, skills, save proficiencies/bonuses, initiative and speed for all eight fixed references                                     | Found missing class-kit inputs in R24/W24; restored source-checked kits, with Rogue gold 8 + 15 = 23 and Wizard gold 5 + 8 = 13                                        |
| RT-001              | Coalesce concurrent persisted-room recovery and preserve the live socket map/newer committed projection                                      | 27 controlled admission/recovery tests; full 49-case managed browser rerun, 10-minute normal and chaos soaks passed                                                    |
| SEC-001             | Apply bounded request admission before body parsing and session work                                                                         | API and credential/guest budgets, expiry, key capacity, Retry-After, preflight and readiness regressions                                                               |
| SEC-002             | Validate browser mutation origin, Fetch Metadata and legacy referrers, including GET logout                                                  | Foreign/opaque/malformed origins, sibling-site requests and unproven cookie requests rejected; supported same-origin/configured-origin and cookieless CLI paths tested |
| SEC-003             | Verify generator message origin and iframe source in both listeners, validate export payloads, and use exact outbound target origins         | Forged same-origin windows, foreign origins, malformed exports/results and normal action/export regressions                                                            |
| SEC-004             | Escape generated TypeScript values/keys, fix ambiguous character classes, and remove untrusted websocket event types from log format strings | Hostile source-data AST regression, prototype-shaped data-key regression and Studio title regression                                                                   |
| SEC-005             | Reject a complete Q&A response when any source is private or cannot be authorized                                                            | Private and unavailable source regressions; the upstream implementation includes every retrieved source in its citation list                                           |

Invocation target selections use the existing durable `featChoices` map.
Lessons of the First Ones feeds existing feat calculations/proficiency/casting
validation. Tough applies once, with round-trip tests. Known conditional/manual
invocation features remain named on the saved sheet; this does not establish
automated attack, damage, range, familiar, healing or conditional-casting effects.
Those effects require their own acceptance assertions. Repeating an already-held
Magic Initiate through Lessons remains explicitly rejected pending a separate
spell-list/grant representation; do not mark that combination supported.

Another concrete V-04 gap remains: the saved creator result does not initialize
class ability `resources`. The existing `resourceUtils` helper is not wired into
creation and contains an approximate Charisma-use calculation. Do not fix this
by copying unreviewed progression metadata or treating a saved feature label as
a usable resource. Canonical counts, edition-specific/partial recovery, host
serialization and rest behavior need implementation and independent assertions.
The guided progression registry also returns no dedicated 2014 class table;
legacy fallback behavior must be reviewed explicitly rather than covered by
the repaired 2024 Warlock schedule. Supplemental/source provenance outside
Artificer remains part of V-01, including legacy backgrounds and lineages that
must not be assumed to appear in SRD 5.1.

The evaluator version is **1.1.0** for these changed rules. Existing characters
are not automatically recalculated, relabeled or certified.

## Class reference completion ledger

Candidate inputs and round-trip checks exist for every row. A candidate passing
the same evaluator that produced it is not an independent reference. Existing
fixed references below also need the complete field/action review and recorded
independent sign-off required by V-02.

| Class     | 2014 fixed reference | 2024 fixed reference | Outstanding                                                       |
| --------- | -------------------- | -------------------- | ----------------------------------------------------------------- |
| Artificer | Not run              | Not run              | Supplemental provenance, casting/progression and full oracle      |
| Barbarian | Not run              | Not run              | Full oracle and actions/resources                                 |
| Bard      | Not run              | Not run              | Full oracle and actions/resources                                 |
| Cleric    | Not run              | Not run              | Full oracle; domain/order and resource audit                      |
| Druid     | Not run              | Not run              | Full oracle; circle/order and resource audit                      |
| Fighter   | F14                  | F24                  | Full field/action review and independent sign-off                 |
| Monk      | Not run              | Not run              | Full oracle and actions/resources                                 |
| Paladin   | Not run              | Not run              | Full oracle; edition-specific casting/resources                   |
| Ranger    | Not run              | Not run              | Full oracle; edition-specific casting/resources                   |
| Rogue     | R14                  | R24                  | Full field/action review and independent sign-off                 |
| Sorcerer  | Not run              | Not run              | Full oracle; origin/metamagic and resource audit                  |
| Warlock   | WL14                 | WL24                 | Full effects and later-level casting/arcanum acceptance; sign-off |
| Wizard    | W14                  | W24                  | Full field/action review and independent sign-off                 |

There are **eight fixed references** and **18 remaining class/edition reference
records** to author/review. The broader 104-case host matrix is not complete.
Blank-input authoring, quiz continuity and the remaining original recovery and
Studio criteria remain separate acceptance rows, even when seeded journeys pass.

## Manual accessibility run sheet

The owner confirmed Windows and Android devices, a MacBook, an iPhone and an
iPad, and that NVDA/VoiceOver/TalkBack tasks can be run with instructions.
MacBook Edge **156.0.4314.42** is owner-reported; iPhone/iPad Safari was described
as latest, without an exact version. Exact OS/AT/browser versions, assignments,
test candidate URL and actual executions remain open. The
[manual acceptance instructions](character-creation-manual-acceptance.md) provide
setup, sample builds, task steps, pass criteria and the result form.
Every row below remains **not run** until an actual session and retest is recorded.

| Manual case | Actual setup required                                              | Tasks and assertions                                                                                                              |
| ----------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| AT-01       | Windows, NVDA, Chrome                                              | Creator/edit/recovery, error correction, saved-sheet actions, Studio author/publish/activate; names, reading order, announcements |
| AT-02       | Windows, NVDA, Firefox                                             | Same tasks; browser-specific focus/dialog behavior                                                                                |
| AT-03       | MacBook, VoiceOver, Safari; also owner-reported Edge 156.0.4314.42 | Same desktop tasks; reading order, nested dialogs, status/error announcements                                                     |
| AT-04       | Physical iPhone/iPad, VoiceOver, Safari                            | Applicable Forge/Simple Player/Studio tasks, portrait/landscape, touch exploration and soft keyboard                              |
| AT-05       | Physical Android phone/tablet, TalkBack, Chrome                    | Applicable tasks, portrait/landscape, soft keyboard and touch targets                                                             |
| KEY-01      | Supported desktop browsers, keyboard only                          | All required tasks without pointer, visible/unobscured focus, Escape, containment and focus return                                |
| ZOOM-01     | Real desktop browser zoom                                          | 200% zoom and 400% reflow; no lost controls, content or error messages                                                            |
| VIS-01      | Actual supported host/theme combinations                           | Dark/light/paper and host palettes, reduced motion, contrast states and text scaling                                              |

For each task record: exact build, OS/browser/AT/device versions, tester/reviewer,
steps, observed result, severity, defect/repair IDs, evidence link and retest.
Do not substitute Playwright emulation or CSS zoom for these rows. Involve an
experienced screen-reader user before closing AT acceptance.

## Remaining work by packet

| Packet | Current status                                                                       | Next executable work                                                                                                                                       |
| ------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V-01   | Inventory captured; source/support decisions and reviewers open                      | Review supplemental provenance and catalog metadata; assign independent reviewers/devices                                                                  |
| V-02   | Eight fixed references; remaining 18 not authored/reviewed                           | Draft literal full-field oracles, verify saves/attacks/expertise/resources, independent review                                                             |
| V-03   | Focused grant regression coverage extended                                           | Complete every grant-family mutation/source/edition combination and invalid imported draft cases                                                           |
| V-04   | Invocation/mastery/subclass-boundary repairs implemented                             | Audit remaining class progression tables and effects, spell/cantrip/preparation/resource transitions; do not infer correctness from filenames labeled 2024 |
| V-05   | Single-class authoring boundary identified                                           | Record supported multiclass contract; independently validate separate engine and imported/manual preservation                                              |
| V-06   | Expanded seeded browser fixtures prepared                                            | Execute/record current matrix; extend to all reviewed references, blank authoring, quiz, recovery and Studio criteria                                      |
| V-07   | Devices confirmed and instructions prepared; manual rows not run                     | Supply the exact test candidate URL, execute actual device/AT tasks, repair and manually retest findings                                                   |
| V-08   | Sustained/chaos and final 50-case browser runs passed; five security scopes analyzed | Obtain independent acceptance and address the documented operational follow-ups; implemented-scope automated checks are complete                           |
| V-09   | Not run                                                                              | Independent acceptance review, moderated 12–18 participant study, release/rollback validation, then broad documentation refresh                            |

The 30-second soak, unavailable CodeQL and historical browser results in the
repair record retain their original limitations. Current longer reliability
runs and scoped CodeQL executions are recorded separately below; they do not
retroactively change historical outcomes. Study recruitment and independent reviews require real
participants/reviewers; no generated or simulated approvals are acceptable.

The first sustained **10-room/40-client/10-minute** run included deliberate
conflict probes because the original invocation used an unsupported
`--conflict-probe=false` argument form. Its configuration records `conflictProbe:
true`; it is **not** normal-traffic evidence. It failed with **79.7%** player
intent success against the unchanged **90%** threshold, despite no lost durable
events, ordering errors or convergence failures. A correctly invoked normal
window (`--conflict-probe false`) also failed, at **38.4%** intent success.

Failure diagnostics and Redis fanout inspection narrowed the issue to parallel
joins on a replica: two recoveries could replace one another's room object and
orphan a still-connected socket from fanout. RT-001 repairs this with one pending
recovery per room, preservation of an already-installed room's connection maps,
and protection against overwriting a newer committed projection. A failed
recovery is retired so later callers can retry. No durability acknowledgement or
canonical PostgreSQL compare-and-swap was moved or bypassed. These failed runs
remain failed; later passing runs must be recorded separately.

The soak report now identifies non-applied intents by synthetic room/client and
status without cookies or character payloads. The managed soak harness accepts
the existing `E2E_NO_BUILD=1` convention for verified local test images; its
default still builds. This prevents repeating unchanged frontend builds during
recovery verification.

Post-repair sustained results, each **10 rooms / 40 clients / 10 minutes**:

| Window                           | Intent outcome                                                                                   | Event/state/reconnect p95 | Integrity                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Normal, conflict probes disabled | **993/993 applied (100%)**, zero timeouts; unchanged 90% minimum                                 | **37 / 28 / 234 ms**      | No lost durable events, ordering errors, duplicate deliveries or convergence failures                                          |
| Chaos, conflict probes enabled   | **910/913 applied (99.67%)**, three timeouts during injected faults; unchanged chaos 50% minimum | **42 / 35 / 392 ms**      | No lost durable events, ordering errors, duplicate deliveries or convergence failures; three timed-out intents remain recorded |

The chaos harness injected a backend restart, Redis interruption and PostgreSQL
latency. These runs verify RT-001 and precede the subsequent HTTP/generator
security changes; the final browser rerun exercises that later candidate.
They do not establish a production-wide SLO or the plan's larger load profiles.
Reports are `apps/vtt/test-results/validation-repaired-normal-soak.json` and
`validation-repaired-chaos-soak.json`; metric deltas are collected through the
gateway and must not be represented as counters from every replica.

## Security scan and operational behavior

The owner explicitly included broader server/generator security hardening in
this pass. CodeQL CLI **2.27.3**, query pack **2.4.8**, and the **105-query
javascript-security-extended** suite completed for the creator, VTT server, VTT
UI, Forge and Studio. Scoped extraction avoids the stalled root extraction;
analysis uses one thread and a 4 GiB budget after the initial 2 GiB quality-suite
attempt ran out of heap. An analysis completing is not an assertion of zero
findings or complete repository security coverage.

| Scope                       | Initial findings             | Disposition / candidate follow-up                                                                                                                                       |
| --------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Creator, 269 TS/JS files    | 2 insecure-randomness alerts | Cosmetic fantasy-name generation only; no security identifier or token use found in the reviewed call path                                                              |
| Forge, 233 TS/JS files      | 2 clear-text-storage alerts  | Fantasy-name history/favorites in localStorage; no credentials or authentication state in the flagged fields                                                            |
| VTT UI, initially 380 files | 6 alerts                     | Generator sender checks, generated-source escaping, URI character-class correction and log-format repair implemented; hardened 381-file rerun reports **zero findings** |
| Studio, 379 TS/JS files     | 1 character-class alert      | Markdown-prefix expression corrected; numeric/punctuation title regression added; hardened rerun reports **zero findings**                                              |
| Server, initially 77 files  | 78 alerts                    | Hardened 78-file rerun still reports 78 alerts: custom middleware/authorization guards need manual disposition rather than a zero-alert claim; details below            |

Server alert dispositions:

- **53 missing-rate-limiting:** central admission now runs for `/api` and `/auth`
  before body parsing and session/database work. Limits are 600 requests/minute
  per client IP; login/register share 20 attempts/15 minutes; guest creation has
  120 requests/15 minutes. Budgets are **per replica**, reset on restart, and do
  not provide a deployment-wide limit. A shared edge abuse budget remains an
  operational hardening follow-up. Rejected requests return 429 and Retry-After;
  bounded key-capacity exhaustion returns 503. Readiness GET/HEAD and OPTIONS
  remain available. The custom implementation is not recognized by this query.
- **1 missing-token-validation:** central browser mutation protection now
  validates configured origins, Fetch Metadata or a trusted legacy referrer.
  Requests with cookies and no proof of origin are rejected. Existing CORS also
  rejects unconfigured supplied origins before route execution. This is an
  origin-based CSRF defense, not a claim that synchronizer tokens were added.
  Cookie-based CLI mutations must supply an explicitly allowed Origin; a
  cookieless CLI request remains supported. The legacy GET logout is covered.
- **17 user-controlled-bypass:** authentication type/presence checks and
  optional document filters were reviewed. Document list/search paths apply
  ownership/public/campaign authorization after retrieval, even with no supplied
  campaign filter. Q&A required SEC-005: filtering citations could leave private
  facts in generated prose, so any unverified source now rejects the whole
  response. This deliberately favors confidentiality over a partial answer;
  authorized-only retrieval before generation remains a useful follow-up.
- **5 log-injection:** flagged campaign/character IDs and generated-token names
  pass through `sanitizeLog`, which removes CR/LF/tab and caps text at 200
  characters; the reviewed sink does not receive the raw value.
- **1 HTTP-to-file-access:** generated-token names/IDs are reduced to alphanumeric
  filename characters, use a fixed extension and destination directory, and pass
  a resolved-path containment check. Arbitrary filesystem access was not found
  on this reviewed path.
- **1 biased cryptographic random:** the dice helper rejects values at or above
  the largest evenly divisible threshold before modulo, avoiding modulo bias.

Raw SARIF remains in `%LOCALAPPDATA%/CodexTools/`, named
`nexus-<scope>-security-20261026.sarif` and
`nexus-<scope>-hardened-security-20261026.sarif` for affected reruns. No raw alert
was deleted or suppressed to make the counts smaller. These dispositions are a
scoped engineering review, not independent security approval.

The controls follow [Express production security guidance](https://expressjs.com/en/advanced/best-practice-security/),
[OWASP CSRF prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html),
and [MDN message-sender validation guidance](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage).

## Command evidence

Current candidate commands and final results are recorded here as they complete.
Failed/stopped attempts are retained in local logs; a later clean rerun is
identified explicitly. Test totals overlap.

| Check                                                                        | Candidate result                                                                                                                                                                |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Creator suite, four workers                                                  | 640 tests passed, including eight expanded numeric/skill/save reference checks; attacks/resources still need full acceptance                                                    |
| Focused grant coverage (whole creator suite, four production files measured) | 98.88% lines, 92.26% branches, 97.43% functions; each measured file exceeds 80% lines/branches                                                                                  |
| Creator typecheck                                                            | Passed after fixing the progression table's literal-type inference                                                                                                              |
| Forge suite, four workers                                                    | 700 tests passed before the subsequent fixed-reference assertion additions; includes shared creator tests                                                                       |
| VTT full unit suite                                                          | **2,595 tests in 240 files passed** on the final candidate with one worker (14.5 minutes), including RT-001 and security repairs. Earlier 2,562-test run predates these changes |
| RT-001 admission regressions                                                 | 27 ConnectionLifecycle tests passed after the repair                                                                                                                            |
| Managed browser                                                              | Final **50 scenarios passed** in 7.1 minutes on fresh hardening images, including 36 creator cases, recovery, Studio author/publish/activate and real API-security checks       |
| Documentation                                                                | Final typecheck and production build passed with the device acceptance instructions; subsequent ledger changes update results only                                              |
| CodeQL                                                                       | Five scoped initial analyses and all three hardened reruns completed; zero VTT UI/Studio findings, server alerts retained with dispositions above                               |
| PostgreSQL integration after RT-001                                          | All 48 tests passed against the isolated validation database                                                                                                                    |
| Request security coverage                                                    | 100% measured lines/functions, 95.91% branches; 54 focused tests passed across eight files, before the final prototype-key regression                                           |
| Generator payload coverage                                                   | 18 payload tests passed; 100% measured lines/functions/branches                                                                                                                 |
| Studio title regression                                                      | 22 focused tests passed                                                                                                                                                         |
| Security type/lint/build                                                     | Server/client/E2E types, scoped lint and CI preflight passed; fresh frontend/backend images built                                                                               |

Use the exact commands in the plan, with the following stable-worker variant
for this Windows host:

```text
npm run test --workspace=@nexus/character-creator -- --maxWorkers=4 --silent
npm run type-check --workspace=@nexus/character-creator
npm run test --workspace=nexus-forge -- --run --maxWorkers=4
node --import tsx apps/vtt/scripts/generate-creator-browser-fixtures.ts
npm run test:e2e --workspace=nexus-vtt
```
