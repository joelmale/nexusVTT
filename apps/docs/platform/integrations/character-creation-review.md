---
title: Character creator and Campaign Studio repair plan
description: Evidence-backed repair backlog, dependencies, regression journeys, and completion gates before the deferred documentation update.
---

# Character creator and Campaign Studio repair plan

Date: **2026-10-24**

Status: **Implementation in progress. Acceptance and documentation refresh remain open.**

Source baseline: **`2d78880a`**, including the creator candidate committed in
`b3d613da`. All source locations below refer to this baseline; recheck them
before implementation. No deployed build is certified by this review.

The requested order is **finish the identified implementation work, verify it,
then update user and developer documentation**. This file is the execution plan
and review record for that work. It does not mark existing features, research,
accessibility, or release gates complete.

The [original creator plan](character-creation-implementation-plan.md),
[Studio sidecar plan](campaign-studio-sidecar-plan.md),
[Studio UX plan](campaign-studio-ux-plan.md), and
[session-planner plan](campaign-studio-session-planner-plan.md) provide design
context. This backlog addresses the concrete defects and missing evidence found
after those plans. A commit title, checked box, or passing self-validation test
does not close a ticket below.

## Implementation checkpoint

The remaining rules and acceptance work is sequenced in the
[validation completion plan](character-creation-validation-plan.md), based on
the repair commit `248fedf9` pushed to `main`.

Follow-up verified **2026-10-25** on `codex/creator-studio-repairs`.
This checkpoint records the repair implementation and its verification; it does
not certify a deployed release. The user/developer documentation refresh remains
deferred.

Required-choice repairs cover Human/Elf grants, Variant Human bonuses and
skills, Divine/Primal Order, proficient weapon masteries, level-one invocations,
feat prerequisites/source policy, Magic Initiate spell lists, and Skilled,
Crafter and Musician proficiencies. Granted skills/tools and feat choices survive
calculation and host conversion. At-will and ritual-only casting profiles keep
their own resource rules. Imported account characters adopt the server's
canonical identity. Room claims provide revocable authority for casting; a
previous claimant loses control after reassignment.

Studio deployment now resolves the published scene revision and real map asset,
retains map/location pin links after reload, publishes linked player handout
contents separately from DM run notes, and displays plain-text handouts.
Repairs also cover writable asset-container paths and explicit actor/run IDs in
PostgreSQL inserts. Deployment projects stable actor tokens through normal
host scene synchronization, with embedded base-token data for reconnects.
The combat panel reads committed participants, rounds and turns instead of demo
actors. Missing pinned encounter/monster revisions stop deployment.

Verified checkpoints: **535 creator tests**, **603 Forge tests (including the
shared creator)**, **942 Studio tests**, **17 real PostgreSQL integration tests**,
and **107 targeted VTT tests**. Additional focused checks passed for encounter
reads/projection and missing pinned revisions. VTT workspace, creator and Studio
type checks passed, as did scoped lint, workspace-lock (17 workspaces), Docker
build contracts (9 Dockerfiles), startup migration registry and 79 affected-target
tests. Test totals overlap and must not be added together.

A fresh disposable production stack passed **41 managed browser scenarios**.
These include all **24** fixed-reference host/mode completion-and-reload cases,
four extra light/paper theme cases, two-client casting with a lost committed
response, same-command retry, preparation, concentration, rest and reconnect,
and Studio authoring/publication followed by actual map activation, handout
reveal, encounter token placement, player reload and combat turns. Creator
inputs and Studio campaign assets are fixture-seeded; this is not evidence that
every input was authored from blank. Existing SIGKILL-after-ACK, stale-base,
replica ordering, phone/iPad and offline recovery scenarios also passed.

Automated creator accessibility checks cover 320/390/768/1440 widths, dark/light/
paper themes, measured contrast, keyboard containment, nested Escape/focus
restoration, overflow and CSS zoom simulation. These checks do not certify
manual browser zoom or assistive technologies.

A conflict-enabled soak against that managed stack passed with **2 rooms,
3 clients per room, 30 seconds**, six reconnects, no lost events and no ordering
or convergence failures. Event ACK p95 was **15 ms**, state ACK p95 **11 ms**,
and reconnect p95 **59 ms**. Both metrics endpoints returned 200 with zero
commit, ordered-event or publish failures. The aggregate test metric recorded
2 resyncs in 73 uploads after deliberate conflict/recovery scenarios, exceeding
the 1% resync-rate SLO; no production SLO or long-duration reliability pass is
claimed.

Open acceptance work remains: the broader independent rules/grant matrix across
classes, levels and content packs; manual screen-reader/device/browser-zoom
checks; and the planned participant study. The six reference builds plus added
grant regressions are not blanket rules certification. CR-03/CR-06 and research/
release certification remain open, and certification flags remain false.
The configured local CodeQL CLI is unavailable; no CodeQL pass is claimed.

## 1. Baseline, scope, and evidence

The earlier review ran `npm run test:character-creator`: **43 files and 489
tests passed**. The creator TypeScript check also passed. These are historical
results from the reviewed candidate, not acceptance results for future repairs.
They do not establish actual host persistence, independent rules correctness,
or a successful Studio-to-VTT journey.

A local Forge **1.5.3** development candidate was inspected without changing an
existing character. Its newcomer Fighter equipment screen listed background
gear without class armor. Most other findings below are **source-confirmed
defects or recovery risks with reproduction tests still required**. The
accessibility, research, broad rules certification, and rollout findings are
**unverified gates**, rather than claims that every existing interaction fails.

Corrections to keep the repair work precise:

- The VTT character API already attempts content deduplication
  (`apps/vtt/server/routes/api.ts:836`). Duplicate account records were not
  reproduced. The missing guarantees concern stable attempt identity,
  concurrent/uncertain saves, and adopting the server-returned identity.
- Submission already has a synchronous double-click guard. Preserve it and
  extend retry coverage; do not replace a working guard merely to add one.
- VTT draft persistence and the personality-quiz switch exist. Their state
  continuity, validation, and recovery are incomplete. Forge draft callbacks
  are not wired at either creator entry point.
- The full wizard's step 0 selects level, not edition. Forge has an edition
  chooser; VTT currently does not. The repaired host contract must make edition
  selection or an explicit enforced campaign edition visible.
- Character claiming and token placement are separate operations. A truthful
  GM-assisted placement path is valid; automatic placement is not required.

### Scope boundary

Repair every issue enumerated in sections 4–7, including reachable placeholder
or inert controls on the required creation/planning/play journeys. Preserve
existing characters, manual overrides, gameplay resources, and higher-level
inputs. Do not solve a known failure by silently dropping an advertised choice
or declaring the failing path unsupported.

This is not a new creator, calculator, general persistence service, analytics
service, or Campaign Studio application migration. Explicitly planned Studio
capabilities such as Chat Prep, Estimate All, and a new preview engine remain
outside this defect backlog. Inventory those notices in CS-09 so the final
status distinguishes delivered capabilities from future roadmap work. A
reachable control represented as working must be repaired, connected to an
existing implementation, or visibly identified as unavailable; a notice is not
implementation evidence.

No production deployment, publishing, data repair of existing user characters,
or external messages are part of implementing this plan. Use disposable test
data. Preserve unrelated changes and accepted ADR history.

## 2. Ownership and contract decisions

One lead integrates the work. Roles below can be held by the same contributors,
but independent rules expectations and acceptance review must not come solely
from the person writing the corresponding calculator.

| Owner | Responsibility |
| --- | --- |
| CORE | Creator draft/actions/adapters, evaluation, finalization, loadout and casting seams |
| RULES | Edition/content policy, complete grants, independent expected values, guidance review |
| HOST | Forge storage/editing and VTT account/session/claim/token integration |
| STUDIO | Session authoring, plan adapters, editor state, publish/activate UI |
| API | Existing VTT repositories, routes, transactions, identity and metadata contracts |
| QA | Reproductions, actual browser journeys, accessibility, evidence and regression gates |
| LEAD | Shared-file ownership, integration, rollout evidence, and final completion decision |

Freeze these decisions in the first work packet, using existing packages and
repositories:

1. **Creator state:** one versioned draft with stable draft/character/attempt
   IDs, monotonically advancing revision, raw base scores, complete choices,
   edition/source references, and per-choice provenance. Mode, subflow and step
   are presentation state. All three presentations edit this same session.
2. **Evaluation:** one authoritative evaluation per supported slice, bound to
   an exact draft/content/evaluator revision. Preview and finalization use that
   result. Reuse existing calculators/effects and shared rules helpers; a bulk
   rules-engine migration is not a prerequisite.
3. **Draft storage:** codecs and callbacks can be shared, but Forge and VTT own
   persistence, identity scope, conflict handling and recovery. Use Forge's
   IndexedDB abstraction and the VTT's existing worker-backed storage boundary.
4. **Saved identity:** retry the same operation with the same evaluated payload
   and owner-scoped attempt identity. An intentional character copy is a new
   operation. Hosts adopt canonical IDs returned by the server. Preserve legacy
   alias mappings; names and content hashes are not operation identities.
5. **Studio authoring:** retain the existing separation between session records
   and prep `session-plan` objects. Link them with stable IDs and one typed
   authoring representation. Save/link changes through existing repository
   transactions and revision checks; do not add a competing embedded store.
6. **Studio activation:** an editable draft, immutable published revision and
   active run are distinct. Disable ordinary Play while unpublished changes
   exist; publish successfully first. An explicit restart identifies the
   published revision it will run. Never silently activate an older revision.
7. **Compatibility:** keep public creator exports, async callbacks,
   `CharacterCreationResult`, conversion seams and existing API callers
   compatible. Add validated fields/adapters when necessary. Preserve higher
   levels and old characters through an explicit compatibility path until their
   evaluation slice is independently certified.

## 3. Delivery order and gates

All tickets start **open**. Dependencies below describe integration order;
fixtures and independent reviews can be prepared earlier. Assign one owner to
each shared file before parallel edits.

| Wave | Work that can proceed together | Exit gate |
| --- | --- | --- |
| 0 — Reproduce and freeze contracts | B-01, CR-01; prepare real-store/browser fixtures | Every finding has a regression/reproduction or an explicitly unverified status; state/identity/persistence seams agreed |
| 1 — Preserve authored state | CR-02/03; H-01; CS-01/02; independent H-05 and CS-08 | Creator edits and Studio plans retain identity and complete authored inputs through their storage seams |
| 2 — Repair rules and planning adapters | CR-04/05 plus pure CR-06 effects against the frozen loadout contract; H-02/06; CS-03/04/06/07 | Independent domain expectations pass; equipped-math integration follows CR-04; Studio edits, references, maps and next-session links round-trip |
| 3 — Integrate completion and play | CR-07, then CR-08/09; H-03/04/07/08; CS-05 | Exact preview/save equality, reliable host recovery, and correct published-revision activation |
| 4 — Prove completion | CR-10, CS-09, Q-01, H-09 | Real host/server journeys, accessibility, affected builds and rollback gates pass with recorded artifacts |
| 5 — Documentation | D-01 only after the product gates above | Both audiences' guides match the verified build; links, examples, navigation, typecheck and documentation build pass |

Creator critical path: **CR-01/02/03 → CR-04/05/06 → CR-07 →
CR-08/09 + H-03/04/08 → CR-10/Q-01/H-09 → D-01**.

Studio critical path: **CS-01/02 → CS-03/04/07 → CS-05 →
CS-09/Q-01 → D-01**. CS-06 and CS-08 can proceed independently once their
shared API/selection contracts are settled.

### B-01 — Reproduce the baseline and establish the defect ledger

**Owner:** QA + LEAD. **Depends:** none.

- Reproduce using the actual full, four-screen and quiz components; standalone
  Forge, desktop VTT and Simple Player entry points; editable server-backed
  Studio rather than demo-only fixtures. Capture IDs, revisions and payloads
  before save, after save, after reload and after handoff.
- Give each ticket a failing regression, manual reproduction, or a named
  verification gap. Record build commit/assets, mode, edition, level, storage
  context and exact commands. Do not log credentials or real player data.
- Add independent expected values and test fixtures before production fixes.
  Existing mocked-host and self-validation tests remain useful for their
  narrower assertions, but cannot serve as rules or end-to-end oracles.

**Accept:** a reviewer can reproduce each definite defect, distinguish risks
from observed failures, and trace every item below to its test and owner.

## 4. Creator domain repair tickets

Source prefix **CC** means `packages/character-creator/src/`.

| Ticket; owner; dependencies | Repair and baseline evidence | Acceptance |
| --- | --- | --- |
| **CR-01 — Independent complete rules fixtures**; RULES + QA; B-01 | Correct incomplete/inconsistent six-reference fixtures before using them as oracles. R24 expects WIS 14 from raw WIS 13 with no WIS grant (`CC/tests/fixtures/referenceBuilds.ts:265,294`); Rogue expertise identifiers differ from calculator labels (`:206`; `CC/utils/characterCreationUtils.ts:151`). Some builds omit required origin/species choices or duplicate background skills. | Every fixture records exact edition/source/version/locator, all choices and independently derived abilities, skills/expertise, saves, attacks, HP/AC, speed, resources, spells, equipment and money. Assert all promised fields, not just HP/AC. A second reviewer approves expectations. |
| **CR-02 — One complete draft and three presentations**; CORE; B-01 | Complete the versioned draft/actions and lossless legacy adapters; retain masteries, orders, invocations, feat/species subchoices, casting sources, higher-level inputs and optional text. Allocate identity once and preserve per-choice provenance. Replace separate local customization and mutation of recommendation memos with canonical updates. Evidence: `CC/adapters/draftAdapter.ts:119,165`; `CC/components/CharacterCreator.tsx:69,89`; `CC/components/guided/FourScreenNewcomerFlow.tsx:118,145,835`. | Full ↔ newcomer ↔ quiz, Back/forward, rename, edition/class/background changes and adapter round-trips retain compatible explicit choices. Invalidated explicit choices have targeted repair messages. Name/alignment changes never rebuild mechanical choices. Quiz answers and presentation position survive independently of derived choices. |
| **CR-03 — Edition/content policy and complete grants**; CORE + RULES; CR-01/02 | Resolve choices by edition and content source; validate allowed sources, membership, prerequisites, bonus targets, skill pools/replacements, expertise, origin/species feats, tools/languages, spells and required class subchoices. Validate ability-method invariants: finite scores, exact standard-array multiset, point-buy range/budget, legal bonus targets and final score caps; intentional manual scores follow explicit host/GM policy. Background lookup lacks edition checks (`CC/services/catalogResolver.ts:102`); `strictEntitlements` is not enforced; the 2024 Acolyte recommendation allocates an invalid CON bonus (`CC/services/recommendationService.ts:247`). | Positive/negative cases cover every advertised grant family, ability method and required subchoice. Unknown/wrong-edition/disallowed content and illegal scores/allocations block completion at a repair target. Equivalent spells granted by different sources retain distinct provenance. Preserve advertised choices while repairing their grants; no silent fallback to another class/species. |
| **CR-04 — Resolve equipment and currency once**; CORE + RULES; CR-02/03 | Explicitly represent class/background packages versus gold, purchases, pack contents, ammunition, integer quantities and equipped slots. Version pack contents by edition. Remove background double-grants, ignored input wallets and electrum loss (`CC/utils/characterCreationUtils.ts:170,219,263,472`); replace edition-blind packs (`CC/services/loadoutResolver.ts:9`). Preserve denomination value across every contract, adding compatible fields or an explicit lossless conversion where required. | Preview → result → Forge reload → VTT conversion have exactly equal inventory, stack quantities, equipped slots and money. Test package A/B combinations, purchases/change, duplicate stacks, empty wallets, all five coins, edition-specific packs, ammunition and conflicting armor/shield/two-handed assignments. Re-evaluation never adds gear or money. |
| **CR-05 — Correct casting and saved spell fields**; CORE + RULES; CR-02/03 | Normalize known, spellbook, prepared, always-prepared and source-granted spells without mixing meanings. Repair Wizard `preparedSpells`/`dailyPrepared` mismatch and empty known-caster packages (`CC/utils/spellUtils.ts:442,456`; `CC/services/recommendationService.ts:306`). Correct edition/class preparation and slot tables, level-one caster grants, and actual proficiency passed into attack/DC math. Repair the existing shared preparation helper (`packages/rules-5e/src/preparation.ts:23`) as well as the facade's level + INT formula for both Wizard editions (`CC/services/draftEvaluator.ts:63`). | Both editions pass membership/level/count/subset/duplicate checks and preserve source grants. Cover low/high INT, 2024 level-one Paladin/Ranger, and progression boundaries. Shared helpers, creator evaluation and saved-sheet preparation agree. Assert actual saved lists, slots, attack/DC and usable sheet actions; six displayed spells alone are not acceptance. |
| **CR-06 — Correct effects and equipped calculations**; CORE + RULES; CR-01/02/03/04 | Apply sourced ability/skill/feat/style/resource effects once, reusing existing rules implementations. Repair carried gear counting as worn, negative medium-armor DEX treatment and missing unarmored alternatives (`CC/utils/characterCreationUtils.ts:322,335,343`). Verify lineage grants, HP, speed, expertise, passive scores, saves, attacks and class resources/rest recovery. | Independent cases distinguish carried/equipped armor/shields, armor alternatives, negative DEX, Defense/Archery, Tough, edition-specific Alert, species/lineage benefits and resource counts. No double ability/feat grant; every pending required choice blocks completion. Existing-character HP/resource usage is not reset. |
| **CR-07 — Make evaluation authoritative at completion**; CORE; CR-02–06 | Route every live preview/submission through one revision-bound evaluator/finalizer. Reject invalid or stale evaluations, set the stable character ID, and hand the already-evaluated loadout/results to hosts. Current live submission bypasses the facade and generates a new ID (`CC/components/CharacterCreationWizard/hooks/useCreationSubmission.ts:37,42`); facade finalization does not reject invalid evaluations (`CC/services/draftEvaluator.ts:129`). | The same revision yields identical preview/result/conversion. Any intervening edit invalidates the old evaluation. Invalid/stale results cannot save. Public imports/callbacks still compile, asynchronous errors retain work, and finalization neither recalculates nor duplicates grants. Integrate stable host retries through H-03. |
| **CR-08 — Complete legal recommendations**; CORE + RULES; CR-03–07 | Generate deterministic recommendations from actual entitlements, loadout and casting services. Select legal class gear instead of `equipmentChoices: []` (`CC/services/recommendationService.ts:302`). Fill only compatible unchosen/recommended fields, preserve explicit player intent, and explain unavailable combinations. | Both editions complete “make a Fighter,” “sneaky elf archer,” and caster journeys. Every advertised class has complete required grants, valid skill replacements, equipped starting gear and legal spells. Name changes do not discard edits; class/species/fantasy and compatible custom choices survive regeneration. |
| **CR-09 — Derive accurate first useful actions**; CORE + RULES; CR-07/08 | Replace fixed bonuses and generic action promises with guidance from evaluated gear, granted features, spells and resources (`CC/services/guidanceService.ts:24,35,61`). Distinguish movement/action/bonus action/reaction; do not advertise an unearned action or an absent weapon. Emit the guidance through the real result path and use existing host actions. | Changing weapon, ability, edition, level or spell package changes guidance appropriately. Each suggested action is available on the saved sheet and consumes/replenishes the correct resource. No fixed +5 promise or ordinary movement described as a bonus action. Host reachability is tested in H-08. |
| **CR-10 — Replace unsupported certification claims with evidence**; RULES + QA; CR-01–09, H-01–08, Q-01 | Replace blanket manifest assertions with traceable support status and independent grant/effect coverage (`CC/data/supportManifest.ts`; `CC/tests/supportCertification.test.ts:27`). The named “24-case” suite currently calls converters/services rather than real hosts (`CC/tests/regressionMatrix.test.ts:20`). | At least one complete independent build per advertised class/edition plus positive/negative grant-family coverage. Execute the six references × guided/full × Forge/VTT, then quiz and Simple Player coverage. Preserve higher-level compatibility and test relevant boundaries without claiming complete multiclass certification from level-one tests. No false “certified” flags. |

Rules acceptance references are the [official SRD index](https://www.dndbeyond.com/srd),
[SRD 5.1](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf),
and [SRD 5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf).
Record exact source locators in fixtures for preparation, backgrounds, class
grants and pack contents. Advertised non-SRD content needs its own approved
primary reference; the current mixed catalog must not be relabeled SRD-only.
Do not copy large rules passages into guides or test descriptions.

## 5. Creator host, recovery, and accessibility tickets

| Ticket; owner; dependencies | Repair and baseline evidence | Acceptance |
| --- | --- | --- |
| **H-01 — Validated codecs, versions, keys and conflicts**; CORE + HOST; CR-02 | Validate envelope and draft separately; migrate known versions and preserve a recoverable original. Reject unknown future versions visibly. Replace key sanitization that collapses distinct identities; scope by host, player/account/browser, context and draft identity. Enforce revision-aware tab conflict handling rather than a ten-minute advisory. Evidence: `CC/services/draftStorage.ts:20,40,138`; VTT ignores `isConflict` at `apps/vtt/src/components/SharedCharacterCreator.tsx:81`. | Test valid/current/legacy/future/corrupt/truncated records, key collisions, quota/blocked storage, account changes and two concurrent tabs. No silent overwrite or destructive migration. Resume/copy/discard decisions are explicit and recoverable. Keep codecs independent of browser storage. |
| **H-02 — Durable drafts at every host entry**; HOST; CR-02, H-01 | Wire Forge `App.tsx:1298` and `routes/CharacterForgeRoute.tsx:70` to existing IndexedDB storage. Move VTT persistence behind its host storage/worker boundary. Persist presentation state and all customization, surface storage failures, and retain an appropriate recovery receipt after partial completion. | Real IndexedDB upgrades and fresh-browser reloads preserve answers and mode/step across all entry paths. Test guest/account separation, explicit discard, interrupted writes and save rejection. Do not promise a last forced-close write; recovery uses the last confirmed durable revision. Existing character databases remain intact. |
| **H-03 — Idempotent save and canonical identity**; HOST + API; CR-02/07, H-01 | Freeze one evaluated payload/attempt across retries. Forge upserts that intended character. VTT parses and adopts the canonical response rather than retaining only the submitted ID (`apps/vtt/src/stores/characterStore.ts:255`). Retain the existing API dedupe and repository alias reconciliation; test whether an owner-scoped durable attempt receipt/unique constraint is needed for concurrency, and add it through existing repositories if needed. | Rejected save, commit then lost response, local post-save failure, double click, same-attempt concurrency and reload during an uncertain save produce one intended record and one canonical ID. Retry does not regenerate/randomize the character. Intentional copies use a new attempt. Account deduplication is tested, not assumed to guarantee exactly-once behavior. |
| **H-04 — Save, session acceptance, claim and placement**; HOST; H-02/03, CR-07 | Use one completion coordinator across desktop, Player Setup and Simple Player. Distinguish saved, submitting, accepted, rejected/offline and awaiting-GM states. Await callbacks and inspect results; retry room submission using the saved canonical character. Simple mode currently closes before submission (`SimplePlayerShell.tsx:76`); `SharedCharacterCreator.tsx:113` invokes an unawaited callback. Correct current-user selection (`PlayerPanel.tsx:132`) and retain GM authority for claims/placement. | Account save followed by rejected/timed-out session admission retains the sheet and a specific retry. Test DM offline, reconnect, room change, delayed results, two-player claim races, spectator, imported unassigned sheets, absent scene, existing linked token and delayed/rejected GM placement. No false “in game” status or duplicate linked token. Both clients agree on ownership and canonical character identity. |
| **H-05 — Reachable existing-character editing**; HOST; B-01; coordinate CR-02 | Forward `onEdit` through every Forge layout and mount the editor outside the selected-sheet early-return trap (`apps/forge/src/App.tsx:984,992,1377`; `components/CharacterSheet/layouts/PaperSheetLayout.tsx:28`). Preserve ID, provenance, notes, equipment and current HP/resources. Separate explicit manual override from recalculation. Edition changes require deliberate validated conversion or a clear restriction, never simple relabeling. | Open/save/cancel Edit from each desktop layout and the phone path; reload and export/import preserve expected changes. Opening or cancelling a legacy/imported character changes nothing. Restore/update and intentional copy have distinct identity behavior. |
| **H-06 — Working customization controls**; CORE + HOST; CR-02/03/05 | Wire the existing spell Randomize button to the real selection service (`CC/components/CharacterCreationWizard/steps/Step4Spells.tsx:255,315`). Restore standard-array swapping: swap logic exists, but the selector disables scores assigned elsewhere (`steps/Step4Abilities.tsx:104,336`). Correct skill editor slug/name lookup (`CC/components/guided/SkillEditModal.tsx:35`) and commit spell edits immutably. | Interact with actual buttons/editors using role/name queries; verify legal visible choices, saved draft and final result. Exchange STR/DEX array assignments while retaining exactly one of each array score. Randomization occurs only on explicit request. Skills and all spell-list distinctions survive rename, back navigation, mode switch and reload. No enabled inert control remains on required journeys. |
| **H-07 — Cancellation, focus, phone/help and scoped styling**; CORE + HOST + QA; CR-02, H-02/06 | Retain existing dialog labels/focus entry and complete one stack-aware focus/escape/dismissal primitive. Nested Escape closes the top editor first. Protect unsaved work and prevent dismissal while submitting. Use CSS Modules and existing scoped tokens for repaired/new creator surfaces; keep portals/help within the creator theme boundary. Help must work by touch and keyboard. | Complete keyboard/nested modal/return-focus/backdrop/route-exit cases, failed draft flush, 320/390/768 widths, portrait/landscape with soft keyboard, 200% zoom and 400% reflow, measured contrast, representative NVDA and VoiceOver/TalkBack, and both host palettes. Required actions remain reachable; automated accessibility checks alone do not certify this ticket. |
| **H-08 — Saved sheet and first-action handoff**; HOST + RULES; CR-07/09, H-04/05 | Open the exact newly saved Forge sheet. The active VTT character panel renders `CharacterSheet.tsx:624`'s Spells placeholder (`apps/vtt/src/components/Panels/CharacterPanel.tsx:33`); Simple Player lacks cast/slot controls. Complete existing `Panels/SpellbookPanel.tsx` binding: replace sample stats/spells and random definition UUIDs (`:40,60,194`) with actual actor profiles and canonical references. Reuse its controls/view-model in the desktop tab and compact Simple Player view with existing preparation/cast/concentration/rest commands. Keep existing sheets and host-owned persistence. | Newly saved Fighter/Rogue/caster can find and execute actual weapon/skill/save/spell/recovery actions in each host. Verify cantrips, legal slot selection, exactly-once slot use, unprepared/exhausted rejection, concentration/rest/reconnect and peer updates; pending/rejected states stay visible. Gear, preparations and resources agree with the evaluated sheet. Standalone export and VTT import/account/session routes stay explicit; no unsupported synchronization is invented. |
| **H-09 — Rollout, measurement and recovery-safe rollback**; LEAD + HOST + QA; CR-10, H-01–08, Q-01 | Separate newcomer presentation rollout from rules-engine/evaluator adoption; retain full view against valid shared state. Wire real entry/step/edit/validation/resume/save/handoff events with accurate timings and separate completion checkpoints, excluding names/prose/raw character payloads. The in-memory recorder is tooling, not participant evidence. Use the original moderated-study protocol before broad promotion. | Flags/fallback preserve identity, answers and old/new drafts; unsupported records remain recoverable. Rollback never resets gameplay resources or reinstates known-invalid math. Instrumentation distinguishes a saved draft from a saved character and accepted room handoff. Conduct/review the planned 12–18-participant study if claiming that gate; report observed counts/timings, not invented success rates. Unrun research/release gates remain open. |

## 6. Campaign Studio repair tickets

Source prefix **DM** means `apps/codex/services/dm-ui/src/`. The existing VTT
backend remains the campaign prep and runtime persistence authority.

| Ticket; owner; dependencies | Repair and baseline evidence | Acceptance |
| --- | --- | --- |
| **CS-01 — Stable session/plan IDs and correct navigation**; STUDIO + API; B-01 | Use `addItem()`'s returned ID for callbacks/navigation instead of synthetic `session-N` (`DM/features/sessions/SessionPlannerModal.tsx:473,544,557`; `DM/services/campaign-bundle-api.ts:1797,1836`). Carry `sessionId`/`planId` through status, publish, reload and activation; replace title-only matching with guarded legacy recovery. Link the published plan to its authored session so the bundle does not add a duplicate timeline entry (`campaign-bundle-api.ts:1307`). | New session opens its saved route. Two same-title sessions remain distinct. Rename, clone, repeated publication and retry never add unintended prep plans/Chronicle sessions. Legacy title recovery refuses ambiguous matches rather than attaching the wrong plan. |
| **CS-02 — Complete authoring persistence and hydration**; STUDIO + API; CS-01 | Persist one typed, versioned authoring representation and session link through existing prep repositories, with validated schema/revision checks. Extend the linked prep contract for readiness, DM notes, teaser and attachments absent from `packages/game-contracts/src/prep.ts:255`; do not create a second store. Session normalization discards embedded `plan` (`DM/services/campaign-bundle-api.ts:598,1919`), and modal add/update does not persist the separate plan. Load full linked contents, not metadata or a generated fallback. | Create/edit → confirmed save → fresh store/browser reload preserves all authored fields and references. Saving a draft leaves an older active/published revision immutable. Failed writes/links leave a recoverable draft; conflicts preserve both versions. A transaction or equivalent durable checkpoint prevents an apparent save with missing plan data. |
| **CS-03 — Lossless references and real encounter materialization**; STUDIO + API; CS-01/02 | Preserve typed scene/encounter/handout/note references through both adapters. `buildSessionPlanModel.ts:215` drops them; `routes/SessionPlanRoute.tsx:59` derives every object reference from `encounterId`. Resolve SRD/homebrew encounter composition to the existing materializer; current publisher downgrades missing `encounterId` to reminder (`DM/services/campaign-prep-api.ts:545,570`). | Generate a plan with SRD and homebrew encounters, reorder/edit/reload/publish/activate, and deploy the correct actors once. Note/handout/scene links also survive. Missing required objects/stats produce a targeted blocker; authored encounter steps never silently become reminders. Retry and reconnect preserve deployment idempotency. |
| **CS-04 — Bind all authoring controls and surface errors**; STUDIO; CS-02/03 | Bind prose, scratchpad, readiness, visibility and step changes to the shared authoring state. The body is unbound `contentEditable` (`DM/features/session-plan/SessionPlan.tsx:879`); checklists/dependencies/visibility only update local state (`:553,593,612,623`). Provide working per-step visibility and a clearly labelled default for new steps; new bulk-edit UI is outside this repair. Validate dependencies rather than merely toggling readiness. Check returned `{ok:false}` and thrown errors. Connect or visibly disable inert formatting/reference controls. | Type/edit/check/share → save → reload → publish transmits intended values. Invalid dependencies remain visible. Failures show accessible errors and retry, retain edits and never claim success. Per-step sharing survives serialization; player-facing VTT projections exclude DM-only prose while DM views retain it. |
| **CS-05 — Exact published revision and truthful activation**; STUDIO + API; CS-01–04, CS-07 | Separate dirty/saving/saved/published/activating/active/error states. Prevent stale status hydration from clearing new edits. Ordinary Play must not activate an older ready plan while current draft changes are visible (`DM/features/session-plan/SessionPlan.tsx:480`; `DM/services/campaign-prep-api.ts:755`). Carry returned plan ID/revision through activation; use stable operation identity for retry, new identity only for explicit restart. | Publish A → edit B → ordinary Play is blocked pending publication. Publish B → activate exactly B's returned revision. Slow hydration, failed publish/link/activation, reload and retry do not discard work, falsely report success or duplicate a run. Explicit restart clearly identifies its immutable revision. |
| **CS-06 — One correct next-session resolver**; STUDIO; B-01 | Reuse one selector across Overview, one-shot hub and Use in next session: valid open curated/current session, then upcoming/earliest open. Never fall back to completed history (`DM/features/section-shell/UseInNextSessionButton.tsx:27,45`). Display the destination and handle returned failures/rejections at `:137`; preserve linkage on failure. | Test empty/all-complete history, stale curated IDs, completed current session, dates/order, and each supported entity kind. Offer create/select-session recovery when none is open. Save/reload confirms links on the displayed session; conflict/network rejection cannot claim success or alter historical prep. |
| **CS-07 — Correct map/scene and handout asset identity**; STUDIO + API; CS-01/02/03 | Select the step/session location's actual map/scene instead of `bundle.maps[0]` (`DM/features/session-plan/buildSessionPlanModel.ts:214`). Reuse assets by stable asset/source identity and content revision, not “Session Scene Map” (`DM/services/campaign-prep-api.ts:243`). `ensureTextAsset()` also reuses by name while ignoring edited body (`:229`); preserve handout identity and content freshness through publication. | Different maps and separate same-name handouts remain distinct across scenes/campaigns. Editing handout prose without renaming publishes the changed text while earlier published revisions stay immutable. Replacing a map affects only its intended scene; retries reuse the correct asset. Missing references produce a repair action, not fallback to another map. |
| **CS-08 — Persist one-shot, edition and campaign mood**; STUDIO + API; B-01 | Forward supported metadata on creation; align the update method compatibly with existing VTT clients; validate and persist allowed fields. Client drops `mode`/edition (`DM/services/campaign-api.ts:117`), uses PATCH at `:134` while VTT exposes PUT (`apps/vtt/server/routes/api.ts:653`); repository allowlist excludes metadata (`CampaignRepository.ts:72`). Keep local mood override distinct from campaign default and show save failures (`DM/features/moods/MoodContext.tsx:56`). | Create one-shot/edition → reload preserves selection. Save campaign mood → a second browser without local override sees it. Existing PUT consumers remain compatible; invalid metadata and unauthorized writes fail visibly. Reuse existing columns/migrations where present; add no redundant schema. |
| **CS-09 — Actual Studio integration and capability closure**; QA + STUDIO + API; CS-01–08 | Close jointly with the Studio slice of Q-01: cover real server-backed create/author/reload/publish/activate/deploy. Current Studio Playwright config uses demo fixtures and stubs API calls. Inventory identified enabled controls/notices; distinguish planned roadmap scope from broken required operations. | Correct UUID navigation, complete plan round-trip, retained references, exact map/handout/monster/revision, no duplicate timeline/run, and truthful recoverable errors pass against real persistence. Demo/iPad smoke remains green but is not substituted for this gate. Planned capabilities are explicitly listed and do not count as repaired implementations. |

## 7. Cross-product verification and documentation follow-up

### Q-01 — Verify production paths, not reconstructed payloads

**Owner:** QA + independent RULES/HOST/API reviewers. **Depends:** harness work
starts at B-01; final execution follows implementation tickets CR-01–09,
H-01–08 and CS-01–08. CR-10 consumes this evidence, CS-09 closes jointly with
its Studio slice, and H-09 follows certification. Q-01 does not depend on those
certification/rollout tickets or D-01.

1. **Creator reference matrix:** six complete independent reference builds
   (F14/F24/R14/R24/W14/W24) × guided/full × Forge/VTT = 24 actual completion
   cases. Add quiz continuity and desktop/Simple Player entries explicitly;
   six calls to a converter are not six browser journeys. Reload saved sheets,
   perform useful actions and compare complete evaluated/saved values.
2. **Broader creator coverage:** every advertised class/edition and grant
   family, incompatible-choice mutations, origins/species casting, gear/gold
   alternatives, exact money/quantities/slots, levels 1/2/3/4/5/8/11/17/19/20
   where relevant, legacy/manual-override preservation. Prioritize actual
   progression boundaries; do not claim complete multiclass coverage from
   these samples.
3. **Recovery matrix:** duplicate clicks; slow/rejected saves; server commit
   followed by lost response; partial local/account/session success; room
   rejection/reconnect; tab conflicts; corrupt/old/future drafts; route exit;
   nested Escape; name/mode/edition changes. Assert identity and preserved
   choices, not only displayed errors.
4. **Studio matrix:** real campaign creation/metadata, complete authoring
   round-trip, typed references/maps/SRD and homebrew actors, same-title and
   renamed/cloned sessions, next-session linkage, dirty publication/activation,
   retry and revision conflict. Exercise a clean store/browser reload between
   operations. Observe the resulting VTT scene and actors.
5. **Accessibility and integration:** complete H-07 checks; validate both host
   palettes and CSS boundaries; keep contract, workspace, Docker and CI target
   graphs accurate if dependencies/routes/build inputs change. Target at least
   80% relevant line/branch coverage for changed implementation while retaining
   stricter existing workspace gates. Coverage is necessary evidence, not a
   substitute for independent assertions and real journeys.

Existing fixtures/mocks should be corrected where they encode the bug: for
example, the planner test expecting a synthetic `session-*` route, facade tests
that treat `isValid` as an independent rules oracle, and publication tests that
manually populate encounter fields the UI never supplies. Add real
serialization/repository tests around those seams rather than deleting useful
unit coverage.

Record for each gate: exact commit/build and content/evaluator versions,
inputs, independent expected values, executed commands, counts/results,
screenshots/traces without personal data, and unresolved findings. A skipped,
stopped, stalled or failed check remains that status. Require independent
approval of rules and architectural boundaries before closing the affected
tickets.

### Validation commands and prerequisites

These commands exist in the manifests at the source baseline. Run focused
files during each repair, then the full affected checks. No new test-runner
command is implied for proposed browser/codec tests; add those cases to the
existing harness and record their actual invocation during implementation.

From the repository root:

```text
npm run test:character-creator
npm run type-check --workspace=@nexus/character-creator
npm run test:rules-5e
npm run test:game-contracts
npm run test --workspace=nexus-forge -- --run
npm run lint --workspace=nexus-forge
npm exec --workspace=nexus-forge tsc -- --noEmit
npm run test --workspace=@nexuscodex/dm-ui
npm run lint --workspace=@nexuscodex/dm-ui
npm run build --workspace=@nexuscodex/dm-ui
npm run test:ci --workspace=nexus-vtt
npm run build:forge
npm run build:vtt
```

Build required workspace dependencies first using the root orchestration/
`build:workspace-deps` mechanism. Run changed contract-package tests/builds
when their schemas or exports change; do not rely on stale `dist` output.

Studio/browser and multiplayer checks:

```text
npm run test:studio --workspace=nexus-vtt
npm run test:e2e --workspace=nexus-vtt
```

The first command currently proves demo/iPad behavior, not real server-backed
persistence. Extend the managed browser setup with isolated test identities,
PostgreSQL, backend replicas and the Studio frontend for Q-01. Existing
`campaignStudioPublish.test.ts` and `campaignStudioEncounters.test.ts` integration
suites require their real database prerequisites; verify the tests execute
rather than skip. No production account is needed.

Changes to canonical transactions, durable events, session admission or
reconnect must preserve the PostgreSQL-before-ACK boundary, entity CAS and
existing managed recovery gates, including SIGKILL-after-ACK and the
conflict-enabled soak. Use the existing managed soak command/options for the
affected scenario; record metrics and results. Pure UI/plan text changes do not
require unrelated chaos runs.

If dependencies, Docker inputs, routes, CI targets or migrations change:

```text
npm run check:workspace-lock
npm run check:docker-build-contracts
npm run test:affected-targets
npm run check:startup-migrations
```

Update owning manifests, lockfile, transitive Docker inputs and affected-target
metadata together when applicable. The plan does not assume a new migration
or feature flag already exists.

### D-01 — Resume documentation only after product acceptance

**Owner:** LEAD + technical writer + independent QA/RULES reviewer.
**Depends:** all applicable CR/H/CS tickets and Q-01 pass, with remaining
future roadmap features explicitly separated. H-09 promotion/research claims
require their own evidence; never relabel them passed to finish the docs.

- Finish the previously requested player and engineering guides against the
  exact verified build. Cover host storage, creation modes/editions, editing,
  money/equipment/spells, retry/resume, sheet/session/token handoff, useful
  actions, keyboard/phone/help and concrete recovery steps.
- Reconcile the existing draft guides, creator/Studio plan status claims,
  stale “uncommitted” baseline wording, architecture/data-flow descriptions,
  public examples, ADR status notes and navigation. Preserve accepted ADR
  history; add a superseding decision if needed. Do not duplicate rules
  explanations or calculators.
- Verify source-backed commands/types, links/anchors, screenshot version and
  privacy, cross-page consistency and both audiences' primary tasks. Run
  `npm run test:docs` (typecheck plus production build with fatal broken links).
  Report any exact failure instead of declaring the documentation complete.

## 8. Completion rule and first work packet

The repair is complete only when every identified defect has a reviewed fix
and regression, every applicable acceptance gate has executed successfully,
and no required creation/planning/play action depends on an inert control,
silent data loss, unsupported rules claim or falsely reported handoff.

Start with **B-01 and CR-01**, then merge bounded repairs through reviewed PRs:
creator draft/catalog contracts; Studio session/plan identity/persistence;
parallel creator casting/loadout/math and Studio editor/reference/map fixes;
host recovery and exact finalization; integrated browser/accessibility and
rollout checks; documentation last. Independent Forge Edit and campaign
metadata fixes can proceed in parallel once file ownership is assigned.

Each PR records its ticket IDs, failing-before/passing-after evidence, affected
contracts/hosts, compatibility behavior and unresolved items. Do not schedule a
single rewrite PR or mark an entire phase complete because its UI renders.
Re-estimate effort after B-01 from reproduced failures, catalog scope and
migration requirements; this plan does not turn unverified work into a fixed
delivery-date promise.
