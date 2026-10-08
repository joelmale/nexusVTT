import type { CampaignFixtureBundle } from '@/demo/fixture-registry';
import type { UserAsset } from '@/services/assets-api';

export interface AssetUsage {
  kind: 'map' | 'location';
  id: string;
  title: string;
  /** Section path under the campaign base. */
  section: 'maps' | 'world';
}

function fileName(path: string | undefined): string {
  return (path ?? '').split('?')[0]!.split('/').pop() ?? '';
}

function pointsAt(
  asset: Pick<UserAsset, 'fullImage'>,
  path: string | undefined,
): boolean {
  const file = fileName(asset.fullImage);
  return Boolean(file) && Boolean(path) && fileName(path) === file;
}

/**
 * Where an asset is used in this campaign: maps by asset id or image file, and
 * locations by image file. Computed from the loaded bundle, not the server.
 */
export function computeAssetUsage(
  bundle: Pick<CampaignFixtureBundle, 'maps' | 'locations'>,
  asset: Pick<UserAsset, 'id' | 'fullImage'>,
): AssetUsage[] {
  const usage: AssetUsage[] = [];
  for (const map of bundle.maps) {
    if (
      map.imageAssetRef?.assetId === asset.id ||
      pointsAt(asset, map.imagePath)
    ) {
      usage.push({ kind: 'map', id: map.id, title: map.title, section: 'maps' });
    }
  }
  for (const location of bundle.locations) {
    if (pointsAt(asset, location.imagePath)) {
      usage.push({
        kind: 'location',
        id: location.id,
        title: location.name,
        section: 'world',
      });
    }
  }
  return usage;
}
