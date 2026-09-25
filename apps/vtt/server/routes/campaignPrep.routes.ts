import { Router, type Request, type Response } from 'express';

import type { DatabaseService } from '../database.js';
import {
  CampaignPrepAuthoringError,
  type CampaignPrepAuthoringResult,
} from '../campaign-prep/CampaignPrepAuthoringService.js';
import { requireAuthenticatedNonGuest } from '../middleware/assetWriteGuard.js';
import { CampaignPrepRevisionConflictError } from '../repositories/CampaignPrepRepository.js';
import type {
  CampaignPrepObjectKind,
  CampaignPrepObjectStatus,
} from '../repositories/base.js';
import {
  SessionPlanPublishingError,
  type PublishSessionPlanResult,
} from '../campaign-prep/SessionPlanPublishingService.js';

type CampaignPrepDatabase = Pick<
  DatabaseService,
  'campaigns' | 'campaignPrep'
>;

interface SessionPlanPublisher {
  publish(request: {
    campaignId: string;
    planId: string;
    expectedRevision: number;
    principalId: string;
    requestId: string;
  }): Promise<PublishSessionPlanResult>;
}

interface CampaignPrepAuthor {
  create(request: {
    campaignId: string;
    kind: CampaignPrepObjectKind;
    data: unknown;
    principalId: string;
    requestId: string;
  }): Promise<CampaignPrepAuthoringResult>;
  revise(request: {
    campaignId: string;
    objectId: string;
    expectedRevision: number;
    data: unknown;
    principalId: string;
    requestId: string;
  }): Promise<CampaignPrepAuthoringResult>;
}

export interface CampaignPrepRouterOptions {
  author: CampaignPrepAuthor;
  db: CampaignPrepDatabase;
  publisher: SessionPlanPublisher;
}

const OBJECT_KINDS = new Set<CampaignPrepObjectKind>([
  'note',
  'npc',
  'location',
  'faction',
  'quest',
  'lore',
  'clue',
  'scene-template',
  'campaign-map',
  'session-plan',
]);

const OBJECT_STATUSES = new Set<CampaignPrepObjectStatus>([
  'draft',
  'ready',
  'retired',
  'archived',
]);

function routeParameter(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function sessionUserId(req: Request): string | null {
  const user = req.user as { id?: unknown } | undefined;
  return typeof user?.id === 'string' ? user.id : null;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

export function createCampaignPrepRouter({
  author,
  db,
  publisher,
}: CampaignPrepRouterOptions): Router {
  const router = Router();

  router.use(
    '/campaigns/:campaignId/prep',
    requireAuthenticatedNonGuest,
    async (req, res, next) => {
      try {
        const userId = sessionUserId(req);
        if (!userId) {
          return res.status(401).json({ error: 'User ID not found in session' });
        }

        const campaignId = routeParameter(req.params.campaignId);
        const campaign = await db.campaigns.getCampaignById(campaignId);
        if (!campaign) {
          return res.status(404).json({ error: 'Campaign not found' });
        }
        if (campaign.dmId !== userId) {
          return res.status(403).json({ error: 'Campaign DM access required' });
        }
        return next();
      } catch (error) {
        return next(error);
      }
    },
  );

  router.get('/campaigns/:campaignId/prep/objects', async (req, res) => {
    const kind = typeof req.query.kind === 'string' ? req.query.kind : undefined;
    const status =
      typeof req.query.status === 'string' ? req.query.status : undefined;
    if (kind && !OBJECT_KINDS.has(kind as CampaignPrepObjectKind)) {
      return res.status(400).json({ error: 'Invalid campaign object kind' });
    }
    if (status && !OBJECT_STATUSES.has(status as CampaignPrepObjectStatus)) {
      return res.status(400).json({ error: 'Invalid campaign object status' });
    }

    try {
      const objects = await db.campaignPrep.listObjects(
        routeParameter(req.params.campaignId),
        {
          kind: kind as CampaignPrepObjectKind | undefined,
          status: status as CampaignPrepObjectStatus | undefined,
        },
      );
      return res.json({ objects });
    } catch (error) {
      console.error('Failed to list campaign prep objects:', error);
      return res.status(500).json({ error: 'Failed to list campaign objects' });
    }
  });

  router.post('/campaigns/:campaignId/prep/objects', async (req, res) => {
    const body = req.body as {
      data?: unknown;
      kind?: unknown;
      requestId?: unknown;
    };
    if (
      typeof body?.kind !== 'string' ||
      !OBJECT_KINDS.has(body.kind as CampaignPrepObjectKind) ||
      !isUuid(body.requestId)
    ) {
      return res.status(400).json({
        error: 'kind must be valid and requestId must be a UUID',
      });
    }

    try {
      const result = await author.create({
        campaignId: routeParameter(req.params.campaignId),
        kind: body.kind as CampaignPrepObjectKind,
        data: body.data,
        principalId: sessionUserId(req) ?? '',
        requestId: body.requestId,
      });
      return res.status(201).json(result);
    } catch (error) {
      return handleAuthoringError(error, res);
    }
  });

  router.get(
    '/campaigns/:campaignId/prep/objects/:objectId',
    async (req, res) => {
      try {
        const campaignId = routeParameter(req.params.campaignId);
        const objectId = routeParameter(req.params.objectId);
        const object = await db.campaignPrep.getObject(campaignId, objectId);
        if (!object) {
          return res.status(404).json({ error: 'Campaign object not found' });
        }
        const revision = await db.campaignPrep.getRevision(
          object.id,
          object.currentRevision,
        );
        if (!revision) {
          return res
            .status(500)
            .json({ error: 'Campaign object revision is missing' });
        }
        return res.json({ object, revision });
      } catch (error) {
        console.error('Failed to load campaign prep object:', error);
        return res.status(500).json({ error: 'Failed to load campaign object' });
      }
    },
  );

  router.put(
    '/campaigns/:campaignId/prep/objects/:objectId',
    async (req, res) => {
      const body = req.body as {
        data?: unknown;
        expectedRevision?: unknown;
        requestId?: unknown;
      };
      if (
        !Number.isInteger(body?.expectedRevision) ||
        (body.expectedRevision as number) < 1 ||
        !isUuid(body.requestId)
      ) {
        return res.status(400).json({
          error:
            'expectedRevision must be positive and requestId must be a UUID',
        });
      }

      try {
        const result = await author.revise({
          campaignId: routeParameter(req.params.campaignId),
          objectId: routeParameter(req.params.objectId),
          expectedRevision: body.expectedRevision as number,
          data: body.data,
          principalId: sessionUserId(req) ?? '',
          requestId: body.requestId,
        });
        return res.json(result);
      } catch (error) {
        return handleAuthoringError(error, res);
      }
    },
  );

  router.post(
    '/campaigns/:campaignId/prep/objects/:objectId/publish',
    async (req: Request, res: Response) => {
      const expectedRevision = (req.body as { expectedRevision?: unknown })
        ?.expectedRevision;
      const requestId = (req.body as { requestId?: unknown })?.requestId;
      if (
        !Number.isInteger(expectedRevision) ||
        (expectedRevision as number) < 1 ||
        !isUuid(requestId)
      ) {
        return res.status(400).json({
          error: 'expectedRevision must be positive and requestId must be a UUID',
        });
      }

      try {
        const result = await publisher.publish({
          campaignId: routeParameter(req.params.campaignId),
          planId: routeParameter(req.params.objectId),
          expectedRevision: expectedRevision as number,
          principalId: sessionUserId(req) ?? '',
          requestId,
        });
        if (!result.published) {
          const unavailable = result.validation.issues.some(
            (issue) => issue.code === 'dependency-unavailable',
          );
          return res.status(unavailable ? 503 : 422).json(result);
        }
        return res.json(result);
      } catch (error) {
        if (error instanceof CampaignPrepRevisionConflictError) {
          return res.status(409).json({
            error: 'Campaign object revision conflict',
            objectId: error.objectId,
            expectedRevision: error.expectedRevision,
          });
        }
        if (error instanceof SessionPlanPublishingError) {
          const status = error.code === 'not-found' ? 404 : 409;
          return res.status(status).json({
            error: error.message,
            code: error.code,
          });
        }
        console.error('Failed to publish session plan:', error);
        return res.status(500).json({ error: 'Failed to publish session plan' });
      }
    },
  );

  return router;
}

function handleAuthoringError(error: unknown, res: Response): Response {
  if (error instanceof CampaignPrepRevisionConflictError) {
    return res.status(409).json({
      error: 'Campaign object revision conflict',
      objectId: error.objectId,
      expectedRevision: error.expectedRevision,
    });
  }
  if (error instanceof CampaignPrepAuthoringError) {
    const status = error.code === 'not-found' ? 404 : 422;
    return res.status(status).json({
      error: error.message,
      code: error.code,
      issues: error.issues,
    });
  }
  console.error('Failed to save campaign prep object:', error);
  return res.status(500).json({ error: 'Failed to save campaign object' });
}
