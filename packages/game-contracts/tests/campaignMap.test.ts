import { describe, expect, it } from 'vitest';

import { campaignMapSchema, mapPinSchema } from '../src/index';

const IDS = {
  map: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  campaign: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  npc: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
};
const NOW = '2026-10-01T12:00:00.000Z';

function map(overrides: Record<string, unknown> = {}) {
  return {
    id: IDS.map,
    campaignId: IDS.campaign,
    schemaVersion: 1,
    revision: 1,
    title: 'Glass Harbor',
    imageAssetRef: { target: 'asset', assetId: 'default-map-1' },
    dimensions: { width: 1920, height: 1080 },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('campaignMapSchema', () => {
  it('accepts a map with only the required fields and applies defaults', () => {
    const parsed = campaignMapSchema.parse(map());
    expect(parsed.description).toBe('');
    expect(parsed.layers).toEqual([]);
    expect(parsed.pins).toEqual([]);
    expect(parsed.imageUrl).toBeUndefined();
  });

  it('keeps a display URL as a path or http(s) URL', () => {
    for (const imageUrl of [
      '/assets/defaults/base_maps/Canals.webp',
      '/users/u1/generated/abc.webp',
      'https://cdn.example.com/map.png',
    ]) {
      expect(campaignMapSchema.parse(map({ imageUrl })).imageUrl).toBe(imageUrl);
    }
  });

  it('never accepts inline image data as the display URL', () => {
    for (const imageUrl of [
      'data:image/png;base64,AAAA',
      'DATA:image/webp;base64,AAAA',
      'blob:https://example.com/1234',
      'javascript:alert(1)',
    ]) {
      expect(campaignMapSchema.safeParse(map({ imageUrl })).success).toBe(false);
    }
    expect(campaignMapSchema.safeParse(map({ imageUrl: '   ' })).success).toBe(
      false,
    );
    expect(
      campaignMapSchema.safeParse(map({ imageUrl: `/${'a'.repeat(2100)}` })).success,
    ).toBe(false);
  });

  it('requires an asset ref and positive dimensions', () => {
    expect(
      campaignMapSchema.safeParse(map({ imageAssetRef: undefined })).success,
    ).toBe(false);
    expect(
      campaignMapSchema.safeParse(map({ dimensions: { width: 0, height: 10 } }))
        .success,
    ).toBe(false);
  });

  it('keeps pins in normalized 0-1 coordinates with defaults', () => {
    const pin = mapPinSchema.parse({ id: 'p1', label: 'Docks', x: 0.25, y: 0.75 });
    expect(pin).toMatchObject({
      icon: 'map-pin',
      visibility: 'players',
      layerIds: [],
      linkedObjectRefs: [],
    });
    for (const bad of [{ x: 1.2, y: 0.5 }, { x: 0.5, y: -0.1 }]) {
      expect(
        mapPinSchema.safeParse({ id: 'p1', label: 'Docks', ...bad }).success,
      ).toBe(false);
    }
  });

  it('accepts pins that link campaign objects', () => {
    const parsed = campaignMapSchema.parse(
      map({
        pins: [
          {
            id: 'p1',
            label: 'Harbor Master',
            x: 0.4,
            y: 0.6,
            visibility: 'dm-only',
            linkedObjectRefs: [
              {
                target: 'campaign-object',
                campaignId: IDS.campaign,
                id: IDS.npc,
                revision: 2,
              },
            ],
          },
        ],
      }),
    );
    expect(parsed.pins[0].linkedObjectRefs).toHaveLength(1);
  });
});
