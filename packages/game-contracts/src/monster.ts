import { z } from 'zod';
import { authoredMetadataSchema, rulesetRefSchema } from './identity.js';
import { abilityScoresSchema } from './character.js';

export const monsterSizeSchema = z.enum([
  'Tiny',
  'Small',
  'Medium',
  'Large',
  'Huge',
  'Gargantuan',
]);
export type MonsterSize = z.infer<typeof monsterSizeSchema>;

export const monsterTypeSchema = z.enum([
  'aberration',
  'beast',
  'celestial',
  'construct',
  'dragon',
  'elemental',
  'fey',
  'fiend',
  'giant',
  'humanoid',
  'monstrosity',
  'ooze',
  'plant',
  'undead',
]);
export type MonsterType = z.infer<typeof monsterTypeSchema>;

export const monsterSpeedSchema = z.object({
  walk: z.number().int().nonnegative().optional(),
  fly: z.number().int().nonnegative().optional(),
  swim: z.number().int().nonnegative().optional(),
  climb: z.number().int().nonnegative().optional(),
  burrow: z.number().int().nonnegative().optional(),
  hover: z.boolean().optional(),
});
export type MonsterSpeed = z.infer<typeof monsterSpeedSchema>;

export const monsterArmorClassSchema = z.object({
  value: z.number().int().positive(),
  type: z.enum(['natural', 'armor', 'spell', 'other']).default('natural'),
  description: z.string().optional(),
});
export type MonsterArmorClass = z.infer<typeof monsterArmorClassSchema>;

export const monsterActionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  attackBonus: z.number().int().optional(),
  damage: z
    .array(
      z.object({
        dice: z.string(),
        type: z.string(),
      }),
    )
    .optional(),
  saveDC: z
    .object({
      ability: z.enum(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']),
      dc: z.number().int().positive(),
      success: z.enum(['none', 'half', 'other']).default('half'),
    })
    .optional(),
  recharge: z
    .object({
      minRoll: z.number().int().min(2).max(6),
      currentCharged: z.boolean().default(true),
    })
    .optional(),
});
export type MonsterAction = z.infer<typeof monsterActionSchema>;

/**
 * Monster Definition (authored reusable stat block in Bestiary)
 */
export const monsterDefinitionSchema = authoredMetadataSchema.extend({
  kind: z.literal('monster'),
  ruleset: rulesetRefSchema,
  size: monsterSizeSchema,
  monsterType: monsterTypeSchema,
  subtype: z.string().optional(),
  alignment: z.string().default('Unaligned'),
  armorClass: z.array(monsterArmorClassSchema).min(1),
  hitPoints: z.object({
    average: z.number().int().positive(),
    roll: z.string(), // e.g. "8d10 + 16"
  }),
  speed: monsterSpeedSchema,
  abilities: abilityScoresSchema,
  challengeRating: z.number().nonnegative(),
  experiencePoints: z.number().int().nonnegative(),
  proficiencyBonus: z.number().int().positive().default(2),
  savingThrows: z.record(z.string(), z.number().int()).default({}),
  skills: z.record(z.string(), z.number().int()).default({}),
  damageVulnerabilities: z.array(z.string()).default([]),
  damageResistances: z.array(z.string()).default([]),
  damageImmunities: z.array(z.string()).default([]),
  conditionImmunities: z.array(z.string()).default([]),
  senses: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
  languages: z.array(z.string()).default([]),
  specialAbilities: z.array(monsterActionSchema).default([]),
  actions: z.array(monsterActionSchema).default([]),
  reactions: z.array(monsterActionSchema).default([]),
  legendaryActions: z
    .object({
      actionsPerRound: z.number().int().positive().default(3),
      actions: z.array(monsterActionSchema),
    })
    .optional(),
  mythicActions: z
    .object({
      trigger: z.string(),
      actions: z.array(monsterActionSchema),
    })
    .optional(),
  innateSpellcasting: z
    .object({
      ability: z.enum(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']),
      saveDC: z.number().int().positive(),
      attackBonus: z.number().int().optional(),
      spells: z.record(z.string(), z.array(z.string())), // e.g. "at-will": ["detect-magic"], "1/day": ["plane-shift"]
    })
    .optional(),
});
export type MonsterDefinition = z.infer<typeof monsterDefinitionSchema>;
