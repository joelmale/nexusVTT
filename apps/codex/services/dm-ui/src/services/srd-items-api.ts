import type {
  CampaignItemRarity,
  CampaignItemType,
} from '../demo/fixture-registry/types';

/** An SRD catalog item reduced to the fields an Item starts from. */
export interface SrdItem {
  id: string;
  ruleset: string;
  name: string;
  itemType: CampaignItemType;
  rarity: CampaignItemRarity;
  requiresAttunement: boolean;
  attunementNote?: string;
  valueGp?: number;
  weightLb?: number;
  description: string;
}

export type SrdItemsResult =
  | { ok: true; items: SrdItem[] }
  | { ok: false; error: string };

const TYPE_BY_CATEGORY: Record<string, CampaignItemType> = {
  weapon: 'weapon',
  armor: 'armor',
  shield: 'shield',
  ammunition: 'ammunition',
  adventuring_gear: 'adventuring_gear',
  equipment_pack: 'adventuring_gear',
  spellcasting_focus: 'adventuring_gear',
  tool: 'tool',
  potion: 'potion',
  scroll: 'scroll',
  wondrous: 'wondrous_item',
  ring: 'wondrous_item',
  rod: 'wondrous_item',
  staff: 'wondrous_item',
  wand: 'wondrous_item',
};

const RARITIES: readonly string[] = [
  'common',
  'uncommon',
  'rare',
  'very_rare',
  'legendary',
  'artifact',
];

const GP_PER_UNIT: Record<string, number> = {
  cp: 0.01,
  sp: 0.1,
  ep: 0.5,
  gp: 1,
  pp: 10,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Maps one catalog entity; undefined when it is not a usable item. */
export function srdItemFromEntity(entity: unknown): SrdItem | undefined {
  if (!isRecord(entity) || !isRecord(entity.data)) return undefined;
  const data = entity.data;
  const id = typeof entity.id === 'string' ? entity.id : '';
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!id || !name) return undefined;
  const category = typeof data.category === 'string' ? data.category : '';
  const rarity = typeof data.rarity === 'string' ? data.rarity : '';
  const attunement = isRecord(data.attunement) ? data.attunement : {};
  const requirement =
    typeof attunement.requirement === 'string' ? attunement.requirement : '';
  const cost = isRecord(data.cost) ? data.cost : undefined;
  const unitValue =
    cost && typeof cost.unit === 'string' ? GP_PER_UNIT[cost.unit] : undefined;
  const valueGp =
    cost && typeof cost.amount === 'number' && unitValue !== undefined
      ? Math.round(cost.amount * unitValue * 100) / 100
      : undefined;
  return {
    id,
    ruleset: typeof entity.ruleset === 'string' ? entity.ruleset : '',
    name,
    itemType: TYPE_BY_CATEGORY[category] ?? 'other',
    rarity: RARITIES.includes(rarity) ? (rarity as CampaignItemRarity) : 'none',
    requiresAttunement: attunement.required === true,
    ...(requirement ? { attunementNote: requirement } : {}),
    ...(valueGp !== undefined ? { valueGp } : {}),
    ...(typeof data.weight === 'number' ? { weightLb: data.weight } : {}),
    description: typeof data.text === 'string' ? data.text : '',
  };
}

/**
 * Items from the VTT's rules catalog proxy
 * (`GET /api/rules/catalog/entities?type=item`). Any failure resolves to
 * `{ ok: false }` so callers can hide the picker.
 */
export async function fetchSrdItems(ruleset = '2024'): Promise<SrdItemsResult> {
  try {
    const response = await fetch(
      `/api/rules/catalog/entities?type=item&ruleset=${encodeURIComponent(ruleset)}`,
      { credentials: 'include' },
    );
    if (!response.ok) {
      return { ok: false, error: `Catalog unavailable (${response.status}).` };
    }
    const body = (await response.json()) as unknown;
    const entities =
      isRecord(body) && Array.isArray(body.entities) ? body.entities : undefined;
    if (!entities) return { ok: false, error: 'Unexpected catalog response.' };
    const items = entities
      .map(srdItemFromEntity)
      .filter((item): item is SrdItem => Boolean(item))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { ok: true, items };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Catalog unavailable.',
    };
  }
}
