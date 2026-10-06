import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DEFAULT_MAPS, findDefaultMap } from './defaultMaps';

// apps/codex/services/dm-ui/src/data -> apps/vtt/public
const PUBLIC_ROOT = resolve(__dirname, '../../../../../vtt/public');
const manifest = JSON.parse(
  readFileSync(resolve(PUBLIC_ROOT, 'assets/defaults/manifest.json'), 'utf8'),
) as { maps: { items: { id: string; path: string; thumbnail?: string }[] } };

describe('generated default map index', () => {
  it('matches the VTT manifest (run scripts/build-default-maps-index.mjs if this fails)', () => {
    const fromManifest = manifest.maps.items.map((item) => item.id).sort();
    expect(DEFAULT_MAPS.map((map) => map.id).sort()).toEqual(fromManifest);
    for (const item of manifest.maps.items) {
      const map = findDefaultMap(item.id)!;
      expect(map.path).toBe(item.path);
      expect(map.thumbnail).toBe(item.thumbnail ?? item.path);
    }
  });

  it('points at files that exist, with a real thumbnail for every map', () => {
    for (const map of DEFAULT_MAPS) {
      expect(existsSync(resolve(PUBLIC_ROOT, map.path.slice(1))), map.path).toBe(true);
      expect(map.thumbnail).not.toBe(map.path);
      expect(existsSync(resolve(PUBLIC_ROOT, map.thumbnail.slice(1))), map.thumbnail).toBe(true);
    }
  });

  it('is small enough to ship in the bundle', () => {
    expect(DEFAULT_MAPS.length).toBeGreaterThan(200);
    expect(findDefaultMap('default-map-1')?.name).toBe('10. DoS2 - Fort Joy Docks');
    expect(findDefaultMap('nope')).toBeUndefined();
  });
});
