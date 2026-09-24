import { z } from 'zod';
import { authoredMetadataSchema, definitionRefSchema, rulesetRefSchema } from './identity.js';

export const itemTypeSchema = z.enum([
  'weapon',
  'armor',
  'shield',
  'wondrous_item',
  'potion',
  'scroll',
  'spellbook',
  'tool',
  'ammunition',
  'adventuring_gear',
]);
export type ItemType = z.infer<typeof itemTypeSchema>;

export const itemRaritySchema = z.enum([
  'common',
  'uncommon',
  'rare',
  'very_rare',
  'legendary',
  'artifact',
]);
export type ItemRarity = z.infer<typeof itemRaritySchema>;

/**
 * Reusable Equipment/Item Definition (Compendium)
 */
export const itemDefinitionSchema = authoredMetadataSchema.extend({
  kind: z.literal('item'),
  ruleset: rulesetRefSchema,
  itemType: itemTypeSchema,
  rarity: itemRaritySchema.default('common'),
  requiresAttunement: z.boolean().default(false),
  weightLb: z.number().nonnegative().default(0),
  costGp: z.number().nonnegative().default(0),
  description: z.string(),
  maxCharges: z.number().int().positive().optional(),
  rechargeRule: z.string().optional(),
});
export type ItemDefinition = z.infer<typeof itemDefinitionSchema>;

/**
 * A concrete owned physical item in an actor's inventory or campaign container
 */
export const itemInstanceSchema = z.object({
  instanceId: z.string().uuid(),
  itemRef: definitionRefSchema,
  name: z.string(),
  quantity: z.number().int().positive().default(1),
  isEquipped: z.boolean().default(false),
  isAttuned: z.boolean().default(false),
  currentCharges: z.number().int().nonnegative().optional(),
  // For physical spellbooks: holds written pages, transcription queue, annotations
  bookContent: z
    .object({
      baseCollectionRef: definitionRefSchema.optional(),
      transcriptionQueue: z.array(
        z.object({
          spellSlug: z.string(),
          costGp: z.number().nonnegative(),
          timeHoursTotal: z.number().positive(),
          timeHoursSpent: z.number().nonnegative(),
          isComplete: z.boolean(),
        }),
      ).default([]),
      annotations: z.record(z.string(), z.string()).default({}), // spellSlug -> notes
    })
    .optional(),
});
export type ItemInstance = z.infer<typeof itemInstanceSchema>;
