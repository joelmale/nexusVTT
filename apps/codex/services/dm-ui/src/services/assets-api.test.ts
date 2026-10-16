import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assetImageUrl,
  deleteAsset,
  isImageAsset,
  listAssets,
  updateAsset,
  uploadAssetFile,
} from './assets-api';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('assets-api', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  /** Answers the profile lookup, then the queued responses in order. */
  function respond(...responses: Response[]) {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/users/profile') return Promise.resolve(json({ id: 'u 1' }));
      const next = responses.shift();
      if (!next) throw new Error(`Unexpected request ${url}`);
      return Promise.resolve(next);
    });
  }

  const lastCall = () =>
    fetchMock.mock.calls.filter(([url]) => url !== '/api/users/profile').at(-1)!;

  it('lists the signed-in user assets fresh from the server, newest first', async () => {
    respond(
      json({
        assets: [
          { id: 'old', name: 'Old', createdAt: '2026-01-01T00:00:00Z' },
          { id: 'none', name: 'No date' },
          { id: 'new', name: 'New', createdAt: '2026-10-01T00:00:00Z' },
        ],
      }),
    );
    const assets = await listAssets();
    expect(assets.map((a) => a.id)).toEqual(['new', 'old', 'none']);
    const [url, init] = lastCall();
    expect(url).toBe('/api/user/u%201/assets');
    expect(init).toMatchObject({ cache: 'no-store', credentials: 'include' });
  });

  it('surfaces a list failure', async () => {
    respond(json({ error: 'Authentication required' }, 401));
    await expect(listAssets()).rejects.toThrow('Authentication required');
  });

  it('PATCHes name and tags and returns the updated asset', async () => {
    respond(json({ asset: { id: 'a/1', name: 'Renamed', tags: ['x'] } }));
    const asset = await updateAsset('a/1', { name: 'Renamed', tags: ['x'] });
    expect(asset).toMatchObject({ name: 'Renamed' });
    const [url, init] = lastCall();
    expect(url).toBe('/api/user/u%201/asset/a%2F1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'Renamed',
      tags: ['x'],
    });
  });

  it('throws the server message when an update is rejected', async () => {
    respond(json({ error: 'name must be 1-120 characters' }, 400));
    await expect(updateAsset('a1', { name: '' })).rejects.toThrow(
      'name must be 1-120 characters',
    );
  });

  it('deletes and reports ok', async () => {
    respond(json({ success: true }));
    await expect(deleteAsset('a1')).resolves.toEqual({ ok: true });
    expect(lastCall()[1].method).toBe('DELETE');
  });

  it('returns the references on a 409 instead of throwing', async () => {
    const references = [
      {
        campaignId: 'c1',
        campaignName: 'Ashes',
        objectId: 'o1',
        kind: 'campaign-map',
        title: 'Harbor',
      },
    ];
    respond(json({ error: 'still used', references }, 409));
    await expect(deleteAsset('a1')).resolves.toEqual({
      ok: false,
      error: 'still used',
      references,
    });
  });

  it('throws on other delete failures', async () => {
    respond(json({ error: 'Asset not found' }, 404));
    await expect(deleteAsset('a1')).rejects.toThrow('Asset not found');
  });

  it('validates uploads before sending anything', async () => {
    await expect(
      uploadAssetFile(new File(['x'], 'a.gif', { type: 'image/gif' }), 'maps'),
    ).rejects.toThrow(/PNG, JPEG or WebP/);
    const big = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 });
    await expect(uploadAssetFile(big, 'maps')).rejects.toThrow(/5 MB/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uploads with the chosen category and the file name as the default name', async () => {
    respond(json({ asset: { id: 'n1', name: 'cave.png', category: 'tokens' } }));
    const asset = await uploadAssetFile(
      new File(['x'], 'cave.png', { type: 'image/png' }),
      'tokens',
    );
    expect(asset.id).toBe('n1');
    const [url, init] = lastCall();
    expect(url).toBe('/api/user/u%201/upload');
    const form = init.body as FormData;
    expect(form.get('category')).toBe('tokens');
    expect(form.get('name')).toBe('cave.png');
  });

  it('builds image URLs and detects image files', () => {
    expect(assetImageUrl({ fullImage: 'users/u1/a.png' })).toBe('/users/u1/a.png');
    expect(assetImageUrl({})).toBe('');
    expect(isImageAsset({ fullImage: 'users/u1/a.WEBP' })).toBe(true);
    expect(isImageAsset({ fullImage: 'users/u1/a.txt' })).toBe(false);
  });
});
