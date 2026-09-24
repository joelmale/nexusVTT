import { z } from 'zod';
import { authoredMetadataSchema, definitionRefSchema, rulesetRefSchema } from './identity';

export const spellSchoolSchema = z.enum([
  'abjuration',
  'conjuration',
  'divination',
  'enchantment',
  'evocation',
  'illusion',
  'necromancy',
  'transmutation',
]);
export type SpellSchool = z.infer<typeof spellSchoolSchema>;

export const spellComponentsSchema = z.object({
  verbal: z.boolean().default(false),
  somatic: z.boolean().default(false),
  material: z.boolean().default(false),
  materialDescription: z.string().optional(),
  materialCostGp: z.number().nonnegative().optional(),
  materialConsumed: z.boolean().default(false),
});
export type SpellComponents = z.infer<typeof spellComponentsSchema>;

/**
 * Versioned Spell Definition
 */
export const spellDefinitionSchema = authoredMetadataSchema.extend({
  kind: z.literal('spell'),
  ruleset: rulesetRefSchema,
  slug: z.string().min(1),
  level: z.number().int().min(0).max(9),
  school: spellSchoolSchema,
  castingTime: z.string(), // e.g. "1 action", "1 bonus action", "10 minutes"
  range: z.string(), // e.g. "60 feet", "Self (15-foot cone)"
  duration: z.string(), // e.g. "Instantaneous", "Concentration, up to 1 minute"
  concentration: z.boolean().default(false),
  ritual: z.boolean().default(false),
  components: spellComponentsSchema,
  description: z.string(),
  higherLevelsDescription: z.string().optional(),
  classes: z.array(z.string()).default([]),
});
export type SpellDefinition = z.infer<typeof spellDefinitionSchema>;

/**
 * Reusable Spell Collection (grimoire text, spell list, repertoire)
 */
export const spellCollectionEntrySchema = z.object({
  spellRef: definitionRefSchema,
  slug: z.string(),
  order: z.number().int().nonnegative(),
  notes: z.string().optional(),
  isFavorite: z.boolean().default(false),
});
export type SpellCollectionEntry = z.infer<typeof spellCollectionEntrySchema>;

export const spellCollectionSchema = authoredMetadataSchema.extend({
  kind: z.literal('spell_collection'),
  ruleset: rulesetRefSchema,
  spells: z.array(spellCollectionEntrySchema).default([]),
});
export type SpellCollection = z.infer<typeof spellCollectionSchema>;

/**
 * Resource Pool (Spell slots, Pact magic, Ki points, Sorcery points, uses)
 */
export const resourcePoolSchema = z.object({
  id: z.string(),
  name: z.string(),
  poolType: z.enum(['slots', 'pact', 'points', 'uses']),
  slots: z
    .record(
      z.string(), // '1'..'9'
      z.object({
        total: z.number().int().nonnegative(),
        current: z.number().int().nonnegative(),
      }),
    )
    .optional(),
  current: z.number().int().nonnegative().optional(),
  max: z.number().int().nonnegative().optional(),
  resetOn: z.enum(['short-rest', 'long-rest', 'dawn']),
});
export type ResourcePool = z.infer<typeof resourcePoolSchema>;

/**
 * Per-source casting profile (Wizard, Cleric, Warlock, Feat grant, Item grant, Monster innate)
 */
export const spellcastingProfileSchema = z.object({
  profileId: z.string(),
  name: z.string(), // e.g. "Wizard Spellcasting", "Pact Magic", "Fey Touched"
  sourceType: z.enum([
    'class',
    'subclass',
    'species',
    'feat',
    'item',
    'monster',
  ]),
  sourceSlug: z.string(),
  spellcastingAbility: z.enum(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']),
  spellSaveDC: z.number().int().positive(),
  spellAttackBonus: z.number().int(),
  isRitualCaster: z.boolean().default(false),
  preparationMode: z.enum(['prepared', 'known', 'innate', 'always_prepared']),
  preparationLimit: z.number().int().nonnegative().optional(),
  resourcePoolId: z.string(), // Links to an actor resource pool
  boundCollectionIds: z.array(z.string().uuid()).default([]),
  knownSpellSlugs: z.array(z.string()).default([]),
  preparedSpellSlugs: z.array(z.string()).default([]),
});
export type SpellcastingProfile = z.infer<typeof spellcastingProfileSchema>;

/**
 * Spellbook Binding: links an actor/profile to a collection or physical book
 */
export const spellbookBindingSchema = z.object({
  bindingId: z.string().uuid(),
  campaignActorId: z.string().uuid(),
  profileId: z.string(),
  collectionRef: definitionRefSchema,
  itemInstanceId: z.string().uuid().optional(),
  purpose: z.enum(['study', 'preparation_source', 'reference', 'item_use']),
  boundAt: z.string().datetime(),
});
export type SpellbookBinding = z.infer<typeof spellbookBindingSchema>;

/**
 * Proposed Named Preparation Plan
 */
export const preparationPlanSchema = z.object({
  planId: z.string().uuid(),
  name: z.string().min(1),
  campaignActorId: z.string().uuid(),
  profileId: z.string(),
  spells: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PreparationPlan = z.infer<typeof preparationPlanSchema>;

/**
 * Active Concentration link
 */
export const activeConcentrationSchema = z.object({
  castId: z.string().uuid(),
  spellRef: definitionRefSchema,
  spellName: z.string(),
  startedAtRound: z.number().int().nonnegative(),
  startedAtTurn: z.number().int().nonnegative(),
  targetActorIds: z.array(z.string().uuid()).default([]),
  drawingIds: z.array(z.string()).default([]),
});
export type ActiveConcentration = z.infer<typeof activeConcentrationSchema>;

/**
 * Authoritative Cast Record
 */
export const castRecordSchema = z.object({
  castId: z.string().uuid(),
  campaignActorId: z.string().uuid(),
  spellRef: definitionRefSchema,
  spellName: z.string(),
  castAtLevel: z.number().int().min(0).max(9),
  sourceProfileId: z.string(),
  consumedResources: z.array(
    z.object({
      poolId: z.string(),
      amount: z.number().int().positive(),
      slotLevel: z.number().int().min(1).max(9).optional(),
    }),
  ),
  targets: z.array(z.string()).default([]),
  state: z.enum([
    'draft',
    'started',
    'awaiting_resolution',
    'resolved',
    'interrupted',
    'corrected',
  ]),
  timestamp: z.string().datetime(),
});
export type CastRecord = z.infer<typeof castRecordSchema>;
