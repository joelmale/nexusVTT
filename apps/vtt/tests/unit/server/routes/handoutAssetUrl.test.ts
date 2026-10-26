import { describe, expect, it, vi } from 'vitest';
import { createHandoutUrlResolver } from '../../../../server/routes/handoutAssetUrl.js';

function listing(assets: Array<{ id: string; fullImage?: string }>, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve({ assets }),
  }) as unknown as typeof fetch;
}

describe('createHandoutUrlResolver', () => {
  it('returns the origin-root path for an image asset', async () => {
    const fetchImpl = listing([
      { id: 'other', fullImage: 'users/u1/other.png' },
      { id: 'map', fullImage: '/users/u1/map.webp' },
    ]);
    const resolve = createHandoutUrlResolver('http://assets:5003', fetchImpl);
    await expect(resolve('u1', 'map')).resolves.toBe('/users/u1/map.webp');
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://assets:5003/user/u1/assets',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('resolves published plain-text handouts', async () => {
    const resolve = createHandoutUrlResolver(
      'http://assets',
      listing([{ id: 'letter', fullImage: 'users/u1/letter.txt' }]),
    );
    await expect(resolve('u1', 'letter')).resolves.toBe('/users/u1/letter.txt');
  });

  it('ignores unsupported assets and unknown ids', async () => {
    const resolve = createHandoutUrlResolver(
      'http://assets',
      listing([
        { id: 'notes', fullImage: 'users/u1/notes.md' },
        { id: 'bare' },
      ]),
    );
    await expect(resolve('u1', 'notes')).resolves.toBeUndefined();
    await expect(resolve('u1', 'bare')).resolves.toBeUndefined();
    await expect(resolve('u1', 'missing')).resolves.toBeUndefined();
  });

  it('fails soft on bad responses, errors and unsafe ids', async () => {
    await expect(
      createHandoutUrlResolver('http://a', listing([], false))('u1', 'x'),
    ).resolves.toBeUndefined();

    const throwing = vi.fn().mockRejectedValue(new Error('down'));
    await expect(
      createHandoutUrlResolver('http://a', throwing as unknown as typeof fetch)(
        'u1',
        'x',
      ),
    ).resolves.toBeUndefined();

    const fetchImpl = listing([]);
    await expect(
      createHandoutUrlResolver('http://a', fetchImpl)('../etc', 'x'),
    ).resolves.toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('defaults to ASSET_API_URL', async () => {
    const fetchImpl = listing([]);
    await createHandoutUrlResolver(undefined, fetchImpl)('u1', 'x');
    expect(vi.mocked(fetchImpl).mock.calls[0][0]).toMatch(
      /\/user\/u1\/assets$/,
    );
  });
});
