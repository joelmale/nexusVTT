import { z } from 'zod';
import { authoredMetadataSchema, rulesetRefSchema } from './identity.js';

/**
 * Ability scores dictionary schema
 */
export const abilityScoreRecordSchema = z.object({
  score: z.number().int().min(1).max(30),
  modifier: z.number().int(),
});

export const abilityScoresSchema = z.object({
  STR: abilityScoreRecordSchema,
  DEX: abilityScoreRecordSchema,
  CON: abilityScoreRecordSchema,
  INT: abilityScoreRecordSchema,
  WIS: abilityScoreRecordSchema,
  CHA: abilityScoreRecordSchema,
});
export type AbilityScores = z.infer<typeof abilityScoresSchema>;

/**
 * Authored Character Record (Account-level definition)
 */
export const characterRecordSchema = authoredMetadataSchema.extend({
  kind: z.literal('character'),
  ruleset: rulesetRefSchema,
  species: z.string().min(1),
  class: z.string().min(1),
  subclass: z.string().optional(),
  level: z.number().int().min(1).max(20),
  alignment: z.string().default('True Neutral'),
  background: z.string().default(''),
  abilities: abilityScoresSchema,
  baseMaxHp: z.number().int().positive(),
  speed: z.number().int().positive().default(30),
  armorClass: z.number().int().positive().default(10),
  proficiencyBonus: z.number().int().positive().default(2),
  features: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      source: z.string(),
      description: z.string(),
      uses: z
        .object({
          total: z.number().int().nonnegative(),
          used: z.number().int().nonnegative(),
          resetOn: z.enum(['short-rest', 'long-rest', 'dawn', 'week']),
        })
        .optional(),
    }),
  ).default([]),
  proficiencies: z.object({
    skills: z.array(z.string()).default([]),
    savingThrows: z.array(z.string()).default([]),
    armor: z.array(z.string()).default([]),
    weapons: z.array(z.string()).default([]),
    tools: z.array(z.string()).default([]),
    languages: z.array(z.string()).default([]),
  }).default({
    skills: [],
    savingThrows: [],
    armor: [],
    weapons: [],
    tools: [],
    languages: [],
  }),
  rawCreationData: z.record(z.string(), z.unknown()).optional(),
  legacyId: z.string().optional(),
});
export type CharacterRecord = z.infer<typeof characterRecordSchema>;
