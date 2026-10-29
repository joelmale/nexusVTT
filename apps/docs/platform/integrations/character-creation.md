---
title: Shared character creation engineering guide
description: Implemented package contracts, draft and evaluation pipeline, host persistence and handoff, rollout controls, known defects, and contributor checks for Nexus character creation.
---

# Shared character creation engineering guide

Reviewed on **2026-10-27** against repository `HEAD` **`6d187098`** (Forge
`1.5.3`, VTT `0.1.0`). Every claim below was read from source at that commit;
file references use `path:line` and may drift, so re-check before relying on a
line number. Nothing here was exercised in a deployed build. Test names are
cited as evidence that a behavior is **covered**, not that the suite was run for
this review (see [Validation](#validation-commands-and-evidence)).

Status vocabulary used throughout: **Implemented** (present in source and
reachable from the shipped UI), **Partial** (present with a named gap),
**Not present** (do not document as available), **Open acceptance** (the
[execution records](character-creation-remaining-tranches.md) still list a gate
as open). Support is **not certified**: every `level1Certified` flag is `false`
(`packages/character-creator/src/data/supportManifest.ts`).

Audience routes: players use [Create a character](/forge/character-creation) and
[Bring your character into a VTT game](/vtt/features/character-onboarding).
The accepted decision is [ADR-0002](/vtt/adr/shared-character-creator). The
documentation audit behind this page is the
[coverage matrix](archive/character-creation-docs-coverage.md).

## Ownership and data flow

Paths are relative to the repository root.

| Owner | Responsibility |
| --- | --- |
| `packages/character-creator` | Wizard and guided UI, bundled catalogs, calculators, effect engine, draft/recommendation/evaluation/loadout services, draft storage codec, level-up choice components. **No** account, storage backend or room state. |
| `packages/rules-5e` | Headless math. The evaluator imports `calculatePreparationLimit` from it, and the creator's `package.json` now declares `@nexus/rules-5e`. |
| `packages/character-contracts` | VTT character shape and the conversion target. |
| Forge (`apps/forge`) | IndexedDB persistence, draft repository, recovery dialog, library selection. |
| VTT (`apps/vtt`) | Conversion, account save, storage-worker draft persistence, session handoff, claim/token operations. |

Both hosts import the creator's TypeScript source at build time through
workspace paths and Vite aliases (`packages/character-creator/package.json:6-11`).
VTT creation does not depend on a reachable Forge service.

Completion path in both presentations:

```text
answers (CreationSession) → useCreationSubmission
  → creationDataToDraft (stable IDs) → evaluateDraft → toCharacterCreationResult
  → CharacterCreationResult → host onComplete
```

`useCreationSubmission.ts:98-100` calls `toCharacterCreationResult(evaluateDraft(current))`
for both the full wizard and the guided flow. `toCharacterCreationResult` throws
when the evaluation is invalid or the draft changed after evaluation
(`services/draftEvaluator.ts`, "Character changed after evaluation"), and the
message is shown in the creator. The `buildCharacter` option on the hook bypasses
the evaluator and exists for tests only; neither presentation passes it.

**Partial — preview equality.** The four-screen preview runs `evaluateDraft` on
every render (`FourScreenNewcomerFlow.tsx:182`), but submit rebuilds a draft
from `CharacterCreationData` and re-evaluates it rather than reusing the
previewed object. Equality is covered by `tests/regressionMatrix.test.ts` and
`tests/creatorRepair.test.ts`; no test asserts "previewed object deep-equals
saved result".

## Public entry points

`src/index.ts` is the supported surface. Highlights:

| Export | Purpose |
| --- | --- |
| `CharacterCreator` | Host entry; owns one `CreationSession` and switches presentations. |
| `CharacterCreationWizard`, `GuidedCharacterCreator`, `FourScreenNewcomerFlow`, `PersonalityWizard` | Individual presentations. `FourScreenNewcomerFlow`'s `onComplete` receives `CharacterCreationData`, not a result. |
| `CharacterCreationResult`, `CharacterCreationCompleteHandler`, `CreatedCharacter`, `CharacterCreationData`, `Edition` | Host contract types. |
| `useCreationSubmission` | Save handshake (in-flight guard, cached retry). |
| `toNexusCharacter`, `createdCharacterToNexus`, `UNMAPPED_CREATOR_FIELDS` | Single conversion into the VTT model; also used by Forge JSON import (`apps/vtt/src/services/characterImport/forgeAdapter.ts`). |
| `CreationDraft`, `creationDataToDraft`, `draftToCreationData`, `evaluateDraft`, `toCharacterCreationResult`, `resolveCatalogEntitlements`, `resolveLoadout`, `calculateTotalCurrencyGp` | Draft and evaluation services. |
| `getRecommendation`, `intentToClass`, `generateFirstTurnGuidance`, `CERTIFIED_SUPPORT_MANIFEST` | Recommendation and support data. |
| `createDraftStorageKey`, `save/load/clearDraftFromStorage`, `encode/decodeDraftRecord`, `migrateDraft`, `CURRENT_DRAFT_VERSION` | Draft codec and optional `Storage` helpers. Production hosts use their own repositories (below). |
| `LevelUp*Choices`, `ClassResourceControls`, `featSpellChoice*` | Level-up and resource building blocks used by Forge. |

Not exported: `useCreationSession`, `getClassSupportScopes`, `getSubclassLevel`,
content-provenance helpers.

### `CharacterCreator` props

From `components/CharacterCreator.tsx:23-49`:

| Prop | Behavior |
| --- | --- |
| `isOpen`, `onCancel`, `onComplete` | Required. `onComplete(result)` may return a promise; await your durable save and **throw to keep the creator open**. |
| `edition?` | Initial edition. |
| `theme?` | Written to `data-theme` on the creator root. |
| `initialMode?`, `allowModeSwitch?` | `'guided'` (default) or `'full'`; switching defaults on. |
| `initialDraft?`, `onDraftChange?`, `onDraftDiscard?` | Resume and persistence seams. **`onDraftDiscard` is accepted but never called by creator code** — hosts discard on their own save path (see Forge/VTT below). |
| `initialPresentation?`, `onPresentationChange?` | Restore and report `CreatorPresentation` (mode plus per-mode step positions). |
| `submitLabel?` | Forwarded **only** to the full wizard (`CharacterCreator.tsx:161`); the guided final button ignores it. |

`api/types.ts:44-71` exports a second, near-duplicate `CharacterCreatorProps`;
the component's own interface is exported as `CharacterCreatorComponentProps`.
They are separate types — keep them in step.

**Not present:** host context props for allowed sources, starting level or
capabilities. `allowedSources?: string[]` exists only on `CreationDraft`
(`types/draft.ts:66`); a host can set it through `initialDraft`, and it is then
enforced by `catalogResolver.ts` and `draftEvaluator.ts`.

### `CharacterCreationResult`

`api/types.ts:28-38`: `character`, `creationData`, `edition`, `createdAt`,
optional `combatGuidance`, `creationAttemptId`, `draftId`, `draftRevision`.
`toCharacterCreationResult` sets `character.id = draft.characterId` and the
guidance field, so the UI path does produce `combatGuidance`.

Minimal host (verified against the props above):

```tsx
import {
  CharacterCreator,
  type CharacterCreationResult,
} from '@nexus/character-creator';
import '@nexus/character-creator/styles.css';

<CharacterCreator
  isOpen
  edition="2024"
  initialMode="full"
  allowModeSwitch={false}
  onCancel={close}
  onComplete={async (result: CharacterCreationResult) => {
    await save(result.character); // throw to keep the creator open
    close();
  }}
/>;
```

## Presentations and shared state

* **Guided (default for the component).** `GuidedCharacterCreator` runs
  `FourScreenNewcomerFlow` by default (`flowMode: 'four-screen'`) and links to the
  older `PersonalityWizard` quiz. The four screens are *Intent* (five playstyle
  cards, a **Quick Class Bypass** button per manifest class, optional species),
  *Recommended Hero* (with ability, skill and spell editors), *Equipment & Spells*,
  and *Name & Finalize* (name, alignment, first-turn guidance, **Create
  Character**).
* **Full.** `CharacterCreationWizard` has 14 indexed steps
  (`constants/wizard.constants.ts:5-38`); conditional steps are skipped.
* **Switching.** `CharacterCreator` creates one `useCreationSession`
  (`CharacterCreator.tsx:73`) and provides it by context; both doors read the
  inherited session (`useCreationSession.ts:145`). Draft data, identity, loadout,
  quiz answers and per-mode step positions transfer
  (`tests/creatorSession.test.tsx:15-37`). **Partial:** the four-screen flow keeps
  `selectedIntent`, `explicitClass`, `selectedSpecies` and the name field in local
  React state (`FourScreenNewcomerFlow.tsx:114-140`), so those are not carried
  across a switch. Button labels: **Advanced Mode** (guided → full) and **Use
  guided creation** (full → guided, only when the host allows switching).
* Hosts choose the starting door. Both hosts pass `initialMode='full'` unless a
  rollout flag is set (see [Rollout](#rollout-and-rollback)); Forge's *Personality
  Wizard* method forces `guided` (`apps/forge/src/App.tsx:1608`).

## Draft model

`CreationDraft` (`types/draft.ts:59-120`): `draftVersion: 1`, `revision`,
`attemptId`, `draftId`, `characterId`, `allowedSources`, edition/level/name,
species/lineage/class/subclass/background slugs, `rawAbilityScores`,
`abilityMethod`, bonuses, skills, expertise, style/mastery/origin fields,
languages, tools, `spells`, a resolved `loadout`, narrative fields and
`provenance: Record<string, 'player' | 'recommended' | 'imported'>`.

Lifecycle (`hooks/useCreationSession.ts`):

* `updateCreationDraft` bumps `revision` and records provenance per updated
  `CharacterCreationData` key. Changing a mechanical key (class, background,
  edition, equipment choices) clears the resolved inventory and currency so the
  loadout is re-resolved; narrative edits keep the exact loadout.
* `replaceRecommended` swaps in a regenerated recommendation but copies back every
  key whose provenance is `player`, and preserves draft, character and attempt IDs.
* **Partial:** choosing a class with the bypass or a species in the dropdown stays
  in local component state and is **not** recorded as `player` provenance, so a
  later regeneration may replace it. Edits made through the modals, name and
  alignment are protected. Provenance is per group, not per grant.

### Draft storage codec

`services/draftStorage.ts`: `CURRENT_DRAFT_VERSION = 1`. `isDraft` validates level
1–20, six numeric scores, array shapes, loadout item shape (positive integer
quantities) and non-negative integer currency. `encodeDraftRecord` throws on an
invalid draft. `decodeDraftRecord` returns `ok`, `unsupported` (future version,
raw bytes retained) or `invalid`, validates `pendingCompletion` and presentation,
and falls back to `migrateDraft` for legacy `CharacterCreationData`.
`tests/tamperedDrafts.test.ts` and the draftStorage tests cover rejection.

**Defect (package helpers).** `loadDraftFromStorage` (`draftStorage.ts:256-318`)
accepts any `version === 1` record with a `draft` field without calling `isDraft`,
and `saveDraftToStorage` does not use `encodeDraftRecord`. The raw-`Storage`
helpers therefore bypass the validation the codec offers. Production hosts do not
use them (below); do not adopt them for new hosts.
`isConflict` is advisory only (another tab id within ten minutes).

## Recommendations

`getRecommendation({ intent?, classSlug?, speciesSlug?, edition, level?, name? })`
(`services/recommendationService.ts:173`) returns `{ draft, reasons,
firstTurnGuidance, evaluation }`. `intentToClass`: close combat and archery →
Fighter, sneak → Rogue, cast → Wizard, support → Cleric. Every manifest class is
reachable through the class bypass.

* Species defaults to Human, or Elf for archery, unless the player chose one.
* Background is fixed per intent class (Fighter Soldier, Rogue Criminal, Wizard
  Sage, Cleric Acolyte); all other classes receive Soldier.
* Starter spell packages exist for Wizard, Cleric, Warlock, Sorcerer, Bard and
  Druid; other casters are padded from the class list. **Artificer has no ability
  profile and recommendations are marked unsupported for it** (`recommendationSupported: false`).
* Reasons are returned in the result, **not stored on the draft**; only the
  `recommended` provenance tag persists. The reason text is a template.

## Evaluation, entitlements and support policy

`evaluateDraft` (`services/draftEvaluator.ts:249`, `EVALUATOR_VERSION` `1.1.0`):
resolve loadout → structural checks (level, equipment-choice indexes) → catalog
and entitlement resolution (`MISSING_*`, `INVALID_*`, under-entitled or duplicate
skills, missing fighting style, source permissions via `allowedSources`) → on a
hard catalog error return early without a character → `calculateCharacterStats` →
validators for spellcasting (cantrip count, six-spell Wizard book, preparation
limit through `rules-5e`, known-spell count, list/level membership), casting
sources, class grants, origin choices and feat entitlements. The result carries a
`draftFingerprint` and `draftRevision`; `isValid` means no error-level issue, not
that the build is certified.

`data/supportManifest.ts` lists 13 classes (including Artificer), each with both
editions, **all `level1Certified: false`**, and every scope from
`getClassSupportScopes()` has `certified: false`. Artificer creation is
`blocked-unverified-source`; other classes are `implemented-awaiting-acceptance`.
The export name `CERTIFIED_SUPPORT_MANIFEST` is historical — treat it as a
support inventory. `data/contentProvenance.ts` separates SRD 5.1 / SRD 5.2.1 core
content from supplemental or unverified sources; unverified sources are rejected
by `isPermittedContentSource`.

Independent reference coverage exists as tests, not certification:
`referenceBuilds.test.ts` (F14/F24/R14/R24/W14 and more), the per-class
`*References.test.ts` files, `supportCertification.test.ts`,
`supportInventory.test.ts` and `regressionMatrix.test.ts`. The matrix exercises
services and conversion, **not** rendered hosts.

The effect-based `rulesEngine` remains separate; do not infer rules-engine
adoption from `VITE_USE_RULES_ENGINE`. Keep rules claims anchored to primary
sources: SRD 5.1 and SRD 5.2.1 for core content, and the publisher's source
pages named in the [tranche record](archive/character-creation-tranches-1-3-evidence.md)
for supplemental content.

## Loadouts, currency and equipped state

`resolveLoadout` (`services/loadoutResolver.ts`) turns class/background options,
explicit currency and starting inventory into items with integer quantities,
equipped flags and source (`class | background | purchased | custom`). Currency
covers `cp/sp/ep/gp/pp`; `calculateTotalCurrencyGp` values electrum at 0.5 gp and
totals **coin value only**. Equipped-slot logic covers armor, shield, main hand,
two-handed and off hand (lines 234-287). Starting gold defaults to 50 gp. A
populated loadout is returned unchanged, which is why mechanical edits clear it
(see Draft model).

## Submission, identity and retry

`useCreationSubmission` (`components/CharacterCreationWizard/hooks/useCreationSubmission.ts`):

* The character ID is `draft.characterId`, stable for the draft/session — **not**
  a new UUID per attempt.
* `inFlight` and `completed` refs block concurrent and duplicate submits.
* The first successful build is cached in `pendingResult`; if `onComplete`
  rejects, the retry calls `onComplete` with the **same** result and ID.

**Defect — stale retry cache.** `pendingResult` is never cleared on failure, and
the cached branch runs before any rebuild (`useCreationSubmission.ts:67-70`).
Reproduction: make `onComplete` reject once; edit an answer in the still-open
creator; click the final button. The host receives the original result, not the
edited one. (Hosts that freeze completion into the persisted draft, below, behave
the same by design after a reload — "Retry previous save" replays the frozen
result.) Idempotency is in memory; reload relies on the host's persisted draft.

## Host: Forge

* **Wrapper.** `ForgeCharacterCreator.tsx` renders `CharacterCreator` in a
  `<dialog>`, used from `App.tsx:1593-1612` (full wizard and personality door)
  and `routes/CharacterForgeRoute.tsx` (`/character-creator`, hard-coded 2024,
  `submitLabel="Save Character"`).
* **Storage.** IndexedDB `NexusForge` v14: `characters` and `characterDrafts`
  stores (`services/storage/IndexedDbAdapter.ts:11-19`) behind `IStorageService`.
  `addCharacter` uses `put`, so a retried save overwrites rather than duplicating
  (`IndexedDbAdapter.drafts.test.ts`).
* **Draft and recovery.** One draft slot per browser, key `forge:local:creation`
  (`ForgeCharacterCreator.tsx:44`). `hooks/useCreatorRecovery.ts` loads on open
  and offers **Resume creation**, **Retry previous save**, **Export recovery
  copy** (`nexus-character-draft.json`) and **Discard draft and start new**. A
  serialized write queue with a revision check rejects writes from a second tab
  ("Draft changed in another tab").
* **Completion.** flush draft → freeze completion → `onComplete` → discard draft
  **only after the host save succeeded**. A failed save keeps the frozen result
  for retry. `App.tsx:333-348` adds the character, reloads the list, selects it and
  shows a "created" toast.
* **Not present in Forge:** first-turn guidance cards (only in the creator's final
  guided screen); a persisted rollout flag (below); account sync.
* **Level-up.** `LevelUpWizard` includes Eldritch Invocation and Weapon Mastery
  steps (`LevelUpWizard.tsx:180-201`) backed by shared `LevelUp*Choices`.
* **Sheet actions.** `AttacksAndActions.tsx` builds attack/damage rolls and renders
  `ClassResourceControls`. The edit form is a manual editor; there is no
  dedicated "manual override" UI beyond editing values.

## Host: VTT

* **Wrapper.** `SharedCharacterCreator.tsx`. Before the creator opens it asks
  **Use 2014 rules / Use 2024 rules** unless a draft supplies the edition (lines
  197-207). `allowModeSwitch` is on.
* **Draft.** Key `vtt:<playerId>:<room|standalone>:creation`, stored in a
  storage-worker IndexedDB (`apps/vtt/src/workers/storageWorker.ts`). A legacy
  `nexus_draft_vtt_<player>` localStorage envelope is imported, not deleted, and
  removed on discard (`SharedCharacterCreator.tsx:33-61`). Same recovery dialog and
  hook design as Forge (`apps/vtt/src/hooks/useCreatorRecovery.ts`).
* **Pipeline** (`SharedCharacterCreator.tsx:103-137`): flush → freeze →
  `createdCharacterToNexus` → stamp `rulesCatalogVersion` →
  `characterStore.saveCreatedCharacter` (POST `/api/characters` with
  `creationAttemptId` and `draftRevision` when authenticated; server
  `createCharacterOnce` in `apps/vtt/server/routes/api.ts:865-890` is idempotent,
  409 on conflict; local cache failure does not fail creation) →
  `handoffSavedCharacter` (`services/characterHandoff.ts`) → discard draft, toast,
  `onComplete`.
* **Handoff outcomes.** No session → *saved*. Host user → *accepted* without a
  network send. Non-host → `sendPlayerIntent({ kind: 'submit-character' })` over
  WebSocket (`playerIntentClient.ts`, 8 s timeout resolving `host-offline`), applied
  by the host client in `playerIntentApplier.ts:136-153`, which rejects
  `not-owner`, forces the submitter as owner and upserts. A non-applied result
  throws, so the creator stays open and the frozen draft supports retry.
* **Not present:** a persistent "awaiting GM" state or approval queue. Feedback is
  a transient toast and thrown errors. The player is never given a token
  automatically; the "ask the DM to place a token" message is computed from the
  player's local scene state (`characterHandoff.ts:36-44`) and can lag the host.
* **Simple Player Mode** reuses `SharedCharacterCreator` through the claim modal
  (`SimplePlayerShell.tsx:63-65, 251-258`). Entry is `/play/:roomCode`
  (`main.tsx:104-112`); the DM invite card (link, copy, share, QR) is mounted in
  `LobbyPanel.tsx:262`.

## Known defects and discrepancies

Report-only; no runtime code was changed by this documentation work.

| # | Evidence | Reproduction / effect |
| - | --- | --- |
| 1 | `apps/vtt/src/components/CharacterPanel.tsx:127-130`; `playerIntentApplier.ts:136` — no spectator check | Join `/play/CODE` with watch-only, switch to Full VTT, open **Characters**: **Create** is offered and a submission is applied. The onboarding banner correctly hides for spectators (`GameUI.tsx:84`). |
| 2 | `useCreationSubmission.ts:67-70` | Stale retry after edit (above). |
| 3 | `packages/character-creator/src/services/draftStorage.ts:256-318` | `loadDraftFromStorage` skips `isDraft`. |
| 4 | `apps/forge/src/App.tsx:482-483` | Importing the same Forge backup twice creates duplicate characters (new UUID each time). |
| 5 | `apps/forge/src/App.tsx:434-443` | Export `postMessage` uses target origin `*` and sends full character data to any parent/opener. |
| 6 | `apps/forge/src/services/dbService.ts:13`; `VttSocketAdapter.ts:35-39` | `setStorageAdapter` has no callers; the adapter has no draft methods and `addCharacter` returns the id without saving when no API exists. Do not wire it without both fixes. |
| 7 | `IndexedDbAdapter.ts:73-76`; `ForgeCharacterCreator.tsx:44` | Single Forge draft slot: two tabs (or both doors) conflict. |
| 8 | `GameUI.tsx:81` | Desktop onboarding banner dismissal is in memory; it returns after reload. |
| 9 | `SharedCharacterCreator.tsx:28, 79-85` | `isModal` prop is declared and unused. |
| 10 | `tests/unit/components/SharedCharacterCreator.test.tsx` | Despite its name it drives `CharacterCreationWizard`, not the host component. Host behavior is covered by `creationSubmission.test.tsx`, `useCreatorRecovery.test.ts`, `characterHandoff.test.ts` and the e2e matrix. |
| 11 | `FourScreenNewcomerFlow.tsx:114-140`; `useCreationSession.ts:105-135` | Class/species picks are not `player` provenance (above). |

## Rollout and rollback

The only rollout control found is a runtime global,
`globalThis.__NEXUS_CREATOR_FLAGS__.guidedDefault`, read by identical
`creatorCapabilities.ts` files in Forge and VTT (`apps/*/src/services/creatorCapabilities.ts`).
Strictly `true` makes guided the starting door; otherwise **full**. Nothing in the
repository sets it, so both hosts open the full wizard by default. A previously
saved presentation overrides the flag (`ForgeCharacterCreator.tsx:153`). There is
no `VITE_` creator variable. The flag changes presentation only; reverting it does
not alter saved data or calculations. A staged-release and rollback runbook,
moderated study and recorded pilot **do not exist** — the
[implementation plan](archive/character-creation-implementation-plan.md) status reflects
that.

## Accessibility and styling

`CreatorDialog` uses a native `<dialog>` with `showModal`, `aria-modal`, an
`aria-label`, Escape/cancel handling, a manual Tab trap and focus restore; the
guided flow uses it. Error banners use `role="alert"`; controls use 44 px minimum
heights. Forge's recovery dialog also uses `<dialog>`. An automated axe audit at
320/390/768/1440 px exists in the e2e matrix
(`apps/vtt/tests/e2e/support/creatorAccessibility.ts:8-10`; it skips unless a
managed stack is available). **Real device, screen-reader, zoom and keyboard
acceptance (T-08) was waived by the owner on 2026-10-27 and is excluded, not
passed.** Do not state the creator is accessibility-certified.

Styling: `scripts/build-styles.mjs` scopes `src/styles/creator-theme.source.css`
to `.nexus-character-creator`, emitting `dist/creator.css` (`./styles.css`). Any
blanket VTT element rule must exclude that subtree. New UI uses CSS Modules and
tokens (ADR-0006); do not add Tailwind.

## Existing characters

Creation drafts describe new characters only. There is no automatic repair or
re-evaluation of saved sheets. Preserve stored choices, manual values, current HP
and resource usage, and any existing `rulesCatalogVersion`. Resource and
manual-recovery behavior lives in `ClassResourceControls` and
`services/resourceLifecycle.ts`; hosts own persistence.

## Extending the creator

Record edition, permitted source and an **independent** expected value (primary
rules text, not another calculator) before advertising content.

| Change | Edit | Required tests |
| --- | --- | --- |
| Class / subclass | SRD and enhanced class data via `services/dataService.ts`, `data/progressions/*`, `supportManifest.ts` entry (subclass levels, `recommendationSupported`) | Reference build in `src/tests/*References.test.ts` for each edition; update `fixtures/supportInventory.json` by running `scripts/capture-support-inventory.ts`; catalog/entitlement fixture; UI choice test; conversion preservation. |
| Background | `data/backgrounds.json` (explicit edition and slug) | Both lookups, ability allocation continuity, skill overlap, tools/languages, coin alternatives, exact inventory. |
| Feat | Feat catalogs and `utils/featUtils.ts` | Eligibility, follow-up choices (`featSpellChoices`), exactly-once effects, draft round-trip, VTT conversion. Presence in data does not mean supported. |
| Recommendation | `recommendationService.ts`, `guidanceService.ts` together | Explicit class/species preservation, deterministic choices, four-screen payload. |
| Spell package | Package table in `recommendationService.ts`; `data/supplementalSpells.ts` for non-SRD | Slug validity per edition, counts, `spellSourceAudit.test.ts`. |
| Host integration | Consume `CharacterCreator`, `CharacterCreationResult` and `createdCharacterToNexus`; supply identity, storage and recovery | Rejected save, retry after partial save, cancel, resume, and session acknowledgement; add a host e2e case. Reuse the existing repository/recovery-hook pattern rather than `Storage` helpers. |

Adding a field requires decisions for `CharacterCreationData`, `CreationDraft`,
both adapters, evaluator, `CreatedCharacter`, conversion (`UNMAPPED_CREATOR_FIELDS`
with a reason if lossy) and host persistence. Never add a second creator or
calculator.

## Validation commands and evidence

Each script was confirmed in `package.json` at the reviewed commit. Run from the
repository root:

```bash
npm run test:character-creator
npm run type-check --workspace=@nexus/character-creator
npm run test --workspace=nexus-forge -- --run
npm run test:unit --workspace=nexus-vtt
npm run build:forge
npm run build:vtt
npm run test:docs
```

If workspace dependencies, Docker inputs or CI targets change, add
`npm run check:workspace-lock`, `npm run check:docker-build-contracts` and
`npm run test:affected-targets`. Browser coverage uses `npm run test:e2e
--workspace=nexus-vtt` (managed stack; the creator host matrix skips without it).
`npm run build --workspace=@nexus/character-creator` regenerates scoped CSS only.

The results of the checks run for this documentation pass are recorded in the
[coverage matrix](archive/character-creation-docs-coverage.md#validation-performed).
