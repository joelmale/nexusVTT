---
title: Shared character creation engineering guide
description: Current package contracts, host ownership, candidate draft services, validation limits, and contributor checks for Nexus character creation.
---

# Shared character creation engineering guide

Reviewed on **2026-10-24**, against `edd07ca9` plus the local character-creation
candidate. The four-screen flow, draft services, evaluator, recommendations and
support manifest include uncommitted changes. Their presence in this checkout
does **not** establish that a deployed Forge or VTT has them. See the
[review and verification record](character-creation-review.md) for build evidence,
test results and unresolved defects, and the
[implementation plan](character-creation-implementation-plan.md) for the remaining
acceptance gates.

This is the maintained engineering explanation. Player instructions live in
[Forge character creation](../../forge/character-creation.md) and
[VTT getting started](../../vtt/getting-started.md). The accepted
[shared-creator ADR](../../vtt/adr/0002-shared-character-creator.md) records why the
package is imported at build time.

## Ownership and data flow

All source paths below are relative to the repository root.

| Owner | Current responsibility |
| --- | --- |
| `packages/character-creator` | Creator UI, bundled creation catalogs, its character model, calculators, rules-engine modules, draft adapters and candidate recommendation/evaluation services. |
| `packages/character-contracts` | Shared VTT character and Forge import shapes, proficiency/skill types and basic helpers. This is the conversion target, not a host persistence service. |
| `packages/game-contracts` | Shared domain schemas, identity, actors, casting profiles, commands and receipts; depends on character contracts. |
| `packages/rules-5e` | Headless shared math, progression, casting/preparation and catalog-key helpers; depends on game contracts. |
| `packages/rules-contracts` | Rules publication schemas and fixtures. It does not own the creator's local draft or wizard state. |
| Forge | Chooser/edition context, its IndexedDB adapter by default, sheet selection and post-save actions. |
| VTT | Account/player identity, conversion, catalog-version recording, account persistence, local cache and separate session/claim/placement operations. |

The creator's manifest currently depends on `@nexus/character-contracts`; it does
**not** depend on `@nexus/rules-5e`. Do not describe the plan's proposed
`character-creator → rules-5e → game-contracts → character-contracts` chain as an
implemented evaluator migration. Add shared generic rules at their existing
headless boundary after independent review; avoid introducing host or creator
imports into those packages.

Both applications resolve the creator's TypeScript source through workspace
configuration. Forge still federates its character sheet separately. Creation
does not require a running Forge remote when launched in VTT.

The current UI completion path is:

```text
Full wizard answers or guided answers
  → useCreationSubmission
  → calculateCharacterStats
  → CharacterCreationResult
  → host save callback
```

The candidate also exports a second, explicit service path:

```text
CharacterCreationData → creationDataToDraft → CreationDraft
  → evaluateDraft → DraftEvaluationResult
  → toCharacterCreationResult → host
```

The four-screen flow calls `getRecommendation()`, which evaluates a generated
draft for its recommendation result. **Actual UI submission still uses the first
path.** Neither creator presentation submits through `evaluateDraft()` or
`toCharacterCreationResult()`. Treat preview/final validation parity as incomplete.

## Public entry points and completion contract

Prefer `CharacterCreator` when a host wants the package's guided/full selector.
Forge currently renders the individual `CharacterCreationWizard` and
`GuidedCharacterCreator` exports from its own chooser; VTT renders
`CharacterCreator` through `SharedCharacterCreator`.

| Export | Purpose |
| --- | --- |
| `CharacterCreator`, `CreationMode` | Selects `guided` or `full`; default mode is `guided`. |
| `CharacterCreationWizard`, `WizardProps` | Full presentation with 14 indexed steps and conditional navigation. Higher-level steps remain a compatibility path, not newly certified support. |
| `GuidedCharacterCreator` | Guided modal; the candidate starts with `FourScreenNewcomerFlow` and offers the older personality quiz. |
| `FourScreenNewcomerFlow`, `FourScreenNewcomerFlowProps` | Lower-level candidate presentation. Its completion callback receives `CharacterCreationData`, not `CharacterCreationResult`. |
| `CharacterCreationResult`, `CharacterCreationCompleteHandler` | Host save contract shared by the full and guided modal wrappers. |
| `CreatedCharacter`, `CharacterCreationData`, `Edition` | Creator model, legacy answer model and `'2014' \| '2024'`. |
| `createdCharacterToNexus`, `toNexusCharacter`, `ToNexusCharacterOptions` | Creator/Forge JSON conversion into the shared VTT character model. |
| `useCreationSubmission` | Shared asynchronous save/error guard; hosts can test the same handshake. |
| Draft, recommendation, evaluation, loadout and storage exports | Candidate services described below; exporting them does not mean all UI paths use them. |

`CharacterCreatorComponentProps` is the alias exported for the actual component
props in `components/CharacterCreator.tsx`. `CharacterCreatorProps` is separately
exported from `api/types.ts`. They currently describe the same host surface; keep
both compatible when evolving it. `WizardProps` excludes mode controls.

| Prop | Current behavior |
| --- | --- |
| `isOpen` | Required; the component renders nothing when false. The host controls visibility. |
| `edition?` | Initial edition. The full wizard can change it in its first step. The guided wrapper defaults to 2024 when omitted. |
| `theme?` | Written to `data-theme` on the creator root. VTT resolves its theme explicitly. |
| `initialMode?`, `allowModeSwitch?` | `CharacterCreator` only; defaults are `guided` and `true`. Mode changes remount the child. |
| `initialDraft?`, `onDraftChange?`, `onDraftDiscard?` | Candidate resume/change/discard seams. Their current limitations are listed below. |
| `submitLabel?` | Used by the full wizard; the guided wrapper does not forward a custom label to its final button. |
| `onCancel` | Required; tells the host to dismiss. Cancellation does not itself clear storage. |
| `onComplete` | Required; `(result: CharacterCreationResult) => void \| Promise<void>`. Await durable host save before resolving. |

The result contains `character`, `creationData`, `edition` and ISO `createdAt`.
The candidate adds optional `combatGuidance`. `toCharacterCreationResult()` sets
that field; `useCreationSubmission()` currently omits it. The host must not assume
it is present after a real UI save. `creationData` contains creation answers, not
an exhaustive provenance ledger or a lossless replay format for every draft.

This minimal host uses actual public exports and keeps save failures inside the
creator. It deliberately selects the full presentation for a host that has already
chosen its experience:

```tsx
import { useState } from 'react';
import {
  CharacterCreator,
  type CharacterCreationResult,
  type CreatedCharacter,
} from '@nexus/character-creator';
import '@nexus/character-creator/styles.css';

interface HostCharacterCreationProps {
  saveCharacter: (character: CreatedCharacter) => Promise<void>;
}

export function HostCharacterCreation({
  saveCharacter,
}: HostCharacterCreationProps) {
  const [isOpen, setIsOpen] = useState(true);

  async function complete(result: CharacterCreationResult): Promise<void> {
    await saveCharacter(result.character);
    setIsOpen(false);
  }

  return (
    <CharacterCreator
      isOpen={isOpen}
      edition="2024"
      initialMode="full"
      allowModeSwitch={false}
      theme="dark-colorful"
      onCancel={() => setIsOpen(false)}
      onComplete={complete}
    />
  );
}
```

For VTT model conversion, use `createdCharacterToNexus(result.character,
{ playerId })`. The same underlying `toNexusCharacter()` serves Forge JSON import.
Review `UNMAPPED_CREATOR_FIELDS` and conversion regressions whenever adding a
field; do not create a second host converter.

## Presentation state, drafts and reconciliation

The full wizard still owns a local `CharacterCreationData` object and step index
in `useWizardState`. Updates shallow-merge answers. Opening resets it or converts
`initialDraft`; it does not restore a persisted step. The four-screen flow owns
intent, explicit class/species, name, alignment and modal edits separately, then
generates recommendations with `useMemo`. The older quiz owns another local
answer flow. These presentations do not yet share one live canonical draft.

`CreationDraft` currently has literal `draftVersion: 1`, `draftId`, `characterId`,
edition, level and name; species/lineage/class/subclass/background slugs; raw
ability scores and a normalized method; ability bonuses; skills, expertise,
style/mastery/origin fields; languages/tools; spell lists; a resolved loadout;
narrative fields; and `provenance: Record<string, DraftProvenance>`.

`DraftProvenance` is `player | recommended | imported`. The adapter marks broad
groups (`species`, `class`, `background`, `abilities`, `skills`, `spells`,
`equipment`) with one supplied provenance value. It does not track each grant's
source, explicit edit, timestamp or rules revision. `DraftChoiceRecord` defines
additional metadata internally but is not used as the draft's provenance shape.

`creationDataToDraft(data, { draftId?, characterId?, provenance? })` resolves a
loadout and normalizes legacy aliases. Callers can supply stable IDs; current UI
change callbacks do not. Each conversion otherwise creates new IDs.
`draftToCreationData()` maps a subset back. It combines known spells and a wizard
spellbook into one draft list, maps manual score methods back to `standard-roll`,
and does not round-trip every full-wizard choice. In particular, weapon mastery,
feat follow-up choices and high-level setup are not a lossless resume contract.

Current reconciliation limits:

- Switching guided to full through `CharacterCreator` changes local mode and
  mounts a fresh child with the original `initialDraft`. It does not transfer the
  latest edited draft. Quick Build/quiz switching also remounts their local state.
- The four-screen change callback publishes `recommendation.draft`. Custom
  abilities and skills are held separately, alignment is separate, and spell
  edits mutate the recommendation object. Do not promise those edits survive
  reload or trigger an up-to-date preview.
- Explicit class/species requests are inputs to recommendation generation; no
  general domain reconciler preserves compatible player edits or produces
  targeted repair actions after a dependency change. The provenance field alone
  does not provide that behavior.
- `onDraftDiscard` is accepted through the components but is not called by the
  current full/four-screen presentations. Closing and discarding are not the same
  operation.

When completing this architecture, preserve explicit player choices, explain
incompatibilities and regenerate only recommendations that are no longer valid.
Those are acceptance requirements from the plan, not guarantees of this candidate.

## Recommendations, evaluation and supported content

`getRecommendation(request)` accepts edition plus optional intent, class,
species, level and name. It returns a draft, reasons, first-turn guidance and an
evaluation. `intentToClass()` maps close combat/archery to Fighter, sneaking to
Rogue, casting to Wizard and support to Cleric. A class request takes precedence
over that map. Policies, score profiles and starter spell packages live in
`services/recommendationService.ts`; guidance lives in `services/guidanceService.ts`.

Build choices are policy-driven, but IDs and evaluation timestamps change on
generation. There is no seed/versioned recommendation record. Unknown requests
can fall back, species lookup includes a cross-edition fallback, and the service
does not preserve prior explicit modal edits. Its comments claiming guaranteed
legal, complete builds exceed what the implemented checks establish.

`evaluateDraft()` resolves the loadout, calls `resolveCatalogEntitlements()`,
adapts to creation answers, calls `calculateCharacterStats()`, copies resolved
currency, and applies a small spell-validation set. It returns the updated draft,
calculated character, structured issues, `isValid`, `evaluatedAt` and evaluator
version `1.0.0`. Issue fields are `id`, numeric `step`, `group`, severity, message
and optional `repairTarget`. The issue step numbers do not currently correspond
to the full wizard's indices in every case; there is no integrated issue router.

Current checks cover required/catalog species and class, background existence,
some 2024 bonus-allocation shapes, minimum class skill count, overlapping
background skills, missing Fighter style, Rogue expertise and limited spell
counts. Several are warnings. `strictEntitlements` is declared but unused.
Background lookup is not fully edition-qualified. Source permissions, complete
feat/species/class grants, legal skill pools, duplicate spell choices and all
casting sources are not comprehensively validated. `isValid` means only that
these checks produced no error; it is not certification of a playable build.

`toCharacterCreationResult(evaluation)` returns the calculated object and guidance
without refusing `isValid: false`. It does not replace the character ID with
`draft.characterId`. A service consumer must handle invalid evaluations before
calling it and must verify identity/preview equality itself.

The package also contains an effect-based `rulesEngine` with `BaseFacts`, sourced
effects, pending choices and phased evaluation. The current draft facade does
not call that engine. `VITE_USE_RULES_ENGINE=true` defines its exported
`USE_RULES_ENGINE` constant; the actual creator completion path does not consult
it. The flag is not a newcomer rollout control or proof of certified rules
adoption. The generic preparation helper in `@nexus/rules-5e` is also not a
substitute for an independent edition-specific rules oracle.

`data/supportManifest.ts` names 12 classes with both editions and
`level1Certified: true`. The four-screen class picker consumes this list. Those
booleans record candidate assertions, not completed independent certification.
The fixture tests and service tests must be reviewed with their actual results;
neither advertised options nor an evaluator success establish full edition,
subclass, multiclass or higher-level correctness. Source-qualified catalog keys
exist in `rules-5e`, but the local draft uses slugs and does not implement a
host-supplied allowed-source policy.

## Loadouts, money and equipped state

The candidate `resolveLoadout(CharacterCreationData | CreationDraft)` reads
selected class equipment options, background equipment, explicit currency and
starting inventory. It expands five named packs, parses coin strings using the
existing equipment parser, matches catalog equipment and merges entries by slug.
Resolved items have an ID, slug, name, quantity, equipped flag, optional slot/AC/
armor metadata, and a class/background/purchased/custom source. Coin denominations
are `cp`, `sp`, `ep`, `gp`, `pp`.

`calculateTotalCurrencyGp()` totals denominations; `totalValueGp` currently means
**coin value**, not an appraisal of the carried items. A populated draft loadout
is returned unchanged. The resolver is not a complete legality or integer-quantity
validator, does not enforce one item per equipped slot, and can add the same
background items again if callers pass already-resolved starting inventory with
the original background.

The full equipment UI and `calculateCharacterStats()` still have their own
equipment handling. The four-screen recommendation starts with empty class
equipment choices; its background-derived loadout is not evidence that the
displayed class combat kit or required ammunition/focus exists. Verify actual
inventory, denominations, equipped armor/weapons and post-save AC against the
preview. The intended one-resolved-loadout pipeline is not yet adopted end to end.

## Host persistence, identity and recovery

Forge's `App.tsx` awaits `dbService.addCharacter(result.character)`, refreshes its
list and selects that ID. The default storage adapter is IndexedDB; an embedding
host may inject another adapter. Standalone Forge does not acquire VTT account or
session ownership through this callback. Forge currently supplies no draft
callbacks, so the draft helper exports do not provide Forge autosave/resume.

VTT's `SharedCharacterCreator.tsx` converts with `createdCharacterToNexus()`, sets
`rulesCatalogVersion` using the catalog client and awaits
`characterStore.saveCreatedCharacter()`. A missing catalog response degrades to
`null`; bundled creation does not wait for Codex availability. The store saves to
the account first when authenticated, updates in-memory state, then attempts its
local cache. Cache failure is logged and does not fail creation. The host clears
the stored draft after a successful save callback.

Session acceptance is a separate host operation. Desktop and Simple Player Mode
callers manage their own assignment/claim flow. Saving a character does not
prove a token was placed, ownership was accepted by the room, or a GM completed
setup. Preserve those separate outcomes in UI and telemetry.

`useCreationSubmission()` synchronously blocks concurrent submissions and blocks
outer cancellation while a save is in flight. Rejections show an alert and keep
the mounted answers available. After success or failure, its guard resets. It
generates a **new UUID on every attempt**. Draft IDs do not yet stabilize that
identity, and the guard does not prevent a later repeat after success if the
host leaves the creator mounted.

VTT account creation includes server-side deduplication behavior, but callers
must verify it against changing payload IDs and the returned server identity;
the store currently retains its supplied ID without consuming the success body.
Forge's IndexedDB adapter uses `add`, not an idempotent upsert. Do not promise
duplicate-free retries across partial saves or remounts. A new integration needs
a stable creation identity, durable acknowledgement and host-level retry tests
before making that guarantee.

### Draft helper contract and limits

The package now exports storage utilities, an implementation change from the
original storage-free boundary. They accept an injected `Storage` or default to
browser `localStorage`. They do not access accounts or multiplayer state.

| API | Current behavior |
| --- | --- |
| `createDraftStorageKey(host, playerId)` | Lowercases and removes characters outside letters/digits/underscore/hyphen. This can collide; it is not a collision-free identity encoding. |
| `saveDraftToStorage(key, draft, options?)` | Writes `DurableDraftRecord` with envelope `version: 1`, timestamp and optional tab/mode/step; returns `null` on unavailable/failed storage. |
| `loadDraftFromStorage(key, options?)` | Loads current-version records or attempts migration; returns `{ record, isConflict }` or `null`. |
| `migrateDraft(raw)` | Attempts limited legacy conversion. Its shape detection is permissive and does not validate every version-1 field. |
| `clearDraftFromStorage(key, options?)` | Removes one key; errors are logged. |

`CURRENT_DRAFT_VERSION`/record `version` and draft `draftVersion` are separate
fields currently set to 1. They are not a rules-content revision or an object
revision. The helper returns current envelope versions without full schema
validation; it does not offer a future-version rejection UI, backup/export,
conflict merge or recovery prompt. Its old-draft detection checks `abilities`
although the canonical draft uses `rawAbilityScores`.

VTT wires these helpers under a player key and tab ID, but ignores the conflict
flag and uses `localStorage` directly. A tab conflict is only a recent-other-tab
advisory (ten minutes), not a write lock. VTT does not persist presentation mode
or step in its current callback. Resume is therefore partial and limited by the
adapter/four-screen omissions above. New VTT persistence work must follow the
repository's storage-worker boundary and preserve a recoverable copy before
migration; do not copy this direct-storage seam as an approved new pattern.

## Existing characters and manual changes

Creation drafts describe new creation. They are not an edit/migration format for
an existing saved sheet. There is no new automatic character repair, comparison
screen or opt-in recalculation workflow in this candidate. Preserve stored base
choices, manual values, used resources/current HP and any existing
`rulesCatalogVersion`; do not label an older sheet with today's catalog on open.

Host sheet actions remain their own behavior. Forge synchronizes equipped-item
references on load and recalculates AC for equipment changes in `App.tsx`; general
sheet edits save through `handleUpdateCharacter`. These paths do not round-trip
through `CreationDraft`. Changes to creation arithmetic need compatibility
fixtures for old imports/manual sheets and separate equipment-action tests;
never assume regenerating a character preserves intentional overrides.

## Accessibility, styling and rollout

Both modal wrappers render a portal rooted at `.nexus-character-creator`, use
`role="dialog"`, `aria-modal`, dialog labels, initial focus/restore, Escape
handling and alert announcements. The full progress bar uses visible step
positions. These primitives are implemented; they do not establish a focus trap,
nested-dialog Escape policy, background inertness, phone usability or assistive
technology certification. Verify those in both hosts before claiming accessible
completion. Nested editor state must survive dismissal/navigation testing.

The creator palette source is
`src/styles/creator-theme.source.css`; `scripts/build-styles.mjs` generates
`dist/creator.css` scoped to the root. Forge imports the source as its app theme;
VTT imports `@nexus/character-creator/styles.css`. Hosts generate the existing
utility classes from package source. Do not import an unscoped creator palette
into VTT, add a second palette, or let global VTT element rules enter the creator
subtree. New components follow the repository's CSS Modules/token guidance;
this existing utility-based surface is not permission for a Tailwind migration.

The candidate makes the four-screen guided view the component default. There is
no separate host-controlled newcomer pilot flag or independently certified
class/edition evaluator rollout. `initialMode` is a presentation prop, not a
release-management system. A rollback must retain compatible saved data and
working arithmetic; reverting a presentation alone is not a verified rollback
procedure. `studyRecorder` is an in-memory helper with partial event wiring, not
evidence that a moderated study, pilot targets or successful handoffs occurred.

## Extending the creator

Keep catalog data, evaluated grants, UI choices and host preservation aligned.
Before advertising content, record its edition, permitted source and independent
expected output. Consult primary edition-specific rules references for the
oracle; neither another calculator nor a generated recommendation is that oracle.

| Change | Source and checks |
| --- | --- |
| Class/subclass | Update edition SRD data and relevant enhanced class/features data consumed by `services/dataService.ts`. Review class-skill counts, subclass/level gating, score profile, equipment and casting/resource handling. Add catalog/entitlement and calculator fixtures in each supported edition, navigation/UI choice tests, conversion preservation and saved-sheet action checks. |
| Background | Update `data/backgrounds.json` with explicit edition/slug and associated grants. Test both lookups, ability allocation and remount continuity, origin choices, skill overlap/replacement, tools/languages, coin alternatives and exact inventory quantities. Test the full UI and recommendation path separately. |
| Feat | Update the feat catalogs/loaders and `utils/featUtils.ts` or sourced effects where the existing path applies. Cover eligibility, follow-up choices, exactly-once effects, ASI/resource/casting source behavior, draft round-trip and VTT conversion. Data presence alone must not mark it supported. |
| Recommendation | Change `services/recommendationService.ts`, explanations and `guidanceService.ts` together. Test explicit class/species preservation, deterministic choices apart from identity/time, legal allocations, dependencies after player edits and the actual four-screen submission payload. |
| Starter spell package | Update the package table and verify every slug against the edition/class catalog. Independently check counts, spellbook/known/prepared distinctions, origins, focus/components, slots and usable first-turn actions. Exercise edit → back → preview → save → host sheet, not only `getRecommendation()`. |
| Host | Consume the existing component/result/converter; define identity, storage and source context outside the package. Test durable save rejection, retry after partial success, cancellation, resume compatibility, saved ID, account/local behavior and session acknowledgement separately. Add browser coverage in each supported host/entry mode. |

Adding a field requires decisions for `CharacterCreationData`, `CreationDraft`,
both adapters, evaluator/result generation, `CreatedCharacter`, conversion and
host persistence. Add a documented unmapped-field reason only when loss is
deliberate. Do not introduce another creator or general calculator.

## Validation commands and evidence

Run these from the **repository root**. Commands below are verified against the
current manifests; their inclusion here is not a claim they passed in this
candidate. Record actual outcomes in the
[verification record](character-creation-review.md).

```bash
npm run build:contracts
npm run type-check --workspace=@nexus/character-creator
npm run test:character-creator
npm run test:rules-5e
npm run test:game-contracts
npm run test --workspace=nexus-forge -- --run
npm run test:unit --workspace=nexus-vtt
npm run typecheck --workspace=@nexus/docs
npm run build:docs
```

The creator owns a Vitest project now; its tests are not only run from Forge.
`npm run build --workspace=@nexus/character-creator` regenerates scoped CSS, not
a JavaScript bundle. Build affected hosts with `npm run build:forge` and
`npm run build:vtt`. Repository policy requires affected CI checks before a PR;
do not describe package tests as full host integration validation.

The candidate adds adapter/catalog/loadout/evaluator/recommendation/storage tests,
`FourScreenNewcomerFlow.test.tsx`, `BackgroundASIWidget.test.tsx`, six F14/F24/
R14/R24/W14/W24 fixtures, `referenceBuilds.test.ts`, `supportCertification.test.ts`
and `regressionMatrix.test.ts`. The reference test currently asserts only part of
the fixture fields. The matrix invokes services/converters, not the rendered
Forge/VTT hosts; its “24-case” label does not establish 24 browser journeys.

Also retain `apps/forge/src/components/CharacterCreationHost.test.tsx`, VTT
submission/save/conversion/round-trip/host-binding tests and independently
reviewed rules fixtures. Release evidence still needs full UI saves for both
editions, both presentations and all host entry modes, error/resume cases,
keyboard/phone/nested-dialog checks, and actual sheet/assignment/placement
outcomes. See the plan's release gates before promoting the newcomer default.
