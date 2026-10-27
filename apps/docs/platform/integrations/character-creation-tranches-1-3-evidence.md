---
title: Creator tranches 1–3 implementation record
description: Current source, resource and progression repairs, measured checks and remaining acceptance work.
---

# Creator tranches 1–3 implementation record

Updated **2026-10-27**. Repairs began from `38ba98566372f3d229ad572e10236bb9a16f7a50`;
the commit parent for publication is `5e2c4ce2535e7c64e04139d04a30999529a3518f`.
Publication does not establish deployment. **T-01, T-02 and T-03 remain open**;
this record does not replace their [exit criteria](character-creation-remaining-tranches.md).
The previous portable validation artifact remains a historical snapshot.
The first implementation slices were published to `main` as `4d3136f0`.
The follow-up below is based on that commit; publishing code is separate from
closing the acceptance criteria.

## Source and ownership decisions

The [case register](/validation/creator-acceptance-register.json) contains the
29 parent tickets and five separately tracked Q-01 criteria. It retains the
requirements hash, owner/reviewer assignments, devices, source decision and
unrun status. Regenerate it with
`node scripts/validation/capture-creator-case-register.mjs`.

DM owns independent rules review, accessibility review and the shared test
environment. The candidate URL and actual device/AT results remain outstanding.
Assignment is not approval.

The user authorized broad Artificer support, superseding the earlier
Wayfinder-only selection. Use Tasha's Cauldron of Everything (2020) as the legacy
foundation and Eberron: Forge of the Artificer (2025) as the revised foundation.
Merge compatible options while retaining their source; deduplicate equivalent
options and honor replacement features within the selected foundation.
The publisher describes the revised class's replacement item system and changed
preparation rules in its [revised Artificer overview](https://www.dndbeyond.com/posts/2106-whats-new-with-the-artificer-in-eberron-forge-of).
Its [Tasha's Alchemist overview](https://www.dndbeyond.com/posts/908-artificer-101-alchemist-from-tashas-cauldron-of)
provides legacy context. Neither overview substitutes for verification of the
complete class, subclass, spell and item tables. Current Artificer catalog data
remains marked unverified and canonical creation is blocked while imported
records remain preserved. Broad Artificer implementation is **not complete**.

Core source checks use SRD 5.1 and SRD 5.2.1. Source policy now distinguishes
actual SRD members from supplemental content and legacy variants. Tough and
Aasimar are not treated as SRD 5.2.1 members. Twelve revised core subclass
entries replace a malformed JSON catalog; the original bytes are retained as
unverified data for audit.

Source-heading fixtures now cover **319 legacy spell names** and **339 revised
spell names, levels, schools and class lists**. They are extracted from the
official PDFs, with their SHA-256 hashes pinned in the capture script. This
comparison corrected missing revised class lists for Blindness/Deafness and
Antipathy/Sympathy, plus Resilient Sphere's revised Abjuration school. It does
not certify descriptions, effects or the legacy spell-class lists.

The Origin category now follows the publisher's ten PHB 2024 Origin feats.
Older dragon feats remain available as General feats rather than being offered
as Origin grants. Supplemental publication labels use XGtE 2017, TCoE 2020 and
FToD 2021; allowed-source configurations must use those corrected identifiers.
See the publisher's [Origin overview](https://www.dndbeyond.com/posts/1785-the-backgrounds-and-origin-feats-in-the-2024),
[Xanathar source index](https://www.dndbeyond.com/sources/dnd/xgte) and
[Fizban announcement](https://www.dndbeyond.com/posts/1090-preorder-fizbans-treasury-of-dragons-to-unlock-a).

To reproduce the heading capture, install Python's `pypdf` package (capture
verified with 6.14.2), download the two official PDFs linked in the fixtures, and
run from the repository root:

```text
python scripts/validation/capture-srd-spell-headings.py --legacy .codex-local-validation/srd-5.1.pdf --revised .codex-local-validation/srd-5.2.1.pdf
```

The script reads no production catalog and refuses PDFs with a different hash.
Independent DM review remains pending.

On 2026-10-27 the user supplied the [legacy Artificer reference](https://dnd5e.wikidot.com/artificer).
It describes the legacy infusion system, not the revised 2025 plan system.
Its base feature timeline, infusion/item/cantrip counts and Intelligence-based
resource counts now have literal regression assertions. The normalized class
skill list excludes the spurious Survival choice; tool proficiencies now include
Tinker's Tools. Legacy preparation uses Intelligence plus half level, rounded
down, rather than the generic full-caster formula. Infused-item capacity and
stored-spell charges are distinguished from ordinary rest-recovering uses.
This partial source audit does not complete subclass, infusion choices, item
assignments or full Artificer spell-list integration. Canonical Artificer creation
therefore remains blocked rather than accepting an incomplete class.

## Implemented engineering slices

- Shared typed resources carry identity, provenance, maximum, known/unknown
  remaining uses, recovery rules, overrides and manual-operation notes. Fresh
  creation initializes full resources; loading and level changes preserve
  expenditure, unknown historical state, custom counters and retired grants.
- Core class counters use ability-based or level-based maxima and distinguish
  partial recovery, full recovery, unlimited uses and conditional actions.
  Ordinary slots, Pact Magic and feature counters remain separate ledgers.
  Verified subclass counters include Open Hand, Land, Fiend, Devotion, revised
  Berserker/Draconic and Evoker allowances. Paired costs and effects remain
  explicitly manual.
- Forge sheet controls await persistence confirmation. VTT resource commands
  require control permission and the current actor version, use the existing
  PostgreSQL transaction and idempotency boundary, and refresh committed state.
  Short-rest healing uses available Hit Dice and Constitution rather than an
  approximation from maximum HP.
  Forge's existing Second Wind healing button also persists consumption before
  emitting its roll; pending clicks are disabled and a rejected save permits
  retry without emitting healing. Four regression cases cover both editions,
  failed/pending saves and depleted or unknown balances.
- Revised core feature schedules and legacy schedules are edition-specific.
  Expertise eligibility, class quantity metadata, capstone increases,
  high-level HP and derived save proficiencies have dedicated calculations.
  Cantrip invocation metadata remains distinct from automatic roll execution.
- Legacy Warlock invocation counts now cover all twenty levels, including
  cantrip, level and Pact prerequisites and controls that retain invalid
  selections for repair. Repeated Skilled lessons have separate durable choice
  keys. Repeated Magic Initiate lessons retain separate lists, abilities and
  free-use allowances through draft and host serialization.
- Creation and level-up share normalized slot calculation. Level-up preserves
  spent slots across Pact Magic rank changes, damage and resource expenditure;
  it validates HP/ASI inputs and applies retrospective Constitution changes
  without mutating the prior character.

## Measured checks

### Follow-up engineering checks (2026-10-27)

- Added explicit resource correction/recovery in both hosts. The VTT command
  uses actor-version validation, control authorization and the existing receipt
  transaction. Invalid balances and contradictory cooldown states are rejected.
- Recorded game-day cooldowns require explicit day advancement/correction;
  ordinary rests do not imply elapsed days. Cooldowns measured in long rests
  decrement once per long rest, block consumption/casting until finished, and
  survive reconciliation and persistence.
- Level-up now saves new Expertise selections, retains prior Expertise,
  validates eligibility and duplicates, and records actual HP gained in history.
  Required Scholar/Expertise choices have a shared wizard step.
- Spell learning validates class, edition, level, duplicate/known selections
  and separate cantrip/spell counts. Wizard book additions and revised prepared
  additions are saved in their respective lists; the old legacy Ranger known-
  spell cap is corrected. Legacy Paladin/Ranger spellcasting is initialized at
  level two, including slots and derived attack/DC. Planning facts now support
  enumerating higher-level choices without missing abilities.
- Mystic Arcanum, Signature Spells and revised Paladin/Ranger fixed free casts
  bind to the existing class counters. Signature choices must be distinct
  third-level spells in the book. Source spell references are matched to the
  campaign catalog without granting a duplicate fresh pool. The level-up wizard
  confirms these class casting selections and preserves unrelated grants.
- The acceptance register now has **112 individually identified criteria**,
  each linked to starting-point checks, manual instructions or the unresolved
  implementation register. They remain not-run until complete candidate-specific
  evidence and independent expectations are recorded; a linked file is not proof.

The full Forge suite passed **862 tests in 88 files**. The managed browser suite
passed **50 scenarios in one single-worker run**, including both hosts' new
manual-record/cooldown journeys and VTT peer assertions. The subsequent first-
spellcasting boundary repair passed its ten focused progression tests and the
production Forge build. The final creator suite passed **778 tests in 74 files**.
Coverage across six selected new level-up/resource services and controls was
**100% lines and 90% branches**; this is not whole-creator coverage.
The final PostgreSQL suite passed **49 tests in nine files**, including concurrent
manual-record retry and multi-rest cooldown recovery. Game contracts passed
47 tests in 11 files; shared rules passed 51 tests in eight files. Changed files
passed their owning projects' lint rules and creator/Forge/VTT type checks.
Fresh server CodeQL retained 78 raw findings
(23 distinct rule/file/message combinations), with no added combinations against
the preceding candidate. Existing findings still require independent disposition.

### Previous implementation-slice checks

Raw reports are local `validation-tranche-*.log` files, rather than committed
reports containing incidental runtime information.

| Check                           | Result and scope                                                                                                                                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shared creator suite            | 747 tests in 68 files passed with four workers                                                                                                                                                                                                                                                               |
| Focused implementation coverage | 98.39% lines, 94.41% branches across nine selected resource, mechanics, Expertise, legacy invocation and proficiency/UI modules; not whole-app coverage                                                                                                                                                      |
| Forge suite                     | 835 tests in 82 files passed, including four limited-resource action regression cases                                                                                                                                                                                                                        |
| VTT unit suite                  | 2,612 tests in 240 files passed with one worker                                                                                                                                                                                                                                                              |
| Resource panel                  | Five tests passed, including a martial actor without casting profiles and a rejected save                                                                                                                                                                                                                    |
| PostgreSQL integration          | 49 tests in nine files passed against the isolated `nexus_repair_test` database                                                                                                                                                                                                                              |
| Game contracts                  | 46 tests in 11 files passed, including resource command input bounds                                                                                                                                                                                                                                         |
| Type checks                     | Shared creator, Forge and VTT checks passed; container builds also exercise Campaign Studio's older library target                                                                                                                                                                                           |
| Scoped lint                     | Changed Forge/VTT production, unit, integration and browser files passed                                                                                                                                                                                                                                     |
| Monorepo integration            | Lockfile and nine Dockerfile contracts passed; 79 affected-target tests passed                                                                                                                                                                                                                               |
| Server CodeQL                   | Fresh extraction analyzed 78 files with security-extended queries; 78 alerts, with no additions when compared by rule, file and message against the prior hardened baseline. Existing findings still require independent disposition                                                                         |
| Creator CodeQL                  | Fresh extraction analyzed 292 files; two existing insecure-randomness alerts and no additions by rule, file and message                                                                                                                                                                                      |
| Managed browser validation      | Single-worker run: 49 passed, one failed because the new Forge journey expected the wrong layout section. After explicitly selecting Classic D&D, that focused journey passed against the final frontend image (one test, 18.2 seconds). This is separate rerun evidence, not a single 50/50 final suite run |
| Normal managed soak             | Passed: 10 rooms, 40 clients, 10 minutes, conflict probe enabled; event/state ACK p95 181/155 ms, reconnect p95 417 ms, intent success 100%                                                                                                                                                                  |
| Chaos managed soak              | Passed with backend restarts, Redis interruption and database latency: same room/client/duration/conflict settings; event/state ACK p95 557/407 ms, reconnect p95 713 ms, intent success 99.77%                                                                                                              |

The first unrestricted-worker creator run timed out in two UI tests under
concurrent builds; the bounded four-worker suite passed. The first container
build exposed `Object.hasOwn` incompatibility with Studio's library target;
the implementation now uses the compatible own-property check. Failed attempts
are not counted as browser passes.

Both soaks reported zero lost events and zero convergence failures. The chaos
report includes one duplicate event delivery and two intent timeouts; its pass
uses the configured 90% minimum intent success threshold, not a claim that no
retries occurred. Reports are local `apps/vtt/test-results/tranches-1-3-*-soak.json`.
These runs exercise the repaired backend resource/transaction path. Later
Forge-only pending-button changes require their separate host/browser checks.

An attempted two-worker browser rerun passed 48 scenarios and failed two while
shared backend restart scenarios overlapped other tests. The managed suite's
configured single-worker setting has been restored for the final run. A full
two-worker VTT unit run passed 2,610 tests and hit two timeouts. The complete
single-worker rerun passed **2,612 tests in 240 files** without changing test
timeouts or assertions. Neither failed attempt is recorded as a pass.

## Remaining work before closing these tranches

1. Finish supplemental Artificer spell-list, subclass, infusion/item-plan choices
   and the compatible option union. The supplied legacy reference does not
   establish revised 2025 tables. Finish spell-mechanics/equipment audits and
   replace criterion starting-point links with complete independent cases.
2. Complete remaining grant resources, conditional paired operations, explicit
   paired costs/effects and resource restoration. Explicit balance recording,
   daily recovery controls, cooldown enforcement and the listed class free-casting
   bindings are implemented; other conditional operations still require manual
   application. A manual operation is not an automated paired transaction.
3. Complete higher-level replacement flows and the remaining mutation/source
   coverage for repeated grants. Finish level-up choice application and
   cross-path equivalence for derived AC, movement, proficiencies and casting.
   Expertise and the covered spell-learning/free-casting choices are applied;
   remaining mastery/invocation and other class choice application is still open.
   Replace legacy hardcoded feat-spell defaults with validated explicit choices.
4. Connect promised invocation effects to actual sheet/casting actions; saved
   mechanics metadata alone does not establish attack/damage/range automation.
5. Finish remaining higher-level real-host journeys.
   Keep their exact candidate scope distinct from the successful backend soaks.
6. DM performs independent rules review and the actual device/AT tasks using
   the [manual acceptance instructions](character-creation-manual-acceptance.md).

The broad player and engineering guide refresh remains deferred.
