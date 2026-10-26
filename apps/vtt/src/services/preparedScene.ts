import type { SceneTemplate } from '@nexus/game-contracts';

interface PreparedScene {
  template: SceneTemplate;
  image: { url: string; width: number; height: number };
}

/** Resolve the published revision and its actual map; missing assets stop activation. */
export async function loadPreparedScene(
  campaignId: string,
  templateId: string,
  revision: number,
  userId: string,
): Promise<PreparedScene> {
  const response = await fetch(
    `/api/campaigns/${encodeURIComponent(campaignId)}/prep/objects/${encodeURIComponent(templateId)}?revision=${revision}`,
    { credentials: 'include' },
  );
  if (!response.ok)
    throw new Error(
      'The published scene revision is unavailable. Restore it before activating this step.',
    );
  const body = (await response.json()) as {
    revision?: { data?: SceneTemplate };
  };
  const template = body.revision?.data;
  const assetId = template?.backgroundAssetRef?.assetId;
  if (!template || !assetId)
    throw new Error('The published scene has no map asset.');
  if (assetId === 'glass-harbor-map' || assetId === 'demo-glass-harbor-map')
    return {
      template,
      image: {
        url: '/demo/ashes-of-veyra/glass-harbor-map.png',
        width: 1586,
        height: 992,
      },
    };
  if (/^https?:\/\//.test(assetId) || assetId.startsWith('/'))
    return { template, image: { url: assetId, width: 1920, height: 1080 } };
  const listing = await fetch(
    `/api/user/${encodeURIComponent(userId)}/assets`,
    { credentials: 'include' },
  );
  if (!listing.ok)
    throw new Error(
      'Could not load the scene map assets. Check your connection and retry.',
    );
  const assets = (await listing.json()) as {
    assets?: Array<{
      id: string;
      fullImage?: string;
      dimensions?: { width: number; height: number };
    }>;
  };
  const asset = assets.assets?.find((entry) => entry.id === assetId);
  if (asset?.fullImage)
    return {
      template,
      image: {
        url: `/${asset.fullImage.replace(/^\/+/, '')}`,
        width: asset.dimensions?.width || 1920,
        height: asset.dimensions?.height || 1080,
      },
    };
  const { assetManager } = await import('@/services/assetManager');
  const bundled = (await assetManager.loadAssetManifest()).assets.find(
    (entry) => entry.id === assetId,
  );
  if (bundled)
    return {
      template,
      image: {
        url: assetManager.getFullImageUrl(bundled),
        width: bundled.dimensions?.width || 1920,
        height: bundled.dimensions?.height || 1080,
      },
    };
  throw new Error(
    'The published scene map is missing. Restore the asset before activating this step.',
  );
}
