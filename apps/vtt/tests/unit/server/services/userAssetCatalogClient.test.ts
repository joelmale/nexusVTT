import { afterEach, describe, expect, it, vi } from 'vitest';

import { UserAssetCatalogClient } from '../../../../server/services/userAssetCatalogClient.js';

describe('UserAssetCatalogClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('finds a user-owned asset by ID', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ assets: [{ id: 'map-1' }] }), {
        status: 200,
      }),
    );
    const client = new UserAssetCatalogClient('http://asset-service:5003/');

    await expect(client.resolveAsset('dm user', 'map-1')).resolves.toBe(
      'available',
    );
    expect(fetch).toHaveBeenCalledWith(
      'http://asset-service:5003/user/dm%20user/assets',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('distinguishes missing assets from unavailable responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ assets: [] }), { status: 200 }),
    );
    const client = new UserAssetCatalogClient('http://asset-service:5003');
    await expect(client.resolveAsset('dm-1', 'map-1')).resolves.toBe('missing');

    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(client.resolveAsset('dm-1', 'map-1')).resolves.toBe(
      'unavailable',
    );

    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    await expect(client.resolveAsset('dm-1', 'map-1')).resolves.toBe(
      'unavailable',
    );
  });
});
