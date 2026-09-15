/**
 * @file devSeed.ts
 * @description Client for the DEV-ONLY seeding endpoints in server/routes/api.ts.
 *
 * Every route here is wrapped in `isDevToolsEnabled()` server-side
 * (ENABLE_DEV_TOOLS, default off) and is simply not registered when disabled,
 * so callers must ALSO gate their UI on `isDevToolsEnabled()` from
 * @/utils/devMode (VITE_ENABLE_DEV_TOOLS, default off) rather than relying on
 * the request failing.
 */

import type { Scene } from '@/types/game';

/** Scene payload from the server: `createScene()` injects the omitted fields. */
export type SeededScenePayload = Omit<
  Scene,
  'id' | 'createdAt' | 'updatedAt' | 'roomCode'
>;

export interface SeededCampaign {
  id: string;
  name: string;
  description: string | null;
  dmId: string;
  lastRoomCode?: string | null;
}

export interface SeededCharacter {
  id: string;
  name: string;
  ownerId: string;
  data: Record<string, unknown>;
}

export interface QuickStartSeed {
  campaign: SeededCampaign;
  character: SeededCharacter;
  scene: SeededScenePayload;
}

export interface ClearAllResult {
  success: boolean;
  deleted: { campaigns: number; characters: number };
  errors: string[];
}

/**
 * Shared POST helper.
 *
 * Checks `res.ok` on every call. The previous ad-hoc "Clear All" button omitted
 * this, so a 404 from a missing route looked like a successful no-op.
 */
async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const detail = await res
      .json()
      .then((b: { error?: string }) => b?.error)
      .catch(() => undefined);
    throw new Error(
      detail ?? `${url} failed (HTTP ${res.status})`,
    );
  }

  return (await res.json()) as T;
}

/** Seeds one campaign + one character and returns them with a scene payload. */
export async function quickStart(): Promise<QuickStartSeed> {
  return postJson<QuickStartSeed>('/api/dev/quick-start');
}

/** Bulk-seeds campaigns and characters onto the dashboard. */
export async function seedData(counts?: {
  campaigns?: number;
  characters?: number;
}): Promise<{
  campaigns: unknown[];
  characters: unknown[];
  errors: string[];
}> {
  return postJson('/api/dev/populate-mock-data', counts ?? {});
}

/** Deletes every campaign and character owned by the caller. */
export async function clearAll(): Promise<ClearAllResult> {
  return postJson<ClearAllResult>('/api/dev/clear-all');
}
