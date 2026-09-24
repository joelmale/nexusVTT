import { z } from 'zod';
import { definitionRefSchema, rulesetRefSchema } from './identity.js';
import { resourcePoolSchema, spellcastingProfileSchema, activeConcentrationSchema } from './spell.js';
import { itemInstanceSchema } from './item.js';
import { abilityScoresSchema } from './character.js';
import { monsterSpeedSchema, monsterArmorClassSchema, monsterActionSchema } from './monster.js';

export const actorKindSchema = z.enum(['pc', 'npc', 'monster', 'companion']);
export type ActorKind = z.infer<typeof actorKindSchema>;

export const actorHpSchema = z.object({
  current: z.number().int(),
  max: z.number().int().positive(),
  temp: z.number().int().nonnegative().default(0),
});
export type ActorHp = z.infer<typeof actorHpSchema>;

export const deathSavesSchema = z.object({
  successes: z.number().int().min(0).max(3).default(0),
  failures: z.number().int().min(0).max(3).default(0),
});
export type DeathSaves = z.infer<typeof deathSavesSchema>;

/**
 * PC specific actor payload
 */
export const pcActorPayloadSchema = z.object({
  species: z.string(),
  class: z.string(),
  subclass: z.string().optional(),
  level: z.number().int().min(1).max(20),
  hitDice: z.object({
    total: z.number().int().positive(),
    current: z.number().int().nonnegative(),
    dieType: z.string(), // e.g. "d8", "d10"
  }),
  experiencePoints: z.number().int().nonnegative().default(0),
  armorClass: z.number().int().positive(),
  speed: z.number().int().positive().default(30),
  proficiencyBonus: z.number().int().positive().default(2),
  abilities: abilityScoresSchema,
});
export type PcActorPayload = z.infer<typeof pcActorPayloadSchema>;

/**
 * Monster specific actor payload
 */
export const monsterActorPayloadSchema = z.object({
  size: z.string(),
  monsterType: z.string(),
  challengeRating: z.number().nonnegative(),
  armorClass: z.array(monsterArmorClassSchema),
  speed: monsterSpeedSchema,
  abilities: abilityScoresSchema,
  specialAbilities: z.array(monsterActionSchema).default([]),
  actions: z.array(monsterActionSchema).default([]),
  reactions: z.array(monsterActionSchema).default([]),
  legendaryActions: z
    .object({
      actionsPerRound: z.number().int().positive(),
      actionsRemaining: z.number().int().nonnegative(),
      actions: z.array(monsterActionSchema),
    })
    .optional(),
  rechargeActionStates: z.record(z.string(), z.boolean()).default({}), // actionId -> isCharged
});
export type MonsterActorPayload = z.infer<typeof monsterActorPayloadSchema>;

/**
 * Campaign Actor: the authoritative live runtime entity in a campaign.
 */
export const campaignActorSchema = z.object({
  campaignActorId: z.string().uuid(),
  campaignId: z.string().uuid(),
  name: z.string().min(1),
  actorKind: actorKindSchema,
  sourceRef: definitionRefSchema, // Links to CharacterRecord or MonsterDefinition
  ruleset: rulesetRefSchema,
  stateVersion: z.number().int().nonnegative(), // For optimistic concurrency CAS
  controllerUserIds: z.array(z.string()).default([]),
  activeSessionId: z.string().uuid().nullable().optional(),
  hp: actorHpSchema,
  deathSaves: deathSavesSchema.default({ successes: 0, failures: 0 }),
  conditions: z.array(z.string()).default([]),
  concentration: activeConcentrationSchema.nullable().optional(),
  resourcePools: z.record(z.string(), resourcePoolSchema).default({}),
  spellcastingProfiles: z.array(spellcastingProfileSchema).default([]),
  inventory: z.array(itemInstanceSchema).default([]),
  pcPayload: pcActorPayloadSchema.optional(),
  monsterPayload: monsterActorPayloadSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CampaignActor = z.infer<typeof campaignActorSchema>;
