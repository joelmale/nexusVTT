import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  publishSessionPlan,
  type PublishSessionPlanInput,
} from './campaign-prep-api';

const CAMPAIGN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const input: PublishSessionPlanInput = {
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
        if (path.endsWith('/prep/objects/plan-1')) {
          const body = JSON.parse(String(requestInit?.body)) as {
            data: Record<string, unknown>;
          };
          revisedPlan = body.data;
          return json({
            object: {
              id: 'plan-1',
              kind: 'session-plan',
              title: input.planTitle,
              currentRevision: 2,
              status: 'draft',
            },
          });
        }
        if (path.endsWith('/prep/objects/plan-1/publish')) {
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
