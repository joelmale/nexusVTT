import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_MAPS, findDefaultMap } from '@/data/defaultMaps';

import {
  resolveMapImage,
  resolveMapThumbnail,
} from './buildMapPreparationModel';

const FORT_JOY = findDefaultMap('default-map-1')!;

describe('resolveMapImage', () => {
  it('prefers the saved display URL', () => {
    expect(
      resolveMapImage({
        imagePath: '/users/u1/generated/abc.webp',
        imageAssetRef: { assetId: 'default-map-1' },
      }),
    ).toBe('/users/u1/generated/abc.webp');
  });

  it('recovers maps saved with only a bundled id (the broken-image case)', () => {
    expect(
      resolveMapImage({ imageAssetRef: { assetId: 'default-map-1' } }),
    ).toBe(FORT_JOY.path);
    expect(FORT_JOY.path).toMatch(/^\/assets\/defaults\/base_maps\//);
  });

  it('never returns a URL nothing serves', () => {
    expect(resolveMapImage({})).toBe('');
    expect(
      resolveMapImage({ imageAssetRef: { assetId: 'custom-map-1696000000000' } }),
    ).toBe('');
    expect(
      resolveMapImage({ imageAssetRef: { assetId: 'a1b2c3d4-uuid-like-id' } }),
    ).toBe('');
  });

  it('keeps the other asset kinds working', () => {
    expect(resolveMapImage({ imageAssetRef: { assetId: 'library:abc/def.webp' } })).toBe(
      '/library-assets/abc/def.webp',
    );
    expect(resolveMapImage({ imageAssetRef: { assetId: 'https://x.test/m.png' } })).toBe(
      'https://x.test/m.png',
    );
    vi.stubEnv('BASE_URL', '/codex-dm/');
    expect(resolveMapImage({ imageAssetRef: { assetId: 'demo-ashes-map' } })).toBe(
      '/codex-dm/campaigns/ashes-of-veyra/maps/glass-harbor.png',
    );
    vi.unstubAllEnvs();
  });
});

describe('resolveMapThumbnail', () => {
  it('uses the small bundled thumbnail for bundled maps', () => {
    expect(
      resolveMapThumbnail({ imageAssetRef: { assetId: 'default-map-1' } }),
    ).toBe(FORT_JOY.thumbnail);
    // A map saved with the full path still gets the thumbnail on cards.
    expect(
      resolveMapThumbnail({
        imagePath: FORT_JOY.path,
        imageAssetRef: { assetId: 'default-map-1' },
      }),
    ).toBe(FORT_JOY.thumbnail);
  });

  it('falls back to the image itself for maps with no thumbnail', () => {
    expect(resolveMapThumbnail({ imagePath: '/users/u1/generated/abc.webp' })).toBe(
      '/users/u1/generated/abc.webp',
    );
    expect(resolveMapThumbnail({})).toBe('');
  });

  it('every bundled map has a distinct thumbnail path', () => {
    const thumbs = new Set(DEFAULT_MAPS.map((map) => map.thumbnail));
    expect(thumbs.size).toBe(DEFAULT_MAPS.length);
  });
});
