/**
 * Resolves a revealed handout's asset id to a browser-loadable image path so
 * Simple Player Mode can show the handout itself, not just its title.
 *
 * The asset service's per-user listing is public and content-addressed image
 * paths are served from the origin root, so players can load the returned
 * path directly. Anything that isn't an image, or any lookup failure,
 * resolves to undefined and the reveal falls back to a title-only toast.
 */

export type HandoutUrlResolver = (
  ownerUserId: string,
  assetId: string,
) => Promise<string | undefined>;

const IMAGE_PATH = /\.(png|jpe?g|webp|gif|svg)$/i;
const SAFE_USER_ID = /^[a-zA-Z0-9-]+$/;
const LOOKUP_TIMEOUT_MS = 1500;

interface AssetListing {
  assets?: Array<{ id?: unknown; fullImage?: unknown }>;
}

export function createHandoutUrlResolver(
  assetApiUrl: string = process.env.ASSET_API_URL || 'http://localhost:5003',
  fetchImpl: typeof fetch = fetch,
): HandoutUrlResolver {
  return async (ownerUserId, assetId) => {
    if (!SAFE_USER_ID.test(ownerUserId)) return undefined;
    try {
      const response = await fetchImpl(
        `${assetApiUrl}/user/${encodeURIComponent(ownerUserId)}/assets`,
        { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) },
      );
      if (!response.ok) return undefined;
      const listing = (await response.json()) as AssetListing;
      const asset = listing.assets?.find((entry) => entry.id === assetId);
      const fullImage = asset?.fullImage;
      if (typeof fullImage !== 'string' || !IMAGE_PATH.test(fullImage)) {
        return undefined;
      }
      return `/${fullImage.replace(/^\/+/, '')}`;
    } catch {
      return undefined;
    }
  };
}
