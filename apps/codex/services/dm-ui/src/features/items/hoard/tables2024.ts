/**
 * 2024 Dungeon Master's Guide Treasure Tables & Hoard Rules.
 * Pure static data definitions for individual treasure and treasure hoards across tiers.
 */
import type { ItemRarity, ItemType } from '../../../demo/fixture-registry/types';

export type TreasureTier = '0-4' | '5-10' | '11-16' | '17+';
export type TreasureType = 'individual' | 'hoard';

export interface DiceSpec {
  count: number;
  sides: number;
  multiplier?: number;
}

export interface CoinDiceMap {
  cp?: DiceSpec;
  sp?: DiceSpec;
  ep?: DiceSpec;
  gp?: DiceSpec;
  pp?: DiceSpec;
}

export interface ValuablesTableSpec {
  unitGp: number;
  category: 'gem' | 'art';
  dice: DiceSpec;
  examples: string[];
}

export interface MagicItemDropSpec {
  rarity: ItemRarity;
  types?: ItemType[];
  dice: DiceSpec;
}

export interface HoardTableRow {
  min: number;
  max: number;
  valuables?: ValuablesTableSpec;
  magicItems?: MagicItemDropSpec[];
}

export interface IndividualTableRow {
  min: number;
  max: number;
  coins: CoinDiceMap;
}

export const INDIVIDUAL_TABLES: Record<TreasureTier, IndividualTableRow[]> = {
  '0-4': [
    { min: 1, max: 30, coins: { cp: { count: 5, sides: 6 } } },
    { min: 31, max: 60, coins: { sp: { count: 4, sides: 6 } } },
    { min: 61, max: 70, coins: { ep: { count: 3, sides: 6 } } },
    { min: 71, max: 95, coins: { gp: { count: 3, sides: 6 } } },
    { min: 96, max: 100, coins: { pp: { count: 1, sides: 6 } } },
  ],
  '5-10': [
    {
      min: 1,
      max: 30,
      coins: {
        cp: { count: 4, sides: 6, multiplier: 100 },
        ep: { count: 1, sides: 6, multiplier: 10 },
      },
    },
    {
      min: 31,
      max: 60,
      coins: {
        sp: { count: 6, sides: 6, multiplier: 10 },
        gp: { count: 2, sides: 6, multiplier: 10 },
      },
    },
    {
      min: 61,
      max: 70,
      coins: {
        ep: { count: 1, sides: 6, multiplier: 100 },
        gp: { count: 1, sides: 6, multiplier: 10 },
      },
    },
    {
      min: 71,
      max: 95,
      coins: { gp: { count: 4, sides: 6, multiplier: 10 } },
    },
    {
      min: 96,
      max: 100,
      coins: {
        gp: { count: 2, sides: 6, multiplier: 10 },
        pp: { count: 3, sides: 6 },
      },
    },
  ],
  '11-16': [
    {
      min: 1,
      max: 20,
      coins: {
        sp: { count: 4, sides: 6, multiplier: 100 },
        gp: { count: 1, sides: 6, multiplier: 100 },
      },
    },
    {
      min: 21,
      max: 35,
      coins: {
        ep: { count: 1, sides: 6, multiplier: 100 },
        gp: { count: 1, sides: 6, multiplier: 100 },
      },
    },
    {
      min: 36,
      max: 75,
      coins: {
        gp: { count: 2, sides: 6, multiplier: 100 },
        pp: { count: 1, sides: 6, multiplier: 10 },
      },
    },
    {
      min: 76,
      max: 100,
      coins: {
        gp: { count: 2, sides: 6, multiplier: 100 },
        pp: { count: 2, sides: 6, multiplier: 10 },
      },
    },
  ],
  '17+': [
    {
      min: 1,
      max: 15,
      coins: {
        ep: { count: 2, sides: 6, multiplier: 1000 },
        gp: { count: 8, sides: 6, multiplier: 100 },
      },
    },
    {
      min: 16,
      max: 55,
      coins: {
        gp: { count: 1, sides: 6, multiplier: 1000 },
        pp: { count: 1, sides: 6, multiplier: 100 },
      },
    },
    {
      min: 56,
      max: 100,
      coins: {
        gp: { count: 1, sides: 6, multiplier: 1000 },
        pp: { count: 2, sides: 6, multiplier: 100 },
      },
    },
  ],
};

export const HOARD_BASE_COINS: Record<TreasureTier, CoinDiceMap> = {
  '0-4': {
    cp: { count: 6, sides: 6, multiplier: 100 },
    sp: { count: 3, sides: 6, multiplier: 100 },
    gp: { count: 2, sides: 6, multiplier: 10 },
  },
  '5-10': {
    cp: { count: 2, sides: 6, multiplier: 100 },
    sp: { count: 2, sides: 6, multiplier: 1000 },
    gp: { count: 6, sides: 6, multiplier: 100 },
    pp: { count: 3, sides: 6, multiplier: 10 },
  },
  '11-16': {
    gp: { count: 4, sides: 6, multiplier: 1000 },
    pp: { count: 5, sides: 6, multiplier: 100 },
  },
  '17+': {
    gp: { count: 12, sides: 6, multiplier: 1000 },
    pp: { count: 8, sides: 6, multiplier: 1000 },
  },
};

export const HOARD_TABLES: Record<TreasureTier, HoardTableRow[]> = {
  '0-4': [
    { min: 1, max: 6 },
    {
      min: 7,
      max: 16,
      valuables: {
        unitGp: 10,
        category: 'gem',
        dice: { count: 2, sides: 6 },
        examples: ['Azurite', 'Banded Agate', 'Blue Quartz', 'Eye Agate', 'Hematite', 'Lapis Lazuli', 'Malachite', 'Moss Agate', 'Obsidian', 'Tiger Eye', 'Turquoise'],
      },
    },
    {
      min: 17,
      max: 26,
      valuables: {
        unitGp: 25,
        category: 'art',
        dice: { count: 2, sides: 4 },
        examples: ['Silver Ewer', 'Carved Bone Statuette', 'Small Gold Bracelet', 'Cloth-of-Gold Vestment', 'Black Velvet Mask embroidered with silver thread', 'Carved Chalcedony Figurine'],
      },
    },
    {
      min: 27,
      max: 36,
      valuables: {
        unitGp: 50,
        category: 'gem',
        dice: { count: 2, sides: 6 },
        examples: ['Bloodstone', 'Carnelian', 'Chalcedony', 'Chrysoprase', 'Citrine', 'Jasper', 'Moonstone', 'Onyx', 'Quartz', 'Sardonyx', 'Star Rose Quartz', 'Zircon'],
      },
    },
    {
      min: 37,
      max: 44,
      valuables: {
        unitGp: 10,
        category: 'gem',
        dice: { count: 2, sides: 6 },
        examples: ['Azurite', 'Malachite', 'Turquoise', 'Hematite'],
      },
      magicItems: [{ rarity: 'common', dice: { count: 1, sides: 6 } }],
    },
    {
      min: 45,
      max: 52,
      valuables: {
        unitGp: 25,
        category: 'art',
        dice: { count: 2, sides: 4 },
        examples: ['Silver Ewer', 'Carved Bone Statuette', 'Small Gold Bracelet'],
      },
      magicItems: [{ rarity: 'uncommon', dice: { count: 1, sides: 4 } }],
    },
    {
      min: 53,
      max: 60,
      valuables: {
        unitGp: 50,
        category: 'gem',
        dice: { count: 2, sides: 6 },
        examples: ['Bloodstone', 'Carnelian', 'Citrine', 'Jasper'],
      },
      magicItems: [{ rarity: 'uncommon', dice: { count: 1, sides: 4 } }],
    },
    {
      min: 61,
      max: 75,
      valuables: {
        unitGp: 50,
        category: 'gem',
        dice: { count: 2, sides: 6 },
        examples: ['Moonstone', 'Onyx', 'Star Rose Quartz', 'Zircon'],
      },
      magicItems: [{ rarity: 'uncommon', dice: { count: 1, sides: 6 } }],
    },
    {
      min: 76,
      max: 85,
      valuables: {
        unitGp: 50,
        category: 'gem',
        dice: { count: 2, sides: 6 },
        examples: ['Bloodstone', 'Carnelian', 'Moonstone'],
      },
      magicItems: [
        { rarity: 'uncommon', dice: { count: 1, sides: 4 } },
        { rarity: 'rare', dice: { count: 1, sides: 1 } },
      ],
    },
    {
      min: 86,
      max: 100,
      valuables: {
        unitGp: 50,
        category: 'gem',
        dice: { count: 2, sides: 6 },
        examples: ['Chrysoprase', 'Citrine', 'Onyx'],
      },
      magicItems: [{ rarity: 'rare', dice: { count: 1, sides: 4 } }],
    },
  ],
  '5-10': [
    { min: 1, max: 4 },
    {
      min: 5,
      max: 10,
      valuables: {
        unitGp: 25,
        category: 'art',
        dice: { count: 2, sides: 4 },
        examples: ['Silver Ewer', 'Carved Bone Statuette', 'Gold Bracelet'],
      },
    },
    {
      min: 11,
      max: 16,
      valuables: {
        unitGp: 50,
        category: 'gem',
        dice: { count: 3, sides: 6 },
        examples: ['Bloodstone', 'Carnelian', 'Jasper', 'Moonstone'],
      },
    },
    {
      min: 17,
      max: 22,
      valuables: {
        unitGp: 100,
        category: 'gem',
        dice: { count: 3, sides: 6 },
        examples: ['Amber', 'Amethyst', 'Chrysoberyl', 'Coral', 'Garnet', 'Jade', 'Pearl', 'Spinel', 'Tourmaline'],
      },
    },
    {
      min: 23,
      max: 28,
      valuables: {
        unitGp: 250,
        category: 'art',
        dice: { count: 2, sides: 4 },
        examples: ['Gold Ring with bloodstones', 'Carved Ivory Statuette', 'Large Gold Bracelet', 'Silver Necklace with gemstone pendant'],
      },
    },
    {
      min: 29,
      max: 40,
      valuables: {
        unitGp: 100,
        category: 'gem',
        dice: { count: 3, sides: 6 },
        examples: ['Amber', 'Amethyst', 'Garnet', 'Jade', 'Pearl'],
      },
      magicItems: [{ rarity: 'uncommon', dice: { count: 1, sides: 6 } }],
    },
    {
      min: 41,
      max: 68,
      valuables: {
        unitGp: 100,
        category: 'gem',
        dice: { count: 3, sides: 6 },
        examples: ['Amethyst', 'Coral', 'Garnet', 'Pearl', 'Spinel'],
      },
      magicItems: [{ rarity: 'rare', dice: { count: 1, sides: 4 } }],
    },
    {
      min: 69,
      max: 88,
      valuables: {
        unitGp: 250,
        category: 'art',
        dice: { count: 2, sides: 4 },
        examples: ['Gold Ring with bloodstones', 'Carved Ivory Statuette', 'Silver Necklace'],
      },
      magicItems: [{ rarity: 'rare', dice: { count: 1, sides: 4 } }],
    },
    {
      min: 89,
      max: 100,
      valuables: {
        unitGp: 250,
        category: 'art',
        dice: { count: 2, sides: 4 },
        examples: ['Bronze crown with turquoise', 'Carved Jade Dragon', 'Silk Robe with gold embroidery'],
      },
      magicItems: [
        { rarity: 'rare', dice: { count: 1, sides: 4 } },
        { rarity: 'very-rare', dice: { count: 1, sides: 1 } },
      ],
    },
  ],
  '11-16': [
    { min: 1, max: 3 },
    {
      min: 4,
      max: 9,
      valuables: {
        unitGp: 250,
        category: 'art',
        dice: { count: 2, sides: 4 },
        examples: ['Gold Ring with bloodstones', 'Carved Ivory Statuette'],
      },
    },
    {
      min: 10,
      max: 15,
      valuables: {
        unitGp: 750,
        category: 'art',
        dice: { count: 2, sides: 4 },
        examples: ['Silver Chalice with lapis lazuli', 'Carved Wood Harp of exotic wood with ivory inlay', 'Small Gold Idol', 'Gold Dragon Comb with red garnets'],
      },
    },
    {
      min: 16,
      max: 29,
      valuables: {
        unitGp: 500,
        category: 'gem',
        dice: { count: 3, sides: 6 },
        examples: ['Alexandrite', 'Aquamarine', 'Black Pearl', 'Blue Spinach', 'Peridot', 'Topaz'],
      },
    },
    {
      min: 30,
      max: 50,
      valuables: {
        unitGp: 500,
        category: 'gem',
        dice: { count: 3, sides: 6 },
        examples: ['Aquamarine', 'Black Pearl', 'Peridot', 'Topaz'],
      },
      magicItems: [{ rarity: 'rare', dice: { count: 1, sides: 6 } }],
    },
    {
      min: 51,
      max: 72,
      valuables: {
        unitGp: 1000,
        category: 'gem',
        dice: { count: 3, sides: 6 },
        examples: ['Black Opal', 'Blue Sapphire', 'Fiery Yellow Corundum', 'Star Ruby', 'Star Sapphire', 'Yellow Sapphire'],
      },
      magicItems: [{ rarity: 'rare', dice: { count: 1, sides: 4 } }, { rarity: 'very-rare', dice: { count: 1, sides: 1 } }],
    },
    {
      min: 73,
      max: 90,
      valuables: {
        unitGp: 750,
        category: 'art',
        dice: { count: 2, sides: 4 },
        examples: ['Silver Chalice with lapis lazuli', 'Small Gold Idol', 'Gold Dragon Comb with red garnets'],
      },
      magicItems: [{ rarity: 'very-rare', dice: { count: 1, sides: 4 } }],
    },
    {
      min: 91,
      max: 100,
      valuables: {
        unitGp: 1000,
        category: 'gem',
        dice: { count: 3, sides: 6 },
        examples: ['Black Opal', 'Blue Sapphire', 'Star Ruby', 'Star Sapphire'],
      },
      magicItems: [{ rarity: 'very-rare', dice: { count: 1, sides: 4 } }, { rarity: 'legendary', dice: { count: 1, sides: 1 } }],
    },
  ],
  '17+': [
    { min: 1, max: 2 },
    {
      min: 3,
      max: 10,
      valuables: {
        unitGp: 1000,
        category: 'gem',
        dice: { count: 3, sides: 6 },
        examples: ['Black Opal', 'Blue Sapphire', 'Star Ruby', 'Star Sapphire'],
      },
      magicItems: [{ rarity: 'rare', dice: { count: 1, sides: 8 } }],
    },
    {
      min: 11,
      max: 25,
      valuables: {
        unitGp: 2500,
        category: 'art',
        dice: { count: 1, sides: 10 },
        examples: ['Fine Gold Chain set with fire opals', 'Old Masterpiece Painting', 'Embroidered Silk and Velvet Mantle with moonstones', 'Platinum Ring set with emerald'],
      },
      magicItems: [{ rarity: 'very-rare', dice: { count: 1, sides: 6 } }],
    },
    {
      min: 26,
      max: 55,
      valuables: {
        unitGp: 5000,
        category: 'gem',
        dice: { count: 1, sides: 8 },
        examples: ['Black Sapphire', 'Diamond (large, clear)', 'Jacinth', 'Ruby', 'Star Emerald'],
      },
      magicItems: [{ rarity: 'very-rare', dice: { count: 1, sides: 6 } }],
    },
    {
      min: 56,
      max: 80,
      valuables: {
        unitGp: 5000,
        category: 'gem',
        dice: { count: 1, sides: 8 },
        examples: ['Black Sapphire', 'Diamond', 'Ruby'],
      },
      magicItems: [{ rarity: 'legendary', dice: { count: 1, sides: 4 } }],
    },
    {
      min: 81,
      max: 100,
      valuables: {
        unitGp: 7500,
        category: 'art',
        dice: { count: 1, sides: 8 },
        examples: ['Jeweled Platinum Crown', 'Jeweled Gold Scepter', 'Gold Cup set with emeralds'],
      },
      magicItems: [
        { rarity: 'very-rare', dice: { count: 1, sides: 4 } },
        { rarity: 'legendary', dice: { count: 1, sides: 4 } },
      ],
    },
  ],
};
