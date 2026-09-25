import {
  campaignObjectRefKey,
  sessionPlanSchema,
  type CampaignObjectRef,
  type SessionPlan,
} from '@nexus/game-contracts';

export type PrepDependencyObjectType =
  | 'campaign-entry'
  | 'scene-template'
  | 'definition'
  | 'rules-entity'
  | 'document'
  | 'asset';

export type PrepDependencyResolution =
  | {
      status: 'available';
      objectType: PrepDependencyObjectType;
    }
  | { status: 'missing' }
  | { status: 'forbidden' };

export interface PrepDependencyResolutionContext {
  campaignId: string;
  principalId: string;
}

export interface PrepDependencyResolver {
  resolve(
    reference: CampaignObjectRef,
    context: PrepDependencyResolutionContext,
  ): Promise<PrepDependencyResolution>;
}

export type SessionPlanPublishIssueCode =
  | 'invalid-plan'
  | 'campaign-mismatch'
  | 'already-ready-plan'
  | 'retired-plan'
  | 'cross-campaign-reference'
  | 'missing-manifest-entry'
  | 'missing-dependency'
  | 'forbidden-dependency'
  | 'unexpected-dependency-kind';

export interface SessionPlanPublishIssue {
  code: SessionPlanPublishIssueCode;
  message: string;
  path?: string;
  reference?: CampaignObjectRef;
}

export type SessionPlanPublishValidation =
  | {
      canPublish: true;
      plan: SessionPlan;
      dependencyManifest: CampaignObjectRef[];
      issues: [];
    }
  | {
      canPublish: false;
      plan?: SessionPlan;
      dependencyManifest: CampaignObjectRef[];
      issues: SessionPlanPublishIssue[];
    };

interface StepDependency {
  reference: CampaignObjectRef;
  expectedType: PrepDependencyObjectType;
  path: string;
}

function getStepDependencies(plan: SessionPlan): StepDependency[] {
  return plan.steps.flatMap((step, index): StepDependency[] => {
    const path = `steps.${index}`;

    switch (step.type) {
      case 'open-entry':
        return [
          {
            reference: step.entryRef,
            expectedType: 'campaign-entry',
            path,
          },
        ];
      case 'activate-scene':
        return [
          {
            reference: step.sceneTemplateRef,
            expectedType: 'scene-template',
            path,
          },
        ];
      case 'deploy-encounter':
        return [
          {
            reference: { target: 'definition', ref: step.encounterRef },
            expectedType: 'definition',
            path,
          },
        ];
      case 'share-handout':
        return [
          {
            reference: step.assetRef,
            expectedType: 'asset',
            path,
          },
        ];
      case 'reminder':
        return [];
    }
  });
}

function getManifest(
  plan: SessionPlan,
  stepDependencies: StepDependency[],
): CampaignObjectRef[] {
  const references: CampaignObjectRef[] = [];
  const keys = new Set<string>();

  for (const reference of plan.dependencies) {
    const key = campaignObjectRefKey(reference);
    if (!keys.has(key)) {
      references.push(reference);
      keys.add(key);
    }
  }

  for (const dependency of stepDependencies) {
    const key = campaignObjectRefKey(dependency.reference);
    if (!keys.has(key)) {
      references.push(dependency.reference);
      keys.add(key);
    }
  }

  return references;
}

export class SessionPlanPublishValidator {
  constructor(private readonly resolver: PrepDependencyResolver) {}

  async validate(
    input: unknown,
    context: PrepDependencyResolutionContext,
  ): Promise<SessionPlanPublishValidation> {
    const parsed = sessionPlanSchema.safeParse(input);
    if (!parsed.success) {
      return {
        canPublish: false,
        dependencyManifest: [],
        issues: parsed.error.issues.map((issue) => ({
          code: 'invalid-plan',
          message: issue.message,
          path: issue.path.length > 0 ? issue.path.join('.') : '$',
        })),
      };
    }

    const plan = parsed.data;
    const issues: SessionPlanPublishIssue[] = [];
    const stepDependencies = getStepDependencies(plan);
    const dependencyManifest = getManifest(plan, stepDependencies);
    const declaredKeys = new Set(plan.dependencies.map(campaignObjectRefKey));

    if (plan.campaignId !== context.campaignId) {
      issues.push({
        code: 'campaign-mismatch',
        message: 'The session plan does not belong to the requested campaign',
        path: 'campaignId',
      });
    }

    if (plan.status === 'retired') {
      issues.push({
        code: 'retired-plan',
        message: 'A retired session plan cannot be published',
        path: 'status',
      });
    }

    if (plan.status === 'ready') {
      issues.push({
        code: 'already-ready-plan',
        message: 'A ready session plan revision is already published',
        path: 'status',
      });
    }

    for (const dependency of stepDependencies) {
      if (!declaredKeys.has(campaignObjectRefKey(dependency.reference))) {
        issues.push({
          code: 'missing-manifest-entry',
          message: 'A session step dependency is absent from the plan manifest',
          path: dependency.path,
          reference: dependency.reference,
        });
      }
    }

    for (const reference of dependencyManifest) {
      if (
        reference.target === 'campaign-object' &&
        reference.campaignId !== context.campaignId
      ) {
        issues.push({
          code: 'cross-campaign-reference',
          message: 'Campaign objects must belong to the session plan campaign',
          reference,
        });
        continue;
      }

      const resolution = await this.resolver.resolve(reference, context);
      if (resolution.status === 'missing') {
        issues.push({
          code: 'missing-dependency',
          message: 'A pinned dependency could not be found',
          reference,
        });
        continue;
      }
      if (resolution.status === 'forbidden') {
        issues.push({
          code: 'forbidden-dependency',
          message: 'The publisher cannot access a pinned dependency',
          reference,
        });
        continue;
      }

      const stepUses = stepDependencies.filter(
        (dependency) =>
          campaignObjectRefKey(dependency.reference) ===
          campaignObjectRefKey(reference),
      );
      for (const stepUse of stepUses) {
        if (resolution.objectType !== stepUse.expectedType) {
          issues.push({
            code: 'unexpected-dependency-kind',
            message: `Expected ${stepUse.expectedType} but resolved ${resolution.objectType}`,
            path: stepUse.path,
            reference,
          });
        }
      }
    }

    if (issues.length > 0) {
      return {
        canPublish: false,
        plan,
        dependencyManifest,
        issues,
      };
    }

    return {
      canPublish: true,
      plan,
      dependencyManifest,
      issues: [],
    };
  }
}
