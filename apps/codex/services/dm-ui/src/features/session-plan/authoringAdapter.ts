import {
  sessionPlanAuthoringSchema,
  type SessionPlan as ContractPlan,
  type SessionPlanAuthoring,
} from '@nexus/game-contracts';

import type { SessionPlan } from '@/demo/ashes-of-veyra/types';

export function normalizeAuthoring(plan: unknown): SessionPlanAuthoring {
  return sessionPlanAuthoringSchema.parse(plan);
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
      visibility: step.visibility === 'shared' ? 'players' : 'dm-only',
      track: step.track,
      type: 'reminder',
      text: step.body?.trim() || step.title,
    })),
  };
}

export function contractToAuthoring(plan: ContractPlan): SessionPlan {
  if (plan.authoring) return { ...plan.authoring, revision: plan.revision };
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
    steps: plan.steps.map((step, index) => ({
      id: step.id,
      order: index + 1,
      title: step.title,
      track: step.track,
      durationMinutes: step.estimatedMinutes,
      visibility: step.visibility === 'players' ? 'shared' : 'dm-only',
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
      ...(step.type === 'reminder' ? { body: step.text } : {}),
    })),
  };
}
