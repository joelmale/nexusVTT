---
title: Remaining creator and Studio implementation tranches
description: Ordered implementation and acceptance work after the first rules, reliability, and security repair tranche.
---

# Remaining creator and Studio implementation tranches

Date: **2026-10-26**. Implementation baseline: **`38ba9856`**, pushed to `main`.
Status: **T-01–03 implementation in progress; exit criteria remain open. T-08 device/AT acceptance waived by the owner (excluded, not passed).** See the
[current implementation record](character-creation-tranches-1-3-evidence.md).

This is the execution plan for work remaining after the first repair tranche.
It refines the open V-01–V-09 packets in the
[original validation plan](character-creation-validation-plan.md), using the
[execution evidence](character-creation-validation-evidence.md). Historical
failures and passes remain in that ledger. The broad player and engineering
guide refresh stays last.

## Baseline and counting rules

The baseline passed 640 creator tests, 2,595 VTT unit tests, 48 PostgreSQL
integration tests, and 50 managed browser scenarios. Ten-room/40-client normal
and chaos soaks each ran for ten minutes and passed their recorded thresholds.
Five CodeQL scopes were analyzed; the server's 78 remaining alerts have recorded
engineering dispositions, not independent security approval.

There are **eight fixed reference records**, for Fighter, Rogue, Wizard and
Warlock in both editions. None has the complete independent sign-off required
by the plan. Barbarian, Monk, Bard and Sorcerer (eight records) were authored on 2026-10-27
and await independent review. **10 records remain to author:** Cleric, Druid,
Paladin, Ranger and Artificer, each in both editions. Artificer
also needs a supplemental-source support decision.

The user has since authorized broad Artificer support and delegated the source
recommendation to Codex. The selected foundations are **Tasha's Cauldron of
Everything (2020)** for legacy characters and **Eberron: Forge of the Artificer
(2025)** for revised characters. Compatible options may be combined with source
provenance. Replacement features and incompatible progression tables must not
stack. Full catalog verification remains open; this decision supersedes the
earlier Wayfinder-only request. **DM** owns independent rules review,
accessibility review and the shared test environment.

The target remains **26 reviewed references and 104 host/mode cases**:
26 × Forge/VTT × guided/full. Existing creator browser coverage is **32 reference
cases plus four theme variants**, totaling 36. The other 14 scenarios in the
50-case suite are separate checks. At an unchanged scope, add **72 reference
host/mode cases**; theme variants do not reduce that number. Blank authoring,
sheet actions, recovery and Studio cases are additional acceptance dimensions.

Do not reduce scope silently to finish a gate. An unsupported option needs an
explicit support decision, visible behavior, rejection/preservation tests as
applicable, and an updated inventory explaining the changed denominator.

## Delivery order

| Tranche | Outcome                                                                  | Dependencies                                                          | Original packets |
| ------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- | ---------------- |
| T-01    | Verified source/support scope and executable case register               | Baseline                                                              | V-01             |
| T-02    | Correct class resources through creation, edits, rest and persistence    | Source facts for each implemented slice from T-01                     | V-02, V-04, V-06 |
| T-03    | Complete supported progression, grant and effect behavior                | T-01; T-02 for resources                                              | V-03, V-04       |
| T-04    | All class/edition reference records and full saved-value assertions      | Draft expectations can begin after T-01; final passes require T-02–03 | V-02             |
| T-05    | Legal/illegal interaction coverage and explicit multiclass contract      | T-01; grow with T-02–04                                               | V-03, V-05       |
| T-06    | Complete host authoring, recovery and Studio workflows                   | T-02–05 for final matrix                                              | V-06             |
| T-07    | Remaining security hardening and final engineering/reliability evidence  | Security work can begin after T-01; final reruns follow T-06          | V-08             |
| T-08    | Actual device/AT acceptance, independent review and participant research | Prepare after T-01; final execution against stable T-06–07 candidate  | V-07, V-09       |
| T-09    | Release/rollback acceptance, accurate certification and guide refresh    | T-01–08                                                               | V-09             |

Deliver small reviewed changes within each tranche. Use the same shared creator
and typed host contracts. Separate source facts, calculated definitions and
runtime state; host apps must not gain competing rules calculators. A tranche
closes only when its exit criteria and linked evidence are complete.

## T-01 — Freeze source and support scope

**Work**

- Reconcile the captured inventory with selectable UI, evaluator, content packs
  and `src/data/supportManifest.ts`. Record scope independently for level-one
  creation, later-level creation, level-up, editing and imported preservation.
- Verify edition and provenance for classes, backgrounds, species/lineages,
  feats, spells, subclasses and equipment. Review legacy backgrounds/lineages
  separately from SRD 5.1; fix misleading source labels and source-policy gates.
- Resolve Artificer in each edition using a verified supplemental source and
  content revision. Do not manufacture an SRD citation or assume a file named
  `2024` proves revised rules support. Keep unresolved rows blocked and visible.
- Create a versioned case register mapping every open CR/H/CS/Q criterion to a
  test, manual task or unresolved implementation issue. Record owner role,
  source, inputs, expected outcome, dependency, evidence and current status.
- Assign independent rules/accessibility reviewers and a test-environment owner.
  Confirm the available devices and prepare a reachable candidate URL without
  representing the existing local Docker stack as accessible from every device.

**Exit:** every advertised scope is accounted for; source-policy tests distinguish
permitted, wrong-edition, unverified and disallowed content. Open decisions have
named owners and blocking cases. Inventory snapshots remain inputs, not oracles.

## T-02 — Implement class resources first

**Observed gap:** `calculateCharacterStats` does not initialize class resources.
`resourceUtils.ts` approximates Charisma-based uses from level and treats rest
recovery as a full refill. The host contract currently permits `unknown[]`.
Simply calling that helper would preserve incorrect behavior.

**Implementation slices**

1. Define a shared typed resource contract and compatibility adapter. Represent
   stable identity, edition/class/grant provenance, maximum, current/spent uses
   and the applicable recovery rule. Support partial recovery and ability-based
   maxima; identify any manual/conditional mechanic explicitly. Keep ordinary
   spell slots, Pact Magic and limited feature/free-casting uses distinguishable.
2. Add source-backed resource definitions and literal count/recovery fixtures.
   First deliver Fighter/Barbarian/Bard across both editions to exercise fixed,
   level-scaled and ability-based maxima. Then cover Monk/Sorcerer/Cleric/Druid,
   followed by Paladin/Ranger/Warlock/Wizard and applicable Rogue resources.
   Include subclass/grant resources where advertised. Artificer follows its
   verified T-01 support scope.
3. Initialize full resources for a newly created character. Reconcile edits and
   level changes without silently replenishing spent uses, losing manual
   overrides or introducing duplicate trackers. Explicitly define max reduction,
   removed/replaced grants and legacy records with no tracked current value.
   Do not invent historical expenditure during migration.
4. Carry resources through evaluation, host conversion, local/account storage,
   export/import, VTT actor projection and sheet actions. Reuse shared rest logic
   while each host retains persistence ownership. Preserve PostgreSQL-before-ACK
   and existing compare-and-swap behavior for durable multiplayer changes.

**Validation:** independent literal maxima at every transition; partial/full/no
recovery; actual ability modifiers; duplicate grants; zero/invalid consumption;
save/reload; edits of spent resources; legacy imports; peer/reconnect consistency.
Include a browser journey that creates, expends, rests and reloads a real tracker.

**Exit:** all in-scope class resources have correct usable saved state and tested
recovery. Unknown/conditional behavior cannot appear as implemented automation.
Contract changes include affected workspace builds and compatibility evidence.

## T-03 — Finish progression, grants and effects

**Work**

- Build independently sourced transition tables for every supported class and
  edition. Audit the existing revised tables; add the missing supported legacy
  progression path instead of relying on the generic fallback in
  `utils/levelUpUtils.ts`.
- Verify subclass timing, proficiency, HP/hit dice and retroactive Constitution,
  ability increases/caps, ASI opportunities, expertise, proficiencies, attacks,
  spell learning/preparation/slots, resource transitions and feature replacement.
  Treat later-level creation and leveling an existing character as separate paths.
- Complete invocation effects beyond saved names: eligible cantrip targeting,
  attack/damage/range modifiers, conditional casting and other supported effects.
  Retain the already-repaired count/mastery/subclass tests as regression coverage.
- Resolve repeatable Lessons/Magic Initiate grants with distinct durable grant
  identities and separate spell-list/ability/use selections. Validate duplicates
  under the actual repeatability rules; preserve existing `featChoices` records.
  A currently rejected legal repeat must remain an open gap until implemented or
  explicitly excluded through the support decision process.
- Clearly distinguish automated effects from features requiring manual action.
  A displayed feature name does not establish working combat/casting behavior.

**Validation:** immediately before, at and after every transition; cross-path
equivalence for the same build; stale choices after level/edition/source changes;
save/reload of higher-level examples; preservation of overrides/spent state.

**Exit:** supported tables and effects have reviewed literal boundary assertions,
canonical validation and correct saved behavior. No advertised legacy path is
accepted as complete solely because a fallback returned an object.

## T-04 — Finish the 26 independent references

Author and validate in these batches, keeping both editions together:

| Batch | New records           | Focus                                                                  |
| ----- | --------------------- | ---------------------------------------------------------------------- |
| A     | Barbarian and Monk: 4 | Unarmored AC, armor/shield restrictions, attacks, resources            |
| B     | Bard and Sorcerer: 4  | Ability-based resources, edition-specific casting, feature effects     |
| C     | Cleric and Druid: 4   | Early subclass/order differences, prepared/granted casting, resources  |
| D     | Paladin and Ranger: 4 | Casting onset, mastery/proficiencies, resources and equipment          |
| E     | Artificer: 2          | Verified supplemental source and explicitly supported edition behavior |

Expand the existing eight records to assert attacks/damage, features, resources,
tools/languages, equipment quantities/equipped state, all casting ledgers and
recovery, alongside the numeric/skill/save checks already added. Use varied
legal origins/equipment to expose interactions; do not use one universal template
as proof of source or grant coverage.

Prepare literal expectations and calculation notes independently of production
calculators, recommendations and fixture generation. Compare evaluated output,
host conversion, serialized record and sheet action results. A rules discrepancy
must be resolved from the pinned source, never by copying actual output into the
expected fixture. Record a second review of expectations and changed expectations.

**Exit:** 26 complete records, all required fields asserted, independent reviewer
sign-off and linked regressions for discovered defects. Candidate fixture capture
and self-consistency tests do not count as independent verification.

## T-05 — Complete choice interactions and multiclass boundaries

For every grant family, add valid and applicable missing/excess/duplicate/unknown/
wrong-edition/disallowed-source/ineligible mutations. Cover species/lineages,
background ability choices, feats and prerequisites, skills/expertise, tools,
languages, orders, styles, mastery, invocations, casting and gear/gold choices.
Exercise changes to class, level, edition, ability scores, source policy and mode,
plus tampered/imported drafts at the canonical evaluator boundary. Preserve valid
answers and explain stale answers that need repair.

Separate ordinary, innate, ritual, at-will and limited-use casting. Test grant
overlap, casting ability, preparation, list membership, use accounting, upcasting,
concentration and rest. Use exhaustive finite tables and recorded pairwise/risk
coverage for cross-family combinations; retain uncovered cases explicitly.

Resolve the multiclass contract before expanding UI scope. Current single-class
authoring does not prove the separate multiclass engine or imports are correct.
For every supported category, verify prerequisites, starting/subsequent-class
proficiencies, HP/hit dice, ASIs, AC alternatives, expertise, ordinary slot
rounding, Pact Magic and per-class learnable/preparable spells. Verify lossless
imported/manual multiclass preservation through edits and export/import.
Enabling new multiclass authoring is a separately scoped product change unless
T-01 establishes that it was already advertised.

**Exit:** every supported grant/category has traceable positive and negative
coverage at both evaluator and saved-output boundaries. Unsupported authoring
cannot be presented as validated support, and preservation behavior is tested.

## T-06 — Complete authoring, persistence and Studio acceptance

**Creator/hosts**

- Extend the reference matrix to all 104 Forge/VTT guided/full cases, retaining
  separate theme variants. Add at least one blank-to-finished visible-control
  journey per class/edition, covering every host/mode pairing within that set,
  then exercise distinct UI branches. Seeded journeys remain useful separately.
- Add quiz continuity, source/edition changes, manual/import entry, editing,
  desktop/Player Setup/Simple Player and export/import. Assert actual saved
  values and usable sheet actions, including resource and casting operations.
- Reconcile each original recovery criterion: slow/rejected saves, commit then
  lost response, same-attempt retry, account/local/room partial success, offline
  DM/reconnect, room change, claim races/spectators, conflicting tabs, corrupt/
  older/future drafts, route exit and pending completion after reload. Assert
  canonical identity, preserved choices and no duplicate characters/tokens.

**Campaign Studio**

- Author from blank using real map, actor and handout references; test invalid,
  deleted or inaccessible dependencies and applicable campaign permissions.
- Cover same-title, renamed and cloned sessions; dirty versus published state;
  pinned revisions; concurrent edits/revisions; failed and repeated activation;
  reload and the correct resulting VTT run/actors/scenes.
- Keep the existing note-only author/publish/activate and deployment tests as
  regressions, without treating them as proof of every Studio criterion.

**Exit:** all applicable H/CS/Q criteria have current passing evidence or an
explicit unresolved defect. Required failures keep the tranche open. Fixtures
must not prepopulate fields the visible UI cannot author.

## T-07 — Close security and engineering follow-ups

**Security implementation**

- Add a deployment-wide abuse budget, using an atomic shared counter or verified
  gateway policy. Decide the failure policy explicitly: preserve protection for
  credentials and expensive operations while documenting readiness/recovery
  behavior. Keep the local bounded limiter as appropriate defense in depth.
  Verify trusted proxy/IP handling, IPv6 behavior, shared-NAT clients, independent
  replica/restart behavior and retries under actual supported traffic.
- Enforce document access during retrieval, before Q&A generation. Propagate a
  server-established authorization scope to the document API/search layer; an
  optional client campaign filter is not that scope. Retain the existing complete
  response rejection as defense in depth. Test unauthorized chunks never reach
  answer generation, and authorized/public/campaign/owner cases still work.
  Review related search counts, snippets and citations for leakage.
- Obtain independent review of the 78 server CodeQL dispositions and the creator/
  Forge findings. Resolve disputed findings and maintain raw results. Inventory
  current dependency alerts and separate actionable release blockers from
  documented follow-ups; do not equate a completed scan with a clean system.

**Final engineering validation**

Run affected creator/contracts/rules/Forge/Studio/VTT tests, lint, type checks,
production builds and CI preflight at one recorded candidate commit. Database
suites must execute. Target at least 80% relevant changed-code lines/branches
without replacing behavioral assertions with implementation-mirroring tests.
Rescan changed security scopes and retain report/tool versions and dispositions.

Repeat managed recovery plus ten-room/40-client/ten-minute normal and chaos
windows when the candidate changes affected durability, reconnect, shared state
or request admission. Assess normal SLOs separately from injected faults and
capture both backend replicas' relevant metrics. Preserve previous failed runs,
unchanged thresholds and PostgreSQL transaction/CAS ordering. Larger load profiles
remain separate requirements wherever the case register identifies them.

Changes to resource contracts, services, environment variables, gateway behavior
or dependencies also require workspace-lock, affected-target, Docker/Compose and
startup/migration checks as applicable. Follow the monorepo delivery contract.

**Exit:** no required skipped/failed check, reviewed security dispositions,
reproducible candidate/report identities and resolved required reliability issues.
This does not assert production deployment health.

## T-08 — Run real device acceptance and research

Use the existing [manual acceptance instructions](character-creation-manual-acceptance.md).
Supply a reachable isolated test URL and exact build identity. Capture versions
before testing; the owner's MacBook Edge **156.0.4314.42** is reported information,
and “latest Safari” on iPhone/iPad is not an exact version record.

Execute Windows NVDA with Chrome and Firefox; MacBook VoiceOver with Safari and
the available Edge; iPhone and iPad VoiceOver/Safari separately; Android
TalkBack/Chrome. Include keyboard-only tasks, actual 200%/400% browser zoom,
mobile text scaling, portrait/landscape, soft keyboards, themes, reduced motion,
validation announcements, nested dialogs and focus return. Run creator, sheet and
Studio tasks as applicable. Emulation and CSS zoom cannot close these rows.

An experienced screen-reader user reviews results. Record actual defects, repairs
and manual retests separately. Independent rules reviewers approve T-04/05
expectations and higher-level scope. Maintain an explicit support matrix for
what was actually reviewed rather than switching on broad class certification.

Prepare recruitment and privacy-safe instrumentation early; conduct the planned
**12–18 participant study** on the stabilized candidate. Agree success criteria
before sessions, record observed completion/time/help/errors/recovery/handoff,
repair material issues and retest. A deferred study leaves that gate open.

**Decision (2026-10-27): device and assistive-technology acceptance waived by the
owner.** The owner chose not to run the real-device, screen-reader, browser-zoom
and keyboard acceptance rows in this plan. Status for those rows is **excluded**,
not pass. No accessibility conformance is claimed for the creator, sheet or
Studio; the automated axe, focus, viewport and contrast checks remain the only
accessibility evidence. The independent rules review and the 12–18 participant
study are **not** covered by this waiver and remain open, as do T-09 release and
rollback acceptance. The prepared [run checklist](character-creation-t08-checklist.md)
stays available if this decision is reversed.

**Exit:** required device/AT tasks and independent reviews pass, material findings
are repaired/retested, and actual participant evidence satisfies the agreed study
criteria. No simulated participants or generated approvals count.

## T-09 — Release, rollback and documentation last

Validate the exact release candidate and image identities in the approved test
environment. Rehearse fallback/rollback while preserving character identity,
drafts, resource expenditure, published revisions and active runs; include forward
compatibility of records written by the new build. Keep any irreversible migration
or separate deployment approval explicit. Verify deployment health after release.

Update certification only for scopes with completed evidence. Then reconcile the
existing player/engineering drafts with accepted behavior, sources, limitations,
commands and recovery instructions. Update screenshots/examples against that
candidate and run documentation link/type/build checks and audience review.

**Exit:** release/rollback evidence, applicable independent approvals, truthful
support claims and verified guides. A pushed commit alone does not close this plan.

## Starting work and recording completion

The next engineering change should be **T-02 resource contract/definitions plus
the Fighter/Barbarian/Bard slice**, preceded by the narrow T-01 source/support
verification needed for those classes. Do not wait for the entire source audit
to start a verified slice. Expand the corresponding literal references alongside
the implementation, then proceed through T-03–06. Security work, device setup and
reviewer/research preparation can proceed independently where dependencies allow.

For each slice record its ticket IDs, failing-before/passing-after evidence,
source revision, touched contracts/hosts, compatibility behavior, actual commands,
candidate commit/images, remaining cases and reviewer/retest status in the case
register and execution ledger. Use **not run, pass, fail, blocked, excluded**;
an exclusion needs the explicit scope decision described above.

Use the existing commands in the original plan. For a genuinely focused VTT test,
run Vitest with an explicit path: the `test:unit` npm script already includes
`tests/unit src`, so appending a file does not isolate it. On this Windows host,
the final broad VTT run used one worker; creator tests used four. Pass soak flags
as separate arguments, for example `--conflict-probe false`, and use fresh
disposable state for deterministic soak room codes. Never run destructive tests
against production or count a reused historical report as a new candidate pass.

Re-estimate after the first resource slice and reference batch reveal actual
defects. The sequence is an implementation plan, not a fixed completion-date
promise. Human/device/research gates need scheduled participation, while remaining
engineering work stays visible and actionable before the guide refresh.
