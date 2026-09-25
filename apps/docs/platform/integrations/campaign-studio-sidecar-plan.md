---
title: Nexus Campaign Studio sidecar plan
description: Project-specific architecture for campaign preparation objects that activate safely in Nexus VTT.
---

# Nexus Campaign Studio sidecar plan

Date: 2026-09-25  
Status: Proposed  
Scope: DM campaign preparation, authored campaign objects, and activation into
Nexus VTT

## 1. Recommendation

Build the campaign builder as a separate DM-focused web application in this
monorepo, but treat it as a **Nexus VTT sidecar**, not as an extension of the
NexusCodex document service.

Use the existing `apps/codex/services/dm-ui` as the short-term product shell so
the current pages and deployment path are not discarded. Rename the product in
the UI to **Nexus Campaign Studio** and migrate it, after the API boundary is
stable, to a top-level application such as `apps/campaign-studio`. Its current
repository location is historical; it must not determine domain ownership.

The central workflow should be:

```text
author campaign objects -> assemble a session plan -> publish a revision
-> activate the plan in Nexus VTT -> launch scenes and encounters on demand
```

The first delivery is a faithful representative frontend for the approved
campaign overview, session-plan authoring, and map-preparation concepts. It
uses a detailed Ashes of Veyra demo campaign and registered placeholders for
future capabilities. The implementation-ready specification is in the
[Campaign Studio visual prototype plan](campaign-studio-visual-prototype-plan.md).

After visual acceptance, the first functional vertical slice is a session plan
containing a prepared scene, an existing `EncounterTemplate`, and linked DM
notes that can be activated and used in the VTT without export/import.

## 2. Review of the supplied proposal

The supplied proposal identifies the right user needs. Adventurekeep's useful
patterns are its organized pages, typed page content, map markers with notes
and encounters, `@` references, integrated encounter planning/tracking, and
unified campaign/compendium search. These are documented in Adventurekeep's
[page guide](https://evening-respect-ad0.notion.site/Creating-Pages-428327e3c9c6444cacc513d33f60a7a6),
[map guide](https://evening-respect-ad0.notion.site/Creating-Maps-ad9eaad287cb4491b7c8e2d34978d5c6),
[`@` mention guide](https://evening-respect-ad0.notion.site/mentions-5c0a2e39e6564b65bd5d72e8e03d98cd),
[encounter guide](https://evening-respect-ad0.notion.site/Creating-Encounters-da3c238087084d2a8cec9cf186749b25),
and [search guide](https://evening-respect-ad0.notion.site/Adventure-Compendium-Search-9df496c9131e4dfa885921f72d965418).

Several implementation recommendations no longer fit Nexus:

| Supplied recommendation | Project-specific correction |
| --- | --- |
| Make `dm-ui` part of the Codex service domain. | Keep the UI temporarily, but make Campaign Studio a VTT sidecar. ADR-0001 keeps NexusCodex an independent document library. |
| Import `EncounterManager`, `MonsterLibrary`, and `NPCLibrary` directly from `apps/forge`. | Do not import another application's source. The current Forge components own context, CSS, IndexedDB/local-storage behavior, and standalone combat state. Extract reusable, host-injected features only when needed. |
| Persist campaign state through `apps/control-api`. | `control-api` is the private administrative control plane. VTT PostgreSQL and its authenticated backend own campaigns and runtime state. |
| Route all references through `doc-api` and Elasticsearch. | Compose search across campaign objects, VTT library objects, the published rules catalog, and Codex documents. `doc-api` remains authoritative only for documents and extracted document content. |
| Upload maps through `admin-ui`. | Maps are assets and belong to the VTT asset service. The admin UI is not a DM workflow surface. |
| Export one large session JSON payload and hydrate the VTT from it. | Persist versioned prep objects and activate a pinned `SessionPlan` revision through VTT APIs and domain commands. JSON export remains backup/portability, not the live integration path. |
| Send the payload through `doc-websocket`. | `doc-websocket` owns collaborative document sessions. Live game changes use the VTT command, event-journal, and PostgreSQL durability path. |
| Pre-roll HP and initiative while authoring. | Store deployment policy and overrides in the template. Materialize actor HP when deploying and initiative when starting the encounter, preserving fresh actor instances and command idempotency. |

## 3. Existing boundaries to preserve

### Nexus VTT backend

The VTT backend is the persistence and authorization boundary for campaigns,
campaign actors, scene state, encounter runs, command receipts, and the ordered
event journal. New activation operations must use the existing transactional,
idempotent command path and must not acknowledge before PostgreSQL commits.

### `@nexus/game-contracts`

This package owns runtime-validated game-domain references and commands.
Existing objects that Campaign Studio should use directly include:

- `DefinitionRef` for immutable revisions;
- `MonsterDefinition` and `EncounterTemplate` for reusable authored content;
- `CampaignActor` for mutable campaign participants;
- `EncounterRun` for deployed combat state;
- `DeployEncounter`, `StartEncounter`, and other domain commands.

Add prep contracts here initially in a dedicated `prep.ts` module. Split them
into `@nexus/campaign-contracts` only if they develop an independent release or
consumer lifecycle. Avoid a second, incompatible object model inside `dm-ui`.

### `@nexus/rules-5e` and `@nexus/rules-contracts`

Use `@nexus/rules-5e` for encounter XP and difficulty calculations. Use the
published rules catalog through the VTT backend for searchable monster, spell,
and item source content. Keep explicit 2014/2024 ruleset identity.

### Nexus Forge

Forge remains the authoring application for reusable mechanical definitions:
characters, monsters, encounters, spell collections, and items. Campaign
Studio may host extracted Forge features through narrow ports, but it should
primarily reference published definition revisions instead of copying them.

There is currently no `packages/forge-features` workspace. Directly mounting
the current Forge components would also import their storage and state
assumptions. Share contracts and headless logic first; extract UI only as a
separate, tested work item.

### NexusCodex

NexusCodex remains the document library, document processor, grounded search
source, and document collaboration service. Campaign objects may link to a
Codex document or citation, but Codex does not become the campaign database,
asset catalog, or gameplay authority.

Campaign Studio should replace its temporary `/codex-api/` reads with the
VTT backend's authorized `/api/documents` and `/api/structured-data` routes,
as already required by the private control-plane plan.

### Asset service

Uploaded maps, handouts, portraits, tokens, and derived thumbnails use the
asset service. Prep objects hold typed asset references, never base64 images or
browser-local blob URLs as canonical data.

## 4. Authored objects and live objects

Do not model a whole game session as one mutable document. Preserve the
platform's authored-definition versus live-runtime distinction.

| Object | Ownership | Mutability | Purpose |
| --- | --- | --- | --- |
| `MonsterDefinition` | Library/Forge | Immutable revisions | Reusable stat block |
| `EncounterTemplate` | Library/Forge or campaign | Immutable revisions | Reusable encounter composition and deployment defaults |
| `CampaignEntry` | Campaign Studio | Versioned authored content | Note, NPC profile, location, faction, quest, lore, or clue |
| `CampaignMap` | Campaign Studio | Versioned authored content | Map asset plus normalized, linked pins |
| `SceneTemplate` | Campaign Studio | Versioned authored content | VTT-ready background, grid, lighting, fog preset, and placements |
| `SessionPlan` | Campaign Studio | Immutable published revisions | Ordered run sheet referencing prepared objects |
| `SessionPlanActivation` | VTT backend | Mutable runtime record | Binds one plan revision to a live VTT session |
| `CampaignActor` | VTT backend | CAS-versioned runtime state | A particular PC, NPC, or monster in play |
| `EncounterRun` | VTT backend | CAS-versioned runtime state | Deployed encounter, initiative, rounds, and participants |

Narrative NPC content and mechanical creature state are related but not the
same object. A `CampaignEntry` of kind `npc` can reference a
`MonsterDefinition` for mechanics and, after deployment, a `CampaignActor` for
the live instance. Biography edits must never heal or otherwise reset the
actor.

## 5. Proposed contracts

The exact field set should be finalized with Zod schemas and fixtures before
database work. The following shape captures the required boundaries.

```ts
type CampaignEntryKind =
  | 'note'
  | 'npc'
  | 'location'
  | 'faction'
  | 'quest'
  | 'lore'
  | 'clue';

type CampaignObjectRef =
  | { target: 'campaign-object'; campaignId: string; id: string; revision: number }
  | { target: 'definition'; ref: DefinitionRef }
  | {
      target: 'rules-entity';
      entityType: 'monster' | 'spell' | 'item';
      ruleset: '2014' | '2024';
      slug: string;
      catalogVersion: number;
    }
  | { target: 'document'; documentId: string }
  | { target: 'asset'; assetId: string };

type AssetObjectRef = Extract<CampaignObjectRef, { target: 'asset' }>;

interface CampaignEntry {
  id: string;
  campaignId: string;
  schemaVersion: number;
  revision: number;
  kind: CampaignEntryKind;
  title: string;
  visibility: 'dm-only' | 'players';
  content: {
    format: 'lexical';
    schemaVersion: number;
    value: unknown;
  };
  links: CampaignObjectRef[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface MapPin {
  id: string;
  position: { x: number; y: number }; // normalized 0..1 map-local coordinates
  label: string;
  icon: string;
  visibility: 'dm-only' | 'players';
  target: CampaignObjectRef;
}

interface CampaignMap {
  id: string;
  campaignId: string;
  revision: number;
  name: string;
  mapAssetRef: AssetObjectRef;
  pins: MapPin[];
}

interface SceneTemplate {
  id: string;
  campaignId: string;
  revision: number;
  name: string;
  backgroundAssetRef: AssetObjectRef;
  grid: {
    enabled: boolean;
    type: 'square' | 'hex';
    size: number;
    offsetX: number;
    offsetY: number;
    snapToGrid: boolean;
  };
  lighting: {
    enabled: boolean;
    globalIllumination: boolean;
    ambientLight: number;
    darkness: number;
  };
  fogPreset?: { mode: 'off' | 'concealed'; revealedShapes: unknown[] };
}

type SessionPlanStep =
  | { id: string; type: 'open-entry'; entryRef: CampaignObjectRef }
  | { id: string; type: 'activate-scene'; sceneTemplateRef: CampaignObjectRef }
  | { id: string; type: 'deploy-encounter'; encounterRef: DefinitionRef<'encounter'> }
  | { id: string; type: 'share-handout'; assetRef: AssetObjectRef }
  | { id: string; type: 'reminder'; text: string };

interface SessionPlan {
  id: string;
  campaignId: string;
  schemaVersion: number;
  revision: number;
  title: string;
  status: 'draft' | 'ready' | 'retired';
  steps: SessionPlanStep[];
  createdAt: string;
  updatedAt: string;
}
```

`SessionPlan` references published revisions. Publishing validates every
reference, reports missing dependencies, and records a dependency manifest.
Source edits do not silently change a ready plan.

## 6. Persistence and APIs

### Canonical storage

Add VTT PostgreSQL tables along these lines:

- `campaign_objects`: identity, campaign, kind, current revision, status, and
  timestamps;
- `campaign_object_revisions`: immutable, schema-versioned payloads;
- `campaign_object_links`: queryable outgoing links and backlinks;
- `session_plan_activations`: plan revision, VTT session, status, current step,
  and activation command ID.

Keep `library_objects` for reusable game definitions. Do not place notes,
locations, or session plans in that table merely to reuse its repository.

Dexie in the current DM UI becomes a draft cache and offline outbox. It must
not remain the only copy of campaign prep. Migrate current local campaigns by
previewing the import, validating each object, mapping IDs, and then uploading
through authenticated APIs.

### API shape

Use same-origin VTT backend routes:

```text
GET    /api/campaigns/:campaignId/prep/objects
POST   /api/campaigns/:campaignId/prep/objects
GET    /api/campaigns/:campaignId/prep/objects/:objectId
PUT    /api/campaigns/:campaignId/prep/objects/:objectId
POST   /api/campaigns/:campaignId/prep/objects/:objectId/publish
GET    /api/campaigns/:campaignId/prep/backlinks/:objectId
GET    /api/campaigns/:campaignId/prep/search
POST   /api/campaigns/:campaignId/session-plans/:planId/activate
```

Authoring writes use expected revision checks. Activation uses an idempotent
domain command and receipt. The activation transaction pins the plan revision
and creates its runtime record; it does not eagerly spawn every encounter.
Individual steps call existing commands such as `DeployEncounter` and
`StartEncounter` when the DM chooses them.

### Search composition

The VTT backend should return a common `SearchHit` envelope while querying the
appropriate owners:

1. Campaign entries and session plans from VTT PostgreSQL.
2. Reusable definitions from `library_objects`.
3. Published rules entities from the rules catalog.
4. Documents and extracted content from NexusCodex.
5. Assets from the asset service where an asset picker is requested.

This powers global search and editor mentions without making Elasticsearch the
owner of every result.

## 7. Capability design

### Session planner and VTT run sheet

This is the product spine. A DM assembles ordered steps from references. The
VTT opens the activated plan in a dockable panel and offers contextual commands:
open notes, switch or create a scene from a template, deploy an encounter,
share a handout, or mark a beat complete.

The panel should retain DM-only visibility and use the existing panel registry.
Player-visible material is exposed only by an explicit share/reveal action.

### Smart links and backlinks

Upgrade the Lexical editor with a custom mention node and command menu. Store a
typed `CampaignObjectRef`, not just a URL or copied name. Render broken,
outdated, and unauthorized references as explicit states.

The mention menu should query unified prep search with type filters. Selecting
a rules entity, campaign entry, definition, document, or asset inserts the
same reference shape used by map pins and session-plan steps. Backlinks then
come from `campaign_object_links`, not by reparsing editor text on every read.

### Encounter composition

Build against `EncounterTemplate` and `@nexus/rules-5e`, not the current DM UI
`Encounter` interface. The composer selects pinned `MonsterDefinition`
revisions, count, faction, wave, overrides, and optional relative placement.

Show raw XP, adjusted XP, party assumptions, and the advisory nature of the
difficulty estimate. Support both 2014 and 2024 rulesets explicitly. Store HP
policy (`average`, `roll-on-deploy`, or a fixed override) and initiative policy
(`individual`, `group`, or `manual`); create actual values in the runtime
command path.

Do not reuse Forge's standalone encounter tracker as the VTT runtime. Nexus
already has `EncounterRun`, `CampaignActor`, and combat commands for that job.

### Map boards, pins, and scene templates

Use an asset-service map reference. Store pin coordinates normalized to the
uncropped source image, then transform them with the same pan/zoom matrix as
the displayed map. A pin links to any `CampaignObjectRef` and opens an
appropriate preview panel.

Keep campaign-atlas pins separate from VTT scene entities. A `SceneTemplate`
is the bridge: it captures background asset, grid alignment, lighting, fog
preset, and optional definition placements. Activating it creates or updates a
VTT scene through a validated command. Canvas-anchored markers rendered during
play must follow the VTT canvas boundary rules.

### Relationship graph and timeline

Generate graph edges from typed links and explicit relationship records. Do
not make the graph editor its own source of truth. A timeline is a filtered
view of sessions, quests, and dated campaign entries. These are valuable after
the object/link foundation is stable and are not MVP blockers.

## 8. Application structure

Near-term structure:

```text
apps/codex/services/dm-ui/       # transitional Campaign Studio shell
packages/game-contracts/src/     # prep contracts, refs, activation commands
packages/rules-5e/               # encounter calculations
apps/vtt/server/                 # canonical prep repositories and APIs
apps/vtt/src/components/Panels/  # live Session Plan panel
apps/vtt/services/asset-service/ # map and handout assets
apps/codex/services/doc-api/     # linked documents and document search only
```

Target structure after migration:

```text
apps/campaign-studio/            # standalone prep UX, served by VTT gateway
packages/campaign-features/      # optional host-injected UI extracted by use
packages/game-contracts/         # shared authored/runtime contracts
```

Campaign Studio and the VTT should consume services through typed ports such
as `CampaignPrepRepository`, `DefinitionCatalog`, `RulesCatalog`,
`AssetCatalog`, and `DocumentCatalog`. A feature component receives these
ports from its host; it does not import a Zustand store, Dexie singleton, or
application-global CSS from another app.

Use CSS Modules and VTT design tokens for newly extracted shared features.
Do not carry the current DM UI's Tailwind dependency into VTT panels.

## 9. Delivery sequence

### Phase A: representative frontend (current priority)

- Reproduce the campaign overview, session-plan authoring, and map-preparation
  concepts as real DOM interfaces in the existing DM UI workspace.
- Seed the complete Ashes of Veyra reference campaign described in the visual
  prototype plan.
- Implement local navigation, selection, tabs, filtering, checklist, layer,
  pin, and zoom states.
- Register every deferred command as a named capability handle with visible
  planned-state feedback.
- Establish approved Playwright screenshot baselines after visual review.

Gate: the three screens match the references at `1586 x 992`, remain coherent
at the two smaller desktop targets, and contain no unregistered dead controls.

### Phase 0: decisions and contracts

- Accept an ADR for Campaign Studio ownership and the authored/live boundary.
- Add Zod schemas for campaign object refs, entries, scene templates, and
  session plans.
- Add fixtures for broken links, pinned revisions, both 5e editions, DM-only
  material, and a plan containing one scene and one encounter.

Gate: every object has one owner, a runtime validator, and a documented
activation behavior.

### Phase 1: canonical campaign prep storage

- Add versioned PostgreSQL repositories and authenticated campaign-scoped APIs.
- Enforce DM/editor authorization and expected revision checks.
- Convert Dexie to an offline draft cache/outbox and implement a reviewed local
  data migration.
- Move Campaign Studio document reads to VTT-authorized routes.

Gate: a DM can edit on one browser, reload or open another browser, and see the
same committed prep without exposing it to another campaign.

### Phase 2: first playable vertical slice

- Implement the session-plan editor and VTT run-sheet panel.
- Compose an `EncounterTemplate` from catalog monsters with rules-engine
  difficulty calculations.
- Activate a pinned plan revision and deploy/start its encounter through the
  existing VTT command pipeline.

Gate: prepare -> publish -> activate -> deploy -> start -> server restart ->
resume succeeds without duplicate actors or lost combat state.

### Phase 3: smart references

- Add Lexical mention nodes, unified search, object previews, and backlinks.
- Support campaign entries, game definitions, rules entities, documents, and
  assets through typed references.

Gate: renames preserve links, archived targets remain diagnosable, and users
cannot discover unauthorized campaign content through search.

### Phase 4: maps and scene templates

- Add map asset selection, normalized pins, and linked previews.
- Add scene-template creation and VTT activation with grid/fog validation.
- Add accessible non-drag alternatives for placing and editing pins.

Gate: pins remain aligned across viewport sizes, and a prepared map becomes a
valid VTT scene without copying image data into campaign JSON.

### Phase 5: collaboration and advanced views

- Add co-DM editing, conflict UI, activity history, and player visibility.
- Add relationship graph and timeline projections.
- Add versioned backup/import bundles with dependency manifests.

Gate: concurrent edits have one clear outcome, private material does not leak,
and exports round-trip through current schemas.

## 10. Verification and operational requirements

- Contract tests parse every API and persisted object as `unknown` at the
  boundary.
- Repository tests cover revision conflicts, backlinks, authorization, and
  atomic activation receipts.
- `@nexus/rules-5e` tests cover encounter calculations for party-size edges and
  both supported editions where the rules differ.
- Managed Playwright covers the Phase 2 activation flow and the required
  post-ack process-kill recovery scenario.
- Search tests prove campaign scoping and prevent results from leaking titles
  or snippets across campaigns.
- Asset tests verify map references, deletion behavior, and thumbnail/full
  resolution fallback.
- Editor tests cover keyboard mention selection, pasted content, broken refs,
  and sanitization.
- Every new write path records audit-friendly identity and request IDs without
  logging private note content.

## 11. Product priority

The immediate priority is the **representative Campaign Studio frontend** in
the companion visual prototype plan. Building the three approved screens and
their shared example campaign first establishes the product vocabulary,
information density, object relationships, and capability handles before
backend contracts constrain the experience.

The first functional milestone after visual acceptance is **session plan plus
encounter activation**. It proves the unique value of building beside Nexus
VTT: authored prep becomes usable live game state.

After that, implement the shared typed-reference substrate and `@` mentions.
Map hotspots should follow because they can then reuse the same references and
scene-template activation. Starting with map pins first would produce another
isolated data model and postpone the hardest integration risk.

The success metric is not feature parity with Adventurekeep. It is the time
from “this encounter and scene are ready” to “the same pinned objects are live
in Nexus VTT,” with no manual export, duplicate state, or re-entry.

## 12. Concept interface gallery

These generated concepts are the visual sources of truth for Phase A. Their
screen anatomy and acceptance criteria are defined in the
[Campaign Studio visual prototype plan](campaign-studio-visual-prototype-plan.md).
They remain product-direction references rather than raster assets to trace or
embed as interface backgrounds.

### Campaign overview

The campaign home emphasizes the next session, active narrative objects,
prepared encounters, backlinks, and recent edits rather than generic metrics.

![Nexus Campaign Studio campaign overview](/img/concepts/campaign-studio/campaign-overview.png)

### Session plan authoring

The run-sheet workspace combines the campaign object library, ordered session
steps, inline typed references, dependency validation, visibility, and revision
publishing.

![Session plan authoring workspace](/img/concepts/campaign-studio/session-plan-authoring.png)

### Map preparation

Map pins are campaign-object references. The inspector exposes linked notes,
NPCs, encounters, and scene templates without making the map a second source
of truth.

![Interactive campaign map preparation](/img/concepts/campaign-studio/map-preparation.png)

### Live VTT run sheet

After activation, the plan becomes a docked VTT tool. The tactical scene stays
primary while the DM advances steps, deploys the encounter, and opens linked
notes through existing runtime commands.

![Activated session plan inside Nexus VTT](/img/concepts/campaign-studio/vtt-session-runsheet.png)
