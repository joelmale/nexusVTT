import type { SessionPlan } from '@nexus/game-contracts';

import {
  CampaignPrepRevisionConflictError,
  type CampaignPrepRepository,
} from '../repositories/CampaignPrepRepository.js';
import type {
  CampaignPrepObjectRecord,
  CampaignPrepObjectRevisionRecord,
} from '../repositories/base.js';
import {
  SessionPlanPublishValidator,
  type SessionPlanPublishValidation,
} from './SessionPlanPublishValidator.js';

export type SessionPlanPublishingErrorCode =
  | 'not-found'
  | 'wrong-object-kind'
  | 'missing-revision'
  | 'stored-identity-mismatch';

export class SessionPlanPublishingError extends Error {
  constructor(
    public readonly code: SessionPlanPublishingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SessionPlanPublishingError';
  }
}

export interface PublishSessionPlanRequest {
  campaignId: string;
  planId: string;
  expectedRevision: number;
  principalId: string;
  requestId: string;
}

export type PublishSessionPlanResult =
  | {
      published: true;
      plan: SessionPlan;
      object: CampaignPrepObjectRecord;
      revision: CampaignPrepObjectRevisionRecord;
    }
  | {
      published: false;
      validation: Extract<SessionPlanPublishValidation, { canPublish: false }>;
    };

type PublishingRepository = Pick<
  CampaignPrepRepository,
  'getObject' | 'getRevision' | 'addRevision'
>;

export class SessionPlanPublishingService {
  constructor(
    private readonly repository: PublishingRepository,
    private readonly validator: SessionPlanPublishValidator,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async publish(
    request: PublishSessionPlanRequest,
  ): Promise<PublishSessionPlanResult> {
    const object = await this.repository.getObject(
      request.campaignId,
      request.planId,
    );
    if (!object) {
      throw new SessionPlanPublishingError(
        'not-found',
        `Session plan ${request.planId} was not found`,
      );
    }
    if (object.kind !== 'session-plan') {
      throw new SessionPlanPublishingError(
        'wrong-object-kind',
        `Campaign object ${request.planId} is not a session plan`,
      );
    }
    if (object.currentRevision !== request.expectedRevision) {
      throw new CampaignPrepRevisionConflictError(
        request.planId,
        request.expectedRevision,
      );
    }

    const revision = await this.repository.getRevision(
      request.planId,
      request.expectedRevision,
    );
    if (!revision) {
      throw new SessionPlanPublishingError(
        'missing-revision',
        `Session plan ${request.planId} is missing revision ${request.expectedRevision}`,
      );
    }

    const validation = await this.validator.validate(revision.data, {
      campaignId: request.campaignId,
      principalId: request.principalId,
    });
    if (!validation.canPublish) {
      return { published: false, validation };
    }

    if (
      validation.plan.id !== request.planId ||
      validation.plan.revision !== request.expectedRevision
    ) {
      throw new SessionPlanPublishingError(
        'stored-identity-mismatch',
        'The stored plan identity does not match its campaign object revision',
      );
    }

    const publishedPlan: SessionPlan = {
      ...validation.plan,
      revision: request.expectedRevision + 1,
      status: 'ready',
      updatedAt: this.now().toISOString(),
      dependencies: validation.dependencyManifest,
    };
    const saved = await this.repository.addRevision(
      request.campaignId,
      request.planId,
      request.expectedRevision,
      {
        revision: publishedPlan.revision,
        schemaVersion: publishedPlan.schemaVersion,
        data: publishedPlan,
        dependencies: publishedPlan.dependencies,
        createdBy: request.principalId,
        requestId: request.requestId,
        title: publishedPlan.title,
        status: 'ready',
      },
    );

    return {
      published: true,
      plan: publishedPlan,
      object: saved.object,
      revision: saved.revision,
    };
  }
}
