import type { CampaignFixtureBundle } from '@/demo/fixture-registry';
import type { GeneratedFaction, FactionRelationship } from '@nexus/character-creator';

type Bundle = CampaignFixtureBundle;
export type FactionItem = Bundle['factions'][number];

export interface FactionsQuery {
  q?: string;
  status?: string;
  sort?: string;
}

export interface FactionGroup {
  id: string;
  label: string;
  status: FactionItem['status'];
  factions: FactionItem[];
}

export interface FactionsModel {
  groups: FactionGroup[];
  visibleCount: number;
  totalCount: number;
  defaultFactionId?: string;
  statusOptions: Array<{ value: string; label: string }>;
  sortOptions: Array<{ value: string; label: string }>;
  stats: Array<{ label: string; value: number }>;
}

/** Status order as specified in the plan. */
const STATUS_ORDER: FactionItem['status'][] = [
  'opposition',
  'unknown',
  'neutral',
  'ally',
];

function getStatusLabel(status: FactionItem['status']): string {
  const labels: Record<FactionItem['status'], string> = {
    opposition: 'Opposition',
    unknown: 'Unknown',
    neutral: 'Neutral',
    ally: 'Ally',
  };
  return labels[status];
}

function memberCountOf(bundle: Bundle, factionId: string): number {
  return bundle.npcs.filter((npc) => npc.factionIds.includes(factionId))
    .length;
}

export function sortedFactions(
  bundle: Bundle,
  sort: string = 'name',
): FactionItem[] {
  const factions = [...bundle.factions];
  if (sort === 'name') {
    factions.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'members') {
    factions.sort(
      (a, b) =>
        memberCountOf(bundle, b.id) - memberCountOf(bundle, a.id) ||
        a.name.localeCompare(b.name),
    );
  }
  return factions;
}

function matches(faction: FactionItem, query: FactionsQuery): boolean {
  if (query.status && faction.status !== query.status) return false;
  const q = query.q?.trim().toLowerCase();
  if (q) {
    const haystack = [faction.name, faction.publicFace]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

export function buildFactionsModel(
  bundle: Bundle,
  query: FactionsQuery = {},
): FactionsModel {
  const sort = query.sort ?? 'name';
  const all = sortedFactions(bundle, sort);
  const visible = all.filter((faction) => matches(faction, query));

  const groups: FactionGroup[] = [];
  for (const status of STATUS_ORDER) {
    const factions = visible.filter((faction) => faction.status === status);
    if (factions.length > 0) {
      groups.push({
        id: status,
        label: getStatusLabel(status),
        status,
        factions,
      });
    }
  }

  const statusOptions = STATUS_ORDER.map((status) => ({
    value: status,
    label: getStatusLabel(status),
  }));

  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'members', label: 'Member count' },
  ];

  return {
    groups,
    visibleCount: visible.length,
    totalCount: all.length,
    defaultFactionId: all[0]?.id,
    statusOptions,
    sortOptions,
    stats: [
      { label: 'Factions', value: all.length },
      {
        label: 'Allies',
        value: all.filter((faction) => faction.status === 'ally').length,
      },
      {
        label: 'Opposition',
        value: all.filter((faction) => faction.status === 'opposition').length,
      },
      {
        label: 'Neutral',
        value: all.filter((faction) => faction.status === 'neutral').length,
      },
      {
        label: 'Unknown',
        value: all.filter((faction) => faction.status === 'unknown').length,
      },
    ],
  };
}

/** Every id the faction references directly, for `RelatedGroups`. */
export function factionForwardIds(faction: FactionItem): string[] {
  return [
    ...(faction.leaderNpcId ? [faction.leaderNpcId] : []),
    ...faction.alliedFactionIds,
    ...faction.rivalFactionIds,
    ...faction.locationIds,
    ...faction.questIds,
  ];
}

/** Get all NPCs that belong to this faction. */
export function factionMembers(
  bundle: Bundle,
  factionId: string,
): Bundle['npcs'] {
  return bundle.npcs.filter((npc) => npc.factionIds.includes(factionId));
}

/** Map CampaignFaction items to GeneratedFaction objects for FactionRelationshipMap rendering */
export function campaignFactionsToGeneratedFactions(
  factions: FactionItem[],
): GeneratedFaction[] {
  return factions.map((faction) => {
    const relationships: FactionRelationship[] = [];

    for (const other of factions) {
      if (other.id === faction.id) continue;

      const isDirectAlly = faction.alliedFactionIds?.includes(other.id);
      const isDirectRival = faction.rivalFactionIds?.includes(other.id);
      const isInverseAlly = other.alliedFactionIds?.includes(faction.id);
      const isInverseRival = other.rivalFactionIds?.includes(faction.id);

      if (isDirectAlly || isInverseAlly) {
        relationships.push({
          targetTempId: other.id,
          targetFactionName: other.name,
          type: 'ally',
          summary: `${faction.name} maintains an alliance with ${other.name}.`,
        });
      } else if (isDirectRival || isInverseRival) {
        relationships.push({
          targetTempId: other.id,
          targetFactionName: other.name,
          type: 'rival',
          summary: `${faction.name} and ${other.name} are rivals competing for power and influence.`,
        });
      } else {
        relationships.push({
          targetTempId: other.id,
          targetFactionName: other.name,
          type: 'ambivalent',
          summary: `No formal pacts or active conflict between ${faction.name} and ${other.name}.`,
        });
      }
    }

    return {
      tempId: faction.id,
      name: faction.name,
      archetype: faction.publicFace
        ? faction.publicFace.length > 25
          ? faction.publicFace.slice(0, 22) + '…'
          : faction.publicFace
        : 'Faction',
      theme: 'political',
      scope: 'regional',
      status: faction.status,
      publicFace: faction.publicFace,
      hiddenAgenda: faction.hiddenAgenda,
      motto: '',
      primaryAsset: '',
      vulnerability: '',
      keyFigures: [],
      relationships,
    };
  });
}

