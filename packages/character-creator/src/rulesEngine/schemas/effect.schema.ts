/**
 * Zod schemas for effects
 */

import { z } from 'zod';
import {
  abilitySchema,
  bonusTypeSchema,
  effectPrioritySchema,
  movementTypeSchema,
  proficiencyTypeSchema,
  resourceTypeSchema,
  senseTypeSchema,
  skillSchema,
  spellcastingTypeSchema,
  stackingRuleSchema,
} from './common.schema';
import { numberOrFormulaSchema } from './formula.schema';
import { predicateArraySchema } from './predicate.schema';

/**
 * Base effect fields
 */
const baseEffectFields = {
  predicate: predicateArraySchema,
  priority: effectPrioritySchema.optional(),
};

/**
 * Grant proficiency effect schema
 */
const grantProficiencyEffectSchema = z.object({
  kind: z.literal('grantProficiency'),
  profType: proficiencyTypeSchema,
  values: z.array(z.string().min(1)),
  ...baseEffectFields,
});

/**
 * Ability score increase effect schema
 */
const abilityScoreIncreaseEffectSchema = z.object({
  kind: z.literal('abilityScoreIncrease'),
  ability: abilitySchema,
  value: z.number().int(),
  ...baseEffectFields,
});

/**
 * Save advantage effect schema
 */
const saveAdvantageEffectSchema = z.object({
  kind: z.literal('saveAdvantage'),
  abilities: z.array(abilitySchema),
  ...baseEffectFields,
});

/**
 * Save bonus effect schema
 */
const saveBonusEffectSchema = z.object({
  kind: z.literal('saveBonus'),
  abilities: z.array(abilitySchema),
  value: numberOrFormulaSchema,
  stacking: stackingRuleSchema,
  bonusType: bonusTypeSchema.optional(),
  ...baseEffectFields,
});

/**
 * Skill proficiency effect schema
 */
const skillProficiencyEffectSchema = z.object({
  kind: z.literal('skillProficiency'),
  skill: skillSchema,
  ...baseEffectFields,
});

/**
 * Skill expertise effect schema
 */
const skillExpertiseEffectSchema = z.object({
  kind: z.literal('skillExpertise'),
  skill: skillSchema,
  ...baseEffectFields,
});

/**
 * Skill bonus effect schema
 */
const skillBonusEffectSchema = z.object({
  kind: z.literal('skillBonus'),
  skill: skillSchema,
  value: numberOrFormulaSchema,
  stacking: stackingRuleSchema,
  bonusType: bonusTypeSchema.optional(),
  ...baseEffectFields,
});

/**
 * Armor class effect schema
 */
const armorClassEffectSchema = z.object({
  kind: z.literal('armorClass'),
  value: numberOrFormulaSchema,
  stacking: stackingRuleSchema.optional(),
  bonusType: bonusTypeSchema.optional(),
  ...baseEffectFields,
});

/**
 * Initiative bonus effect schema
 */
const initiativeBonusEffectSchema = z.object({
  kind: z.literal('initiativeBonus'),
  value: numberOrFormulaSchema,
  stacking: stackingRuleSchema,
  bonusType: bonusTypeSchema.optional(),
  ...baseEffectFields,
});

/**
 * Speed effect schema
 */
const speedEffectSchema = z.object({
  kind: z.literal('speed'),
  movementType: movementTypeSchema,
  value: numberOrFormulaSchema,
  ...baseEffectFields,
});

/**
 * Sense effect schema
 */
const senseEffectSchema = z.object({
  kind: z.literal('sense'),
  senseType: senseTypeSchema,
  range: z.number().int().positive(),
  ...baseEffectFields,
});

/**
 * Resource effect schema
 */
const resourceEffectSchema = z.object({
  kind: z.literal('resource'),
  resourceId: z.string().min(1),
  resourceType: resourceTypeSchema,
  value: numberOrFormulaSchema,
  level: z.number().int().min(0).max(9).optional(),
  ...baseEffectFields,
});

/**
 * Spellcasting ability effect schema
 */
const spellcastingAbilityEffectSchema = z.object({
  kind: z.literal('spellcastingAbility'),
  ability: abilitySchema,
  ...baseEffectFields,
});

/**
 * Grant spell effect schema
 */
const grantSpellEffectSchema = z.object({
  kind: z.literal('grantSpell'),
  spellSlug: z.string().min(1),
  spellcastingType: spellcastingTypeSchema,
  usesSpellSlot: z.boolean().optional(),
  ...baseEffectFields,
});

/**
 * Spell slots effect schema
 */
const spellSlotsEffectSchema = z.object({
  kind: z.literal('spellSlots'),
  slots: z.record(z.string(), z.number().int().nonnegative()),
  ...baseEffectFields,
});

/**
 * Grant feature effect schema
 */
const grantFeatureEffectSchema = z.object({
  kind: z.literal('grantFeature'),
  featureId: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  ...baseEffectFields,
});

/**
 * Tag effect schema
 */
const tagEffectSchema = z.object({
  kind: z.literal('tag'),
  tags: z.array(z.string().min(1)),
  ...baseEffectFields,
});

/**
 * Equipment restriction effect schema
 */
const equipmentRestrictionEffectSchema = z.object({
  kind: z.literal('equipmentRestriction'),
  restrictionType: z.enum(['cannotWear', 'cannotWield', 'requiresAttunement']),
  itemTags: z.array(z.string().min(1)),
  ...baseEffectFields,
});

/**
 * Condition effect schema
 */
const conditionEffectSchema = z.object({
  kind: z.literal('condition'),
  condition: z.string().min(1),
  ...baseEffectFields,
});

/**
 * Hit point max effect schema
 */
const hitPointMaxEffectSchema = z.object({
  kind: z.literal('hitPointMax'),
  value: numberOrFormulaSchema,
  stacking: stackingRuleSchema,
  ...baseEffectFields,
});

/**
 * Effect schema (union of all effect types)
 */
export const effectSchema = z.union([
  grantProficiencyEffectSchema,
  abilityScoreIncreaseEffectSchema,
  saveAdvantageEffectSchema,
  saveBonusEffectSchema,
  skillProficiencyEffectSchema,
  skillExpertiseEffectSchema,
  skillBonusEffectSchema,
  armorClassEffectSchema,
  initiativeBonusEffectSchema,
  speedEffectSchema,
  senseEffectSchema,
  resourceEffectSchema,
  spellcastingAbilityEffectSchema,
  grantSpellEffectSchema,
  spellSlotsEffectSchema,
  grantFeatureEffectSchema,
  tagEffectSchema,
  equipmentRestrictionEffectSchema,
  conditionEffectSchema,
  hitPointMaxEffectSchema,
]);

/**
 * Choice option schema
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const choiceOptionSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    value: z.string().min(1),
    label: z.string().min(1),
    description: z.string().optional(),
    effects: z.array(effectSchema).optional(),
  })
);

/**
 * Effect choice schema
 */
export const effectChoiceSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  type: z.enum(['select', 'multiselect', 'number', 'text']),
  options: z.array(choiceOptionSchema).optional(),
  min: z.number().int().optional(),
  max: z.number().int().optional(),
  predicate: predicateArraySchema,
});

/**
 * Sourced effect schema
 */
export const sourcedEffectSchema = z.object({
  sourceId: z.string().min(1),
  effectId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  effects: z.array(effectSchema),
  choice: effectChoiceSchema.optional(),
  edition: z.enum(['2014', '2024', 'both']).optional(),
  icon: z.string().optional(),
});

/**
 * Duration schema
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const durationSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    z.object({ type: z.literal('permanent') }),
    z.object({ type: z.literal('rounds'), count: z.number().int().positive() }),
    z.object({ type: z.literal('minutes'), count: z.number().int().positive() }),
    z.object({ type: z.literal('hours'), count: z.number().int().positive() }),
    z.object({ type: z.literal('untilLongRest') }),
    z.object({ type: z.literal('untilShortRest') }),
    z.object({ type: z.literal('concentration'), maxDuration: durationSchema }),
  ])
);

/**
 * Temporary effect schema
 */
export const temporaryEffectSchema = sourcedEffectSchema.extend({
  duration: durationSchema,
  appliedAt: z.number().int(),
});
