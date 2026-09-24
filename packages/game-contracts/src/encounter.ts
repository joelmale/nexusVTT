import { z } from 'zod';
import { authoredMetadataSchema, definitionRefSchema, rulesetRefSchema } from './identity.js';

export const encounterGroupSchema = z.object({
  id: z.string().uuid(),
  monsterRef: definitionRefSchema,
  count: z.number().int().positive(),
  faction: z.enum(['hostile', 'neutral', 'friendly']).default('hostile'),
  customName: z.string().optional(),
  waveIndex: z.number().int().nonnegative().default(0),
  relativePlacements: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
      }),
    )
    .optional(),
  overrides: z.record(z.string(), z.unknown()).default({}),
});
export type EncounterGroup = z.infer<typeof encounterGroupSchema>;

/**
 * Encounter Template (authored reusable blueprint)
 */
export const encounterTemplateSchema = authoredMetadataSchema.extend({
  kind: z.literal('encounter'),
  ruleset: rulesetRefSchema,
  groups: z.array(encounterGroupSchema).min(1),
  rewardRefs: z.array(z.string()).default([]),
  environmentNotes: z.string().optional(),
});
export type EncounterTemplate = z.infer<typeof encounterTemplateSchema>;

export const encounterParticipantSchema = z.object({
  actorId: z.string().uuid(),
  initiativeRoll: z.number().int().optional(),
  tieBreaker: z.number().optional(),
  hasActedThisRound: z.boolean().default(false),
  reactionUsed: z.boolean().default(false),
});
export type EncounterParticipant = z.infer<typeof encounterParticipantSchema>;

/**
 * Encounter Run (deployed live combat instance in a campaign)
 */
export const encounterRunSchema = z.object({
  runId: z.string().uuid(),
  campaignId: z.string().uuid(),
  templateRef: definitionRefSchema,
  stage: z.enum(['staged', 'deployed', 'active', 'completed', 'archived']),
  deploymentCommandId: z.string().uuid(),
  activeSessionId: z.string().uuid().nullable().optional(),
  currentRound: z.number().int().positive().default(1),
  currentTurnIndex: z.number().int().nonnegative().default(0),
  activeWaveIndex: z.number().int().nonnegative().default(0),
  participants: z.array(encounterParticipantSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type EncounterRun = z.infer<typeof encounterRunSchema>;
