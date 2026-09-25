import express, { type Express } from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CampaignPrepRevisionConflictError } from '../../../../server/repositories/CampaignPrepRepository.js';
import { SessionPlanPublishingError } from '../../../../server/campaign-prep/SessionPlanPublishingService.js';
import { createCampaignPrepRouter } from '../../../../server/routes/campaignPrep.routes.js';

const CAMPAIGN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PLAN_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const REQUEST_ID = '22222222-2222-4222-8222-222222222222';

describe('campaign prep routes', () => {
  let app: Express;
  let baseUrl: string;
  let server: Server;
  let authenticated = true;
  let userId = USER_ID;
  let campaigns: { getCampaignById: ReturnType<typeof vi.fn> };
  let campaignPrep: {
    getObject: ReturnType<typeof vi.fn>;
    getRevision: ReturnType<typeof vi.fn>;
    listObjects: ReturnType<typeof vi.fn>;
  };
  let publisher: { publish: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authenticated = true;
    userId = USER_ID;
    campaigns = {
      getCampaignById: vi.fn().mockResolvedValue({
        id: CAMPAIGN_ID,
        dmId: USER_ID,
      }),
    };
    campaignPrep = {
      getObject: vi.fn(),
      getRevision: vi.fn(),
      listObjects: vi.fn().mockResolvedValue([]),
    };
    publisher = { publish: vi.fn() };

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.isAuthenticated = () => authenticated;
      req.user = authenticated
        ? ({ id: userId, provider: 'google' } as Express.User)
        : undefined;
      next();
    });
    app.use(
      '/api',
      createCampaignPrepRouter({
        db: { campaigns, campaignPrep } as never,
        publisher,
      }),
    );

    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected a TCP listener');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('requires an authenticated non-guest campaign DM', async () => {
    authenticated = false;
    let response = await fetch(
      `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/prep/objects`,
    );
    expect(response.status).toBe(401);

    authenticated = true;
    userId = '33333333-3333-4333-8333-333333333333';
    response = await fetch(
      `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/prep/objects`,
    );
    expect(response.status).toBe(403);

    campaigns.getCampaignById.mockResolvedValue(null);
    response = await fetch(
      `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/prep/objects`,
    );
    expect(response.status).toBe(404);
  });

  it('lists campaign objects with validated filters', async () => {
    campaignPrep.listObjects.mockResolvedValue([{ id: PLAN_ID }]);
    const response = await fetch(
      `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/prep/objects?kind=session-plan&status=draft`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      objects: [{ id: PLAN_ID }],
    });
    expect(campaignPrep.listObjects).toHaveBeenCalledWith(CAMPAIGN_ID, {
      kind: 'session-plan',
      status: 'draft',
    });

    const invalid = await fetch(
      `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/prep/objects?kind=nope`,
    );
    expect(invalid.status).toBe(400);

    const invalidStatus = await fetch(
      `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/prep/objects?status=nope`,
    );
    expect(invalidStatus.status).toBe(400);
  });

  it('loads an object with its current immutable revision', async () => {
    campaignPrep.getObject.mockResolvedValue({
      id: PLAN_ID,
      currentRevision: 3,
    });
    campaignPrep.getRevision.mockResolvedValue({
      objectId: PLAN_ID,
      revision: 3,
    });
    const response = await fetch(
      `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/prep/objects/${PLAN_ID}`,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.revision).toMatchObject({ objectId: PLAN_ID, revision: 3 });

    campaignPrep.getObject.mockResolvedValue(null);
    const missing = await fetch(
      `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/prep/objects/${PLAN_ID}`,
    );
    expect(missing.status).toBe(404);
  });

  it('publishes with the authenticated principal and expected revision', async () => {
    publisher.publish.mockResolvedValue({
      published: true,
      plan: { id: PLAN_ID, revision: 4, status: 'ready' },
      object: { id: PLAN_ID, currentRevision: 4 },
      revision: { objectId: PLAN_ID, revision: 4 },
    });
    const response = await publish({
      expectedRevision: 3,
      requestId: REQUEST_ID,
    });

    expect(response.status).toBe(200);
    expect(publisher.publish).toHaveBeenCalledWith({
      campaignId: CAMPAIGN_ID,
      planId: PLAN_ID,
      expectedRevision: 3,
      principalId: USER_ID,
      requestId: REQUEST_ID,
    });
  });

  it('returns structured validation and catalog-unavailable responses', async () => {
    publisher.publish.mockResolvedValueOnce({
      published: false,
      validation: {
        canPublish: false,
        dependencyManifest: [],
        issues: [{ code: 'missing-dependency', message: 'missing' }],
      },
    });
    expect(
      (await publish({ expectedRevision: 3, requestId: REQUEST_ID })).status,
    ).toBe(422);

    publisher.publish.mockResolvedValueOnce({
      published: false,
      validation: {
        canPublish: false,
        dependencyManifest: [],
        issues: [
          { code: 'dependency-unavailable', message: 'catalog offline' },
        ],
      },
    });
    expect(
      (await publish({ expectedRevision: 3, requestId: REQUEST_ID })).status,
    ).toBe(503);
  });

  it('rejects malformed commands and stale expected revisions', async () => {
    expect((await publish({ expectedRevision: 0 })).status).toBe(400);

    publisher.publish.mockRejectedValue(
      new CampaignPrepRevisionConflictError(PLAN_ID, 3),
    );
    const response = await publish({
      expectedRevision: 3,
      requestId: REQUEST_ID,
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      objectId: PLAN_ID,
      expectedRevision: 3,
    });

    publisher.publish.mockRejectedValue(
      new SessionPlanPublishingError('not-found', 'Plan not found'),
    );
    expect(
      (await publish({ expectedRevision: 3, requestId: REQUEST_ID })).status,
    ).toBe(404);

    publisher.publish.mockRejectedValue(new Error('database offline'));
    expect(
      (await publish({ expectedRevision: 3, requestId: REQUEST_ID })).status,
    ).toBe(500);
  });

  function publish(body: Record<string, unknown>): Promise<Response> {
    return fetch(
      `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/prep/objects/${PLAN_ID}/publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
  }
});
