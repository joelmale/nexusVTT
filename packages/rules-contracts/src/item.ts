import { z } from 'zod';
import {
  CostSchema,
  DamageRollSchema,
  EntityRefSchema,
  NameSchema,
} from './common.js';

export const ItemCategorySchema = z.enum([
  'weapon',
  'armor',
  'shield',
  'ammunition',
  'adventuring_gear',
  'tool',
  'spellcasting_focus',
  'equipment_pack',
  'mount_vehicle',
  'potion',
  'ring',
  'rod',
  'scroll',
  'staff',
  'wand',
  'wondrous',
  'other',
]);
export type ItemCategory = z.infer<typeof ItemCategorySchema>;

export const ItemRaritySchema = z.enum([
  'mundane',
  'common',
  'uncommon',
  'rare',
  'very_rare',
  'legendary',
  'artifact',
  'varies',
]);
export type ItemRarity = z.infer<typeof ItemRaritySchema>;

export const WeaponPropertySchema = z.enum([
  'ammunition',
  'finesse',
  'heavy',
  'light',
  'loading',
  'range',
  'reach',
  'special',
  'thrown',
  'two_handed',
  'versatile',
]);

/** 2024-only weapon mastery properties. */
export const WeaponMasterySchema = z.enum([
  'cleave',
  'graze',
  'nick',
  'push',
  'sap',
  'slow',
  'topple',
  'vex',
]);

const weaponFields = {
  category: z.enum(['simple', 'martial']),
  kind: z.enum(['melee', 'ranged']),
  damage: DamageRollSchema,
  versatileDamage: DamageRollSchema.optional(),
  properties: z.array(WeaponPropertySchema),
  /** Normal/long range in feet for ranged or thrown weapons. */
  range: z
    .object({ normal: z.number().positive(), long: z.number().positive().optional() })
    .strict()
    .optional(),
  /** Magic bonus to attack and damage rolls (e.g. +1 weapon). */
  bonus: z.number().int().min(1).max(3).optional(),
};

export const Weapon2014Schema = z.object(weaponFields).strict();
export const Weapon2024Schema = z
  .object({ ...weaponFields, mastery: WeaponMasterySchema.optional() })
  .strict();

export const ArmorSchema = z
  .object({
    category: z.enum(['light', 'medium', 'heavy', 'shield']),
    /** Base AC, or the AC bonus for a shield. */
    baseAc: z.number().int().min(0).max(30),
    dexBonus: z.boolean(),
    maxDexBonus: z.number().int().min(0).optional(),
    strengthRequirement: z.number().int().min(0).max(30).optional(),
    stealthDisadvantage: z.boolean(),
    donTime: z.string().trim().min(1).optional(),
    doffTime: z.string().trim().min(1).optional(),
    /** Magic bonus to AC (e.g. +1 armor). */
    bonus: z.number().int().min(1).max(3).optional(),
  })
  .strict();

export const ItemChargesSchema = z
  .object({
    max: z.number().int().positive(),
    /** When charges recover, e.g. "dawn". */
    recharge: z.string().trim().min(1).optional(),
    /** Dice regained on recharge, e.g. "1d6+4". */
    rechargeDice: z.string().trim().min(1).optional(),
  })
  .strict();

export const ItemActivationSchema = z
  .object({
    type: z.enum(['action', 'bonus_action', 'reaction', 'magic_action', 'utilize', 'special']),
    text: z.string().trim().min(1).optional(),
  })
  .strict();

export const ItemSpellSchema = z
  .object({
    ref: EntityRefSchema,
    chargeCost: z.number().int().min(0).optional(),
    castLevel: z.number().int().min(0).max(9).optional(),
  })
  .strict();

const itemFields = {
  name: NameSchema,
  category: ItemCategorySchema,
  rarity: ItemRaritySchema,
  attunement: z
    .object({
      required: z.boolean(),
      /** e.g. "by a wizard"; only meaningful when attunement is required. */
      requirement: z.string().trim().min(1).optional(),
    })
    .strict(),
  cost: CostSchema.optional(),
  /** Weight in pounds. */
  weight: z.number().nonnegative().optional(),
  armor: ArmorSchema.optional(),
  charges: ItemChargesSchema.optional(),
  activation: ItemActivationSchema.optional(),
  /** Spells the item can cast, by slug in the same ruleset. */
  spells: z.array(ItemSpellSchema).optional(),
  /** Rules text; mundane gear may legitimately have none. */
  text: z.string().trim().max(20_000).default(''),
};

export const Item2014Schema = z
  .object({
    ruleset: z.literal('2014'),
    ...itemFields,
    weapon: Weapon2014Schema.optional(),
  })
  .strict();
export const Item2024Schema = z
  .object({
    ruleset: z.literal('2024'),
    ...itemFields,
    weapon: Weapon2024Schema.optional(),
  })
  .strict();

type ItemShape = z.infer<typeof Item2014Schema> | z.infer<typeof Item2024Schema>;

function refineItem(item: ItemShape, ctx: z.RefinementCtx): void {
  const isWeapon = item.category === 'weapon';
  if (isWeapon && !item.weapon) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['weapon'],
      message: 'weapons require weapon statistics',
    });
  }
  if (item.weapon && !isWeapon) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['weapon'],
      message: 'weapon statistics are only allowed for category "weapon"',
    });
  }
  const isArmor = item.category === 'armor' || item.category === 'shield';
  if (isArmor && !item.armor) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['armor'],
      message: 'armor and shields require armor statistics',
    });
  }
  if (item.armor && !isArmor) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['armor'],
      message: 'armor statistics are only allowed for armor or shields',
    });
  }
  if (item.armor && (item.armor.category === 'shield') !== (item.category === 'shield')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['armor', 'category'],
      message: 'shield armor statistics must match the shield category',
    });
  }
  if (item.weapon) {
    const { properties, versatileDamage, range } = item.weapon;
    if (new Set(properties).size !== properties.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['weapon', 'properties'],
        message: 'weapon properties must be unique',
      });
    }
    if (properties.includes('versatile') !== (versatileDamage !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['weapon', 'versatileDamage'],
        message: 'versatile weapons, and only they, require versatileDamage',
      });
    }
    const needsRange =
      item.weapon.kind === 'ranged' || properties.includes('thrown');
    if (needsRange && !range) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['weapon', 'range'],
        message: 'ranged and thrown weapons require a range',
      });
    }
    if (range?.long !== undefined && range.long < range.normal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['weapon', 'range', 'long'],
        message: 'long range cannot be shorter than normal range',
      });
    }
  }
  if (item.rarity === 'mundane' && item.attunement.required) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['attunement', 'required'],
      message: 'mundane items cannot require attunement',
    });
  }
  if (!item.attunement.required && item.attunement.requirement !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['attunement', 'requirement'],
      message: 'an attunement requirement needs required: true',
    });
  }
}

export const ItemSchema = z
  .discriminatedUnion('ruleset', [Item2014Schema, Item2024Schema])
  .superRefine(refineItem);

export type Item = z.infer<typeof ItemSchema>;
export type Item2014 = z.infer<typeof Item2014Schema>;
export type Item2024 = z.infer<typeof Item2024Schema>;
