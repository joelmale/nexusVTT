---
title: Character creator rules and acceptance completion plan
description: Executable work packets for broader rules coverage, host verification, manual accessibility, and remaining release evidence.
---

# Character creator rules and acceptance completion plan

> **Documentation status (2026-10-27):** the player and engineering guides were refreshed against `6d187098`. This page is a historical planning/evidence record; for current behavior use the [engineering guide](../character-creation.md) and the [coverage matrix](character-creation-docs-coverage.md).

Date: **2026-10-25**. Baseline: **`248fedf9`**, pushed to `main`.

Status: **Implementation in progress; remaining acceptance gates are open.** This plan supplements
the [repair record](character-creation-review.md). Finish implementation gaps
and validation before the deferred player and engineering documentation refresh.
Creating this plan does not close an acceptance ticket or certify any class.

Execution began **2026-10-26**. The live inventory found Artificer in both
editions in addition to the 12 manifest classes. The required scope is now
**26 class/edition references and 104 host/mode cases**, including a separate
supplemental-source review for Artificer. See the
[execution evidence and outstanding work](character-creation-validation-evidence.md).

## Verified starting point

At the baseline, the support manifest advertised 12 classes in both editions: Barbarian,
Bard, Cleric, Druid, Fighter, Monk, Paladin, Ranger, Rogue, Sorcerer, Warlock,
and Wizard. Its level-one certification flags remain false. Review the actual
catalog and entry points as well: anything selectable but absent from the
manifest must be added to the inventory and given an explicit support decision.

The baseline has six independent references (Fighter, Rogue, Wizard in each
edition), focused grant regressions, 28 creator browser completion/theme cases,
and 41 managed browser cases overall. Creator inputs are fixture-seeded; these
are not blank-to-finished authoring evidence for every choice or class.

Before the main push, the full VTT unit rerun passed **2,562 tests in 237 files**
with four workers and console output suppressed. All **48 PostgreSQL integration
tests**, **166 asset-service tests**, full VTT lint/types/cycle checks, and CI
preflight passed. Earlier creator, Forge and Studio totals are recorded in the
repair record; totals overlap. The first broad run exposed stale tests, which
were corrected. A subsequent all-assertions-passing run had a Vitest console
teardown error; the final rerun exited successfully. Keep these outcomes distinct.

Automated accessibility covers widths, contrast, keyboard containment and focus,
themes and CSS zoom simulation. Actual assistive technology, browser zoom and
physical-device acceptance remain unexecuted. The 30-second conflict soak passed
functional checks, but its aggregate resync metric exceeded the stated SLO
after deliberate recovery/conflict traffic. It proves neither sustained load
nor production SLO compliance. Local CodeQL was unavailable.

## Scope and evidence rules

Use the shared `packages/character-creator` evaluator and host contract; do not
create separate host calculators. Test the evaluated character, host conversion,
persisted sheet, exported/imported record, and VTT actor projection where relevant.

Pin official rule sources using the [official SRD hub](https://www.dndbeyond.com/srd):
SRD 5.1 for the legacy baseline and SRD 5.2.1 for the revised baseline. Record
the exact document version, section/page and content-pack revision for each
expected value. Identify selectable supplemental/homebrew content separately;
do not infer its rules from a similarly named SRD option or silently mix editions.

Expected results must be prepared independently of production calculators,
recommendations, converters and fixture generators. Commit literal inputs,
expected values and calculation notes after review. A generated actual result
must never become its own expected result. Reuse independently reviewed values
across layers, with a second review whenever a rule expectation changes.

Use these statuses per case: **not run, pass, fail, blocked, excluded**. An
excluded option requires a reason, a visible support restriction, and rejection
tests; it cannot remain advertised as supported. A blocked/unrun case is never
a pass. Certification applies only to the recorded edition, levels, options,
source packs and host paths.

Maintain one evidence ledger alongside the fixtures with these fields:

| Field     | Required content                                                        |
| --------- | ----------------------------------------------------------------------- |
| Identity  | Stable case ID, work packet, class, edition, level(s), mode, host       |
| Input     | Complete choices, source policy, content/evaluator versions             |
| Oracle    | Rule citation, independent calculation, expected saved values, reviewer |
| Execution | Exact commit/build, command or manual task, browser/device/AT versions  |
| Result    | Status, actual values, durable artifact/trace link, timestamp           |
| Follow-up | Defect ID, severity, repair commit, regression and retest result        |

Do not retain personal names, credentials or private character prose in evidence.
Use disposable identities and isolated test databases.

## Work packets and exit criteria

Owners below describe responsibilities, not assigned people. Codex can implement
and automate checks; independent rules review, physical-device/AT sessions and
participant research need recorded human participation. Assign reviewers and
available devices in packet V-01 before claiming those gates can finish.

### V-01 — Freeze the advertised support inventory

**Owner:** rules reviewer + creator maintainer. **Dependency:** none.

- Inventory selectable classes, editions, subclasses, levels, origins, feats,
  spells, equipment and source packs across full/guided/quiz entry points.
- Compare `src/data/supportManifest.ts`, catalogs, evaluator and actual controls.
  Record edition-specific casting/progression metadata discrepancies as defects;
  manifest comments are not a rules authority.
- Record whether multiclass creation, later-level creation, level-up and legacy
  imported multiclass preservation are separately supported. Existing data types
  alone do not establish support.
- Create the case ledger, reviewer assignments, AT/device availability and
  support matrix. Inventory all relevant original CR/H/CS/Q tickets and map
  each acceptance criterion to evidence or an open case.

**Exit:** every advertised option has a testable support scope; missing product
behavior has a defect, rather than an assumption that validation will fix it.

### V-02 — Establish 26 independent class/edition references

**Owner:** independent rules reviewer + QA. **Dependency:** V-01.

Create one complete level-one reference for every class in each edition:
**26 required references** (24 core plus two Artificer candidates). Re-review/reuse
the existing six and add the missing **20**. Artificer requires verified
supplemental provenance rather than an SRD citation. Prefer varied origins and
equipment rather than repeating one template.

For every reference compare ability scores/modifiers, proficiency bonus, HP and
hit dice, AC, initiative/speed, weapon attack/damage bonuses and dice, saves,
skills, expertise, tools/languages, exact equipment/quantities/equipped state,
money, spell attack/DC, spell selections/preparation, slots and other resources.
Mark fields genuinely not applicable and explain why. Include chosen features
and provenance; a correct total does not excuse a lost feature.

| Class family    | Additional independent checks                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------- |
| Barbarian, Monk | Edition-specific unarmored AC, armor/shield restrictions, weapon/unarmed attacks, class resources   |
| Fighter, Rogue  | Fighting-style/mastery eligibility, expertise allocations, extra ASI opportunities where applicable |
| Bard, Sorcerer  | Edition-specific spell ledger/preparation and class resource progression                            |
| Cleric, Druid   | Orders/domains/subclasses at the applicable levels, proficiencies, prepared and granted spells      |
| Paladin, Ranger | Edition-specific onset/progression of casting, equipment and class resources                        |
| Warlock         | Pact Magic separately from ordinary slots, invocations, pact choices and granted casting            |
| Wizard          | Spellbook versus prepared spells, rituals, spell learning and recovery                              |

**Exit:** 26 reviewed fixture records; automated comparison against production
evaluation, host conversion and saved records. A second reviewer signs the
expectations. Each mismatch becomes a repair plus a regression.

### V-03 — Complete legal and illegal choice validation

**Owner:** creator maintainer + rules reviewer + QA. **Dependency:** V-01;
use V-02 fixtures as mutation starting points.

For every advertised grant family add a valid case and explicit invalid cases
for missing, excessive, duplicate, unknown, disallowed-source, wrong-edition and
ineligible selections where applicable. Cover species/lineages, backgrounds,
ability increases, feat entitlements/prerequisites/repeatability, class skills,
expertise, tools, languages, orders, styles, masteries and invocations.

Cover ordinary, innate, feat, at-will and ritual casting: list membership,
casting ability, cantrip/spell counts, preparation, free uses versus slots,
upcasting, concentration and recovery. Verify gear/gold alternatives, armor and
shield compatibility, proficiency, quantities, currency and duplicate grants.

Test changes after selection: class, level, edition, source policy, origin,
ability scores and mode. Explain invalidated choices and require repair;
do not silently remove unrelated valid choices. Invalid imported/tampered drafts
must fail canonical validation even if the UI normally prevents the combination.

Use exhaustive cases for finite entitlement tables, boundary cases for numeric
limits, and pairwise cross-family combinations supplemented by known risky
interactions. Record uncovered combinations instead of calling sampling exhaustive.

**Exit:** each grant family has traceable positive/negative coverage at both
validation and saved-output boundaries; invalid drafts cannot complete.

### V-04 — Repair and verify higher-level progression

**Owner:** creator/rules maintainer + independent rules reviewer.
**Dependency:** V-01–03. Start with the known Warlock gap.

`src/services/classGrantChoices.ts` explicitly enforces the 2024 invocation
count at level one. Review higher-level counts, prerequisites, selectable catalog
completeness, replacements and saved effects before expanding its support claim.
Apply the same review to mastery counts and other level-dependent grants.

Build a boundary table from the pinned rules for each advertised class/edition.
For every count/eligibility transition test immediately before, at and after the
transition when the supported range permits. Include applicable levels
1/2/3/4/5/8/11/17/19/20, plus all additional table transitions; that list alone
is not complete coverage. Verify subclass timing, ASIs/feats, ability caps,
proficiency, HP/retroactive Constitution effects, expertise, attacks, spell
learning/preparation/slots, Pact Magic, resource maxima and recovery triggers.

Distinguish creating a character at a later level from advancing an existing
character. Verify both if advertised. Preserve spent resources and explicit
manual overrides during edits; define intentional recalculation separately.

**Exit:** reviewed boundary tables, repaired choices/calculations, regression
tests, and saved/reloaded higher-level examples. Restrict unsupported options
visibly and test rejection; do not silently narrow scope to finish the gate.

### V-05 — Resolve the multiclass support contract

**Owner:** rules reviewer + product/creator maintainer. **Dependency:** V-01, V-04.

Inventory the implementation before selecting cases. For supported combinations,
independently check entry prerequisites, initial-class versus later-class
proficiencies, class/total levels, hit dice/HP, ASIs, expertise overlap, conflicting
AC formulas, and resource attribution. Separate multiclass slot calculation from
spells learnable/preparable per class and from Pact Magic/granted/free casting.

Cover every supported caster-progression category and supported interaction,
including ordinary casting plus Pact Magic and any advertised fractional
progression. Include illegal prerequisites, over-level builds, source/edition
mixes and duplicate incompatible features. Do not require nonexistent subclass
options simply to fill a category.

If new multiclass authoring is unsupported, document that product decision in
the support matrix, prevent it from masquerading as validated creation, and
still verify lossless imported/manual multiclass preservation. Enabling new
multiclass creation is a separately estimated implementation item.

**Exit:** explicit approved support scope, positive/negative coverage for every
supported category, preservation tests and truthful UI/manifest restrictions.

### V-06 — Finish actual authoring and host acceptance

**Owner:** host/Studio maintainers + QA. **Dependency:** V-02–05 for final execution.

- Run the 26 class/edition references through guided/full × Forge/VTT:
  **104 completion/persistence cases**, extending the existing 24 core cases.
  Reconcile counts with the ledger; theme variants are separate cases.
- For every class/edition perform at least one complete creation through visible
  controls from a blank draft. At minimum cover all host/mode combinations in
  that set, then add distinct UI branches not exercised by those journeys.
  Seeded cases remain useful but do not satisfy blank-authoring requirements.
- Add explicit quiz-to-guided/full continuity, manual/import paths, desktop,
  Player Setup and Simple Player entry coverage. Verify edition/source changes,
  validation repair, save/reload, export/import, and the exact saved sheet.
- Complete the recovery ledger: rejected/slow saves, commit then lost response,
  same-attempt retry, partial account/local/room success, DM offline/reconnect,
  room change, claim races, spectators, tab conflicts, corrupt/old/future drafts,
  route exit and pending completion after reload. Assert preserved choices,
  canonical identity and absence of duplicate characters/tokens.
- Execute useful sheet actions, including weapon/skill/save rolls and casting,
  preparation, concentration, rest, exhaustion and peer/reconnect consistency.
- Close remaining Studio criteria with real authoring from blank, map/actor/
  handout references, same-title/renamed/cloned sessions, dirty publication,
  pinned revisions, failed/retried activation, concurrent revisions and reload.
  Observe actual VTT results; do not prepopulate fields the UI cannot author.

**Exit:** every applicable H/CS/Q criterion has current pass evidence or an
explicit unresolved defect. Existing passing journeys need reruns after changes
to their implementation, fixtures, contracts or integration dependencies.

### V-07 — Complete manual accessibility acceptance

**Owner:** accessibility tester + host/Studio maintainers.
**Dependency:** stable V-06 journeys; preparation can begin after V-01.

Use actual supported browsers and record versions. Minimum manual combinations:
Windows NVDA with Chrome and Firefox; macOS/iOS VoiceOver with Safari; Android
TalkBack with Chrome. Record unavailable combinations as blocked, not simulated
passes. Include an experienced screen-reader user in the acceptance review.

For Forge, VTT desktop/Simple Player and Studio, complete creation/edit/save/
resume, validation-error correction, spell/slot/rest actions, and Studio
author/publish/activate tasks as applicable. Verify accessible names, headings,
grouping, field instructions, error association, status/save announcements,
logical reading/tab order, dialog containment, nested Escape and focus return.
Run keyboard-only journeys without a pointer and check visible unobscured focus.

Test real 200% browser zoom and 400% reflow, OS/text scaling where supported,
dark/light/paper themes and applicable host palettes. On physical phone/tablet,
test portrait/landscape, soft-keyboard opening, validation, scrolling, touch
targets and save/cancel access. Check reduced motion and relevant contrast states.

**Exit:** device/AT task ledger, findings with severity, fixes and manual retests;
no unresolved accessibility defect prevents or materially impairs a required task.
Automated axe/focus/viewport checks also pass on the final build. CSS zoom
simulation and emulated devices cannot close the real-device/manual rows.

### V-08 — Finish engineering, reliability and security evidence

**Owner:** QA + API/integration maintainer. **Dependency:** implementation freeze.

Run affected package tests, lint, types and production builds against one recorded
commit; verify database suites execute rather than skip. Retain existing coverage
gates and target at least 80% relevant lines/branches for changed implementation.
Inspect assertions and untested branches; coverage percentages alone do not
establish rules correctness. Repeat managed browser recovery and cross-replica
checks after relevant changes.

Extend the short soak using the existing managed baseline (10 rooms, 4 clients
per room, 10 minutes). Include conflict/reconnect traffic and the managed chaos
variant for the changed durability/reconnect paths. Preserve PostgreSQL-before-ACK
and entity CAS. Record loss, ordering, convergence, latency and metrics results.
Assess normal-traffic SLO windows separately from intentional conflict/chaos
windows, while reporting both; never discard failure-inducing traffic from the
report or claim the earlier aggregate resync breach passed.

Restore a working CodeQL CLI/query setup or execute an equivalent configured CI
CodeQL check and record its result. Review findings and repairs; an unavailable
scanner remains blocked and a simple credential-pattern scan is not a substitute.

**Exit:** reproducible command/report ledger, no required skipped/failed checks,
explained and resolved reliability findings, and reviewed security results.
Local test success does not establish production deployment health.

### V-09 — Close research, release and documentation gates

**Owner:** product lead + independent rules/accessibility/QA reviewers + writer.
**Dependency:** V-01–08.

Execute the existing moderated **12–18 participant study** before claiming its
gate. Validate privacy-safe event instrumentation first. Report actual observed
completion, time, help requests, errors, recovery and handoff outcomes; do not
invent success thresholds or claim automated journeys replace participants.
Agree study success criteria before sessions, repair material findings and retest.
If research is deferred, keep H-09/research promotion open with that decision
recorded; it is not completion of this entire plan.

Review the final support matrix independently. Update certification only for
scopes with completed evidence; keep unsupported scopes false. Validate fallback/
rollback without losing identities, drafts, choices or spent gameplay resources.
Record any separate deployment approval and post-deployment health checks.

Only then resume the requested documentation refresh: reconcile the existing
drafts, support limitations, recovery instructions, commands, examples and plan
status against the accepted build. Run documentation typecheck and production
build, check links and versioned screenshots, and obtain audience review.

**Exit:** explicit sign-offs with commit/evidence links, truthful support claims,
completed applicable release/study gates, and verified user/developer guides.

## Execution order and validation commands

Start with **V-01**, then deliver a first bounded repair packet: Warlock invocation
progression inventory and tests, its identified implementation fixes, and the two
independent Warlock references. Continue the remaining class/edition matrix and
grant/boundary repairs in small reviewed changes. Prepare accessibility devices
and research recruitment early; execute acceptance on the stabilized build.
Complete V-06–08, then V-09. Do not start the broad guide refresh while required
implementation or acceptance failures remain.

Use existing commands from the repository root; append exact file filters during
development and record the actual commands/environment in the ledger:

```text
npm run test:character-creator
npm run type-check --workspace=@nexus/character-creator
npm run test:rules-5e
npm run test:game-contracts
npm run test --workspace=nexus-forge -- --run
npm run lint --workspace=nexus-forge
node node_modules/typescript/bin/tsc --project apps/forge/tsconfig.json --noEmit
npm run test --workspace=@nexuscodex/dm-ui
npm run lint --workspace=@nexuscodex/dm-ui
npm run build --workspace=@nexuscodex/dm-ui
npm run test:ci --workspace=nexus-vtt
npm run build:forge
npm run build:vtt
npm run test:e2e --workspace=nexus-vtt
npm run test:soak:managed --workspace=nexus-vtt -- --rooms 10 --clients-per-room 4 --duration 10m
npm run test:soak:chaos --workspace=nexus-vtt -- --rooms 10 --clients-per-room 4 --duration 10m
npm run ci:preflight
npm run test:docs
```

Use a disposable database whose name passes the integration safety guard, and
the managed harness for browser/soak infrastructure. Never target production
for destructive tests. On this Windows host, the clean unit execution used
`npm run test:unit --workspace=nexus-vtt -- --maxWorkers=4 --silent`; record runner
teardown errors separately from assertion failures. Split a CI run only with a
complete ledger of its constituent checks, not an implied aggregate pass.

The plan is finished when every required ledger row passes, every discovered
implementation defect has a reviewed repair and regression, and all required
independent/manual/research sign-offs are recorded. A commit, passing six-build
matrix or green coverage percentage cannot substitute for those outcomes.
