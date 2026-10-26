import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPreparedScene } from '@/services/preparedScene';
vi.mock('@/services/assetManager', () => ({
  assetManager: {
    loadAssetManifest: vi.fn().mockResolvedValue({ assets: [] }),
  },
}));
afterEach(() => vi.unstubAllGlobals());
const template = {
  id: 'scene',
  name: 'Real map',
  backgroundAssetRef: { assetId: 'uploaded-map' },
};

describe('published scene resolution', () => {
  it('loads the pinned revision and actual uploaded map path', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ revision: { data: template } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          assets: [
            {
              id: 'uploaded-map',
              fullImage: 'assets/user/owner/map.webp',
              dimensions: { width: 640, height: 480 },
            },
          ],
        }),
      });
    vi.stubGlobal('fetch', fetch);
    const loaded = await loadPreparedScene('campaign', 'scene', 2, 'owner');
    expect(fetch.mock.calls[0][0]).toBe(
      '/api/campaigns/campaign/prep/objects/scene?revision=2',
    );
    expect(loaded.image).toEqual({
      url: '/assets/user/owner/map.webp',
      width: 640,
      height: 480,
    });
  });
  it('stops activation when the requested revision is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(
      loadPreparedScene('campaign', 'scene', 2, 'owner'),
    ).rejects.toThrow('revision is unavailable');
  });
  it('stops activation when the referenced asset is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ revision: { data: template } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ assets: [] }),
        }),
    );
    await expect(
      loadPreparedScene('campaign', 'scene', 2, 'owner'),
    ).rejects.toThrow('map is missing');
  });
});
