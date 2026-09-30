import type { CampaignSummary } from '../../services/campaign-api';
import { ashesOfVeyra } from '../ashes-of-veyra';
import {
  getCampaignCatalogEntryBySlug,
  getVisibleCampaignCatalog,
} from '../campaign-catalog/catalog';
import type { CampaignCatalogEntry } from '../campaign-catalog/types';
import { crownOfCinders } from '../crown-of-cinders';
import { lanternsOfMourningfen } from '../lanterns-of-mourningfen';
import { starsBelowKharad } from '../stars-below-kharad';
import type {
  CampaignCollections,
  CampaignFixture,
  CampaignFixtureBundle,
  CampaignHandout,
  CampaignNote,
  LibraryObject,
  SceneTemplateRef,
} from './types';

/** What each fixture module exports; scene templates are optional. */
type FixtureModule = Omit<CampaignCollections, 'sceneTemplates' | 'notes'> & {
  sceneTemplates?: SceneTemplateRef[];
};

const FIXTURES: Record<string, FixtureModule> = {
  'ashes-of-veyra': ashesOfVeyra,
  'crown-of-cinders': crownOfCinders,
  'lanterns-of-mourningfen': lanternsOfMourningfen,
  'stars-below-kharad': starsBelowKharad,
};

/** Only Ashes has live publish/activate wiring for session plans. */
const PUBLISHING_SLUGS: ReadonlySet<string> = new Set(['ashes-of-veyra']);

/** Fixtures without an explicit list treat `scene-*` library objects as templates. */
function deriveSceneTemplates(
  libraryObjects: readonly LibraryObject[],
): SceneTemplateRef[] {
  return libraryObjects
    .filter((item) => item.kind === 'scene' && item.id.startsWith('scene-'))
    .map((item) => ({ id: item.id, title: item.title }));
}

/** Read-only notes for examples: fixture lore, campaign-wide. */
function deriveNotes(fixture: FixtureModule): CampaignNote[] {
  return fixture.handouts
    .filter((item) => item.kind === 'lore')
    .map((item, index) => ({
      id: item.id,
      campaignId: item.campaignId,
      title: item.title,
      body: item.content.length > 0 ? item.content.join('\n\n') : item.summary,
      anchor: { type: 'campaign' },
      color: 'yellow',
      size: 'small',
      order: index,
    }));
}

/**
 * Read-only handout organization for examples: folder and order come from the
 * fixture folder that lists the handout; shared handouts go to all players.
 */
function deriveHandouts(fixture: FixtureModule): CampaignHandout[] {
  return fixture.handouts.map((item, index) => {
    const folder = fixture.folders.find((entry) =>
      entry.objectIds.includes(item.id),
    );
    return {
      ...item,
      ...(folder ? { folderId: folder.id } : {}),
      order: folder ? folder.objectIds.indexOf(item.id) : index,
      audience: item.visibility === 'shared' ? 'all' : 'hidden',
      body: item.content.join('\n\n'),
    };
  });
}

function bundleFromFixture(
  entry: CampaignCatalogEntry,
  fixture: FixtureModule,
): CampaignFixtureBundle {
  return Object.freeze({
    ...fixture,
    sceneTemplates:
      fixture.sceneTemplates ?? deriveSceneTemplates(fixture.libraryObjects),
    handouts: deriveHandouts(fixture),
    notes: deriveNotes(fixture),
    slug: entry.slug,
    campaignId: fixture.campaign.id,
    lifecycle: entry.lifecycle,
    catalog: entry,
    source: 'fixture',
    features: { publishSessionPlans: PUBLISHING_SLUGS.has(entry.slug) },
  });
}

function emptyCollections(): Omit<CampaignCollections, 'campaign'> {
  return {
    acts: [],
    sessions: [],
    npcs: [],
    factions: [],
    quests: [],
    objectives: [],
    encounters: [],
    clues: [],
    handouts: [],
    locations: [],
    maps: [],
    pins: [],
    libraryObjects: [],
    folders: [],
    sceneTemplates: [],
    notes: [],
  };
}

/**
 * A bundle holding only what the catalog knows: showcase sessions and player
 * characters. Every other collection is empty. Used for catalog entries that
 * have no registered full fixture.
 */
export function bundleFromCatalogEntry(
  entry: CampaignCatalogEntry,
): CampaignFixtureBundle {
  const campaign: CampaignFixture = {
    id: entry.campaign.id,
    title: entry.campaign.name,
    subtitle: entry.subtitle,
    premise: entry.premise,
    ruleset: entry.ruleset,
    edition: entry.edition,
    status: entry.lifecycle,
    currentSessionId: entry.selectedSessionId,
    actIds: [],
    sessionIds: entry.showcaseSessions.map((session) => session.id),
    playerCharacters: entry.playerCharacters,
    objectCounts: {
      all: 0,
      scenes: 0,
      encounters: 0,
      npcs: 0,
      lore: 0,
      handouts: 0,
    },
    nextSession: {
      sessionId: entry.selectedSessionId,
      plannedDate: '',
      time: '',
      relativeDate: '',
      encounterId: '',
      npcId: '',
      locationId: '',
      questId: '',
    },
    activity: { backlinks: [], recentEdits: [] },
  };
  return Object.freeze({
    ...emptyCollections(),
    campaign,
    sessions: entry.showcaseSessions,
    slug: entry.slug,
    campaignId: entry.campaign.id,
    lifecycle: entry.lifecycle,
    catalog: entry,
    source: 'catalog-only',
    features: { publishSessionPlans: false },
  });
}

/**
 * The truthful bundle for a real server campaign: the server knows a name and
 * description and nothing else the section pages can list.
 */
export function createEmptyBundle(
  summary: CampaignSummary,
): CampaignFixtureBundle {
  const entry: CampaignCatalogEntry = {
    slug: summary.id,
    campaign: summary,
    subtitle: '',
    premise: summary.description ?? '',
    ruleset: 'D&D 5e',
    edition: '2024',
    lifecycle: 'draft',
    tier: 'tier-1',
    tags: [],
    playerCharacters: [],
    selectedSessionId: '',
    showcaseSessions: [],
    fixtureSource: 'catalog',
  };
  return Object.freeze({
    ...bundleFromCatalogEntry(entry),
    source: 'server-empty',
  });
}

const cache = new Map<string, CampaignFixtureBundle>();

function resolveBundle(entry: CampaignCatalogEntry): CampaignFixtureBundle {
  const cached = cache.get(entry.slug);
  if (cached) return cached;
  const fixture = FIXTURES[entry.slug];
  const bundle = fixture
    ? bundleFromFixture(entry, fixture)
    : bundleFromCatalogEntry(entry);
  cache.set(entry.slug, bundle);
  return bundle;
}

/**
 * Resolves a slug to a bundle, honoring the catalog's production visibility
 * gate (only `full-demo` campaigns outside development/test).
 */
export function getFixtureBundle(
  slug: string,
  mode: string = import.meta.env.MODE,
): CampaignFixtureBundle | undefined {
  const visible = getVisibleCampaignCatalog(mode).some(
    (entry) => entry.slug === slug,
  );
  if (!visible) return undefined;
  const entry = getCampaignCatalogEntryBySlug(slug);
  return entry ? resolveBundle(entry) : undefined;
}

export function listFixtureBundles(
  mode: string = import.meta.env.MODE,
): CampaignFixtureBundle[] {
  return getVisibleCampaignCatalog(mode).map(resolveBundle);
}
