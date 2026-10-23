/**
 * Pure seedable treasure hoard roller adhering to the 2024 DMG tables.
 */
import type {
  CampaignItemRarity as ItemRarity,
  CampaignItemType as ItemType,
} from '../../../demo/fixture-registry/types';
import type { SrdItem } from '../useSrdCatalog';
import {
  HOARD_BASE_COINS,
  HOARD_TABLES,
  INDIVIDUAL_TABLES,
  type CoinDiceMap,
  type DiceSpec,
  type TreasureTier,
  type TreasureType,
} from './tables2024';

export interface RolledCoins {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
  totalGp: number;
}

export interface RolledValuable {
  name: string;
  unitGp: number;
  count: number;
  totalGp: number;
  category: 'gem' | 'art';
}

export interface RolledMagicItem {
  name: string;
  rarity: ItemRarity;
  type: ItemType;
  description?: string;
  sourceCompendiumId?: string;
  valueGp?: number;
  attunement?: boolean;
}

export interface RolledTreasureResult {
  tier: TreasureTier;
  type: TreasureType;
  seed: number;
  d100Roll: number;
  coins: RolledCoins;
  valuables: RolledValuable[];
  magicItems: RolledMagicItem[];
  totalGp: number;
}

export interface RollTreasureOptions {
  tier: TreasureTier;
  type?: TreasureType;
  seed?: number;
  compendiumItems?: SrdItem[];
}

/**
 * 32-bit Mulberry PRNG for fast, deterministic, reproducible dice rolls.
 */
export function createPrng(seed: number): () => number {
  let s = Math.floor(seed) >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rollDie(sides: number, rand: () => number = Math.random): number {
  if (sides <= 1) return 1;
  return Math.floor(rand() * sides) + 1;
}

export function evalDice(dice: DiceSpec, rand: () => number = Math.random): number {
  let sum = 0;
  for (let i = 0; i < dice.count; i++) {
    sum += rollDie(dice.sides, rand);
  }
  return sum * (dice.multiplier ?? 1);
}

function resolveCoins(coinMap: CoinDiceMap, rand: () => number): RolledCoins {
  const cp = coinMap.cp ? evalDice(coinMap.cp, rand) : 0;
  const sp = coinMap.sp ? evalDice(coinMap.sp, rand) : 0;
  const ep = coinMap.ep ? evalDice(coinMap.ep, rand) : 0;
  const gp = coinMap.gp ? evalDice(coinMap.gp, rand) : 0;
  const pp = coinMap.pp ? evalDice(coinMap.pp, rand) : 0;

  const totalGp =
    Math.round((cp * 0.01 + sp * 0.1 + ep * 0.5 + gp + pp * 10) * 100) / 100;

  return { cp, sp, ep, gp, pp, totalGp };
}

const DEFAULT_MAGIC_ITEMS_BY_RARITY: Record<Exclude<ItemRarity, 'none'>, Array<{ name: string; type: ItemType; valueGp: number }>> = {
  common: [
    { name: 'Potion of Healing', type: 'potion', valueGp: 50 },
    { name: 'Spell Scroll (1st Level)', type: 'scroll', valueGp: 75 },
    { name: 'Candle of the Deep', type: 'wondrous_item', valueGp: 50 },
    { name: 'Cloak of Many Fashions', type: 'wondrous_item', valueGp: 50 },
  ],
  uncommon: [
    { name: 'Bag of Holding', type: 'wondrous_item', valueGp: 400 },
    { name: 'Boots of Elvenkind', type: 'wondrous_item', valueGp: 350 },
    { name: 'Cloak of Protection', type: 'wondrous_item', valueGp: 450 },
    { name: 'Potion of Greater Healing', type: 'potion', valueGp: 150 },
    { name: '+1 Weapon', type: 'weapon', valueGp: 500 },
    { name: '+1 Shield', type: 'shield', valueGp: 400 },
    { name: 'Wand of Magic Missiles', type: 'wondrous_item', valueGp: 450 },
  ],
  rare: [
    { name: 'Cloak of the Bat', type: 'wondrous_item', valueGp: 3000 },
    { name: 'Flame Tongue', type: 'weapon', valueGp: 4000 },
    { name: 'Ring of Protection', type: 'wondrous_item', valueGp: 3500 },
    { name: 'Potion of Superior Healing', type: 'potion', valueGp: 450 },
    { name: 'Amulet of Health', type: 'wondrous_item', valueGp: 4000 },
    { name: '+2 Weapon', type: 'weapon', valueGp: 4000 },
    { name: '+1 Armor', type: 'armor', valueGp: 3500 },
  ],
  very_rare: [
    { name: 'Belt of Giant Strength (Fire)', type: 'wondrous_item', valueGp: 20000 },
    { name: 'Staff of Power', type: 'wondrous_item', valueGp: 25000 },
    { name: 'Manual of Bodily Health', type: 'wondrous_item', valueGp: 22000 },
    { name: 'Potion of Supreme Healing', type: 'potion', valueGp: 1350 },
    { name: '+3 Weapon', type: 'weapon', valueGp: 20000 },
    { name: '+2 Armor', type: 'armor', valueGp: 18000 },
  ],
  legendary: [
    { name: 'Holy Avenger', type: 'weapon', valueGp: 80000 },
    { name: 'Staff of the Magi', type: 'wondrous_item', valueGp: 90000 },
    { name: 'Ring of Three Wishes', type: 'wondrous_item', valueGp: 100000 },
    { name: 'Vorpal Sword', type: 'weapon', valueGp: 85000 },
    { name: 'Cloak of Invisibility', type: 'wondrous_item', valueGp: 75000 },
  ],
  artifact: [
    { name: 'Eye of Vecna', type: 'wondrous_item', valueGp: 150000 },
    { name: 'Hand of Vecna', type: 'wondrous_item', valueGp: 150000 },
    { name: 'Book of Exalted Deeds', type: 'wondrous_item', valueGp: 200000 },
  ],
};

export function rollTreasure(options: RollTreasureOptions): RolledTreasureResult {
  const { tier, type = 'hoard', compendiumItems = [] } = options;
  const seed = options.seed !== undefined ? options.seed : Math.floor(Math.random() * 2147483647);
  const rand = createPrng(seed);

  const d100Roll = rollDie(100, rand);

  if (type === 'individual') {
    const table = INDIVIDUAL_TABLES[tier] || INDIVIDUAL_TABLES['0-4'];
    const row = table.find((r) => d100Roll >= r.min && d100Roll <= r.max) || table[0];
    const coins = resolveCoins(row.coins, rand);
    return {
      tier,
      type: 'individual',
      seed,
      d100Roll,
      coins,
      valuables: [],
      magicItems: [],
      totalGp: coins.totalGp,
    };
  }

  // Hoard
  const baseCoinMap = HOARD_BASE_COINS[tier] || HOARD_BASE_COINS['0-4'];
  const coins = resolveCoins(baseCoinMap, rand);

  const table = HOARD_TABLES[tier] || HOARD_TABLES['0-4'];
  const row = table.find((r) => d100Roll >= r.min && d100Roll <= r.max) || table[0];

  const valuables: RolledValuable[] = [];
  if (row.valuables) {
    const count = evalDice(row.valuables.dice, rand);
    if (count > 0) {
      const examples = row.valuables.examples;
      const example = examples.length > 0 ? examples[Math.floor(rand() * examples.length)] : (row.valuables.category === 'gem' ? 'Gem' : 'Art Object');
      const name = `${example} (${row.valuables.unitGp} gp)`;
      valuables.push({
        name,
        unitGp: row.valuables.unitGp,
        count,
        totalGp: row.valuables.unitGp * count,
        category: row.valuables.category,
      });
    }
  }

  const magicItems: RolledMagicItem[] = [];
  if (row.magicItems && row.magicItems.length > 0) {
    for (const drop of row.magicItems) {
      const count = evalDice(drop.dice, rand);
      for (let i = 0; i < count; i++) {
        // Find matching candidates in compendium
        const candidates = compendiumItems.filter((item) => {
          if (item.rarity !== drop.rarity) return false;
          if (drop.types && drop.types.length > 0 && !drop.types.includes(item.itemType)) {
            return false;
          }
          return true;
        });

        if (candidates.length > 0) {
          const picked = candidates[Math.floor(rand() * candidates.length)];
          magicItems.push({
            name: picked.name,
            rarity: picked.rarity,
            type: picked.itemType,
            description: picked.description,
            sourceCompendiumId: picked.id,
            valueGp: picked.valueGp,
            attunement: picked.requiresAttunement,
          });
        } else {
          // Fallback
          const defaults = (drop.rarity !== 'none' && DEFAULT_MAGIC_ITEMS_BY_RARITY[drop.rarity]) || DEFAULT_MAGIC_ITEMS_BY_RARITY.common;
          const picked = defaults[Math.floor(rand() * defaults.length)];
          magicItems.push({
            name: picked.name,
            rarity: drop.rarity,
            type: picked.type,
            valueGp: picked.valueGp,
          });
        }
      }
    }
  }

  const valuablesGp = valuables.reduce((sum, v) => sum + v.totalGp, 0);
  const magicItemsGp = magicItems.reduce((sum, m) => sum + (m.valueGp ?? 0), 0);
  const totalGp = Math.round((coins.totalGp + valuablesGp + magicItemsGp) * 100) / 100;

  return {
    tier,
    type: 'hoard',
    seed,
    d100Roll,
    coins,
    valuables,
    magicItems,
    totalGp,
  };
}
