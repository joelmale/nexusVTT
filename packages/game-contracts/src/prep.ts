import { z } from 'zod';

import { definitionRefSchema } from './identity.js';

export const campaignEntryKindSchema = z.enum([
  'note',
  'npc',
  'location',
  'faction',
  'quest',
  'lore',
  'clue',
]);
export type CampaignEntryKind = z.infer<typeof campaignEntryKindSchema>;

export const campaignVisibilitySchema = z.enum(['dm-only', 'players']);
export type CampaignVisibility = z.infer<typeof campaignVisibilitySchema>;

export const campaignObjectRevisionRefSchema = z.object({
  target: z.literal('campaign-object'),
  campaignId: z.string().uuid(),
  id: z.string().uuid(),
  revision: z.number().int().positive(),
});

export const definitionObjectRefSchema = z.object({
  target: z.literal('definition'),
  ref: definitionRefSchema,
});

export const rulesEntityObjectRefSchema = z.object({
  target: z.literal('rules-entity'),
  entityType: z.enum(['monster', 'spell', 'item']),
  ruleset: z.enum(['2014', '2024']),
  slug: z.string().trim().min(1),
  catalogVersion: z.number().int().positive(),
});

export const documentObjectRefSchema = z.object({
  target: z.literal('document'),
  documentId: z.string().min(1),
});

export const assetObjectRefSchema = z.object({
  target: z.literal('asset'),
  assetId: z.string().min(1),
});
export type AssetObjectRef = z.infer<typeof assetObjectRefSchema>;

export const campaignObjectRefSchema = z.discriminatedUnion('target', [
  campaignObjectRevisionRefSchema,
  definitionObjectRefSchema,
  rulesEntityObjectRefSchema,
  documentObjectRefSchema,
  assetObjectRefSchema,
]);
export type CampaignObjectRef = z.infer<typeof campaignObjectRefSchema>;

export function campaignObjectRefKey(reference: CampaignObjectRef): string {
  switch (reference.target) {
    case 'campaign-object':
      return JSON.stringify([
        reference.target,
        reference.campaignId,
        reference.id,
        reference.revision,
      ]);
    case 'definition':
      return JSON.stringify([
        reference.target,
        reference.ref.kind,
        reference.ref.id,
        reference.ref.revision,
      ]);
    case 'rules-entity':
      return JSON.stringify([
        reference.target,
        reference.entityType,
        reference.ruleset,
        reference.slug,
        reference.catalogVersion,
      ]);
    case 'document':
      return JSON.stringify([reference.target, reference.documentId]);
    case 'asset':
      return JSON.stringify([reference.target, reference.assetId]);
  }
}

export const lexicalContentSchema = z.object({
  format: z.literal('lexical'),
  schemaVersion: z.number().int().positive(),
  value: z.unknown(),
});
export type LexicalContent = z.infer<typeof lexicalContentSchema>;

export const campaignEntrySchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  schemaVersion: z.number().int().positive(),
  revision: z.number().int().positive(),
  kind: campaignEntryKindSchema,
  title: z.string().trim().min(1),
  visibility: campaignVisibilitySchema,
  content: lexicalContentSchema,
  links: z.array(campaignObjectRefSchema).default([]),
  tags: z.array(z.string().trim().min(1)).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CampaignEntry = z.infer<typeof campaignEntrySchema>;

export const sceneTemplateSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  schemaVersion: z.number().int().positive(),
  revision: z.number().int().positive(),
  name: z.string().trim().min(1),
  backgroundAssetRef: assetObjectRefSchema,
  grid: z.object({
    enabled: z.boolean(),
    type: z.enum(['square', 'hex']),
    size: z.number().positive(),
    offsetX: z.number().finite(),
    offsetY: z.number().finite(),
    snapToGrid: z.boolean(),
  }),
  lighting: z.object({
    enabled: z.boolean(),
    globalIllumination: z.boolean(),
    ambientLight: z.number().min(0).max(1),
    darkness: z.number().min(0).max(1),
  }),
  fogPreset: z
    .object({
      mode: z.enum(['off', 'concealed']),
      revealedShapes: z.array(z.unknown()),
    })
    .optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SceneTemplate = z.infer<typeof sceneTemplateSchema>;

const sessionPlanStepBaseSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1),
  estimatedMinutes: z.number().int().nonnegative(),
  visibility: campaignVisibilitySchema,
});

const encounterDefinitionRefSchema = definitionRefSchema.extend({
  kind: z.literal('encounter'),
});

export const sessionPlanStepSchema = z.discriminatedUnion('type', [
  sessionPlanStepBaseSchema.extend({
    type: z.literal('open-entry'),
    entryRef: campaignObjectRevisionRefSchema,
  }),
  sessionPlanStepBaseSchema.extend({
    type: z.literal('activate-scene'),
    sceneTemplateRef: campaignObjectRevisionRefSchema,
  }),
  sessionPlanStepBaseSchema.extend({
    type: z.literal('deploy-encounter'),
    encounterRef: encounterDefinitionRefSchema,
  }),
  sessionPlanStepBaseSchema.extend({
    type: z.literal('share-handout'),
    assetRef: assetObjectRefSchema,
  }),
  sessionPlanStepBaseSchema.extend({
    type: z.literal('reminder'),
    text: z.string().trim().min(1),
  }),
]);
export type SessionPlanStep = z.infer<typeof sessionPlanStepSchema>;

export const sessionPlanSchema = z
  .object({
    id: z.string().uuid(),
    campaignId: z.string().uuid(),
    schemaVersion: z.number().int().positive(),
    revision: z.number().int().positive(),
    title: z.string().trim().min(1),
    status: z.enum(['draft', 'ready', 'retired']),
    steps: z.array(sessionPlanStepSchema).min(1),
    dependencies: z.array(campaignObjectRefSchema).default([]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((plan, context) => {
    const seenStepIds = new Set<string>();

    plan.steps.forEach((step, index) => {
      if (seenStepIds.has(step.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Session plan step IDs must be unique',
          path: ['steps', index, 'id'],
        });
      }
      seenStepIds.add(step.id);
    });
  });
export type SessionPlan = z.infer<typeof sessionPlanSchema>;
