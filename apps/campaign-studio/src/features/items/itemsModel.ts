import type {
  CampaignFixtureBundle,
  CampaignItem,
  CampaignItemHolderKind,
  CampaignItemRarity,
  CampaignItemType,
} from '@/demo/fixture-registry';

import { searchItems } from './itemSearch';

type Bundle = CampaignFixtureBundle;

export type ItemsGroupBy = 'holder' | 'type' | 'rarity' | 'quest' | 'session';

export interface ItemsQuery {
  q?: string;
  rarity?: string;
  holder?: string;
  discovery?: string;
  session?: string;
  itemType?: string;
  type?: string;
  attunement?: string;
  valuePreset?: string;
  value?: string;
  groupBy?: ItemsGroupBy;
  group?: ItemsGroupBy;
}

export interface ItemGroup {
  id: string;
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

export const VALUE_PRESET_OPTIONS: Array<{
  value: string;
  label: string;
}> = [
  { value: 'under-50', label: '< 50 gp' },
  { value: '50-500', label: '50 – 500 gp' },
  { value: '500-5000', label: '500 – 5,000 gp' },
  { value: 'over-5000', label: '> 5,000 gp' },
];

export const ATTUNEMENT_OPTIONS: Array<{
  value: string;
  label: string;
}> = [
  { value: 'attuned', label: 'Requires Attunement' },
  { value: 'none', label: 'No Attunement' },
];

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

function matchesFilters(item: CampaignItem, query: ItemsQuery): boolean {
  if (query.rarity && item.rarity !== query.rarity) return false;
  if (query.holder && item.holder.kind !== query.holder) return false;
  if (query.discovery === 'undiscovered' && item.discovered) return false;
  if (query.discovery === 'discovered' && !item.discovered) return false;
  if (query.session && item.sessionId !== query.session) return false;

  const itemType = query.itemType || query.type;
  if (itemType && item.itemType !== itemType) return false;

  if (query.attunement) {
    if (
      query.attunement === 'attuned' ||
      query.attunement === 'requires_attunement' ||
      query.attunement === 'yes' ||
      query.attunement === 'true'
    ) {
      if (!item.requiresAttunement) return false;
    } else if (
      query.attunement === 'none' ||
      query.attunement === 'no_attunement' ||
      query.attunement === 'no' ||
      query.attunement === 'false'
    ) {
      if (item.requiresAttunement) return false;
    }
  }

  const valuePreset = query.valuePreset || query.value;
  if (valuePreset) {
    const val = item.valueGp ?? 0;
    if (
      valuePreset === 'under-50' ||
      valuePreset === 'under_50' ||
      valuePreset === '0-50' ||
      valuePreset === 'low'
    ) {
      if (val >= 50) return false;
    } else if (valuePreset === '50-500' || valuePreset === 'medium') {
      if (val < 50 || val > 500) return false;
    } else if (valuePreset === '500-5000') {
      if (val < 500 || val > 5000) return false;
    } else if (
      valuePreset === 'over-5000' ||
      valuePreset === 'over_5000' ||
      valuePreset === '5000+' ||
      valuePreset === 'high'
    ) {
      if (val <= 5000) return false;
    }
  }

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
  const groupBy: ItemsGroupBy = query.groupBy || query.group || 'holder';

  let groups: ItemGroup[] = [];

  if (groupBy === 'holder') {
    groups = GROUP_ORDER.flatMap((id) => {
      const own = visible.filter((item) => item.holder.kind === id);
      return own.length > 0 ? [{ id, label: HOLDER_LABELS[id], items: own }] : [];
    });
  } else if (groupBy === 'type') {
    const typeKeys = Object.keys(ITEM_TYPE_LABELS) as CampaignItemType[];
    groups = typeKeys.flatMap((type) => {
      const own = visible.filter((item) => item.itemType === type);
      return own.length > 0
        ? [{ id: type, label: ITEM_TYPE_LABELS[type] ?? type, items: own }]
        : [];
    });
    const otherItems = visible.filter(
      (item) => !typeKeys.includes(item.itemType as CampaignItemType),
    );
    if (otherItems.length > 0) {
      groups.push({ id: 'other', label: 'Other', items: otherItems });
    }
  } else if (groupBy === 'rarity') {
    const rarityKeys = Object.keys(RARITY_LABELS) as CampaignItemRarity[];
    groups = rarityKeys.flatMap((rarity) => {
      const own = visible.filter((item) => item.rarity === rarity);
      return own.length > 0
        ? [{ id: rarity, label: RARITY_LABELS[rarity] ?? rarity, items: own }]
        : [];
    });
  } else if (groupBy === 'quest') {
    const assignedItemIds = new Set<string>();
    for (const quest of bundle.quests ?? []) {
      const own = visible.filter((item) => (item.questIds ?? []).includes(quest.id));
      if (own.length > 0) {
        own.forEach((item) => assignedItemIds.add(item.id));
        groups.push({ id: quest.id, label: quest.title, items: own });
      }
    }
    const unlinked = visible.filter((item) => !assignedItemIds.has(item.id));
    if (unlinked.length > 0) {
      groups.push({ id: 'unlinked', label: 'No linked quest', items: unlinked });
    }
  } else if (groupBy === 'session') {
    const sessionItemIds = new Set<string>();
    for (const session of bundle.sessions ?? []) {
      const own = visible.filter((item) => item.sessionId === session.id);
      if (own.length > 0) {
        own.forEach((item) => sessionItemIds.add(item.id));
        groups.push({
          id: session.id,
          label: session.title || `Session ${session.number ?? session.id}`,
          items: own,
        });
      }
    }
    const unscheduled = visible.filter((item) => !sessionItemIds.has(item.id));
    if (unscheduled.length > 0) {
      groups.push({ id: 'unscheduled', label: 'Unscheduled', items: unscheduled });
    }
  }

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
    itemTypeOptions: (Object.keys(ITEM_TYPE_LABELS) as CampaignItemType[]).map((value) => ({
      value,
      label: ITEM_TYPE_LABELS[value],
      count: all.filter((item) => item.itemType === value).length,
    })),
    attunementOptions: [
      {
        value: 'attuned',
        label: 'Requires Attunement',
        count: all.filter((item) => item.requiresAttunement).length,
      },
      {
        value: 'none',
        label: 'No Attunement',
        count: all.filter((item) => !item.requiresAttunement).length,
      },
    ],
    valuePresetOptions: [
      {
        value: 'under-50',
        label: '< 50 gp',
        count: all.filter((item) => (item.valueGp ?? 0) < 50).length,
      },
      {
        value: '50-500',
        label: '50 – 500 gp',
        count: all.filter((item) => (item.valueGp ?? 0) >= 50 && (item.valueGp ?? 0) <= 500).length,
      },
      {
        value: '500-5000',
        label: '500 – 5,000 gp',
        count: all.filter((item) => (item.valueGp ?? 0) >= 500 && (item.valueGp ?? 0) <= 5000).length,
      },
      {
        value: 'over-5000',
        label: '> 5,000 gp',
        count: all.filter((item) => (item.valueGp ?? 0) > 5000).length,
      },
    ],
    groupByOptions: [
      { value: 'holder', label: 'Holder' },
      { value: 'type', label: 'Type' },
      { value: 'rarity', label: 'Rarity' },
      { value: 'quest', label: 'Quest' },
      { value: 'session', label: 'Session' },
    ],
  };
}
