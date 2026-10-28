import { describe, expect, it } from 'vitest';
import { computeAssetUsage } from './assetUsage';
import type { CampaignMap, CampaignLocation } from '@/demo/fixture-registry';

describe('computeAssetUsage', () => {
  it('computes usage across maps and locations matching asset id or image filename', () => {
    const mockMaps: Partial<CampaignMap>[] = [
      {
        id: 'map-1',
        title: 'Wave Echo Cave',
        imageAssetRef: { assetId: 'asset-123' },
      },
      {
        id: 'map-2',
        title: 'Cragmaw Hideout',
        imagePath: '/uploads/cragmaw.png?v=1',
      },
    ];

    const mockLocations: Partial<CampaignLocation>[] = [
      {
        id: 'loc-1',
        name: 'Hideout Entrance',
        imagePath: '/images/cragmaw.png',
      },
      {
        id: 'loc-2',
        name: 'Town Square',
        imagePath: '/images/phandalin.png',
      },
    ];

    const asset1 = { id: 'asset-123', fullImage: '/assets/cave.png' };
    const usage1 = computeAssetUsage(
      { maps: mockMaps as CampaignMap[], locations: mockLocations as CampaignLocation[] },
      asset1,
    );
    expect(usage1).toEqual([
      { kind: 'map', id: 'map-1', title: 'Wave Echo Cave', section: 'maps' },
    ]);

    const asset2 = { id: 'asset-456', fullImage: '/uploads/cragmaw.png' };
    const usage2 = computeAssetUsage(
      { maps: mockMaps as CampaignMap[], locations: mockLocations as CampaignLocation[] },
      asset2,
    );
    expect(usage2).toEqual([
      { kind: 'map', id: 'map-2', title: 'Cragmaw Hideout', section: 'maps' },
      { kind: 'location', id: 'loc-1', title: 'Hideout Entrance', section: 'world' },
    ]);
  });
});
