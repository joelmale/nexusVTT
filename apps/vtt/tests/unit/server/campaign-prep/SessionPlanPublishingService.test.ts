import type { SessionPlan } from '@nexus/game-contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SessionPlanPublishingError,
  SessionPlanPublishingService,
} from '../../../../server/campaign-prep/SessionPlanPublishingService.js';
import type { SessionPlanPublishValidator } from '../../../../server/campaign-prep/SessionPlanPublishValidator.js';
import { CampaignPrepRevisionConflictError } from '../../../../server/repositories/CampaignPrepRepository.js';

const IDS = {
  campaign: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  plan: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  user: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  request: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
} as const;

const draftPlan: SessionPlan = {
  id: IDS.plan,
  campaignId: IDS.campaign,
  schemaVersion: 1,
  revision: 3,
  title: 'Session 12 - The Glass Harbor',
  status: 'draft',
  steps: [
    {
      id: '10000000-0000-4000-8000-000000000001',
      type: 'reminder',
      title: 'Opening recap',
      estimatedMinutes: 10,
      visibility: 'players',
      text: 'Re-establish the burned ledger.',
    },
  ],
  dependencies: [],
  createdAt: '2026-09-25T12:00:00.000Z',
  updatedAt: '2026-09-25T12:00:00.000Z',
};

const objectRecord = {
  id: IDS.plan,
  campaignId: IDS.campaign,
  kind: 'session-plan' as const,
  title: draftPlan.title,
  currentRevision: 3,
  status: 'draft' as const,
  createdBy: IDS.user,
  updatedBy: IDS.user,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const revisionRecord = {
  objectId: IDS.plan,
  revision: 3,
  schemaVersion: 1,
  data: draftPlan,
  dependencyManifest: [],
  createdBy: IDS.user,
  requestId: IDS.request,
  createdAt: new Date(),
};

describe('SessionPlanPublishingService', () => {
  let repository: {
    getObject: ReturnType<typeof vi.fn>;
    getRevision: ReturnType<typeof vi.fn>;
    addRevision: ReturnType<typeof vi.fn>;
  };
  let validator: { validate: ReturnType<typeof vi.fn> };
  let service: SessionPlanPublishingService;

  const request = {
    campaignId: IDS.campaign,
    planId: IDS.plan,
    expectedRevision: 3,
    principalId: IDS.user,
    requestId: IDS.request,
  };

  beforeEach(() => {
    repository = {
      getObject: vi.fn().mockResolvedValue(objectRecord),
      getRevision: vi.fn().mockResolvedValue(revisionRecord),
      addRevision: vi.fn().mockResolvedValue({
        object: { ...objectRecord, currentRevision: 4, status: 'ready' },
        revision: { ...revisionRecord, revision: 4 },
      }),
    };
    validator = {
      validate: vi.fn().mockResolvedValue({
        canPublish: true,
        plan: draftPlan,
        dependencyManifest: [],
        issues: [],
      }),
    };
    service = new SessionPlanPublishingService(
      repository,
      validator as unknown as SessionPlanPublishValidator,
      () => new Date('2026-09-25T15:30:00.000Z'),
    );
  });

  it('publishes a validated draft as the next immutable revision', async () => {
    const result = await service.publish(request);

    expect(result).toMatchObject({
      published: true,
      plan: {
        revision: 4,
        status: 'ready',
        updatedAt: '2026-09-25T15:30:00.000Z',
      },
    });
    expect(repository.addRevision).toHaveBeenCalledWith(
      IDS.campaign,
      IDS.plan,
      3,
      expect.objectContaining({
        revision: 4,
        status: 'ready',
        requestId: IDS.request,
      }),
    );
  });

  it('returns validation issues without writing a revision', async () => {
    validator.validate.mockResolvedValueOnce({
      canPublish: false,
      dependencyManifest: [],
      issues: [
        {
          code: 'missing-dependency',
          message: 'A pinned dependency could not be found',
        },
      ],
    });

    const result = await service.publish(request);

    expect(result).toMatchObject({ published: false });
    expect(repository.addRevision).not.toHaveBeenCalled();
  });

  it('rejects missing and non-session-plan objects', async () => {
    repository.getObject.mockResolvedValueOnce(null);
    await expect(service.publish(request)).rejects.toMatchObject({
      code: 'not-found',
    });

    repository.getObject.mockResolvedValueOnce({
      ...objectRecord,
      kind: 'note',
    });
    await expect(service.publish(request)).rejects.toMatchObject({
      code: 'wrong-object-kind',
    });
  });

  it('rejects a stale expected revision before loading payload data', async () => {
    repository.getObject.mockResolvedValueOnce({
      ...objectRecord,
      currentRevision: 4,
    });

    await expect(service.publish(request)).rejects.toBeInstanceOf(
      CampaignPrepRevisionConflictError,
    );
    expect(repository.getRevision).not.toHaveBeenCalled();
  });

  it('reports a missing stored revision', async () => {
    repository.getRevision.mockResolvedValueOnce(null);

    await expect(service.publish(request)).rejects.toMatchObject({
      code: 'missing-revision',
    });
  });

  it('rejects stored payloads whose identity does not match the object row', async () => {
    validator.validate.mockResolvedValueOnce({
      canPublish: true,
      plan: { ...draftPlan, revision: 2 },
      dependencyManifest: [],
      issues: [],
    });

    await expect(service.publish(request)).rejects.toBeInstanceOf(
      SessionPlanPublishingError,
    );
    expect(repository.addRevision).not.toHaveBeenCalled();
  });
});
