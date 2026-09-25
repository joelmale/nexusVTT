import { afterEach, describe, expect, it, vi } from 'vitest';

import { publishGlassHarborPlan } from './campaign-prep-api';

const CAMPAIGN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('publishGlassHarborPlan', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('publishes an existing draft through the VTT campaign-prep API', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const path = String(input);
        if (path === '/api/campaigns') {
          return json([{ id: CAMPAIGN_ID, name: 'Ashes of Veyra' }]);
        }
        if (path === '/api/users/profile') {
          return json({ id: 'dm-1' });
        }
        if (path === '/api/user/dm-1/assets') {
          return json({
            assets: [{ id: 'asset-map', name: 'Glass Harbor Docks Map' }],
          });
        }
        if (path.endsWith('/prep/objects') && init?.method !== 'POST') {
          return json({
            objects: [
              {
                id: 'note-1',
                kind: 'note',
                title: "Harbormaster's Warning",
                currentRevision: 1,
                status: 'draft',
              },
              {
                id: 'scene-1',
                kind: 'scene-template',
                title: 'Glass Harbor Docks',
                currentRevision: 1,
                status: 'draft',
              },
              {
                id: 'plan-1',
                kind: 'session-plan',
                title: 'Session 12 - The Glass Harbor',
                currentRevision: 1,
                status: 'draft',
              },
            ],
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

    const result = await publishGlassHarborPlan();

    expect(result.plan.revision).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/campaigns/${CAMPAIGN_ID}/prep/objects/plan-1/publish`,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('surfaces an authentication response as a useful error', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => json({ error: 'Authentication required' }, 401),
    );

    await expect(publishGlassHarborPlan()).rejects.toThrow(
      'Authentication required',
    );
  });
});
