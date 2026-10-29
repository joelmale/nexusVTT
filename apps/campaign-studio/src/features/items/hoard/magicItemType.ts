import type { CampaignItemType } from '../../../demo/fixture-registry/types';

const MAGIC_ITEM_TYPE_MAP: Record<string, CampaignItemType> = {
  weapon: 'weapon',
  armor: 'armor',
  shield: 'shield',
  wondrous: 'wondrous_item',
  wondrous_item: 'wondrous_item',
  ring: 'wondrous_item',
  rod: 'wondrous_item',
  staff: 'wondrous_item',
  wand: 'wondrous_item',
  potion: 'potion',
  scroll: 'scroll',
  spellbook: 'spellbook',
  tool: 'tool',
  ammunition: 'ammunition',
  adventuring_gear: 'adventuring_gear',
  treasure: 'treasure',
  other: 'other',
};

export function mapHoardMagicItemType(
  rawType: string | undefined,
): CampaignItemType {
  if (!rawType) return 'wondrous_item';
  return MAGIC_ITEM_TYPE_MAP[rawType.toLowerCase()] ?? 'wondrous_item';
}
