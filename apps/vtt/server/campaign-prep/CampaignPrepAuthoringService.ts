import {
  campaignEntrySchema,
  campaignObjectRefKey,
  sceneTemplateSchema,
  sessionPlanSchema,
  type CampaignEntry,
  type CampaignObjectRef,
  type SceneTemplate,
  type SessionPlan,
} from '@nexus/game-contracts';

import {
  CampaignPrepRevisionConflictError,
  type CampaignPrepRepository,
} from '../repositories/CampaignPrepRepository.js';
import type {
  CampaignPrepObjectKind,
  CampaignPrepObjectRecord,
  CampaignPrepObjectRevisionRecord,
} from '../repositories/base.js';

type AuthoredPrepObject = CampaignEntry | SceneTemplate | SessionPlan;

type AuthoringRepository = Pick<
  CampaignPrepRepository,
  'addRevision' | 'createObject' | 'getObject'
>;

export type CampaignPrepAuthoringErrorCode =
  | 'not-found'
  | 'unsupported-kind'
  | 'invalid-payload'
  | 'identity-mismatch'
  | 'published-payload';

export interface CampaignPrepAuthoringIssue {
  message: string;
  path: string;
}

export class CampaignPrepAuthoringError extends Error {
  constructor(
    public readonly code: CampaignPrepAuthoringErrorCode,
    message: string,
    public readonly issues: CampaignPrepAuthoringIssue[] = [],
  ) {
    super(message);
    this.name = 'CampaignPrepAuthoringError';
  }
}

export interface CreateCampaignPrepObjectRequest {
  campaignId: string;
  kind: CampaignPrepObjectKind;
  data: unknown;
  principalId: string;
  requestId: string;
}

export interface ReviseCampaignPrepObjectRequest {
  campaignId: string;
  objectId: string;
  expectedRevision: number;
  data: unknown;
  principalId: string;
  requestId: string;
}

export interface CampaignPrepAuthoringResult {
  data: AuthoredPrepObject;
  object: CampaignPrepObjectRecord;
  revision: CampaignPrepObjectRevisionRecord;
}

function parsePayload(
  kind: CampaignPrepObjectKind,
  input: unknown,
): AuthoredPrepObject {
  if (kind === 'campaign-map') {
    throw new CampaignPrepAuthoringError(
      'unsupported-kind',
      'Campaign map authoring is not available in this API revision',
    );
  }

  const parsed =
    kind === 'scene-template'
      ? sceneTemplateSchema.safeParse(input)
      : kind === 'session-plan'
        ? sessionPlanSchema.safeParse(input)
        : campaignEntrySchema.safeParse(input);
  if (!parsed.success) {
    throw new CampaignPrepAuthoringError(
      'invalid-payload',
      'Campaign object payload failed contract validation',
      parsed.error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path.length > 0 ? issue.path.join('.') : '$',
      })),
    );
  }

  if ('kind' in parsed.data && parsed.data.kind !== kind) {
    throw new CampaignPrepAuthoringError(
      'identity-mismatch',
      'Campaign entry kind does not match the object kind',
    );
  }
  if ('status' in parsed.data && parsed.data.status !== 'draft') {
    throw new CampaignPrepAuthoringError(
      'published-payload',
      'Authoring writes may only save draft session plans',
    );
  }
  return parsed.data;
}

function objectTitle(data: AuthoredPrepObject): string {
  return 'name' in data ? data.name : data.title;
}

function sessionStepReferences(plan: SessionPlan): CampaignObjectRef[] {
  return plan.steps.flatMap((step): CampaignObjectRef[] => {
    switch (step.type) {
      case 'open-entry':
        return [step.entryRef];
      case 'activate-scene':
        return [step.sceneTemplateRef];
      case 'deploy-encounter':
        return [{ target: 'definition', ref: step.encounterRef }];
      case 'share-handout':
        return [step.assetRef];
      case 'reminder':
        return [];
    }
  });
}

function objectDependencies(data: AuthoredPrepObject): CampaignObjectRef[] {
  const references =
    'links' in data
      ? data.links
      : 'backgroundAssetRef' in data
        ? [data.backgroundAssetRef]
        : [...data.dependencies, ...sessionStepReferences(data)];
  const seen = new Set<string>();
  return references.filter((reference) => {
    const key = campaignObjectRefKey(reference);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function assertIdentity(
  data: AuthoredPrepObject,
  campaignId: string,
  objectId: string,
  revision: number,
): void {
  if (
    data.campaignId !== campaignId ||
    data.id !== objectId ||
    data.revision !== revision
  ) {
    throw new CampaignPrepAuthoringError(
      'identity-mismatch',
      'Payload identity or revision does not match the requested campaign object',
    );
  }
}

export class CampaignPrepAuthoringService {
  constructor(private readonly repository: AuthoringRepository) {}

  async create(
    request: CreateCampaignPrepObjectRequest,
  ): Promise<CampaignPrepAuthoringResult> {
    const data = parsePayload(request.kind, request.data);
    assertIdentity(data, request.campaignId, data.id, 1);
    const saved = await this.repository.createObject(
      {
        id: data.id,
        campaignId: request.campaignId,
        kind: request.kind,
        title: objectTitle(data),
        status: 'draft',
        createdBy: request.principalId,
      },
      {
        revision: data.revision,
        schemaVersion: data.schemaVersion,
        data,
        dependencies: objectDependencies(data),
        createdBy: request.principalId,
        requestId: request.requestId,
      },
    );
    return { data, ...saved };
  }

  async revise(
    request: ReviseCampaignPrepObjectRequest,
  ): Promise<CampaignPrepAuthoringResult> {
    const object = await this.repository.getObject(
      request.campaignId,
      request.objectId,
    );
    if (!object) {
      throw new CampaignPrepAuthoringError(
        'not-found',
        `Campaign object ${request.objectId} was not found`,
      );
    }
    if (object.currentRevision !== request.expectedRevision) {
      throw new CampaignPrepRevisionConflictError(
        request.objectId,
        request.expectedRevision,
      );
    }

    const data = parsePayload(object.kind, request.data);
    assertIdentity(
      data,
      request.campaignId,
      request.objectId,
      request.expectedRevision + 1,
    );
    const saved = await this.repository.addRevision(
      request.campaignId,
      request.objectId,
      request.expectedRevision,
      {
        revision: data.revision,
        schemaVersion: data.schemaVersion,
        data,
        dependencies: objectDependencies(data),
        createdBy: request.principalId,
        requestId: request.requestId,
        title: objectTitle(data),
        status: 'draft',
      },
    );
    return { data, ...saved };
  }
}
