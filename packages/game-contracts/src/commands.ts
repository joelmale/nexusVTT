import { z } from 'zod';
import { definitionRefSchema } from './identity.js';
import { assetObjectRefSchema } from './prep.js';

/**
 * Base command envelope carrying metadata, CAS expected versions, and idempotency key
 */
export const baseCommandEnvelopeSchema = z.object({
  commandId: z.string().uuid(),
  protocolVersion: z.literal('1.0'),
  campaignId: z.string().uuid(),
  issuerUserId: z.string().min(1),
  timestamp: z.string().datetime(),
  expectedActorVersions: z
    .record(z.string().uuid(), z.number().int().nonnegative())
    .default({}),
  expectedRoomVersion: z.number().int().nonnegative().optional(),
});

// Payloads

export const admitCharacterPayloadSchema = z.object({
  type: z.literal('AdmitCharacter'),
  characterDefinitionRef: definitionRefSchema,
  initialControllerUserIds: z.array(z.string()).default([]),
});
export type AdmitCharacterPayload = z.infer<typeof admitCharacterPayloadSchema>;

export const applyDamagePayloadSchema = z.object({
  type: z.literal('ApplyDamage'),
  targetActorId: z.string().uuid(),
  amount: z.number().int().positive(),
  damageType: z.string().default('untyped'),
  sourceDescription: z.string().optional(),
});
export type ApplyDamagePayload = z.infer<typeof applyDamagePayloadSchema>;

export const healActorPayloadSchema = z.object({
  type: z.literal('HealActor'),
  targetActorId: z.string().uuid(),
  amount: z.number().int().positive(),
  sourceDescription: z.string().optional(),
});
export type HealActorPayload = z.infer<typeof healActorPayloadSchema>;

export const deployEncounterPayloadSchema = z.object({
  type: z.literal('DeployEncounter'),
  templateRef: definitionRefSchema,
  sceneId: z.string().uuid(),
  anchorPosition: z.object({
    x: z.number(),
    y: z.number(),
  }),
  hiddenFromPlayers: z.boolean().default(false),
});
export type DeployEncounterPayload = z.infer<
  typeof deployEncounterPayloadSchema
>;

export const startEncounterPayloadSchema = z.object({
  type: z.literal('StartEncounter'),
  encounterRunId: z.string().uuid(),
});
export type StartEncounterPayload = z.infer<typeof startEncounterPayloadSchema>;

export const advanceCombatTurnPayloadSchema = z.object({
  type: z.literal('AdvanceCombatTurn'),
  encounterRunId: z.string().uuid(),
});
export type AdvanceCombatTurnPayload = z.infer<
  typeof advanceCombatTurnPayloadSchema
>;

export const applyPreparationPlanPayloadSchema = z.object({
  type: z.literal('ApplyPreparationPlan'),
  targetActorId: z.string().uuid(),
  profileId: z.string(),
  preparedSpellSlugs: z.array(z.string()),
});
export type ApplyPreparationPlanPayload = z.infer<
  typeof applyPreparationPlanPayloadSchema
>;

export const castSpellPayloadSchema = z.object({
  type: z.literal('CastSpell'),
  actorId: z.string().uuid(),
  spellRef: definitionRefSchema,
  profileId: z.string(),
  castAtLevel: z.number().int().min(0).max(9),
  targetActorIds: z.array(z.string().uuid()).default([]),
  targetCoordinates: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
});
export type CastSpellPayload = z.infer<typeof castSpellPayloadSchema>;

export const endConcentrationPayloadSchema = z.object({
  type: z.literal('EndConcentration'),
  actorId: z.string().uuid(),
  castId: z.string().uuid(),
});
export type EndConcentrationPayload = z.infer<
  typeof endConcentrationPayloadSchema
>;

export const restActorPayloadSchema = z.object({
  type: z.literal('RestActor'),
  actorId: z.string().uuid(),
  restType: z.enum(['short', 'long']),
  hitDiceToSpend: z.number().int().nonnegative().default(0),
});
export type RestActorPayload = z.infer<typeof restActorPayloadSchema>;

export const transferItemPayloadSchema = z.object({
  type: z.literal('TransferItem'),
  sourceActorId: z.string().uuid().optional(),
  targetActorId: z.string().uuid().optional(),
  itemInstanceId: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
});
export type TransferItemPayload = z.infer<typeof transferItemPayloadSchema>;

export const activateSessionPlanPayloadSchema = z.object({
  type: z.literal('ActivateSessionPlan'),
  sessionPlanId: z.string().uuid(),
  planRevision: z.number().int().positive(),
  sessionId: z.string().min(1),
});
export type ActivateSessionPlanPayload = z.infer<
  typeof activateSessionPlanPayloadSchema
>;

export const advanceSessionPlanStepPayloadSchema = z.object({
  type: z.literal('AdvanceSessionPlanStep'),
  activationId: z.string().uuid(),
  stepIndex: z.number().int().nonnegative(),
  stepId: z.string().uuid().optional(),
  completed: z.boolean().default(true),
});
export type AdvanceSessionPlanStepPayload = z.infer<
  typeof advanceSessionPlanStepPayloadSchema
>;

export const revealHandoutPayloadSchema = z.object({
  type: z.literal('RevealHandout'),
  assetRef: assetObjectRefSchema,
  title: z.string().trim().min(1),
  stepId: z.string().uuid().optional(),
});
export type RevealHandoutPayload = z.infer<typeof revealHandoutPayloadSchema>;

/**
 * Union of all domain command payloads
 */
export const domainCommandPayloadSchema = z.discriminatedUnion('type', [
  admitCharacterPayloadSchema,
  applyDamagePayloadSchema,
  healActorPayloadSchema,
  deployEncounterPayloadSchema,
  startEncounterPayloadSchema,
  advanceCombatTurnPayloadSchema,
  applyPreparationPlanPayloadSchema,
  castSpellPayloadSchema,
  endConcentrationPayloadSchema,
  restActorPayloadSchema,
  transferItemPayloadSchema,
  activateSessionPlanPayloadSchema,
  advanceSessionPlanStepPayloadSchema,
  revealHandoutPayloadSchema,
]);
export type DomainCommandPayload = z.infer<typeof domainCommandPayloadSchema>;

/**
 * Validated Domain Command Envelope
 */
export const domainCommandSchema = baseCommandEnvelopeSchema.extend({
  payload: domainCommandPayloadSchema,
});
export type DomainCommand = z.infer<typeof domainCommandSchema>;
