import type {
  CampaignFaction,
  CampaignNpc,
  CampaignSession,
} from '@/demo/ashes-of-veyra/types';
import {
  getBacklinks,
  type CampaignFixtureBundle,
} from '@/demo/fixture-registry';

export const UNAFFILIATED_ID = 'none';
export const UNAFFILIATED_LABEL = 'Unaffiliated';

export type NpcSort = 'last-appearance' | 'name';

export interface NpcsQuery {
  q?: string;
  faction?: string;
  location?: string;
  tag?: string;
  sort?: string;
}

export interface NpcRow {
  id: string;
  name: string;
  role: string;
  monogram: string;
  /** Primary (first) faction, when it resolves. */
  factionId?: string;
  factionName?: string;
  /** Highest session number the NPC appears in; 0 when never. */
  lastAppearance: number;
  /** Draft campaigns only: no sessions, quests or encounters. */
  unused: boolean;
}

export interface NpcGroup {
  id: string;
  label: string;
  items: NpcRow[];
}

export interface FacetOption {
  value: string;
  label: string;
}

export interface NpcsModel {
  total: number;
  rows: NpcRow[];
  groups: NpcGroup[];
  sort: NpcSort;
  /** Default sort first, so the FilterBar shows it when `sort` is unset. */
  sortOptions: Array<{ value: NpcSort; label: string }>;
  factionOptions: FacetOption[];
  locationOptions: FacetOption[];
  tagOptions: FacetOption[];
  unusedCount: number;
  unaffiliatedCount: number;
}

export function defaultSort(bundle: CampaignFixtureBundle): NpcSort {
  const { lifecycle } = bundle;
  return lifecycle === 'active' || lifecycle === 'paused'
    ? 'last-appearance'
    : 'name';
}

export function resolveSort(
  bundle: CampaignFixtureBundle,
  requested?: string,
): NpcSort {
  return requested === 'name' || requested === 'last-appearance'
    ? requested
    : defaultSort(bundle);
}

export function monogramFor(
  npc: Pick<CampaignNpc, 'name' | 'portraitFallback'>,
): string {
  const given = npc.portraitFallback?.trim();
  if (given) return given;
  const letters = npc.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '');
  return letters.join('') || '?';
}

/** Sessions the NPC appears in (either side of the link), ordered by number. */
export function npcAppearances(
  bundle: CampaignFixtureBundle,
  npc: CampaignNpc,
): CampaignSession[] {
  const own = new Set(npc.sessionIds);
  return bundle.sessions
    .filter((session) => own.has(session.id) || session.npcIds.includes(npc.id))
    .sort((a, b) => a.number - b.number);
}

/** Quests the NPC gives, in bundle order. */
export function npcQuestsGiven(bundle: CampaignFixtureBundle, npcId: string) {
  return bundle.quests.filter((quest) => quest.giverNpcId === npcId);
}

/** Factions the NPC belongs to plus factions they lead. */
export function npcFactions(
  bundle: CampaignFixtureBundle,
  npc: CampaignNpc,
): Array<{ id: string; leads: boolean }> {
  const result = new Map<string, boolean>();
  for (const id of npc.factionIds) result.set(id, false);
  for (const faction of bundle.factions) {
    if (faction.leaderNpcId === npc.id) result.set(faction.id, true);
  }
  return [...result].map(([id, leads]) => ({ id, leads }));
}

function isUnused(bundle: CampaignFixtureBundle, npc: CampaignNpc): boolean {
  if (bundle.lifecycle !== 'draft') return false;
  if (npcAppearances(bundle, npc).length > 0) return false;
  if (npcQuestsGiven(bundle, npc.id).length > 0) return false;
  return !getBacklinks(bundle, npc.id).some(
    (ref) =>
      ref.kind === 'session' ||
      ref.kind === 'quest' ||
      ref.kind === 'encounter',
  );
}

function compareBySort(sort: NpcSort) {
  return (a: NpcRow, b: NpcRow) => {
    if (sort === 'last-appearance' && a.lastAppearance !== b.lastAppearance) {
      return b.lastAppearance - a.lastAppearance;
    }
    return a.name.localeCompare(b.name);
  };
}

export function buildNpcsModel(
  bundle: CampaignFixtureBundle,
  query: NpcsQuery = {},
): NpcsModel {
  const factionsById = new Map<string, CampaignFaction>(
    bundle.factions.map((faction) => [faction.id, faction]),
  );
  const locationsById = new Map(
    bundle.locations.map((location) => [location.id, location]),
  );
  const sort = resolveSort(bundle, query.sort);
  const needle = query.q?.trim().toLowerCase() ?? '';

  const primaryFaction = (npc: CampaignNpc) => {
    const id = npc.factionIds[0];
    return id ? factionsById.get(id) : undefined;
  };

  const all = bundle.npcs.map((npc) => {
    const faction = primaryFaction(npc);
    const appearances = npcAppearances(bundle, npc);
    const row: NpcRow = {
      id: npc.id,
      name: npc.name,
      role: npc.role,
      monogram: monogramFor(npc),
      factionId: faction?.id,
      factionName: faction?.name,
      lastAppearance: appearances.reduce(
        (max, session) => Math.max(max, session.number),
        0,
      ),
      unused: isUnused(bundle, npc),
    };
    return { npc, row };
  });

  const matches = ({ npc, row }: (typeof all)[number]) => {
    if (query.faction) {
      const ok =
        query.faction === UNAFFILIATED_ID
          ? !row.factionId
          : npc.factionIds.includes(query.faction);
      if (!ok) return false;
    }
    if (query.location && !npc.locationIds.includes(query.location)) {
      return false;
    }
    if (query.tag && !npc.tags.includes(query.tag)) return false;
    if (needle) {
      const haystack = [
        npc.name,
        npc.role,
        npc.ancestry,
        row.factionName ?? '',
        ...npc.tags,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  };

  const rows = all
    .filter(matches)
    .map((entry) => entry.row)
    .sort(compareBySort(sort));

  const groups: NpcGroup[] = [];
  for (const faction of bundle.factions) {
    const items = rows.filter((row) => row.factionId === faction.id);
    if (items.length > 0) {
      groups.push({ id: faction.id, label: faction.name, items });
    }
  }
  const unaffiliated = rows.filter((row) => !row.factionId);
  if (unaffiliated.length > 0) {
    groups.push({
      id: UNAFFILIATED_ID,
      label: UNAFFILIATED_LABEL,
      items: unaffiliated,
    });
  }

  const factionIds = new Set(bundle.npcs.flatMap((npc) => npc.factionIds));
  const factionOptions: FacetOption[] = bundle.factions
    .filter((faction) => factionIds.has(faction.id))
    .map((faction) => ({ value: faction.id, label: faction.name }));
  if (bundle.npcs.some((npc) => !primaryFaction(npc))) {
    factionOptions.push({ value: UNAFFILIATED_ID, label: UNAFFILIATED_LABEL });
  }
  const locationIds = new Set(bundle.npcs.flatMap((npc) => npc.locationIds));
  const locationOptions: FacetOption[] = [...locationIds]
    .flatMap((id) => {
      const location = locationsById.get(id);
      return location ? [{ value: id, label: location.name }] : [];
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  const tagOptions: FacetOption[] = [
    ...new Set(bundle.npcs.flatMap((npc) => npc.tags)),
  ]
    .sort((a, b) => a.localeCompare(b))
    .map((tag) => ({ value: tag, label: tag }));

  const sortOptions: NpcsModel['sortOptions'] = [
    { value: 'last-appearance', label: 'Last appearance' },
    { value: 'name', label: 'Name' },
  ];
  const defaultValue = defaultSort(bundle);
  sortOptions.sort((a, b) =>
    a.value === defaultValue ? -1 : b.value === defaultValue ? 1 : 0,
  );

  return {
    total: bundle.npcs.length,
    rows,
    groups,
    sort,
    sortOptions,
    factionOptions,
    locationOptions,
    tagOptions,
    unusedCount: all.filter((entry) => entry.row.unused).length,
    unaffiliatedCount: all.filter((entry) => !entry.row.factionId).length,
  };
}
