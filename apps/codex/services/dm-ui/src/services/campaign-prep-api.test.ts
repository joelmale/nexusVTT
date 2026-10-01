import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  activateSessionPlan,
  AuthenticationRequiredError,
  ensureSession,
  fetchSessionPlanStatus,
  publishSessionPlan,
  type PublishSessionPlanInput,
} from './campaign-prep-api';

const CAMPAIGN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const input: PublishSessionPlanInput = {
  campaignId: CAMPAIGN_ID,
  campaignTitle: 'A Real Campaign',
  planTitle: 'Session 7 - Crossroads',
  revision: 1,
  steps: [
    {
      command: 'Reminder',
      durationMinutes: 5,
      id: 'main-step',
      title: 'Main objective',
      track: 'main',
      visibility: 'dm-only',
    },
    {
      command: 'Reminder',
      durationMinutes: 0,
      id: 'parallel-step',
      title: 'Keep an eye on the rival party',
      track: 'parallel',
      visibility: 'shared',
    },
  ],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('publishSessionPlan', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('publishes the edited tracks into the selected campaign', async () => {
    let revisedPlan: Record<string, unknown> | undefined;
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (request, requestInit) => {
        const path = String(request);
        if (path === '/api/users/profile') {
          return json({ id: 'dm-1' });
        }
        if (path === '/api/campaigns') {
          return json([{ id: CAMPAIGN_ID, name: input.campaignTitle }]);
        }
        if (path === '/api/user/dm-1/assets') {
          return json({ assets: [] });
        }
        if (path.endsWith('/prep/objects') && !requestInit?.method) {
          return json({
            objects: [
              {
                id: 'plan-1',
                kind: 'session-plan',
                title: input.planTitle,
                currentRevision: 1,
                status: 'draft',
              },
            ],
          });
        }
        if (path.endsWith('/prep/objects/plan-1/publish')) {
          const body = JSON.parse(String(requestInit?.body)) as {
            data: Record<string, unknown>;
          };
          revisedPlan = body.data;
          return json({
            published: true,
            plan: { id: 'plan-1', revision: 2, status: 'ready' },
          });
        }
        throw new Error(`Unexpected request: ${path}`);
      });

    const result = await publishSessionPlan(input);

    expect(result.plan.revision).toBe(2);
    expect(revisedPlan).toMatchObject({
      title: input.planTitle,
      steps: [
        expect.objectContaining({ title: 'Main objective', track: 'main' }),
        expect.objectContaining({
          title: 'Keep an eye on the rival party',
          track: 'parallel',
        }),
      ],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/campaigns/${CAMPAIGN_ID}/prep/objects/plan-1/publish`,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('surfaces an authentication response as a useful error', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      json({ error: 'Authentication required' }, 401),
    );

    await expect(publishSessionPlan(input)).rejects.toThrow(
      'Authentication required',
    );
  });

  it('declares referenced steps in the plan dependency manifest', async () => {
    let createdPlan: Record<string, unknown> | undefined;
    const referencedInput: PublishSessionPlanInput = {
      ...input,
      steps: [
        {
          command: 'Open note',
          durationMinutes: 5,
          id: 'note-step',
          title: 'Read the warning',
          track: 'main',
          visibility: 'dm-only',
        },
        {
          body: 'The sealed gate will open at midnight.',
          command: 'Share handout',
          durationMinutes: 0,
          id: 'handout-step',
          title: 'Sealed warning',
          track: 'parallel',
          visibility: 'shared',
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (request, requestInit) => {
        const path = String(request);
        if (path === '/api/users/profile') return json({ id: 'dm-1' });
        if (path === '/api/campaigns') {
          return json([{ id: CAMPAIGN_ID, name: input.campaignTitle }]);
        }
        if (path === '/api/user/dm-1/assets') return json({ assets: [] });
        if (path.endsWith('/prep/objects') && !requestInit?.method) {
          return json({ objects: [] });
        }
        if (path === `/api/campaigns/${CAMPAIGN_ID}/prep/objects`) {
          const body = JSON.parse(String(requestInit?.body)) as {
            data: Record<string, unknown>;
            kind: string;
          };
          if (body.kind === 'note') {
            return json({
              object: {
                id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                kind: 'note',
                title: 'Read the warning',
                currentRevision: 1,
                status: 'draft',
              },
            });
          }
          createdPlan = body.data;
          return json({
            object: {
              id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
              kind: 'session-plan',
              title: input.planTitle,
              currentRevision: 1,
              status: 'draft',
            },
          });
        }
        if (path === '/api/user/dm-1/upload') {
          return json({
            asset: { id: 'handout-asset', name: 'Sealed warning' },
          });
        }
        if (path.endsWith('/publish')) {
          return json({
            published: true,
            plan: { id: 'plan-1', revision: 1, status: 'ready' },
          });
        }
        throw new Error(`Unexpected request: ${path}`);
      },
    );

    await publishSessionPlan(referencedInput);

    expect(createdPlan).toMatchObject({
      dependencies: [
        {
          target: 'campaign-object',
          campaignId: CAMPAIGN_ID,
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          revision: 1,
        },
        { target: 'asset', assetId: 'handout-asset' },
      ],
    });
  });

  it('publishes an authored encounter step as a pinned deploy-encounter step', async () => {
    const ENCOUNTER_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    let createdPlan: Record<string, unknown> | undefined;
    let materializeBody: Record<string, unknown> | undefined;
    const goblin = {
      key: 'srd:goblin',
      name: 'Goblin',
      cr: '1/4',
      ac: 15,
      hp: 7,
      speed: 30,
      abilities: [8, 14, 10, 10, 8, 8],
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (request, requestInit) => {
        const path = String(request);
        if (path === '/api/users/profile') return json({ id: 'dm-1' });
        if (path === '/api/user/dm-1/assets') return json({ assets: [] });
        if (path.endsWith('/materialize')) {
          expect(path).toBe(
            `/api/campaigns/${CAMPAIGN_ID}/prep/encounters/${ENCOUNTER_ID}/materialize`,
          );
          materializeBody = JSON.parse(String(requestInit?.body));
          return json({
            encounterRef: { kind: 'encounter', id: ENCOUNTER_ID, revision: 4 },
            monsterCount: 1,
            created: true,
          });
        }
        if (path.endsWith('/prep/objects') && !requestInit?.method) {
          return json({ objects: [] });
        }
        if (path === `/api/campaigns/${CAMPAIGN_ID}/prep/objects`) {
          createdPlan = (
            JSON.parse(String(requestInit?.body)) as {
              data: Record<string, unknown>;
            }
          ).data;
          return json({
            object: {
              id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
              kind: 'session-plan',
              title: input.planTitle,
              currentRevision: 1,
              status: 'draft',
            },
          });
        }
        if (path.endsWith('/publish')) {
          return json({
            published: true,
            plan: { id: 'plan-1', revision: 1, status: 'ready' },
          });
        }
        throw new Error(`Unexpected request: ${path}`);
      },
    );

    await publishSessionPlan({
      ...input,
      steps: [
        {
          command: 'Deploy encounter',
          durationMinutes: 30,
          encounterId: ENCOUNTER_ID,
          encounterMonsters: [goblin],
          id: 'enc-step',
          title: 'Dock ambush',
          track: 'main',
          visibility: 'dm-only',
        },
        {
          command: 'Deploy encounter',
          durationMinutes: 5,
          id: 'legacy-step',
          title: 'Unlinked fight',
          track: 'main',
          visibility: 'dm-only',
        },
      ],
    });

    expect(materializeBody).toEqual({ monsters: [goblin] });
    const steps = (createdPlan as { steps: Record<string, unknown>[] }).steps;
    expect(steps[0]).toMatchObject({
      type: 'deploy-encounter',
      encounterRef: { kind: 'encounter', id: ENCOUNTER_ID, revision: 4 },
    });
    // Without an authored encounter the step still publishes as a reminder.
    expect(steps[1]).toMatchObject({ type: 'reminder' });
    expect(createdPlan).toMatchObject({
      dependencies: [
        {
          target: 'definition',
          ref: { kind: 'encounter', id: ENCOUNTER_ID, revision: 4 },
        },
      ],
    });
  });

  it('surfaces the first publish validation issue', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      json(
        {
          published: false,
          validation: {
            issues: [
              {
                message:
                  'A session step dependency is absent from the plan manifest',
                path: 'steps.0',
              },
            ],
          },
        },
        422,
      ),
    );

    await expect(publishSessionPlan(input)).rejects.toThrow(
      'A session step dependency is absent from the plan manifest (steps.0)',
    );
  });
});

describe('ensureSession', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns profile when authenticated', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url) === '/api/users/profile') {
        return json({ id: 'user-42' });
      }
      throw new Error(`Unexpected url: ${url}`);
    });

    const profile = await ensureSession();
    expect(profile.id).toBe('user-42');
  });

  it('throws AuthenticationRequiredError on 401 in production and never calls login or register', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (url) => {
        if (String(url) === '/api/users/profile') {
          return json({ error: 'Unauthorized' }, 401);
        }
        return json({ ok: true });
      });

    await expect(ensureSession()).rejects.toThrow(AuthenticationRequiredError);
    // Must only have called /api/users/profile once, never /auth/login or /auth/register
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/users/profile',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('attempts dev bootstrap only when VITE_DEV_AUTH_BOOTSTRAP is explicitly enabled in dev mode', async () => {
    vi.stubEnv('VITE_DEV_AUTH_BOOTSTRAP', 'true');
    vi.stubEnv('VITE_DEV_AUTH_EMAIL', 'test-dm@nexus.local');
    vi.stubEnv('VITE_DEV_AUTH_PASSWORD', 'test-password');

    let profileCalls = 0;
    let loginCalled = false;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const path = String(url);
      if (path === '/api/users/profile') {
        profileCalls++;
        if (profileCalls === 1) {
          return json({ error: 'Unauthorized' }, 401);
        }
        return json({ id: 'bootstrapped-dm' });
      }
      if (path === '/auth/login') {
        loginCalled = true;
        const body = JSON.parse(String(init?.body));
        expect(body.email).toBe('test-dm@nexus.local');
        expect(body.password).toBe('test-password');
        return json({ success: true });
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    const profile = await ensureSession();
    expect(profile.id).toBe('bootstrapped-dm');
    expect(loginCalled).toBe(true);
    expect(profileCalls).toBe(2);
  });
});

describe('fetchSessionPlanStatus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns draft status when no plan object exists for the campaign', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const path = String(url);
      if (path === '/api/users/profile') return json({ id: 'dm-1' });
      if (path === '/api/campaigns')
        return json([{ id: CAMPAIGN_ID, name: input.campaignTitle }]);
      if (path.endsWith('/prep/objects?kind=session-plan'))
        return json({ objects: [] });
      throw new Error(`Unexpected path: ${path}`);
    });

    const status = await fetchSessionPlanStatus({
      campaignId: CAMPAIGN_ID,
      planTitle: input.planTitle,
    });

    expect(status).toEqual({
      campaignId: CAMPAIGN_ID,
      status: 'draft',
      published: false,
    });
  });

  it('hydrates ready status and revision when plan is published', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const path = String(url);
      if (path === '/api/users/profile') return json({ id: 'dm-1' });
      if (path === '/api/campaigns')
        return json([{ id: CAMPAIGN_ID, name: input.campaignTitle }]);
      if (path.endsWith('/prep/objects?kind=session-plan')) {
        return json({
          objects: [
            {
              id: 'plan-101',
              kind: 'session-plan',
              title: input.planTitle,
              currentRevision: 4,
              status: 'ready',
            },
          ],
        });
      }
      if (path.endsWith('/session-plans/active')) {
        return json({
          activation: {
            id: 'act-1',
            sessionId: 'sess-12',
            sessionPlanId: 'plan-101',
            status: 'active',
          },
        });
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    const status = await fetchSessionPlanStatus({
      campaignId: CAMPAIGN_ID,
      planTitle: input.planTitle,
    });

    expect(status).toEqual({
      planId: 'plan-101',
      campaignId: CAMPAIGN_ID,
      status: 'ready',
      revision: 4,
      published: true,
      activeSessionId: 'sess-12',
      isActivated: true,
    });
  });
});

describe('activateSessionPlan', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('activates an already published plan directly without publishing a new revision', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (url, init) => {
        const path = String(url);
        if (path === '/api/users/profile') return json({ id: 'dm-1' });
        if (path === '/api/campaigns')
          return json([{ id: CAMPAIGN_ID, name: input.campaignTitle }]);
        if (path.endsWith('/prep/objects?kind=session-plan')) {
          return json({
            objects: [
              {
                id: 'plan-101',
                kind: 'session-plan',
                title: input.planTitle,
                currentRevision: 4,
                status: 'ready',
              },
            ],
          });
        }
        if (
          path ===
          `/api/campaigns/${CAMPAIGN_ID}/session-plans/plan-101/activate`
        ) {
          const body = JSON.parse(String(init?.body));
          expect(body.planRevision).toBe(4);
          return json({
            activation: {
              id: 'act-1',
              campaignId: CAMPAIGN_ID,
              sessionPlanId: 'plan-101',
              planRevision: 4,
              sessionId: 'sess-12',
              currentStepIndex: 0,
              status: 'active',
            },
            plan: { id: 'plan-101', revision: 4, status: 'ready' },
          });
        }
        throw new Error(`Unexpected path: ${path}`);
      });

    const result = await activateSessionPlan(input);

    expect(result.activation.planRevision).toBe(4);
    // Verify publish endpoint was NEVER called
    const calls = fetchSpy.mock.calls.map(([url]) => String(url));
    expect(calls.some((url) => url.endsWith('/publish'))).toBe(false);
  });
});
