---
title: Campaign Studio visual prototype plan
description: Implementation specification for the first three Nexus Campaign Studio concept screens and the Ashes of Veyra reference campaign.
---

# Campaign Studio visual prototype plan

Date: 2026-09-25  
Status: Approved direction, implementation ready  
Parent plan: [Nexus Campaign Studio sidecar plan](campaign-studio-sidecar-plan.md)

## 1. Objective

Build a representative frontend in the existing
`apps/codex/services/dm-ui` workspace that faithfully reproduces the first
three approved Campaign Studio concepts:

1. Campaign overview.
2. Session-plan authoring.
3. Interactive map preparation.

The prototype should look and feel like a real product. It should contain a
detailed, internally consistent example campaign and enough local interaction
to demonstrate navigation, selection, filtering, inspector changes, tabs,
layer visibility, and map zoom. Backend writes, multiplayer, authoritative
publishing, encounter deployment, and asset management remain later phases.

This phase deliberately prioritizes product shape before domain integration.
The prototype becomes the visual and information-architecture reference around
which later capabilities are implemented.

## 2. Visual sources of truth

All three references are `1586 x 992` PNGs. Implement and review the primary
desktop layout at that exact viewport first.

| Screen | Reference | Prototype route |
| --- | --- | --- |
| Campaign overview | [campaign-overview.png](/img/concepts/campaign-studio/campaign-overview.png) | `/campaigns/ashes-of-veyra/overview` |
| Session-plan authoring | [session-plan-authoring.png](/img/concepts/campaign-studio/session-plan-authoring.png) | `/campaigns/ashes-of-veyra/sessions/session-12` |
| Map preparation | [map-preparation.png](/img/concepts/campaign-studio/map-preparation.png) | `/campaigns/ashes-of-veyra/maps/glass-harbor` |

The references determine composition, density, hierarchy, panel proportions,
and control placement. Generated-image artifacts do not override product
quality: implementation text must be spelled correctly, controls must be
accessible, repeated spacing must be consistent, and the same entity must use
the same name everywhere.

Do not recreate the mockups as a single background image. Every visible panel,
row, tab, button, icon, label, pin, and selected state must be rendered as real
HTML/CSS. The harbor artwork and portraits may be raster assets.

## 3. Scope and non-goals

### Required in the representative frontend

- The three routes render directly on first load without account setup.
- The default route redirects to the Ashes of Veyra overview.
- Navigation between the three routes works.
- Lists, object counts, selected rows, tabs, expanded sections, inspector
  contents, layer visibility, map zoom, and pin selection have local state.
- Every apparent command has hover, focus, pressed, disabled, or planned state.
- Planned commands open one consistent capability notice rather than doing
  nothing.
- All visible content comes from typed demo fixtures, not inline component
  literals.
- The existing import/export and legacy pages remain available during the
  prototype, but are not part of the new primary navigation.

### Explicitly deferred

- PostgreSQL persistence and authenticated campaign APIs.
- Dexie migration or synchronization.
- Actual `SessionPlan` publication and revision creation.
- Forge component extraction.
- Codex, rules-catalog, or asset-service queries.
- Rich-text editing beyond a representative editable surface.
- Drag-and-drop persistence.
- Real map uploads, pin creation, backlinks, or scene creation.
- Multiplayer, player visibility enforcement, and VTT activation.
- Mobile-specific product design.

## 4. Prototype architecture

Keep the prototype isolated from the legacy `dm-ui` screens so visual work does
not accidentally deepen the existing local-only data model.

```text
apps/codex/services/dm-ui/src/
  demo/
    ashes-of-veyra/
      campaign.ts
      encounters.ts
      factions.ts
      handouts.ts
      index.ts
      locations.ts
      maps.ts
      npcs.ts
      quests.ts
      sessions.ts
  features/
    studio-shell/
    campaign-overview/
    session-plan/
    map-preparation/
    capability-notice/
  routes/
    CampaignOverviewRoute.tsx
    MapPreparationRoute.tsx
    SessionPlanRoute.tsx
  styles/
    design-tokens.css
    globals.css
```

Each feature directory contains its component, CSS Module, local view-model
types, and focused tests. Shared primitives should be extracted only after at
least two screens need the same behavior.

The demo fixtures implement a narrow read-only repository:

```ts
interface DemoCampaignRepository {
  getCampaign(campaignId: string): DemoCampaign | undefined;
  getOverview(campaignId: string): CampaignOverviewViewModel;
  getSessionPlan(sessionId: string): SessionPlanViewModel | undefined;
  getMap(mapId: string): MapPreparationViewModel | undefined;
}
```

Components consume view models or this interface. They must not import the
Dexie singleton. A future API repository can replace the fixture repository
without redesigning the screens.

## 5. Visual system

Create `src/styles/design-tokens.css` as the sole value source for the new
prototype. CSS Modules consume semantic variables and do not contain literal
colors or independent z-index values.

### Color roles

- `--studio-chrome`: graphite navigation and top-bar surfaces.
- `--studio-chrome-raised`: selected and hover chrome surface.
- `--studio-canvas`: warm neutral application background.
- `--studio-surface`: primary work surface.
- `--studio-surface-muted`: inspector and secondary row background.
- `--studio-border`: ordinary separators.
- `--studio-border-strong`: selected and structural separators.
- `--studio-text`: primary text.
- `--studio-text-muted`: metadata and descriptions.
- `--studio-positive`: active, ready, selected, and successful state.
- `--studio-warning`: medium priority and incomplete readiness.
- `--studio-danger`: hostile encounter, high-priority clue, and destructive
  state.
- `--studio-neutral`: inactive and unscheduled state.

The palette should visually match the references: graphite chrome, warm-light
working surfaces, forest-green primary actions, amber caution, and restrained
crimson danger. There are no gradients, decorative glows, or purple accents.

### Typography

- Use Inter through the existing Nexus font dependency or an equivalent local
  sans-serif stack.
- Product and campaign names: 28-32px, weight 700.
- Screen headings: 24-28px, weight 700.
- Panel headings: 16-18px, weight 650-700.
- Row titles and commands: 14-15px, weight 550-650.
- Body and metadata: 12-14px, regular.
- Do not scale type with viewport width and do not use negative letter spacing.

### Geometry and density

- Global top bar: 48px high.
- Primary left rail: 232px on overview.
- Object library: 360px on session-plan authoring.
- Map navigation rail plus layers panel: 392px combined.
- Overview activity inspector: 274px.
- Session and map inspectors: 392px.
- Primary page gutters: 28px.
- Major section gap: 16px.
- Row height: 48-58px depending on secondary text.
- Icon button: 32px square; standard command: 36-40px high.
- Border radius: 4px for controls and 6px for bounded panels.
- Shadows are limited to menus and overlays. Structural panels use borders.

These values are starting constraints. During screenshot matching, adjust them
centrally through tokens rather than per-screen exceptions.

### Icons and controls

Use direct-path Lucide imports. Match the references with familiar outline
icons. Buttons that can be represented by an icon use an icon with a tooltip;
primary commands may use icon plus text. Status pills are reserved for compact
status values, not ordinary navigation.

## 6. Shared shell

`StudioShell` replaces the current generic `AppLayout` for the new routes.

Required behavior:

- Fixed-height viewport with independently scrolling work regions.
- Persistent product identity: `Nexus VTT` and `Campaign Studio`.
- Campaign selector fixed to `Ashes of Veyra` in demo mode.
- Exact active navigation treatment from each reference.
- Theme and settings icons are present as planned capability handles.
- No body-level scrolling at `1586 x 992`.
- Focus remains visible against dark and light surfaces.

The overview uses a full-height campaign rail. Session-plan authoring and map
preparation use a compact top product bar and screen-specific left workspaces.
They share tokens, icon treatments, menus, and footer/status behavior without
being forced into one identical column layout.

## 7. Screen specification: campaign overview

Reference: `campaign-overview.png`.

### Layout

```text
| campaign rail 232 | main workspace flex | activity inspector 274 |
```

The main workspace includes a compact title header, one full-width next-session
band, then a two-by-two grid of operational sections. The inspector spans the
content height to the right.

### Campaign rail

Render:

- Nexus VTT Campaign Studio identity.
- Campaign selector with active indicator.
- Overview, Sessions, World, NPCs, Factions, Quests, Encounters, Maps, Lore.
- Settings at the bottom.

`Overview` is selected. Sessions and Maps navigate to the implemented demo
routes. Other items update the selected treatment briefly and show a capability
notice that identifies the planned screen.

### Header and next-session band

Render:

- `Ashes of Veyra`.
- Subtitle: `A fractured realm. A buried truth. And embers that still burn.`
- `D&D 5e`, `12 Sessions`, and `Last edited 2 hours ago`.
- Search, theme, and avatar icon controls.
- `Next Session` label.
- `Session 12 - The Glass Harbor`.
- `Sat, Apr 26, 2025`, `4-8 PM`, and `in 3 days` as fixed demo text.
- Primary `Plan Session` command navigating to session 12.
- Four summary facts: Dockside Ambush, Captain Serin, Glass Harbor, and Find
  the Ember Key.

### Operational grid

Sections and ordering:

1. Active Quests.
2. Prepared Encounters.
3. Unresolved Clues.
4. Recent Campaign Objects.

Each section has four rows, a small leading semantic icon or status dot, title,
secondary text, compact metadata/status, and overflow command. `View All`
opens a capability notice with the corresponding target feature.

### Activity inspector

Render `Activity & Links` with two unframed sections:

- Backlinks: Captain Serin, Glass Harbor, Dockside Ambush, Find the Ember Key.
- Recent Edits: Dockside Ambush, Captain Serin, Glass Harbor, The Crimson Wake,
  and Map: Harbor District.

Selecting an object in the main grid moves it to the emphasized inspector row
and updates a small details summary. This is local state and demonstrates the
future shared-object interaction model.

## 8. Screen specification: session-plan authoring

Reference: `session-plan-authoring.png`.

### Layout

```text
| object library 360 | run-sheet workspace flex | details inspector 392 |
```

A 48px global product bar spans all three columns. Each column scrolls
independently beneath it.

### Object library

Render:

- Search field with `Ctrl K` hint.
- `Campaign` and `Compendium` tabs.
- Object-type counts: All Objects 124, Scenes 18, Encounters 12, NPCs 28, Lore
  32, Handouts 14.
- Recent objects: Glass Harbor Docks, Captain Serin, Dockside Ambush, Burned
  Shipping Ledger, The Azure Compact.
- Folder tree: Act I - Fractured Tides, Act II - The Glass Harbor, and Act III
  - The Hollow Crown.
- Expanded Act II child counts for Scenes, NPCs, Encounters, and Handouts.

Search filters all displayed rows locally. Tabs switch between campaign fixture
objects and a short SRD-shaped demo compendium. Folder disclosure and object
selection work locally.

### Run-sheet header

Render:

- Breadcrumb `Sessions > Session 12`.
- `Session 12 - The Glass Harbor`.
- Date, `~3-4 hours`, party level 5, and tags `Urban`, `Intrigue`, `Combat`.
- Draft selector and overflow command.
- Tabs: Run Sheet, Session Notes, Player Facing, Attachments.
- Commands: Add Step, Reorder, Estimate All, Preview.

Only Run Sheet is fully represented. Other tabs render concise seeded content
in the same workspace rather than blank screens.

### Run-sheet steps

Render these ordered steps:

1. Opening recap, 10 minutes, shared.
2. Activate scene: Glass Harbor Docks, 5 minutes, shared.
3. Open note: Harbormaster's Warning, 10 minutes, shared and selected.
4. Deploy encounter: Dockside Ambush, 30 minutes, DM-only.
5. Share handout: Burned Shipping Ledger, 5 minutes, shared.

The selected note expands to show a toolbar and editable-looking text surface.
It includes a visually distinct typed reference to `@Captain Serin`. Editing
may update local component state, but no Lexical integration is required in
this phase.

Step drag handles, visibility controls, and overflow menus are visible. Reorder
mode may move steps with up/down controls; persistent drag-and-drop is deferred.
`Add Step` appends a temporary demo reminder in memory so the control feels
real without creating a new data contract.

### Details inspector

Render:

- Tabs: Details, References, Chat Prep.
- Session Plan pinned to Revision 3.
- Last edited information and View history.
- Dependencies with status: Glass Harbor Docks, Dockside Ambush, Burned
  Shipping Ledger.
- Readiness checklist at 4/6.
- Visibility radio group with DM only selected.
- Full-width `Publish plan` command.

Dependencies and checklist rows are interactive local toggles. `Publish plan`
uses capability ID `session-plan.publish` and displays the planned backend
phase and expected future result.

## 9. Screen specification: map preparation

Reference: `map-preparation.png`.

### Layout

```text
| app rail 128 | map layers 264 | map canvas flex | inspector 392 |
```

A compact product bar spans the viewport. The map canvas and inspector fill the
remaining height. The bottom map toolbar is anchored inside the canvas region.

### App rail and layers

The app rail contains Campaign, Maps, Locations, NPCs, Encounters, Items,
Scenes, Notes, Assets, Journal, Settings, and Collapse. `Maps` is selected.

The layers panel contains:

- Locations, Encounters, NPCs, Notes, and Environment.
- Grid, Labels, and Fog of War as initially hidden secondary layers.
- Six location rows with pin icons and overflow controls.

Layer eye controls toggle the corresponding map overlays locally. The location
list selects and centers the matching pin.

### Map canvas

Use a clean Glass Harbor map asset without UI baked into it. Required pins:

1. North Docks.
2. The Salty Mast Tavern.
3. Fishmongers' Row.
4. Old Customs House.
5. Harbor Warehouse.
6. South Pier.

Pin 04 is selected initially and uses the danger/selected treatment. Store
positions as normalized coordinates in the fixture even though persistence is
deferred. Render zoom in, zoom out, recenter, a scale, compass, and minimap.

Zoom controls change a CSS transform around the map center with a constrained
range. Pin positions and minimap viewport must remain synchronized with that
transform. Panning, uploaded maps, and persisted coordinates are deferred.

The bottom toolbar contains Select, Add Pin, Link Object, Toggle Visibility,
and Create Scene. Select and visibility work locally. Other commands use the
capability registry.

### Location inspector

Render selected pin metadata and tabs Details, Linked Objects (4), Map Notes.
For Old Customs House show:

- A location image.
- Two-paragraph compact description.
- Customs House Notes.
- Captain Serin, Harbor Master.
- Dockside Ambush, 3-5 bandits (CR 1).
- Harbor Warehouse scene template.
- Link Existing Object command.
- Tags Government, Harbor, Law Enforcement.

Selecting a different pin replaces this content with its fixture record. At
least all six locations need a title, short description, tags, and one linked
object so the interaction is convincing.

## 10. Ashes of Veyra reference campaign

### Premise

Veyra is a coastal realm built over the drowned remains of an older kingdom.
The Ember Key, believed to unlock the sealed Hollow Crown beneath the bay, has
resurfaced in the trade city of Glass Harbor. The party is caught between the
Harbor Watch, the smuggling network called the Crimson Wake, the Ashen Synod,
and a drowned cult that hears voices below the tide.

Tone: maritime intrigue, buried history, uneasy alliances, and tactical urban
encounters. Ruleset: D&D 5e, 2024 campaign with compatible 2014 SRD creatures
called out in fixture metadata.

### Acts

| Act | Status | Sessions | Summary |
| --- | --- | --- | --- |
| Act I: Fractured Tides | Complete | 1-7 | The party survives the wreck of the *Northstar*, discovers ember-marked cargo, and follows it to Veyra. |
| Act II: The Glass Harbor | Active | 8-13 | The party investigates the key's arrival, navigates harbor factions, and uncovers a route beneath the Customs House. |
| Act III: The Hollow Crown | Planned | 14-20 | The factions descend into the drowned royal vault while the coast begins to fracture. |

### Sessions

| No. | Title | State | Principal result or plan |
| --- | --- | --- | --- |
| 1 | Wreck on the Black Shoals | Complete | Survivors recover the first ember-marked crate. |
| 2 | The Lantern Road | Complete | The party escorts refugees and meets the Lantern Guild. |
| 3 | Salt in the Wound | Complete | Sahuagin tracks reveal organized activity. |
| 4 | The Fractured Spire | Complete | A sealed observatory points toward Glass Harbor. |
| 5 | A Debt in Blood | Complete | Mira's family debt becomes leverage for the Crimson Wake. |
| 6 | Bells Beneath the Tide | Complete | The party hears the drowned choir for the first time. |
| 7 | Passage to Veyra | Complete | The party secures transport into the city. |
| 8 | City of Glass and Salt | Complete | Harbor factions and wards are introduced. |
| 9 | The Salty Mast | Complete | Selka Marr offers information for a favor. |
| 10 | Customs and Contraband | Complete | A false manifest connects the Synod to missing cargo. |
| 11 | Smoke over Fishmongers' Row | Complete | The party prevents an arson and finds the burned ledger. |
| 12 | The Glass Harbor | Draft | Current prototype run sheet and Dockside Ambush. |
| 13 | Under the Customs House | Planned | Explore the flooded tunnel and recover the Ember Key. |

### Player characters

| Name | Role | Immediate hook |
| --- | --- | --- |
| Kael Ardyn | Human fighter | Former Harbor Watch officer seeking who framed him. |
| Mira Vale | Half-elf rogue | Her family owes the Crimson Wake a dangerous favor. |
| Torin Stonewake | Dwarf cleric | Receives visions from bells beneath the bay. |
| Lira Fen | Elf wizard | Studies the pre-Veyran wards surrounding the Ember Key. |

### Key NPCs

| NPC | Role | Motivation | Current relationship |
| --- | --- | --- | --- |
| Captain Serin Dhal | Harbor Master | Keep trade moving while quietly exposing corruption. | Cautious ally; five backlinks. |
| Selka Marr | Crimson Wake broker | Control the key's sale without starting a faction war. | Useful, untrusted contact. |
| Prelate Oren Voss | Ashen Synod envoy | Claim the Ember Key as a holy relic. | Polite antagonist. |
| Neris Quill | Lantern Guild archivist | Prove the drowned kingdom survived beneath Veyra. | Research ally. |
| Warden Elian Rook | Harbor Watch commander | Restore order and conceal his role in the manifests. | Secret antagonist. |
| Old Mara Venn | Salty Mast proprietor | Protect dockworkers and collect every useful rumor. | Friendly information source. |

### Factions

| Faction | Public face | Hidden agenda |
| --- | --- | --- |
| Harbor Watch | Customs, patrols, and port security | Rook diverts confiscated relics to private buyers. |
| The Crimson Wake | Smugglers and dockside fixers | Wants leverage over every faction, not open rule. |
| Ashen Synod | Temple relief and historical stewardship | Believes the Hollow Crown can restore divine authority. |
| Lantern Guild | Navigators, scholars, and lighthouse keepers | Maps passages into the drowned city. |
| Choir Below | Sailors' superstition | A real cult awakening something beneath the crown vault. |

### Active quests and objectives

**Find the Ember Key**: active, high priority.

- Confirm which ship delivered the ember-marked crate.
- Decode the Burned Shipping Ledger.
- Enter the tunnel beneath the Old Customs House.
- Secure the key before the Synod or Crimson Wake.

**The Fractured Spire**: on hold.

- Identify the missing lens from the observatory.
- Compare its runes with Lira's harbor ward sketches.

**A Debt in Blood**: on hold.

- Learn what Mira's family promised Selka Marr.
- Decide whether to honor, repay, or break the debt.

**Whispers Beneath Veyra**: not started.

- Record the drowned bell sequence.
- Find a survivor who has heard the same voices.

### Prepared encounters

| Encounter | Type | Composition | Trigger | Intended use |
| --- | --- | --- | --- | --- |
| Dockside Ambush | Combat | Bandit captain, four bandits, one mastiff | Party reaches the eastern pier or attracts attention | Session 12 primary encounter |
| Sahuagin Patrol | Combat/exploration | Four sahuagin and one scout | Party searches the outer docks after midnight | Optional pressure encounter |
| City Watch Checkpoint | Social | Sergeant, four guards, customs clerk | Party transports contraband across wards | Skill challenge or negotiation |
| The Drowned Cellar | Combat/hazard | Two drowned dead, grasping tide hazard | Party opens the cellar below the Salty Mast | Discovery encounter |

Difficulty values in the prototype are display fixtures. The functional phase
will recalculate them through `@nexus/rules-5e` from pinned definitions.

### Unresolved clues

| Clue | Priority | Meaning |
| --- | --- | --- |
| Strange Symbol on Crate | High | The mark combines Synod ash script with a drowned royal seal. |
| Note from the Smuggler | Medium | Mentions a key, an eastern-pier rendezvous, and the phrase `third bell`. |
| Sahuagin Activity | Medium | Patrols avoid one submerged route directly below Customs House. |
| Broken Compass | Low | Points inland toward the Fractured Spire instead of north. |

### Handouts and lore

- Burned Shipping Ledger: names the *Dawn Petrel* and pier 6; several rows are
  deliberately missing.
- Harbormaster's Warning: Serin asks the party to watch the eastern pier without
  involving the Watch.
- The Azure Compact: historical treaty dividing salvage rights after the
  sinking of old Veyra.
- Bell-Rhyme of the Shoals: children's verse matching the cult's sequence.

### Session 12 run sheet

1. Opening recap: establish the ledger, Serin's request, and faction pressure.
2. Activate Glass Harbor Docks: evening, light rain, shift change at the Watch.
3. Open Harbormaster's Warning: give the party the eastern-pier lead.
4. Deploy Dockside Ambush: attackers attempt to seize the ledger, not kill the
   party unless cornered.
5. Share Burned Shipping Ledger: reveal `third bell` after the encounter.
6. Optional choice: follow a fleeing bandit or confront the Watch patrol.
7. Closing beat: a bell sounds from beneath the harbor at low tide.

## 11. Demo fixture requirements

Use stable readable IDs such as `campaign-ashes-of-veyra`, `session-12`,
`map-glass-harbor`, and `npc-captain-serin`. Do not use random IDs in fixtures.

The fixture set must include:

- One campaign and three acts.
- Thirteen sessions.
- At least six named NPCs and five factions.
- Four active or tracked quests with objective records.
- Four prepared encounters with composition summaries.
- Six map locations with normalized pin coordinates.
- Four unresolved clues.
- Three handouts/lore records.
- The five primary session-plan steps plus two optional beats.
- Backlink and recent-edit records matching the overview.
- Object counts matching the session-plan library even when only representative
  records are materialized. Counts are explicit fixture metadata, not fake
  arrays containing dozens of empty objects.

All cross-references use stable IDs. Tests assert that every fixture reference
resolves.

## 12. Capability handle registry

No visible command should be a silent dead control. Add one registry:

```ts
type PrototypeCapabilityStatus = 'local-demo' | 'planned' | 'disabled';

interface PrototypeCapability {
  id: string;
  label: string;
  status: PrototypeCapabilityStatus;
  targetPhase: string;
  description: string;
}
```

Minimum planned capability IDs:

| Capability ID | Visible controls | Future owner |
| --- | --- | --- |
| `campaign.search` | Global and object search | Unified prep search |
| `campaign.object.create` | Add object and add dependency | Campaign prep API |
| `campaign.object.history` | View history and revision selector | Versioned campaign objects |
| `session-plan.publish` | Publish plan | Session plan repository |
| `session-plan.preview` | Preview | Session-plan validator |
| `session-plan.activate` | Play in VTT | VTT domain command |
| `session-plan.chat-prep` | Chat Prep tab | Grounded assistant, later decision |
| `map.pin.create` | Add Pin | Campaign map repository |
| `map.object.link` | Link Object | Campaign object links |
| `map.scene.create` | Create Scene | Scene template command |
| `map.asset.replace` | Map image controls | Asset service |
| `encounter.deploy` | Encounter action | Existing VTT command path |

`CapabilityNotice` shows the label, what the control will eventually do, the
target phase, and that no data changed. Use a toast for small icon commands and
a compact popover for primary commands. Avoid modal interruptions for every
placeholder action.

## 13. Interaction matrix

| Interaction | Prototype behavior | Persistence |
| --- | --- | --- |
| Navigate Overview -> Plan Session | Real route transition | URL only |
| Navigate Session -> Map | Real route transition | URL only |
| Select campaign object | Update selected styling and inspector | Component state |
| Search fixture objects | Filter local records | Component state |
| Switch tabs | Render seeded alternate panel | Component state |
| Expand folders/steps | Toggle local disclosure | Component state |
| Reorder session step | Move in local array | Until refresh |
| Add demo step | Append one temporary reminder | Until refresh |
| Toggle readiness item | Update checked state | Until refresh |
| Select map pin | Center pin and replace inspector | Component state |
| Toggle map layer | Show/hide overlay | Component state |
| Zoom/recenter map | Update synchronized transform | Component state |
| Publish/link/create/deploy | Capability notice | No mutation |

## 14. Asset plan

Required visual assets:

- Clean top-down Glass Harbor map without pins or interface elements.
- Old Customs House location image.
- Six NPC portraits or polished initials-based portrait fallbacks.
- Four player-character portraits for future VTT run-sheet continuity.

Generate project-specific raster assets with the image-generation workflow and
store accepted outputs under:

```text
apps/codex/services/dm-ui/public/demo/ashes-of-veyra/
```

Use descriptive filenames and an `assets.ts` manifest. The UI must remain
usable if an optional portrait is unavailable. Do not extract interface
fragments from the concept screenshots; produce clean source assets so DOM
controls and pins remain independent.

## 15. Implementation batches

### A1. Visual foundation and fixtures

- Add Studio routes and default redirect.
- Add design tokens, reset, typography, and shell primitives.
- Add typed Ashes of Veyra fixtures and reference-integrity tests.
- Add the capability registry and notice component.
- Add clean demo assets or temporary deterministic placeholders.

Acceptance: fixture tests pass and all three routes render a stable shell at
`1586 x 992` without overflow or missing references.

### A2. Campaign overview

- Implement the rail, header, next-session band, four-section grid, and
  activity inspector.
- Add row selection, navigation, planned capability notices, and complete demo
  content.

Acceptance: the screen matches the reference composition and content density;
Plan Session navigates to session 12.

### A3. Session-plan authoring

- Implement the object library, folder tree, run sheet, expanded note editor,
  and details inspector.
- Add local search, tabs, checklist, disclosure, reorder, and add-step behavior.

Acceptance: the selected note and Revision 3 inspector match the reference;
all nonlocal commands identify their capability ID.

### A4. Map preparation

- Implement rails, layer controls, transformed map, six synchronized pins,
  minimap, toolbar, and location inspector.
- Add local pin selection, layer toggles, zoom, recenter, and visibility.

Acceptance: pin 04 and Old Customs House match the reference initial state;
pin alignment remains correct while zooming.

### A5. Visual hardening

- Add desktop responsive constraints for `1440 x 900` and `1280 x 800`.
- Add keyboard navigation, focus states, tooltips, reduced motion, and contrast
  checks.
- Add component tests and Playwright visual baselines.
- Replace temporary assets with accepted project assets.

Acceptance: all reference screens pass visual review and no UI text overlaps,
clips, or changes panel dimensions during interaction.

## 16. Verification

### Component tests

- Fixture reference integrity.
- Route rendering and not-found fallbacks.
- Overview selection and navigation.
- Session search, tabs, reorder, and checklist state.
- Map pin selection, layer visibility, zoom bounds, and inspector updates.
- Capability notice content for every planned ID.

Add Vitest and Testing Library to `dm-ui`; the workspace currently has no test
script or test inventory entry.

### Screenshot verification

Use Playwright at:

- `1586 x 992`: primary reference comparison.
- `1440 x 900`: common desktop constraint.
- `1280 x 800`: minimum supported prototype desktop.

For initial implementation, compare each route side-by-side with its concept
and verify these landmarks within four pixels at the reference viewport:

- Top-bar and rail boundaries.
- Left workspace and inspector widths.
- Main content gutters and section gaps.
- Header and first-row baselines.
- Bottom toolbar position on the map screen.

The generated PNGs are design references, not automated pixel baselines; map
art and corrected text make a strict source-image diff inappropriate. After
the first implementation is accepted, commit Playwright screenshots from the
real DOM as regression baselines with a low visual-difference threshold.

### Build gate

Run:

```bash
npm run lint --workspace=@nexuscodex/dm-ui
npm run build --workspace=@nexuscodex/dm-ui
npm run test --workspace=@nexuscodex/dm-ui
```

Add the test script during A1 and include the DM UI in the appropriate root and
CI test orchestration.

## 17. Definition of done

The representative frontend is complete when:

1. The three routes reproduce the approved compositions at `1586 x 992`.
2. Ashes of Veyra feels like one campaign rather than disconnected filler.
3. All visible records are fixture-driven and cross-references resolve.
4. Navigation, selection, tabs, local filters, checklists, layers, pins, and
   zoom behave convincingly.
5. Every deferred command has a registered capability handle and visible
   feedback.
6. No component writes to Dexie, the VTT API, Codex, or the asset service.
7. Keyboard focus, contrast, overflow, and text-fit checks pass.
8. Lint, build, unit tests, and accepted visual baselines pass.

## 18. Transition to functional phases

After visual acceptance, implement capabilities in dependency order rather
than screen order:

1. Replace fixture repository with canonical campaign prep reads.
2. Add versioned campaign object writes and object history.
3. Implement typed search and reference linking.
4. Persist session plans and publish revisions.
5. Persist maps, normalized pins, and scene templates.
6. Activate a published session plan in Nexus VTT.
7. Connect encounter deployment, handout sharing, and player visibility.

Each functional phase replaces one or more capability-registry entries while
preserving the approved screens and interactions.
