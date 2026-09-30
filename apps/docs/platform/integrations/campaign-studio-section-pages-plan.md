---
title: Campaign Studio section pages plan
description: Fixture registry and read-only section pages (Sessions, World, NPCs, Factions, Quests, Encounters, Maps, Lore) for Nexus Campaign Studio.
---

# Campaign Studio section pages plan

Date: 2026-09-29  
Status: proposed. Related: [visual prototype plan](./campaign-studio-visual-prototype-plan.md),
[sidecar plan](./campaign-studio-sidecar-plan.md),
[ADR 0006](../../vtt/adr/0006-campaign-studio-sidecar-boundary.md).

Scope: `apps/codex/services/dm-ui`. Paths below are relative to
`apps/codex/services/dm-ui/src` unless stated otherwise.

Today the rail lists nine sections, but only Overview, one Session plan
(`routes/SessionPlanRoute.tsx`) and one Map preparation workspace
(`routes/MapPreparationRoute.tsx`) exist, and both are hard-wired to Ashes of
Veyra. Every other rail item fires `campaign.section.open`. This plan turns the
remaining seven sections into read-only prep directories. They work for any
fixture campaign and degrade to honest empty states for real server campaigns.

Guiding rules, inherited from the visual prototype plan §4:

- Pages consume a campaign-agnostic bundle or view models. They never import a
  specific fixture module (`@/demo/ashes-of-veyra/...`) directly.
- Everything is read-only. Mutations route to the existing capability notice,
  so the UI does not pretend to save.
- No new dependencies. Use CSS Modules and `styles/design-tokens.css` only.

---

## 1. Campaign fixture registry

### 1.1 Types

New module `demo/fixture-registry/`. It re-exports the entity types from
`demo/ashes-of-veyra/types.ts`, which stays the canonical type file for now.
Moving it would collide with the agents currently authoring the other three
fixtures. The move to `demo/fixture-types.ts` is a later Haiku-tier task.

```ts
// demo/fixture-registry/types.ts
export interface CampaignFixtureBundle {
  slug: string;                       // URL segment, matches catalog slug
  campaignId: FixtureId;
  lifecycle: CampaignLifecycle;       // from demo/campaign-catalog/types.ts
  catalog: CampaignCatalogEntry;      // switcher/overview metadata
  campaign: CampaignFixture;
  acts: CampaignAct[];
  sessions: CampaignSession[];
  npcs: CampaignNpc[];
  factions: CampaignFaction[];
  quests: CampaignQuest[];
  objectives: QuestObjective[];
  encounters: CampaignEncounter[];
  clues: CampaignClue[];
  handouts: CampaignHandout[];
  locations: CampaignLocation[];
  maps: CampaignMap[];
  pins: MapPin[];
  libraryObjects: LibraryObject[];
  folders: FolderRecord[];
  sceneTemplates: SceneTemplateRef[]; // { id, title }. Replaces the SCENE_TITLES
                                      // map and the hard-coded scene ids in
                                      // inspectFixtureIntegrity
  source: 'fixture' | 'catalog-only' | 'server-empty';
  features: { publishSessionPlans: boolean }; // true only for Ashes today
}
```

`AshesOfVeyraFixtures` already has this shape minus
`slug/lifecycle/catalog/sceneTemplates/source/features`. Each fixture's
`index.ts` keeps exporting its object (`ashesOfVeyra`, `crownOfCinders`, …)
unchanged. The registry wraps each one:

```ts
// demo/fixture-registry/registry.ts
const FIXTURES: Record<string, FixtureCollections> = {
  'ashes-of-veyra': ashesOfVeyra,
  'crown-of-cinders': crownOfCinders,          // registered in task T9
  'lanterns-of-mourningfen': lanternsOfMourningfen,
  'stars-below-kharad': starsBelowKharad,
};

export function getFixtureBundle(
  slug: string, mode = import.meta.env.MODE,
): CampaignFixtureBundle | undefined;
export function listFixtureBundles(mode?: string): CampaignFixtureBundle[];
export function createEmptyBundle(summary: CampaignSummary): CampaignFixtureBundle;
```

Resolution order in `getFixtureBundle(slug)`:

1. Visibility gate. If the slug is not in `getVisibleCampaignCatalog(mode)`,
   return `undefined`. This keeps the existing production gate that only shows
   `full-demo` campaigns.
2. A registered full fixture → `source: 'fixture'`.
3. Otherwise a catalog entry → `bundleFromCatalogEntry(entry)`. That bundle
   holds only `showcaseSessions` and `playerCharacters`, and every other
   collection is `[]`, with `source: 'catalog-only'`. If a sibling fixture
   lands late or is dropped, the sections still render: Sessions shows
   something and the rest show empty states.

Bundles are frozen, module-level singletons built once at import. Pages get
them through one hook:

```ts
// features/section-shell/useCampaignBundle.ts
type BundleState =
  | { status: 'loading' }
  | { status: 'missing'; reason: 'unknown-slug' | 'campaign-unavailable' }
  | { status: 'ready'; bundle: CampaignFixtureBundle; basePath: string };
export function useCampaignBundle(): BundleState;
```

- For `/demo/:slug/*` routes, the hook calls `getFixtureBundle(slug)` synchronously.
- For `/campaigns/:campaignId/*` routes, it reads `useCampaignContext()`. That
  context's `state` supplies `loading`, and a missing `activeCampaign` maps to
  `missing`. A ready campaign maps to `createEmptyBundle(activeCampaign)`, with
  `lifecycle: 'draft'` and `source: 'server-empty'`.
- `basePath` is `/demo/<slug>` or `/campaigns/<encoded id>`. Every link is
  built from it, so pages never branch on demo vs. real.

### 1.2 Entity index and backlinks

`demo/fixture-registry/entityIndex.ts` builds a lazily memoized index per bundle
(a `WeakMap<bundle, EntityIndex>`):

```ts
type EntityKind = 'session' | 'location' | 'npc' | 'faction' | 'quest'
  | 'objective' | 'encounter' | 'map' | 'clue' | 'handout' | 'scene';
interface EntityRef { id: string; kind: EntityKind; label: string; href?: string }
resolveEntity(bundle, id): EntityRef | undefined     // href is relative to basePath
getBacklinks(bundle, id): EntityRef[]                // reverse of every *Id / *Ids field
```

`getBacklinks` is generic. It walks every id-bearing field listed in the
current `inspectFixtureIntegrity` and inverts it. This matters because the data
is not symmetric. For example, `CampaignEncounter` has no `npcIds`, and
`CampaignNpc.sessionIds` may not mirror `CampaignSession.npcIds`. Every detail
pane shows the union of forward links and backlinks, deduplicated and grouped
by kind. Objectives resolve to their parent quest's href with `#objective-<id>`.

### 1.3 Integrity

Generalize `inspectFixtureIntegrity()` to `inspectBundleIntegrity(bundle)` in
`demo/fixture-registry/integrity.ts`. It takes the same checks, but gets its
data from the bundle and includes `sceneTemplates` ids. Ashes'
`inspectFixtureIntegrity()` becomes a one-line wrapper so
`fixtures.test.ts` stays green. `registry.test.ts` loops over
`listFixtureBundles('test')` and asserts zero issues for every bundle. That
gives the three in-flight fixtures a gate without touching their files.

### 1.4 Seam for server data

`CampaignFixtureBundle` is the read model that pages depend on. Later, a
`campaign-prep` adapter (`services/campaign-bundle-api.ts`) maps
`/api/campaigns/:id/prep/objects` records (`PrepObjectRecord.kind`:
`session-plan`, `note`, `scene-template`, …) into the same shape. The only
change is that `useCampaignBundle` gains a real async branch for `/campaigns/`
routes and `source` gains `'server'`. Pages, shared components and routes do
not change. Until then, `createEmptyBundle` is the truthful representation:
the server has the campaign's name and description and nothing else the
sections can list.

### 1.5 Type additions (small, backwards compatible)

| Change | Why |
| --- | --- |
| `CampaignFixture.status: 'active'` → `CampaignLifecycle` | Other fixtures are draft/paused/complete. |
| `CampaignLocation.type` → `string` (UI humanizes it; known values keep icons) | Marsh, hold and court locations don't fit the harbor union. |
| `CampaignLocation.parentLocationId?: FixtureId` | Needed for the World hierarchy. Ashes: set every location except `location-glass-harbor` to `location-glass-harbor`. |
| `CampaignLocation.mapId?` / `pinId?` optional | Not every location is pinned. |
| `CampaignMap.imagePath?` optional | Maps without art render a placeholder tile. |
| `CampaignQuest.resolution?: string` | Complete campaigns show how a quest ended. Rendered only when present. |
| Bundle-level `sceneTemplates: {id, title}[]` | Removes the `SCENE_TITLES` and hard-coded scene-id hacks. |

No other fields are added. Everything in §2 renders from existing fields.

---

## 2. Section pages

### 2.0 Common anatomy

Every entity section uses the same `SectionLayout`:

```
┌ SectionHeader: title · count · LifecycleBanner (if not active) ──────────────┐
├ FilterBar (search + ≤3 facet selects + sort) ────────────────────────────────┤
│ EntityList (master, 360px = --studio-library-width) │ Detail pane (fluid)    │
│  grouped rows, 48–58px                               │  header, fields,       │
│                                                      │  Related (EntityLinks) │
└──────────────────────────────────────────────────────┴───────────────────────┘
```

- Selection lives in the URL: `/<section>/:entityId`. Clicking a row navigates,
  so every cross-link is a real, shareable URL and Back works.
- With no `:entityId`, the detail pane shows a Section summary card: counts by
  status, plus "In next session" items for an active campaign.
- An unknown `:entityId` shows an inline "Not found in this campaign" in the
  detail pane, with a link back to the section. Never redirect silently.
- Filters and sort persist in the query string (`?status=active&sort=name`), so
  links keep the view.
- Below 1020px the layout is one column. The list shows when no id is set, the
  detail shows when an id is set, and the detail gets a "← All NPCs" back link.
- DM-only content (`hiddenAgenda`, `visibility: 'dm-only'`, `tactics`) always
  shows a `DM only` badge. There is no player-view toggle yet.
- Mutating affordances are visible but stubbed. "New <thing>" calls
  `campaign.object.create`, and the overflow menu calls
  `campaign.object.actions`. There are no edit forms.

**Lifecycle treatment** (`bundle.lifecycle`, shared by all sections):

| Lifecycle | Banner | Default emphasis |
| --- | --- | --- |
| draft | "Draft campaign — nothing has been played yet." | Prep gaps: unplanned sessions, not-started quests, unlinked NPCs. |
| active | none | The current/next session (`campaign.currentSessionId` or `catalog.selectedSessionId`) and what it touches. |
| paused | "Paused — last played Session N." (the highest `complete` session) | Open threads: active/on-hold quests, unresolved clues. |
| complete | "Campaign complete — read as a chronicle." | History: completed sessions in order, quest resolutions. Upcoming-oriented chips are hidden. |

The banner uses `role="status"` with the `--studio-info-soft` token for paused
and complete, and `--studio-neutral-soft` for draft.

### 2.1 Sessions

- **Purpose:** See the campaign's arc at a glance and jump into a run sheet.
- **Layout:** The master list is a timeline grouped by act (`acts` ordered by
  `order`, act status badge, act summary collapsed). Each row shows
  `#number`, `title`, a `status` badge, `plannedDate`, `partyLevel`, and a
  run-sheet icon when `plan` exists. Sessions without an act (catalog-only)
  go under "Sessions".
- **Detail:** Shows `summary`, date/duration/level, `tags`, and the Related
  groups (quests, NPCs, factions, locations, encounters, clues, handouts),
  built from the session's own id arrays plus backlinks. When the session has
  a `plan`, the detail also shows plan readiness (`readiness` complete/total)
  and an **Open run sheet** primary button → `/sessions/:id/plan`. Without a
  plan, it shows "Plan this session" (stub: `campaign.object.create`).
- **Filters/sort:** Status (complete/draft/planned), act. The order is always
  by number. Default scroll and selection follow the lifecycle: active selects
  the current session, paused the last complete one, complete the last one,
  and draft the first planned or draft one.
- **Lifecycle:** Complete campaigns hide "Plan this session" and label the
  timeline "Chronicle".
- **Empty:** "No sessions yet. Sessions you plan will appear here as a
  timeline." with a stubbed Plan button.
- **Run-sheet route:** `SessionPlanRoute` becomes parameterized by
  `:sessionId` and builds its view model from the bundle. Publish and activate
  stay live only when `bundle.features.publishSessionPlans` is true (Ashes).
  Everywhere else they notify `session-plan.publish` / `.activate`.

### 2.2 World (locations)

- **Purpose:** A place-first index. "Where can the party go, and what's there?"
- **Layout:** The master is a tree built from `parentLocationId`. Roots are
  sorted by name and children sorted by name. It uses the `role="tree"`
  pattern, with expand/collapse persisted in the query string (`?open=`).
  Rows show the name, the humanized `type`, and small counts (NPCs,
  encounters).
- **Detail:** Shows `imagePath` (if present), `shortDescription`,
  `description[]`, `tags`, and `notes` (DM only). The Related groups are NPCs,
  factions, encounters, quests, handouts, and the sessions from backlinks.
  **On map:** when `mapId` is set, a map chip → `/maps/:mapId?pin=:pinId`.
  **Scene template:** when `sceneTemplateId` is set, a label from
  `sceneTemplates`, stubbed to `map.scene.create`.
- **Filters/sort:** Type, tag, and "has map pin". Typing in search flattens the
  tree to matching rows, each with a parent breadcrumb.
- **Lifecycle:** Active emphasizes locations whose ids appear in the next
  session's `locationIds` (an "Next session" chip). Other lifecycles show no
  special emphasis.
- **Empty:** "No locations yet." with "New location" (stub).

### 2.3 NPCs

- **Purpose:** Quick recall of who someone is, what they want, and where the
  party met them.
- **Layout:** Rows show a `portraitFallback` monogram, `name`, `role`, and the
  first faction chip. Rows are grouped by primary faction (the first in
  `factionIds`), with "Unaffiliated" last.
- **Detail:** `role` · `ancestry`, **Motivation**, **Relationship to party**,
  `tags`. The Related groups are factions (with "Leads" when a faction's
  `leaderNpcId` matches), locations, quests given (quests where
  `giverNpcId === npc.id`), sessions (appearances, ordered by number), and
  handouts/encounters from backlinks.
- **Filters/sort:** Faction, location, tag. Sort by name, or by last
  appearance (max session number among appearances). The default sort is last
  appearance for active and paused campaigns, and name otherwise.
- **Lifecycle:** Draft shows an "Unused" marker on NPCs with no sessions,
  quests or encounters, which helps spot prep gaps.
- **Empty:** "No NPCs yet." with "New NPC" (stub).

### 2.4 Factions

- **Purpose:** Track the political map and hidden agendas.
- **Layout:** Rows are grouped by `status`, in this order: opposition, unknown,
  neutral, ally. Each row shows the name, a status badge, and the leader name.
- **Detail:** **Public face**, **Hidden agenda** (DM-only badge), leader
  (NPC link), a **Relations** strip with allies and rivals as faction chips
  tinted positive and danger, members (NPCs whose `factionIds` include this
  faction), locations, quests, and encounters from backlinks.
- **Filters/sort:** Status. Sort by name or member count.
- **Lifecycle:** No special treatment. Status already carries the meaning.
- **Empty:** "No factions yet." with "New faction" (stub).

### 2.5 Quests

- **Purpose:** What the party is chasing and what's blocking it.
- **Layout:** Rows are grouped by `status`: active, on-hold, not-started,
  complete. The complete group is collapsed by default except in complete
  campaigns. Rows show the title, a `priority` badge, and objective progress
  as "2/4" (complete objectives out of total).
- **Detail:** `summary`, the giver (NPC link), and an **Objectives** checklist
  (a read-only list ordered by `order`). Each objective shows its status
  badge, with linked clue and location chips and `id="objective-<id>"` as an
  anchor. The Related groups are factions, locations, and sessions.
  `resolution` shows when present.
- **Filters/sort:** Priority and faction. Sort by priority (high→low, the
  default) or title.
- **Lifecycle:** Paused campaigns badge active and on-hold quests as "Open
  thread". Complete campaigns expand the complete group first.
- **Empty:** "No quests yet." with "New quest" (stub).

### 2.6 Encounters

- **Purpose:** Pick and review prepared fights and social scenes.
- **Layout:** Rows show the title, a `kind` label, a `difficulty` badge
  (low=neutral, moderate=warning, high=danger), and the participant total
  (the sum of `composition[].count`).
- **Detail:** `trigger`, `intendedUse`, **Composition** as a table (name ×
  count, role, ruleset), **Tactics** (DM only), `rulesetNotes`, and the
  Related groups (locations, factions, sessions). **Deploy to VTT** is stubbed
  to the existing `encounter.deploy` capability.
- **Filters/sort:** Kind and difficulty. Sort by title or by the next session
  it's used in.
- **Lifecycle:** Complete campaigns hide Deploy. Active campaigns show a "Next
  session" chip on encounters in the next session's `encounterIds`.
- **Empty:** "No encounters prepared." with "New encounter" (stub).

### 2.7 Maps

- **Purpose:** Choose a map to prepare.
- **Layout:** This section has no master/detail. The index at `/maps` is a
  card grid. Each card shows an `imagePath` thumbnail (or a token-tinted
  placeholder with a MapPin icon), the `title`, `description` clamped to two
  lines, and "N pinned locations · M layers". Clicking a card opens the
  existing prep workspace at `/maps/:mapId`.
- **Prep workspace:** `MapPreparationRoute` becomes parameterized by `:mapId`
  and builds its model from the bundle. It honors `?pin=` for the initial
  `selectedPinId`, and scene titles come from `sceneTemplates`. The
  workspace's own "back to overview" link becomes "← Maps"
  (`${basePath}/maps`).
- **Empty:** "No maps yet." with "Upload map" (stub: `map.asset.replace`).

### 2.8 Lore

- **Purpose:** The campaign's paper trail, meaning clues to track and
  documents to hand out.
- **Layout:** The page has three tabs (`role="tablist"`, persisted as
  `?tab=`), and each tab uses the common master/detail.
  - **Clues** (default): Rows are grouped by `status` (unresolved,
    partially-understood, resolved) with a `priority` badge. The detail shows
    `meaning` (DM only), source handouts, related quests, locations, and
    sessions.
  - **Handouts:** Rows show the title, `kind` (handout or lore), and a
    `visibility` badge (Player-ready or DM only). The detail shows `summary`
    and renders `content[]` as paragraphs in a bordered "document" panel,
    followed by the Related groups: clues, quests, locations, factions,
    sessions. "Share with players" is stubbed.
  - **Library:** A read-only folder view. `folders` are ordered by their act,
    each with its `children` counts and the `objectIds` it contains, resolved
    through `resolveEntity`, so rows link to the owning section. Library
    objects whose ids don't resolve (scenes) show as plain rows.
- **URL:** `/lore/:loreId` accepts either a clue id or a handout id. The tab is
  inferred from the entity kind when `?tab` is absent.
- **Filters:** Clues filter by status and priority. Handouts filter by kind
  and visibility.
- **Lifecycle:** Paused campaigns sort unresolved high-priority clues first.
  Complete campaigns default the Clues tab to the resolved group expanded.
- **Empty:** Each tab gets its own empty state. Library says "Folders appear
  once objects are organized by act."

### 2.9 Deliberately out of scope

The following are out of scope: editing any field, drag reordering,
relationship graphs, a timeline across the whole calendar, player-view
previews, global search (still `campaign.search`), fetching real campaign
objects, and Overview for non-Ashes fixtures (it stays
`FixtureCampaignOverview`).

---

## 3. Routes, shared components, CSS, a11y

### 3.1 Route table (in `App.tsx`)

| Path (under `demo/:fixtureSlug` and `campaigns/:campaignId`) | Element |
| --- | --- |
| `overview` | existing routes (unchanged) |
| `sessions/:sessionId?` | `SessionsSectionRoute` |
| `sessions/:sessionId/plan` | `SessionPlanRoute` (parameterized) |
| `world/:locationId?` | `WorldSectionRoute` |
| `npcs/:npcId?` | `NpcsSectionRoute` |
| `factions/:factionId?` | `FactionsSectionRoute` |
| `quests/:questId?` | `QuestsSectionRoute` |
| `encounters/:encounterId?` | `EncountersSectionRoute` |
| `maps` | `MapsSectionRoute` (index) |
| `maps/:mapId` | `MapPreparationRoute` (parameterized) |
| `lore/:loreId?` | `LoreSectionRoute` |

Each route is registered twice, once per prefix, from a single
`SECTION_ROUTES` array in `routes/sectionRoutes.tsx`. Legacy links:

- `demo/ashes-of-veyra/maps/glass-harbor` → `Navigate` to `…/maps/map-glass-harbor`.
- `campaigns/ashes-of-veyra/sessions/session-12` → `/demo/ashes-of-veyra/sessions/session-12/plan`.
- `campaigns/ashes-of-veyra/maps/glass-harbor` → `/demo/ashes-of-veyra/maps/map-glass-harbor`.
- `demo/ashes-of-veyra/sessions/session-12` now selects Session 12 in the list,
  with **Open run sheet** one click away. `campaign-overview.tsx` links change
  to `/plan` so the Overview → run sheet flow is unchanged.

Real campaigns (`/campaigns/:id/<section>`) render the same components with
`createEmptyBundle`. Every section shows its empty state. Sessions `:id/plan`
and `maps/:mapId` render "Not found in this campaign", because an empty bundle
has no sessions or maps.

### 3.2 Shared components: `features/section-shell/`

These are extracted now because seven screens need them (the prototype plan
§4 requires "≥2 screens").

- `SectionRoute.tsx`: The `StudioFrame` wrapper, plus `useCampaignBundle`,
  loading/missing states, and `contextLabel`. Section routes are about 10
  lines each.
- `SectionLayout.tsx` (+ `.module.css`): Header, filter slot, master list,
  detail pane, the responsive single-pane switch, and the Back link.
- `EntityList.tsx`: A grouped listbox. Props: `groups: {id,label,items}[]`,
  `renderRow`, `selectedId`, `getHref`. Rows are links (`NavLink`), not
  buttons.
- `EntityLink.tsx`: A chip showing kind icon + label → `basePath + ref.href`.
  An unresolved id renders a muted, non-link chip ("Missing reference") and
  never throws.
- `RelatedGroups.tsx`: Takes forward ids + `getBacklinks`, groups by kind, and
  renders `EntityLink` lists under `h3`s.
- `FilterBar.tsx`: A search input plus facet `<select>`s and a sort
  `<select>`, bound to query params through a `useSectionQuery()` hook.
- `StatusBadge.tsx`: One `tone` → token map. `positive | warning | danger |
  neutral | info`. Each domain enum maps to a tone in `statusTones.ts`.
- `LifecycleBanner.tsx`, `EmptyState.tsx`, `SectionSummary.tsx`.
- `useCampaignBundle.ts`, `useSectionQuery.ts`.

### 3.3 CSS approach

- Use CSS Modules per component. Colors, radii, gaps and z-index come only from
  `--studio-*` tokens. Add three tokens to `design-tokens.css`:
  `--studio-row-height: 52px`, `--studio-detail-max: 760px` (the readable
  line length for the detail body), and `--studio-section-breakpoint`, which
  is documentation only because media queries can't read variables. Use
  `1020px` literally, matching `campaign-overview.module.css`.
- Section-specific modules (`NpcsSection.module.css`, …) cover only content
  layout inside the detail pane: field grids and the composition table.
- Include `prefers-reduced-motion`. The only motion is the tree expand chevron.

### 3.4 Accessibility

- Every page has a `<main>` with one `h1` (the section name). The detail title
  is `h2` and Related group titles are `h3`.
- Master lists are `<nav aria-label="NPC list">` containing `<ul>` of links,
  with `aria-current="page"` on the selected row. Do not build a custom
  listbox, so keyboard and screen-reader behavior comes for free.
- World uses the WAI-ARIA tree pattern (`role="tree"`, `treeitem`,
  `aria-expanded`, and arrow-key handling in one small hook).
- Lore tabs follow the tabs pattern with roving tabindex. The tab state lives
  in the URL.
- On selection change, move focus to the detail `h2` (`tabIndex={-1}`) only on
  single-pane widths. On desktop, focus stays in the list.
- Status is never conveyed by color alone. Badges always carry text.
- The DM-only badge text is "DM only", not an icon.
- The filter bar inputs have visible labels (a visually hidden label is fine
  for search). The result count is announced through an `aria-live="polite"`
  span ("12 NPCs").
- Stubbed buttons stay enabled and open the capability notice, which is
  already accessible. Don't use `disabled`, because disabled controls hide
  intent from screen readers.

---

## 4. Implementation plan

The tasks are ordered and each one ships alone (green `npm run test`,
`type-check`, `lint` in `apps/codex/services/dm-ui`). Parallel groups touch
disjoint files.

### T1: Fixture registry and type widening (Sonnet)

- **Files:**
  - `demo/fixture-registry/{types,registry,entityIndex,integrity,index}.ts`
    and `registry.test.ts`, `entityIndex.test.ts`.
  - `demo/ashes-of-veyra/types.ts` (the §1.5 widenings).
  - `demo/ashes-of-veyra/locations.ts` (`parentLocationId`).
  - `demo/ashes-of-veyra/index.ts` (add `sceneTemplates`, and make
    `inspectFixtureIntegrity` delegate).
- **Registers:** Ashes, plus catalog-only fallback for the other three.
- **Tests:**
  - Every visible bundle passes `inspectBundleIntegrity`.
  - `getFixtureBundle` honors the production gate.
  - `bundleFromCatalogEntry` yields sessions with empty collections.
  - `resolveEntity`/`getBacklinks` round-trip, e.g. Captain Serin ←
    `quest.giverNpcId` and ← `session.npcIds`.
  - `createEmptyBundle` yields `lifecycle: 'draft'`.
- **Coordination:** Announce the §1.5 widenings to the fixture agents before
  merging. Widening is compatible with anything they've written.

### T2: Section shell, route table, rail wiring (Sonnet). Depends on T1.

- **Files:**
  - `features/section-shell/*` (§3.2).
  - `routes/sectionRoutes.tsx`.
  - Seven placeholder files, `routes/sections/{Sessions,World,Npcs,Factions,Quests,Encounters,Lore}SectionRoute.tsx`,
    plus `routes/sections/MapsSectionRoute.tsx`. Each renders `SectionRoute`
    with an `EmptyState` "Coming soon". This is what lets later tasks edit
    only their own file.
  - `App.tsx` (the route table and legacy redirects from §3.1).
  - `features/studio-shell/StudioCampaignRail.tsx`.
  - `features/campaign-overview/campaign-overview.tsx` (update the two
    `navigate` targets).
  - `styles/design-tokens.css` (the three tokens).
- **Rail wiring change:**
  - `activeRoute` is derived from the path segment after `campaignBase`
    (`pathname.slice(campaignBase.length).split('/')[1] ?? 'overview'`),
    instead of `includes('/sessions/')`.
  - `selectRoute` becomes `navigate(\`${campaignBase}/${route}\`)` for every
    item, including real campaigns.
  - Delete the Ashes-specific branches and the `#sessions` hack.
  - `campaign.section.open` stays in the registry (it's used by the Overview
    "view all" links), but the rail no longer fires it. Mark its registry
    status `implemented` in T10.
- **Tests:**
  - `features/section-shell/SectionLayout.test.tsx`: single-pane switch via
    the `matchMedia` mock, empty state, and not-found detail.
  - `EntityLink.test.tsx`: an unresolved id renders non-link.
  - Extend `StudioFrame.test.tsx`: each rail item navigates to
    `/demo/ashes-of-veyra/<route>` and sets `aria-current`, and under
    `/campaigns/:id` the rail navigates to `/campaigns/:id/npcs`.
  - Extend `routes/CampaignRoutes.test.tsx`: legacy redirects land on the new
    paths, `/campaigns/campaign-blank/npcs` renders the empty state, and an
    unknown slug renders "Example campaign unavailable".
  - `SessionPlanRoute.test.tsx` stays unchanged.

### Parallel group A: section pages (after T2, all in parallel)

Each task owns `features/<section>/` (component, `.module.css`, view-model
builder `<section>Models.ts`, tests) plus its single
`routes/sections/<X>SectionRoute.tsx` file. None touch `App.tsx`, the rail, or
another section. View-model builders are pure functions
`(bundle, query) => ViewModel`. They get unit tests, and the component gets an
RTL test rendered through a shared `renderSection(path)` helper that T2 adds
to `features/section-shell/testUtils.tsx`.

| Task | Tier | Feature dir | Key tests |
| --- | --- | --- | --- |
| T3 Sessions list | Sonnet | `features/sessions/` | Act grouping order. Lifecycle default selection per lifecycle (use all four fixtures). "Open run sheet" only when `plan` exists. Catalog-only bundle renders the ungrouped list. |
| T4 World | Sonnet | `features/world/` | Tree built from `parentLocationId`. Arrow-key expand/collapse. Search flattens with breadcrumb. Map chip href `maps/map-glass-harbor?pin=…`. |
| T5 NPCs | Sonnet | `features/npcs/` | Faction grouping + "Unaffiliated". Last-appearance sort. Quests-given backlink. Draft "Unused" marker. |
| T6 Factions | Haiku | `features/factions/` | Status group order. Allies/rivals chips. Members derived from NPC `factionIds`. |
| T7 Quests + Encounters | Sonnet | `features/quests/`, `features/encounters/` | Objective progress count and `#objective-` anchors. Participant total. Deploy fires `encounter.deploy`. Complete lifecycle hides Deploy. |
| T8 Lore | Sonnet | `features/lore/` | Tab inferred from `:loreId` kind. Roving tabindex. Handout `content[]` renders as paragraphs. Library folder rows link through `resolveEntity`. |

T7 bundles two small, similar sections to limit placeholder churn. Each of the
two directories is still disjoint.

### Parallel group B: workspaces (after T2, parallel with group A)

- **T8b Parameterized run sheet (Sonnet):**
  - **Files:** `routes/SessionPlanRoute.tsx`,
    `features/session-plan/buildSessionPlanModel.ts` (moved out of the route),
    and `routes/SessionPlanRoute.test.tsx`.
  - **Change:** `buildSessionPlanModel(bundle, sessionId)` replaces the
    hard-coded `session12Plan`/`sessions` imports. Publish/activate are gated
    on `bundle.features.publishSessionPlans`.
  - **Tests:** The existing suite passes at `/demo/ashes-of-veyra/sessions/session-12/plan`.
    A Crown of Cinders plan renders, and its Publish button fires
    `session-plan.publish`. An unknown session id renders not-found.
- **T8c Parameterized map prep + Maps index (Sonnet):**
  - **Files:** `routes/MapPreparationRoute.tsx`,
    `features/map-preparation/buildMapPreparationModel.ts`, the
    `MapPreparation.tsx` back link (the `basePath` prop), and
    `routes/sections/MapsSectionRoute.tsx` with `features/maps/`.
  - **Tests:** `?pin=` selects the pin. Scene titles come from
    `sceneTemplates`. The index card links to `maps/:mapId`. The no-image
    placeholder renders.

### T9: Register the three new fixtures (Haiku). After the fixture agents land.

- **Files:** `demo/fixture-registry/registry.ts` (three import lines + map
  entries) and `demo/campaign-catalog/catalog.ts` (flip `fixtureSource` to
  `'full-demo'` only if the product owner wants them visible in production.
  Default: leave them as `'catalog'`).
- **Tests:** The `registry.test.ts` integrity loop now covers them. Fix data
  only in the offending fixture's own files. Add one smoke test per slug that
  renders `/demo/<slug>/npcs` and finds a known NPC name.

### T10: Hardening pass (Haiku). Last.

- Set `campaign.section.open` to `implemented` in `capabilities.ts`.
- Screenshot pass at 1440/1020/390 widths for the four fixtures × seven
  sections, following visual prototype plan §16.
- Run axe via the existing Playwright setup, if present. Otherwise fall back
  to RTL role queries.
- Update `campaign-studio-visual-prototype-plan.md` §4 to point to this
  document and the registry.

### Order summary

```
T1 ──► T2 ──┬─► T3, T4, T5, T6, T7, T8     (group A, parallel)
            └─► T8b, T8c                   (group B, parallel with A)
fixture agents done ──► T9 (needs T1) ──► T10 (after everything)
```

Each group-A/B task leaves the other placeholders in place, so main is
shippable after every merge.

## 5. Addendum: editing (supersedes "everything is read-only")

Decisions (product owner):

- Real campaigns (`/campaigns/:id`) are **editable**; example campaigns
  (`/demo/:slug`) stay read-only and offer **"Start from this example"**, which
  creates a new real campaign seeded from the fixture through the prep API.
- **One page per section per campaign.** No per-item pages or "New" buttons on
  detail panes. The only creation flows are: create campaign (blank), and
  start-from-example. Adding an item is a single **"Add" row at the bottom of
  the section list** (inline, creates the object and selects it); editing is
  in place in the detail pane (Edit / Save / Cancel).
- **First-cut edit scope:** NPCs, Factions, Quests (incl. objectives),
  Locations, Lore and Handouts (a single formattable multi-line text field).
  Sessions keep the existing run-sheet editor. **Encounters and Maps remain
  read-only.** Do NOT add an encounter object kind or schema: encounters must
  later tie into the VTT initiative panel and are designed separately.
- Lore and handouts are simple formattable notes the DM builds to give to some
  or all players: title, rich multi-line body (reuse the existing Lexical
  editor / markdown setup already used in dm-ui if present; otherwise a
  textarea with markdown), and an audience (`all` or a list of player
  character ids). Server kind: `lore` (handouts = `lore` with
  `subtype: 'handout'`), or `note` if the schema requires; inspect
  apps/vtt/server/routes/campaignPrep.routes.ts and the repository validation
  and choose the minimal mapping without changing server schemas unless
  unavoidable (if unavoidable, keep the change additive and tested).
- Save honesty: UI states `idle | saving | saved | conflict | error`; "saved"
  only after the server response. Server revisions are compare-and-swap; a
  409 shows a conflict banner with "Reload latest".

### 5.1 Store seam (shared contract; defined in `features/section-shell/bundleStore.ts`)

```ts
export type SaveState = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';
export type EditableKind = 'npc' | 'faction' | 'quest' | 'location' | 'lore';
export interface SaveResult { ok: boolean; conflict?: boolean; error?: string }
export interface BundleStore {
  bundle: CampaignFixtureBundle;
  status: 'loading' | 'ready' | 'error';
  editable: boolean;          // false for fixtures / catalog-only / no permission
  reload(): Promise<void>;
  // patch is the section's entity shape (Partial<CampaignNpc> etc.)
  updateItem(kind: EditableKind, id: string, patch: Record<string, unknown>): Promise<SaveResult>;
  addItem(kind: EditableKind, draft: Record<string, unknown>): Promise<SaveResult & { id?: string }>;
}
```

`useBundleStore()` returns a read-only store for fixtures (`editable: false`,
mutations resolve `{ ok:false, error:'read-only' }`) and a server-backed store
for real campaigns, implemented in `services/campaign-bundle-api.ts` (load
prep objects into a bundle with `source: 'server'`; map back on save;
optimistic revision tracking; `seedFromFixture(slug) => campaignId`).

### 5.2 Task changes

- **T2** additionally defines `bundleStore.ts`, `useBundleStore`, the
  read-only fixture store, an `EditableSection` scaffold (Edit/Save/Cancel,
  SaveState banner, list-bottom "Add" row) and the "Start from this example"
  action (calls `seedFromFixture` from T-S, behind a prop until it lands).
- **T-S (parallel with T2, disjoint files):** `services/campaign-bundle-api.ts`
  (+ tests): load, map, save, add, seed-from-fixture, conflict handling,
  lore/handout mapping. Reuse `campaign-prep-api.ts` request helpers.
- **T3–T8** section tasks: NPCs, Factions, Quests, World (locations), Lore
  (incl. handouts) get edit forms via `EditableSection`; Sessions, Encounters,
  Maps stay read-only apart from the existing run sheet.
