import {
  ensureSession,
  mapImageProblem,
  uploadAsset,
  type UserAsset,
} from './campaign-prep-api';

export type { UserAsset };

/** A non-archived campaign object that still points at an asset. */
export interface AssetReference {
  campaignId: string;
  campaignName: string;
  objectId: string;
  kind: string;
  title: string;
}

export type DeleteAssetResult =
  | { ok: true }
  | { ok: false; references: AssetReference[]; error?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function errorFrom(body: unknown, status: number): string {
  return isRecord(body) && typeof body.error === 'string'
    ? body.error
    : `Request failed with status ${status}`;
}

async function userAssetUrl(assetId?: string): Promise<string> {
  const profile = await ensureSession();
  const base = `/api/user/${encodeURIComponent(profile.id)}`;
  return assetId ? `${base}/asset/${encodeURIComponent(assetId)}` : base;
}

/** Path the browser loads an asset's image from (served at the origin root). */
export function assetImageUrl(asset: Pick<UserAsset, 'fullImage'>): string {
  return asset.fullImage ? `/${asset.fullImage.replace(/^\/+/, '')}` : '';
}

export function isImageAsset(asset: Pick<UserAsset, 'fullImage'>): boolean {
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(asset.fullImage ?? '');
}

/** The signed-in user's assets, newest first when timestamps exist. */
export async function listAssets(): Promise<UserAsset[]> {
  const url = `${await userAssetUrl()}/assets`;
  // The asset service marks listings cacheable; a stale list would hide a
  // fresh upload or rename.
  const response = await fetch(url, {
    credentials: 'include',
    cache: 'no-store',
  });
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) throw new Error(errorFrom(body, response.status));
  const assets =
    isRecord(body) && Array.isArray(body.assets)
      ? (body.assets as UserAsset[])
      : [];
  return [...assets].sort((a, b) =>
    (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
  );
}

/** Uploads an image; validates type and size like the map upload does. */
export async function uploadAssetFile(
  file: File,
  category: string,
  name = file.name,
): Promise<UserAsset> {
  const problem = mapImageProblem(file);
  if (problem) throw new Error(problem);
  const profile = await ensureSession();
  return uploadAsset(profile.id, name, file, file.name, category);
}

export async function updateAsset(
  assetId: string,
  patch: { name?: string; tags?: string[] },
): Promise<UserAsset> {
  const response = await fetch(await userAssetUrl(assetId), {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok || !isRecord(body) || !isRecord(body.asset)) {
    throw new Error(errorFrom(body, response.status));
  }
  return body.asset as unknown as UserAsset;
}

/**
 * Hard-deletes an asset. The server answers 409 with the campaign objects that
 * still use it; that is a result, not an error.
 */
export async function deleteAsset(assetId: string): Promise<DeleteAssetResult> {
  const response = await fetch(await userAssetUrl(assetId), {
    method: 'DELETE',
    credentials: 'include',
  });
  const body = (await response.json().catch(() => null)) as unknown;
  if (response.status === 409) {
    return {
      ok: false,
      error: errorFrom(body, 409),
      references:
        isRecord(body) && Array.isArray(body.references)
          ? (body.references as AssetReference[])
          : [],
    };
  }
  if (!response.ok) throw new Error(errorFrom(body, response.status));
  return { ok: true };
}
