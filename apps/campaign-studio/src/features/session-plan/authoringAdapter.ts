import {
  sessionPlanAuthoringSchema,
  type CampaignVisibility,
  type SessionPlan as ContractPlan,
  type SessionPlanAuthoring,
} from '@nexus/game-contracts';

import type { SessionPlan } from '@/demo/ashes-of-veyra/types';

export type AuthoringStep = SessionPlan['steps'][number] & {
  encounterId?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Normalizes any visibility token ('shared' | 'players' | 'dm-only') to authoring vocabulary. */
export function toAuthoringVisibility(
  visibility: unknown,
): 'shared' | 'dm-only' {
  return visibility === 'shared' || visibility === 'players'
    ? 'shared'
    : 'dm-only';
}

/** Normalizes any visibility token ('shared' | 'players' | 'dm-only') to contract vocabulary. */
export function toContractVisibility(visibility: unknown): CampaignVisibility {
  return visibility === 'shared' || visibility === 'players'
    ? 'players'
    : 'dm-only';
}

export function normalizeAuthoring(plan: unknown): SessionPlanAuthoring {
  if (!isRecord(plan)) {
    return sessionPlanAuthoringSchema.parse(plan);
  }
  const normalized: Record<string, unknown> = {
    ...plan,
    ...(plan.defaultVisibility !== undefined
      ? { defaultVisibility: toAuthoringVisibility(plan.defaultVisibility) }
      : {}),
    ...(Array.isArray(plan.steps)
      ? {
          steps: plan.steps.map((step) =>
            isRecord(step) && step.visibility !== undefined
              ? { ...step, visibility: toAuthoringVisibility(step.visibility) }
              : step,
          ),
        }
      : {}),
  };
  return sessionPlanAuthoringSchema.parse(normalized);
}

/** Persist inputs before publication without pretending unresolved actions are
 * executable. Publication replaces these draft reminders with validated refs. */
export function draftContractPlan(input: {
  plan: unknown;
  id: string;
  sessionId: string;
  campaignId: string;
  title: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}): ContractPlan {
  const authoring = normalizeAuthoring(input.plan);
  return {
    id: input.id,
    sessionId: input.sessionId,
    campaignId: input.campaignId,
    title: input.title,
    schemaVersion: 1,
    revision: input.revision,
    status: 'draft',
    authoring,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    dependencies: [],
    steps: authoring.steps.map((step) => ({
      id: /^[0-9a-f-]{36}$/i.test(step.id) ? step.id : crypto.randomUUID(),
      title: step.title,
      estimatedMinutes: step.durationMinutes,
      visibility: toContractVisibility(step.visibility),
      track: step.track,
      type: 'reminder',
      text: step.body?.trim() || step.title,
    })),
  };
}

export const authoringToContract = draftContractPlan;

export function contractToAuthoring(
  plan: ContractPlan,
): SessionPlan & { steps: AuthoringStep[] } {
  if (plan.authoring) {
    return {
      ...plan.authoring,
      revision: plan.revision,
      ...(plan.authoring.defaultVisibility
        ? {
            defaultVisibility: toAuthoringVisibility(
              plan.authoring.defaultVisibility,
            ),
          }
        : {}),
      steps: plan.authoring.steps.map((step) => ({
        ...step,
        visibility: toAuthoringVisibility(step.visibility),
      })),
    };
  }
  return {
    version: 1,
    revision: plan.revision,
    lastEdited: plan.updatedAt,
    estimatedMinutes: plan.steps.reduce(
      (sum, step) => sum + step.estimatedMinutes,
      0,
    ),
    readiness: [],
    dependencies: [],
    notes: [],
    playerFacingSummary: '',
    attachments: [],
    steps: plan.steps.map(
      (step, index): AuthoringStep => ({
        id: step.id,
        order: index + 1,
        title: step.title,
        track: step.track,
        durationMinutes: step.estimatedMinutes,
        visibility: toAuthoringVisibility(step.visibility),
        kind:
          step.type === 'open-entry'
            ? 'note'
            : step.type === 'activate-scene'
              ? 'scene'
              : step.type === 'deploy-encounter'
                ? 'encounter'
                : step.type === 'share-handout'
                  ? 'handout'
                  : 'note',
        ...(step.type === 'open-entry' ? { objectId: step.entryRef.id } : {}),
        ...(step.type === 'activate-scene'
          ? { sceneTemplateId: step.sceneTemplateRef.id }
          : {}),
        ...(step.type === 'deploy-encounter'
          ? {
              objectId: step.encounterRef.id,
              encounterId: step.encounterRef.id,
            }
          : {}),
        ...(step.type === 'share-handout'
          ? { objectId: step.assetRef.assetId }
          : {}),
        ...(step.type === 'reminder' ? { body: step.text } : {}),
      }),
    ),
  };
}
