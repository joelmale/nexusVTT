import express, { type Express } from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CampaignPrepAuthoringError } from '../../../../server/campaign-prep/CampaignPrepAuthoringService.js';
import {
  CampaignPrepRevisionConflictError,
  SessionPlanActivationError,
} from '../../../../server/repositories/CampaignPrepRepository.js';
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
    getBacklinks: ReturnType<typeof vi.fn>;
    activateSessionPlan: ReturnType<typeof vi.fn>;
    getActiveSessionPlanActivation: ReturnType<typeof vi.fn>;
    getActivation: ReturnType<typeof vi.fn>;
    advanceSessionPlanActivation: ReturnType<typeof vi.fn>;
    updateSessionPlanActivationProgress: ReturnType<typeof vi.fn>;
  };
  let commandReceipts: { getReceipt: ReturnType<typeof vi.fn> };
  let domainCommands: { execute: ReturnType<typeof vi.fn> };
  let libraryObjects: {
    getObjectById: ReturnType<typeof vi.fn>;
    getRevision: ReturnType<typeof vi.fn>;
    createObject: ReturnType<typeof vi.fn>;
    addRevision: ReturnType<typeof vi.fn>;
  };
  let publisher: { publish: ReturnType<typeof vi.fn> };
  let author: {
    create: ReturnType<typeof vi.fn>;
    revise: ReturnType<typeof vi.fn>;
  };

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
      getBacklinks: vi.fn().mockResolvedValue([]),
      activateSessionPlan: vi.fn(),
      getActiveSessionPlanActivation: vi.fn(),
      getActivation: vi.fn(),
      advanceSessionPlanActivation: vi.fn(),
      updateSessionPlanActivationProgress: vi.fn(),
    };
    commandReceipts = { getReceipt: vi.fn().mockResolvedValue(null) };
    domainCommands = { execute: vi.fn() };
    libraryObjects = {
      getObjectById: vi.fn().mockResolvedValue(null),
      getRevision: vi.fn().mockResolvedValue(null),
      createObject: vi
        .fn()
        .mockImplementation(async (_object, _initial, id: string) => ({
          object: { id },
          revision: { objectId: id, revision: 1 },
        })),
      addRevision: vi.fn(),
    };
    publisher = { publish: vi.fn() };
    author = { create: vi.fn(), revise: vi.fn() };

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
        author,
        db: {
          campaigns,
          campaignPrep,
          commandReceipts,
          domainCommands,
          libraryObjects,
        } as never,
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

  it('creates and revises campaign objects through the authoring service', async () => {
    author.create.mockResolvedValue({ object: { id: PLAN_ID } });
    let response = await fetch(
      `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/prep/objects`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'session-plan',
          data: { id: PLAN_ID },
          requestId: REQUEST_ID,
        }),
      },
    );
    expect(response.status).toBe(201);
    expect(author.create).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: CAMPAIGN_ID,
        kind: 'session-plan',
        principalId: USER_ID,
      }),
    );

    author.revise.mockResolvedValue({ object: { id: PLAN_ID } });
    response = await fetch(
      `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/prep/objects/${PLAN_ID}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: { id: PLAN_ID },
          expectedRevision: 1,
          requestId: REQUEST_ID,
        }),
      },
    );
    expect(response.status).toBe(200);
    expect(author.revise).toHaveBeenCalledWith(
      expect.objectContaining({ objectId: PLAN_ID, expectedRevision: 1 }),
    );
  });

  it('returns structured authoring validation errors', async () => {
    author.create.mockRejectedValue(
      new CampaignPrepAuthoringError('invalid-payload', 'Invalid object', [
        { path: 'title', message: 'Required' },
      ]),
    );
    const response = await fetch(
      `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/prep/objects`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'note',
          data: {},
          requestId: REQUEST_ID,
        }),
      },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: 'invalid-payload',
      issues: [{ path: 'title' }],
    });
  });

  it('publishes with the authenticated principal and expected revision', async () => {
    publisher.publish.mockResolvedValue({
      published: true,
      plan: { id: PLAN_ID, revision: 4, status: 'ready' },
      object: { id: PLAN_ID, currentRevision: 4 },
      revision: { objectId: PLAN_ID, revision: 4 },
    });
    const response = await publish({
      data: { id: PLAN_ID, revision: 4, status: 'draft' },
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
      proposedPlan: { id: PLAN_ID, revision: 4, status: 'draft' },
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

  it('activates a session plan and returns the active plan', async () => {
    const mockActivation = {
      id: '99999999-9999-4999-8999-999999999999',
      campaignId: CAMPAIGN_ID,
      sessionPlanId: PLAN_ID,
      planRevision: 2,
      sessionId: 'session-12',
      currentStepIndex: 0,
      status: 'active',
      stepStates: {},
      activatedBy: USER_ID,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const mockPlan = {
      id: PLAN_ID,
      campaignId: CAMPAIGN_ID,
      revision: 2,
      title: 'Session 12 - The Glass Harbor',
      status: 'ready',
      steps: [],
    };

    campaignPrep.activateSessionPlan.mockResolvedValueOnce({
      activation: mockActivation,
      plan: mockPlan,
      replayed: false,
    });

    const activateResponse = await fetch(
      `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/session-plans/${PLAN_ID}/activate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'session-12',
          planRevision: 2,
          requestId: REQUEST_ID,
        }),
      },
    );

    expect(activateResponse.status).toBe(200);
    const activateBody = await activateResponse.json();
    expect(activateBody.activation.id).toBe(mockActivation.id);
    expect(activateBody.plan.title).toBe(mockPlan.title);
    expect(campaignPrep.activateSessionPlan).toHaveBeenCalledWith({
      campaignId: CAMPAIGN_ID,
      sessionPlanId: PLAN_ID,
      planRevision: 2,
      sessionId: 'session-12',
      activatedBy: USER_ID,
      requestId: REQUEST_ID,
    });

    // Get active session plan
    campaignPrep.getActiveSessionPlanActivation.mockResolvedValueOnce({
      activation: mockActivation,
      plan: mockPlan,
    });

    const activeResponse = await fetch(
      `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/session-plans/active?sessionId=session-12`,
    );
    expect(activeResponse.status).toBe(200);
    const activeBody = await activeResponse.json();
    expect(activeBody.activation.id).toBe(mockActivation.id);

    // Update progress
    campaignPrep.updateSessionPlanActivationProgress.mockResolvedValueOnce({
      ...mockActivation,
      currentStepIndex: 1,
    });

    const progressResponse = await fetch(
      `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/session-plans/activations/${mockActivation.id}/progress`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStepIndex: 1, expectedRevision: 1 }),
      },
    );
    expect(progressResponse.status).toBe(200);
    const progressBody = await progressResponse.json();
    expect(progressBody.activation.currentStepIndex).toBe(1);
  });

  it('falls back to the campaign run sheet when the room code rotated', async () => {
    const activation = { id: 'act-1', campaignId: CAMPAIGN_ID, revision: 2 };
    campaignPrep.getActiveSessionPlanActivation
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ activation, plan: { id: PLAN_ID } });

    const response = await fetch(
      `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/session-plans/active?sessionId=NEWC`,
    );

    expect(response.status).toBe(200);
    expect(campaignPrep.getActiveSessionPlanActivation).toHaveBeenNthCalledWith(
      1,
      CAMPAIGN_ID,
      'NEWC',
    );
    expect(campaignPrep.getActiveSessionPlanActivation).toHaveBeenNthCalledWith(
      2,
      CAMPAIGN_ID,
    );
  });

  it('returns 404 when the campaign has no active run sheet', async () => {
    campaignPrep.getActiveSessionPlanActivation.mockResolvedValue(null);
    const response = await fetch(
      `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/session-plans/active`,
    );
    expect(response.status).toBe(404);
  });

  it('handles activation errors with appropriate HTTP status codes', async () => {
    campaignPrep.activateSessionPlan.mockRejectedValueOnce(
      new SessionPlanActivationError('Plan not ready', 'not-ready'),
    );

    const notReadyResponse = await fetch(
      `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/session-plans/${PLAN_ID}/activate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'session-12',
          requestId: REQUEST_ID,
        }),
      },
    );
    expect(notReadyResponse.status).toBe(422);

    campaignPrep.activateSessionPlan.mockRejectedValueOnce(
      new SessionPlanActivationError('Plan not found', 'not-found'),
    );

    const notFoundResponse = await fetch(
      `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/session-plans/${PLAN_ID}/activate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'session-12',
          requestId: REQUEST_ID,
        }),
      },
    );
    expect(notFoundResponse.status).toBe(404);
  });

  it('accepts a partial activation patch without a step index', async () => {
    const activationId = '99999999-9999-4999-8999-999999999999';
    campaignPrep.updateSessionPlanActivationProgress.mockResolvedValueOnce({
      id: activationId,
      campaignId: CAMPAIGN_ID,
      currentStepIndex: 2,
      status: 'completed',
      stepStates: {},
    });

    const response = await fetch(
      `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/session-plans/activations/${activationId}/progress`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', expectedRevision: 3 }),
      },
    );

    expect(response.status).toBe(200);
    expect(
      campaignPrep.updateSessionPlanActivationProgress,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        activationId,
        campaignId: CAMPAIGN_ID,
        expectedRevision: 3,
        currentStepIndex: undefined,
        status: 'completed',
      }),
    );
  });

  it('advances the active session-plan step atomically', async () => {
    const activationId = '99999999-9999-4999-8999-999999999999';
    campaignPrep.advanceSessionPlanActivation.mockResolvedValueOnce({
      id: activationId,
      currentStepIndex: 1,
      status: 'active',
      stepStates: { 'step-1': { completed: true } },
    });

    const response = await fetch(
      `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/session-plans/activations/${activationId}/advance`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId: 'step-1',
          stepIndex: 0,
          expectedRevision: 4,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(campaignPrep.advanceSessionPlanActivation).toHaveBeenCalledWith({
      activationId,
      campaignId: CAMPAIGN_ID,
      completedBy: USER_ID,
      stepId: 'step-1',
      stepIndex: 0,
      expectedRevision: 4,
    });
  });

  it('maps stale progress and advance revisions to 409', async () => {
    const activationId = '99999999-9999-4999-8999-999999999999';
    const stale = new SessionPlanActivationError('stale', 'conflict');
    campaignPrep.updateSessionPlanActivationProgress.mockRejectedValueOnce(
      stale,
    );
    campaignPrep.advanceSessionPlanActivation.mockRejectedValueOnce(stale);
    const base = `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/session-plans/activations/${activationId}`;
    const headers = { 'Content-Type': 'application/json' };

    const progress = await fetch(`${base}/progress`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ currentStepIndex: 1, expectedRevision: 1 }),
    });
    const advance = await fetch(`${base}/advance`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ stepId: 's', stepIndex: 0 }),
    });
    expect(progress.status).toBe(409);
    expect(advance.status).toBe(409);
  });

  it('rejects malformed activation, progress and advance commands', async () => {
    const activationId = '99999999-9999-4999-8999-999999999999';
    const headers = { 'Content-Type': 'application/json' };
    const planUrl = `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/session-plans`;
    const post = (url: string, method: string, body: unknown) =>
      fetch(url, { method, headers, body: JSON.stringify(body) });

    // Activation needs a UUID request ID so a retry is idempotent.
    expect(
      (await post(`${planUrl}/${PLAN_ID}/activate`, 'POST', { sessionId: 'a' }))
        .status,
    ).toBe(400);
    expect(
      (
        await post(`${planUrl}/not-a-uuid/activate`, 'POST', {
          requestId: REQUEST_ID,
        })
      ).status,
    ).toBe(400);
    // Progress needs the activation revision the caller observed.
    expect(
      (
        await post(`${planUrl}/activations/${activationId}/progress`, 'PATCH', {
          currentStepIndex: 1,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post(`${planUrl}/activations/nope/progress`, 'PATCH', {
          expectedRevision: 1,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post(`${planUrl}/activations/${activationId}/advance`, 'POST', {
          stepId: 's',
          stepIndex: 0,
          expectedRevision: 0,
        })
      ).status,
    ).toBe(400);
    expect(campaignPrep.activateSessionPlan).not.toHaveBeenCalled();
    expect(
      campaignPrep.updateSessionPlanActivationProgress,
    ).not.toHaveBeenCalled();
    expect(campaignPrep.advanceSessionPlanActivation).not.toHaveBeenCalled();
  });

  it('rejects an invalid activation status', async () => {
    const activationId = '99999999-9999-4999-8999-999999999999';
    const response = await fetch(
      `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/session-plans/activations/${activationId}/progress`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'finished-ish' }),
      },
    );

    expect(response.status).toBe(400);
    expect(
      campaignPrep.updateSessionPlanActivationProgress,
    ).not.toHaveBeenCalled();
  });

  it('fetches backlinks for a campaign prep object', async () => {
    campaignPrep.getObject.mockResolvedValueOnce({
      id: PLAN_ID,
      campaignId: CAMPAIGN_ID,
      currentRevision: 1,
    });
    campaignPrep.getBacklinks.mockResolvedValueOnce([
      {
        sourceObjectId: 'other-object',
        sourceRevision: 1,
        targetKey: 'some-key',
        target: {},
      },
    ]);

    const response = await fetch(
      `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/prep/backlinks/${PLAN_ID}`,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.links).toHaveLength(1);
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

  describe('deploy-encounter step', () => {
    const activationId = '99999999-9999-4999-8999-999999999999';
    const stepId = '55555555-5555-4555-8555-555555555555';
    const sceneId = '66666666-6666-4666-8666-666666666666';
    const runId = '77777777-7777-4777-8777-777777777777';
    const url = () =>
      `${baseUrl}/api/campaigns/${CAMPAIGN_ID}/session-plans/activations/${activationId}/steps/${stepId}/deploy-encounter`;
    const post = (body: unknown) =>
      fetch(url(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    const activation = (stepStates: Record<string, unknown> = {}) => ({
      id: activationId,
      campaignId: CAMPAIGN_ID,
      status: 'active',
      revision: 3,
      stepStates,
    });
    const plan = {
      steps: [
        {
          id: stepId,
          type: 'deploy-encounter',
          encounterRef: { kind: 'encounter', id: PLAN_ID, revision: 1 },
        },
      ],
    };

    it('deploys once, records the run id, and sends a stable command id', async () => {
      campaignPrep.getActivation.mockResolvedValue({
        activation: activation(),
        plan,
      });
      domainCommands.execute.mockResolvedValue({
        duplicate: false,
        receipt: { result: { success: true, data: { encounterRunId: runId } } },
      });
      campaignPrep.updateSessionPlanActivationProgress.mockResolvedValue(
        activation({ [stepId]: { encounterRunId: runId } }),
      );

      const response = await post({ sceneId });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.encounterRunId).toBe(runId);
      expect(body.duplicate).toBe(false);
      const command = domainCommands.execute.mock.calls[0][0];
      expect(command.payload).toMatchObject({
        type: 'DeployEncounter',
        sceneId,
        hiddenFromPlayers: false,
      });
      expect(domainCommands.execute.mock.calls[0][1]).toMatchObject({
        isDm: true,
        principalId: USER_ID,
      });
      expect(
        campaignPrep.updateSessionPlanActivationProgress,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedRevision: 3,
          stepStates: {
            [stepId]: expect.objectContaining({ encounterRunId: runId }),
          },
        }),
      );

      await post({ sceneId });
      expect(domainCommands.execute.mock.calls[1][0].commandId).toBe(
        command.commandId,
      );
    });

    it('does not deploy again when the run id is already recorded', async () => {
      campaignPrep.getActivation.mockResolvedValue({
        activation: activation({ [stepId]: { encounterRunId: runId } }),
        plan,
      });
      const response = await post({ sceneId });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        encounterRunId: runId,
        duplicate: true,
      });
      expect(domainCommands.execute).not.toHaveBeenCalled();
    });

    it('reuses an existing command receipt after a crash before recording', async () => {
      campaignPrep.getActivation.mockResolvedValue({
        activation: activation(),
        plan,
      });
      commandReceipts.getReceipt.mockResolvedValue({
        result: { result: { success: true, data: { encounterRunId: runId } } },
      });
      campaignPrep.updateSessionPlanActivationProgress.mockResolvedValue(
        activation({ [stepId]: { encounterRunId: runId } }),
      );
      const response = await post({ sceneId });
      expect(response.status).toBe(200);
      expect(domainCommands.execute).not.toHaveBeenCalled();
    });

    it('rejects non-DM callers and invalid input', async () => {
      userId = '33333333-3333-4333-8333-333333333333';
      expect((await post({ sceneId })).status).toBe(403);
      userId = USER_ID;
      expect((await post({ sceneId: 'scene-1' })).status).toBe(400);
      expect(domainCommands.execute).not.toHaveBeenCalled();
    });

    it('rejects steps that are not encounter deployments', async () => {
      campaignPrep.getActivation.mockResolvedValue({
        activation: activation(),
        plan: { steps: [{ id: stepId, type: 'reminder', text: 'x' }] },
      });
      expect((await post({ sceneId })).status).toBe(422);
      campaignPrep.getActivation.mockResolvedValue(null);
      expect((await post({ sceneId })).status).toBe(404);
    });
  });

  describe('encounter materialization', () => {
    const ENCOUNTER_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const url = `/api/campaigns/${CAMPAIGN_ID}/prep/encounters/${ENCOUNTER_ID}/materialize`;
    const goblin = {
      key: 'srd:goblin',
      name: 'Goblin',
      cr: '1/4',
      ac: 15,
      hp: 7,
      speed: 30,
      abilities: [8, 14, 10, 10, 8, 8],
    };
    const post = (body: unknown, path = url) =>
      fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

    beforeEach(() => {
      campaignPrep.getObject.mockResolvedValue({
        id: ENCOUNTER_ID,
        campaignId: CAMPAIGN_ID,
        kind: 'encounter',
        title: 'Dock ambush',
        currentRevision: 2,
      });
      campaignPrep.getRevision.mockResolvedValue({
        data: {
          content: {
            value: {
              nexusStudio: {
                fields: {
                  composition: [
                    {
                      name: 'Goblin',
                      count: 2,
                      monsterKey: 'srd:goblin',
                      cr: '1/4',
                    },
                  ],
                },
              },
            },
          },
        },
      });
    });

    it('materializes an authored encounter and returns its pinned ref', async () => {
      const response = await post({ monsters: [goblin] });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        encounterRef: { kind: 'encounter', id: ENCOUNTER_ID, revision: 1 },
        monsterCount: 1,
        created: true,
      });
      expect(libraryObjects.createObject).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'encounter',
          campaignId: CAMPAIGN_ID,
          ownerId: USER_ID,
        }),
        expect.anything(),
        ENCOUNTER_ID,
      );
    });

    it('is restricted to the campaign DM and validates input', async () => {
      userId = '33333333-3333-4333-8333-333333333333';
      expect((await post({ monsters: [goblin] })).status).toBe(403);
      userId = USER_ID;
      expect(
        (
          await post(
            { monsters: [goblin] },
            `/api/campaigns/${CAMPAIGN_ID}/prep/encounters/not-a-uuid/materialize`,
          )
        ).status,
      ).toBe(400);
      expect((await post({ monsters: [{ ...goblin, hp: 0 }] })).status).toBe(
        422,
      );
      expect(libraryObjects.createObject).not.toHaveBeenCalled();
    });

    it('returns 404 for a missing encounter and 422 for other kinds', async () => {
      campaignPrep.getObject.mockResolvedValue(null);
      expect((await post({ monsters: [goblin] })).status).toBe(404);
      campaignPrep.getObject.mockResolvedValue({
        id: ENCOUNTER_ID,
        campaignId: CAMPAIGN_ID,
        kind: 'npc',
        title: 'Mira',
        currentRevision: 1,
      });
      expect((await post({ monsters: [goblin] })).status).toBe(422);
    });

    it('returns 422 when monsters are missing stats or unlinked', async () => {
      const resMissingStats = await post({ monsters: [] });
      expect(resMissingStats.status).toBe(422);
      const jsonMissing = await resMissingStats.json();
      expect(jsonMissing.error).toMatch(/Stat blocks missing for: Goblin/);

      campaignPrep.getRevision.mockResolvedValueOnce({
        data: {
          content: {
            value: {
              nexusStudio: {
                fields: {
                  composition: [{ name: 'Mystery Creature', count: 1 }],
                },
              },
            },
          },
        },
      });
      const resUnlinked = await post({ monsters: [goblin] });
      expect(resUnlinked.status).toBe(422);
      const jsonUnlinked = await resUnlinked.json();
      expect(jsonUnlinked.error).toMatch(/Link these monsters to the catalog/);
    });
  });
});
