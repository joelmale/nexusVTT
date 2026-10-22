import type {
  CampaignFixtureBundle,
  CampaignItem,
  CampaignItemHolderKind,
  CampaignItemRarity,
  CampaignItemType,
} from '@/demo/fixture-registry';

type Bundle = CampaignFixtureBundle;

export interface ItemsQuery {
  q?: string;
  rarity?: string;
  holder?: string;
  discovery?: string;
  session?: string;
}

export interface ItemGroup {
  id: CampaignItemHolderKind;
  label: string;
  items: CampaignItem[];
}

export const HOLDER_LABELS: Record<CampaignItemHolderKind, string> = {
  'party-member': 'Party',
  npc: 'NPCs',
  location: 'Locations',
  encounter: 'Encounters',
  none: 'Unassigned',
};

export const HOLDER_KIND_OPTIONS: Array<{
  value: CampaignItemHolderKind;
  label: string;
}> = [
  { value: 'none', label: 'Unassigned' },
  { value: 'party-member', label: 'Party member' },
  { value: 'npc', label: 'NPC' },
  { value: 'location', label: 'Location' },
  { value: 'encounter', label: 'Encounter' },
];

export const RARITY_LABELS: Record<CampaignItemRarity, string> = {
  none: 'Mundane',
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  very_rare: 'Very rare',
  legendary: 'Legendary',
  artifact: 'Artifact',
};

export const ITEM_TYPE_LABELS: Record<CampaignItemType, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  shield: 'Shield',
  wondrous_item: 'Wondrous item',
  potion: 'Potion',
  scroll: 'Scroll',
  spellbook: 'Spellbook',
  tool: 'Tool',
  ammunition: 'Ammunition',
  adventuring_gear: 'Adventuring gear',
  treasure: 'Treasure',
  other: 'Other',
};

const GROUP_ORDER: CampaignItemHolderKind[] = [
  'party-member',
  'npc',
  'location',
  'encounter',
  'none',
];

export const items = (bundle: Bundle): CampaignItem[] => bundle.items ?? [];

/** Items whose holder is `holderId`. */
export function itemsHeldBy(bundle: Bundle, holderId: string): CampaignItem[] {
  return items(bundle)
    .filter((item) => item.holder.id === holderId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Display name of whatever holds an item; undefined when unassigned or gone. */
export function holderName(
  bundle: Bundle,
  holder: CampaignItem['holder'],
): string | undefined {
  if (!holder.id) return undefined;
  switch (holder.kind) {
    case 'party-member':
      return bundle.campaign.playerCharacters.find((pc) => pc.id === holder.id)
        ?.name;
    case 'npc':
      return bundle.npcs.find((npc) => npc.id === holder.id)?.name;
    case 'location':
      return bundle.locations.find((loc) => loc.id === holder.id)?.name;
    case 'encounter':
      return bundle.encounters.find((enc) => enc.id === holder.id)?.title;
    case 'none':
      return undefined;
  }
}

import { searchItems } from './itemSearch';

function matchesFilters(item: CampaignItem, query: ItemsQuery): boolean {
  if (query.rarity && item.rarity !== query.rarity) return false;
  if (query.holder && item.holder.kind !== query.holder) return false;
  if (query.discovery === 'undiscovered' && item.discovered) return false;
  if (query.discovery === 'discovered' && !item.discovered) return false;
  if (query.session && item.sessionId !== query.session) return false;
  return true;
}

export function buildItemsModel(bundle: Bundle, query: ItemsQuery = {}) {
  const all = [...items(bundle)].sort((a, b) => a.name.localeCompare(b.name));

  // If search query is present, rank via searchItems
  let pool = all;
  if (query.q?.trim()) {
    const scored = searchItems(all, query.q);
    pool = scored.map((s) => s.item);
  }

  const visible = pool.filter((item) => matchesFilters(item, query));

  const groups: ItemGroup[] = GROUP_ORDER.flatMap((id) => {
    const own = visible.filter((item) => item.holder.kind === id);
    return own.length > 0 ? [{ id, label: HOLDER_LABELS[id], items: own }] : [];
  });

  const placedGp = all
    .filter((item) => item.holder.kind !== 'none')
    .reduce((sum, item) => sum + (item.valueGp ?? 0) * (item.quantity || 1), 0);

  return {
    groups,
    visibleCount: visible.length,
    totalCount: all.length,
    undiscoveredCount: all.filter((item) => !item.discovered).length,
    placedGp,
    holderOptions: GROUP_ORDER.map((value) => ({
      value,
      label: HOLDER_LABELS[value],
      count: all.filter((item) => item.holder.kind === value).length,
    })),
    rarityOptions: (
      Object.keys(RARITY_LABELS) as CampaignItemRarity[]
    ).map((value) => ({
      value,
      label: RARITY_LABELS[value],
      count: all.filter((item) => item.rarity === value).length,
    })),
    discoveryOptions: [
      {
        value: 'undiscovered',
        label: 'Undiscovered',
        count: all.filter((item) => !item.discovered).length,
      },
      {
        value: 'discovered',
        label: 'Discovered',
        count: all.filter((item) => item.discovered).length,
      },
    ],
    sessionOptions: (bundle.sessions ?? []).map((session) => ({
      value: session.id,
      label: session.title || `Session ${session.number ?? session.id}`,
      count: all.filter((item) => item.sessionId === session.id).length,
    })),
  };
}
