import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CampaignApiError,
  createCampaign,
  listCampaigns,
} from './campaign-api';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}

describe('campaign-api', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lists server campaigns from most recently updated', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      json([
        {
          createdAt: '2026-01-01T00:00:00Z',
          description: null,
          id: 'older',
          name: 'Shared name',
          updatedAt: '2026-01-02T00:00:00Z',
        },
        {
          createdAt: '2026-01-01T00:00:00Z',
          description: 'Friday group',
          id: 'newer',
          name: 'Shared name',
          updatedAt: '2026-02-02T00:00:00Z',
        },
      ]),
    );

    await expect(listCampaigns()).resolves.toMatchObject([
      { id: 'newer' },
      { id: 'older' },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/campaigns',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('creates a campaign with trimmed fields and no name deduplication', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      json(
        {
          createdAt: '2026-02-02T00:00:00Z',
          description: 'Friday group',
          id: 'new-id',
          name: 'Shared name',
          updatedAt: '2026-02-02T00:00:00Z',
        },
        201,
      ),
    );

    await expect(
      createCampaign({
        description: '  Friday group  ',
        name: '  Shared name  ',
      }),
    ).resolves.toMatchObject({ id: 'new-id', name: 'Shared name' });
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/campaigns',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      description: 'Friday group',
      name: 'Shared name',
    });
  });

  it('rejects blank names before making a request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(createCampaign({ name: '   ' })).rejects.toThrow(
      'Campaign name is required.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves authentication failures as typed errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      json({ error: 'Authentication required' }, 401),
    );

    await expect(listCampaigns()).rejects.toMatchObject<CampaignApiError>({
      message: 'Authentication required',
      status: 401,
    });
  });
});
