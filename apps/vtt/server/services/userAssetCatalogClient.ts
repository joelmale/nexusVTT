export type UserAssetResolution = 'available' | 'missing' | 'unavailable';

interface UserAssetManifestResponse {
  assets?: unknown;
}

export class UserAssetCatalogClient {
  private readonly apiUrl: string;

  constructor(
    apiUrl: string,
    private readonly timeout = 3000,
  ) {
    this.apiUrl = apiUrl.replace(/\/$/, '');
  }

  async resolveAsset(
    userId: string,
    assetId: string,
  ): Promise<UserAssetResolution> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await fetch(
        `${this.apiUrl}/user/${encodeURIComponent(userId)}/assets`,
        { signal: controller.signal },
      );
      if (!response.ok) {
        return 'unavailable';
      }
      const body = (await response.json()) as UserAssetManifestResponse;
      if (!Array.isArray(body.assets)) {
        return 'unavailable';
      }
      const exists = body.assets.some(
        (asset) =>
          typeof asset === 'object' &&
          asset !== null &&
          'id' in asset &&
          asset.id === assetId,
      );
      return exists ? 'available' : 'missing';
    } catch {
      return 'unavailable';
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
