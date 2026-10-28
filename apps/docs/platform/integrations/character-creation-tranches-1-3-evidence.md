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

### T-04 batch A: Barbarian and Monk references (2026-10-27)

Four records (B14, B24, M14, M24) were added to `referenceBuilds.ts`. Their
expected values were calculated by hand from SRD 5.1 and SRD 5.2.1 (class
tables, species, backgrounds, pack contents) before comparing with the
evaluator, and a dedicated `barbarianMonkReferences.test.ts` asserts hit dice,
Rage resources and recovery, kit quantities, masteries and Magic Initiate
casting separation after a JSON round trip. Independent human review of these
expectations is still outstanding, so they are not yet counted as approved
references. Fourteen class/edition records remain.

The independent calculation exposed five defects, each repaired with data or
code and covered by a regression:

- `criminal-2024` listed 15 gp and Dark Common Clothes; SRD 5.2.1 gives 16 GP
  and Traveler's Clothes. The existing R24 oracle had inherited the wrong 15 gp
  (it expected 23 gp); it now expects 24 gp.
- `half-orc` (SRD 5.1) had empty ability bonuses; it now grants STR +2, CON +1.
- Half-Orc's Menacing never granted Intimidation proficiency.
- The 2014 Elf Keen Senses check matched `half-elf`, which has no such trait.
- 2024 characters received the SRD 5.1 Explorer's Pack and Dungeoneer's Pack
  contents. Explorer's, Dungeoneer's and Burglar's packs now follow SRD 5.2.1
  for 2024 characters (the Entertainer's Pack is still unmodeled).

### T-04 batch B: Bard and Sorcerer references (2026-10-27)

Four more records (BD14, BD24, SC14, SC24) follow the same method, with
dedicated assertions in `bardSorcererReferences.test.ts` (hit dice, cantrip and
slot counts, known versus prepared ledgers, Bardic Inspiration and Innate
Sorcery, both editions' Entertainer's Packs, and separate lineage/feat/class
casting ledgers). They await independent review. Ten class/edition records
remain: Cleric, Druid, Paladin, Ranger and Artificer.

Defects found and repaired:

- SRD 5.2.1 Gnomish Lineage was not modeled. Forest and Rock Gnome now create
  their own casting sources (Forest: Minor Illusion and Speak with Animals with
  Proficiency Bonus free casts; Rock: Mending and Prestidigitation), with the
  casting ability chosen from INT/WIS/CHA.
- The Entertainer's Pack was unmodeled in both editions; it now expands per
  SRD 5.1 and SRD 5.2.1.
- A full comparison of the bundled 2014 class spell lists with the SRD 5.1
  Spell Lists found three omissions: Faerie Fire (Bard), Divination (Cleric)
  and Meld into Stone (Druid). They are repaired and pinned by
  `legacySpellLists.test.ts`. Entries on a list that the SRD does not show (for
  example Arcane Eye on Cleric, Create Food and Water on Druid) were left in
  place pending a provenance decision. The same comparison against SRD 5.2.1
  found the 2024 lists consistent, apart from entries that need a manual check
  (Phantasmal Force on Bard, Sorcerer and Wizard; Mind Spike on Sorcerer).

### T-04 batch C: Cleric and Druid references (2026-10-27)

Four records (CL14, CL24, DR14, DR24), with assertions in
`clericDruidReferences.test.ts`: Divine and Primal Order effects and their
Wisdom-based Arcana/Religion/Nature bonuses, separate Magic Initiate, Drow
lineage and Druidic casting ledgers, each edition's Priest's and Explorer's
Packs, and proficiencies. They await independent review. Six records remain:
Paladin, Ranger and Artificer.

Defects found and repaired: the 2014 Life Domain granted neither its always
prepared domain spells (Bless and Cure Wounds, then the SRD 5.1 list at Cleric
levels 3, 5, 7 and 9, kept separate from the Cleric's prepared spells) nor its
heavy armor proficiency. One authoring error was also caught by validation, not
the app: Acolyte offers INT/WIS/CHA, so the first DR24 draft's CON increase was
rightly rejected.

### T-04 batch D: Paladin and Ranger references (2026-10-27)

Four records (PL14, PL24, RG14, RG24), with assertions in
`paladinRangerReferences.test.ts`: the edition split in spellcasting onset (no
slots or prepared spells at level one in 2014, two slots and two prepared spells
in 2024), Lay On Hands, 2014 Divine Sense, Favored Enemy with Hunter's Mark kept
out of the prepared count, weapon masteries, armor proficiencies, the Wood Elf
lineage ledger, and each edition's packs. All twelve non-Artificer class
records now exist for both editions (24 with Fighter, Rogue, Wizard and Warlock)
and await independent review. Only the two Artificer records remain; they depend
on the T-01 source work.

No numeric or ledger defect surfaced in this batch. One open gap was recorded:
the Soldier background's gaming set choice is saved as the placeholder "Gaming
Set (choose one)" instead of the player's choice (`it.todo` in the test file).

### T-03 invocation effects on the sheet (2026-10-27)

The saved `classMechanics.cantripEffects` metadata was previously unused by any
host. A shared `resolveCantripAction()` now turns a known cantrip, the
character's level and those saved effects into a concrete action: attack bonus
or save DC, damage dice with cantrip scaling at levels 5, 11 and 17,
Eldritch Blast beam counts, Agonizing Blast's per-roll Charisma bonus, Eldritch
Spear's range increase (30 feet times Warlock level) and Repelling Blast's
10-foot push. Forge's Attacks and Spellcasting panel lists each damaging cantrip
and emits one attack and damage roll per beam. The 2024 catalog's
`cantripUpgrade` text is now exposed on `AppSpell`.

Not yet done: the VTT spellbook and actor projection do not carry
`classMechanics`, so the VTT neither shows nor applies these effects; pushes and
Large-or-smaller size limits are reported as notes, not enforced; and Devil's
Sight, Lessons of the First Ones and other non-cantrip invocations remain
descriptive. Damaging cantrip damage is parsed from spell text because the 2024
catalog has no structured dice.

### T-03 level-up invocation and mastery application (2026-10-27)

`LevelUpChoices.eldritchInvocationsChosen` and `weaponMasteriesChosen` were
declared but ignored, so a leveling Warlock could never take the invocations
the class table grants. `applyLevelUp` now validates and applies them. Each list
is the complete new selection (so a level-up can swap an earlier pick) and is
checked with the same rules as creation: the SRD 5.2.1 invocation count for the
new level, level and prerequisite requirements, duplicates, eligible cantrip
targets, and mastery count and class proficiency. Rejected choices throw before
any change, and `classMechanics` (Agonizing Blast and the other cantrip
effects) is recomputed from the new selection. A category the player did not
touch is left alone. Two further defects were found while testing: an
"eligible targets" error was silently filtered out of the first version, and
the creator test runner needed the same 20-second timeout as Forge for one
load-sensitive test.

Update: the Forge level-up wizard now has an invocation step (all Warlock levels
where the SRD 5.2.1 count grows: 2, 5, 7, 9, 12, 15 and 18) and a weapon mastery
step (when the class's mastery count grows). Both are shared components
(`LevelUpInvocationChoices`, `LevelUpWeaponMasteryChoices`) driven by the same
validators as `applyLevelUp`, so the UI cannot offer a pick the level-up would
reject; the confirm step lists the picks. They are covered by component tests
and have not been exercised in a browser session.
Invocation selection at level-up is limited to the 2024 rules; 2014 Warlocks
return a clear error. Mastery counts that grow at a level are not yet required
by the wizard.

### T-01 Artificer source audit (2026-10-27)

The supplied legacy reference (class page and spell list page) was fetched and
committed as `artificerLegacyReference.json`, with its limits recorded: it is a
third-party transcription of Tasha's Cauldron of Everything plus later material
(Unearthed Arcana, Fizban's, Spelljammer), not the book, and it does not cover
the revised 2025 class. `artificerReference.test.ts` verifies against it:

- The 20-level slot table matches `classSpellSlots('artificer', '2014', n)` at
  every level, and the infusion, infused item and cantrip counts already
  matched.
- The reference list has **103 spells**; **70 resolve** to spells in the bundled
  SRD 5.1 catalog (four under their SRD names, for example Faithful Hound), and
  **33 do not exist in the catalog**. Those 33 (for example Booming Blade,
  Absorb Elements, Tasha's Caustic Brew, Summon Construct, Bigby's Hand) are
  non-SRD spells whose text cannot be added without a licensed source.
- No bundled spell yet carries `artificer` in its class list, and a test keeps
  that true while the class is blocked, so a partial list cannot appear as
  supported by accident.

Decision needed from the owner before this can close: either supply or license
the non-SRD spell text and the revised 2025 Artificer tables, or record an
explicit scope decision that Artificer supports only the SRD-resolvable subset
(70 spells) with the rest visibly unsupported. Neither is assumed here, and
Artificer creation remains blocked.

### T-05 tampered drafts and the multiclass boundary (2026-10-27)

`tamperedDrafts.test.ts` applies 20 kinds of tampering to all 24 reference
builds at the canonical evaluator boundary (unknown or duplicate skills,
cantrips and spells, spells above the character's slots, background bonuses on
the wrong abilities or too large, wrong-edition and unknown species,
backgrounds and classes, out-of-range levels and ability scores, a class change
that keeps stale answers, and a corrupt equipment selection). A first probe
found the evaluator already rejected 17 of the 20 for every build that the
mutation applies to; the other three were real gaps and are repaired:

- Level 0 was accepted: the draft adapter turned it into level 1 with
  `data.level || 1`, and nothing validated the range. Levels outside 1-20 or
  non-integers now raise `INVALID_LEVEL`.
- An equipment selection index outside the option list (for example 99) was
  accepted for every build. It now raises `INVALID_EQUIPMENT_CHOICE`; an unmade
  (null) choice is still allowed.
- The 2014 High Elf's bonus Wizard cantrip was allowed but not required, so a
  record missing it passed.

A rejected draft keeps the player's other answers (expertise, origin feat and
weapon mastery are asserted unchanged). The mutation list does not yet cover
disallowed-source policy or every grant family; those remain open under T-05.

Multiclass contract: the saved character contract has one `class`, `classSlug`
and `level`, so multiclass characters can be neither authored by the creator
(the support inventory already records `creatorAuthoring: false`) nor stored
losslessly. An imported multiclass record would be reduced to a single class.
That is recorded here as an explicit limitation, not validated support. What is
verified is the shared slot calculator: `multiclassTable.test.ts` pins the
20-row SRD multiclass slot table, Paladin/Ranger half-level rounding (up in
2024, down in 2014), exclusion of Pact Magic, and non-casting classes. Eldritch
Knight and Arcane Trickster are not in either SRD and are not verified.

### Legacy Artificer spells and tool proficiencies (2026-10-27)

The 29 official spells on the legacy Artificer list that the SRD does not contain
are now in the catalog as **mechanics-only** entries (level, school, timing,
range, components, duration, and the damage or saving throw numbers the sheet
needs) in `supplementalSpells.ts`. Their rules text is deliberately not
bundled because the descriptions are published, copyrighted text and the
repository is public; the description field says so, and `textNotBundled` marks
them. The three Unearthed Arcana playtest spells are excluded. Bigby's Hand
resolves to the SRD's Arcane Hand, so the SRD side is 71 spells; with the 29
supplemental entries the legacy Artificer list is 100 spells, tagged only on
2014 spells (the revised 2025 Artificer list is unverified, so no 2024 spell
carries it). Artificer creation itself stays blocked.

Tool proficiencies gained two fields on catalog tools: `relatedSkills` (the
skills a proficiency can inform) and `proficiencyGroup`, plus the missing Land
and Water Vehicles proficiencies. The SRD already supplied each tool's ability,
cost, weight, craftable items and utilize DCs.

Campaign Studio's compendium showed "No description provided" for every tool
because SRD 5.2 lists most gear with structured fields and no prose, and the
catalog's `text` came only from a `description` field (100 of 213 items had
none). The converter now builds a factual summary from those fields when there
is no prose (ability and utilize DCs for tools, damage, properties and mastery
for weapons, armor class and requirements for armor). Already-seeded catalogs
need a reseed to pick this up.

Single source of truth: doc-api carried a committed copy of the creator
package's 2024 equipment (`equipment-2024.json`, identical content). The copy is
removed; the build now copies the shared file into `dist/data`, the image build
copies it from the package, CI rebuilds doc-api when it changes, and the
seeder's monorepo fallback path (which had an off-by-one) is fixed. The 2014
equipment and classic magic item files remain doc-api-only; they are sole
copies, not duplicates, and moving them into the shared package is open work.

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
   Level-up Fey Touched and Artificer Initiate spells now come only from explicit,
   catalog-validated `featChoices` (no invented Charm Person/Identify/Mending
   defaults), and feat-granted spells no longer skip non-casters. The Artificer
   catalog has no spells yet, so Artificer Initiate grants nothing until T-01
   source work lands. Remaining legacy fixed-spell feats (for example Drow High
   Magic and Wood Elf Magic) are fixed by their rules text; confirm that per
   feat. The Forge level-up ASI/feat step now offers these choices (shared
   `featSpellChoices` rules) and requires a legal one; the creation wizard does
   not yet.
4. Connect promised invocation effects to actual sheet/casting actions; saved
   mechanics metadata alone does not establish attack/damage/range automation.
5. Finish remaining higher-level real-host journeys.
   Keep their exact candidate scope distinct from the successful backend soaks.
6. DM performs the independent rules review. The actual device/AT tasks were
   **waived by the owner on 2026-10-27** (status excluded, not passed; no
   accessibility conformance is claimed). The [manual acceptance instructions](character-creation-manual-acceptance.md)
   remain available if that decision is reversed.

The broad player and engineering guide refresh remains deferred.
