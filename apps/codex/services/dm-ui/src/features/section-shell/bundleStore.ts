import type { CampaignFixtureBundle } from '@/demo/fixture-registry';
import type { CampaignSummary } from '@/services/campaign-api';

export type SaveState = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';
export type EditableKind =
  | 'npc'
  | 'faction'
  | 'quest'
  | 'location'
  | 'note'
  | 'handout'
  | 'handout-folder';

export interface SaveResult {
  ok: boolean;
  conflict?: boolean;
  error?: string;
}

/**
 * The seam between section pages and their data. Fixtures get a read-only
 * store; real campaigns get a server-backed one (see `ServerBundleBackend`).
 */
export interface BundleStore {
  bundle: CampaignFixtureBundle;
  status: 'loading' | 'ready' | 'error';
  /** False for fixtures, catalog-only bundles, and users without permission. */
  editable: boolean;
  reload(): Promise<void>;
  /** `patch` is the section's entity shape (`Partial<CampaignNpc>`, ...). */
  updateItem(
    kind: EditableKind,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<SaveResult>;
  addItem(
    kind: EditableKind,
    draft: Record<string, unknown>,
  ): Promise<SaveResult & { id?: string }>;
  /** Persist a new note order (whole board or a filtered subset). */
  reorderNotes(orderedIds: string[]): Promise<SaveResult>;
}

export const READ_ONLY_ERROR = 'read-only';

/** Store for fixtures and any bundle nobody can write to. */
export function createReadOnlyStore(
  bundle: CampaignFixtureBundle,
): BundleStore {
  return {
    bundle,
    status: 'ready',
    editable: false,
    reload: () => Promise.resolve(),
    updateItem: () => Promise.resolve({ ok: false, error: READ_ONLY_ERROR }),
    addItem: () => Promise.resolve({ ok: false, error: READ_ONLY_ERROR }),
    reorderNotes: () => Promise.resolve({ ok: false, error: READ_ONLY_ERROR }),
  };
}

/**
 * What the server-backed implementation must provide for one campaign.
 * Implemented by `services/campaign-bundle-api.ts` (task T-S). Results may
 * carry the refreshed `bundle`; when they do not, `useBundleStore` reloads.
 */
export interface ServerBundleStoreController {
  /** Fetch the campaign's current bundle (`source: 'server'`). */
  load(): Promise<CampaignFixtureBundle>;
  updateItem(
    kind: EditableKind,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<SaveResult & { bundle?: CampaignFixtureBundle }>;
  addItem(
    kind: EditableKind,
    draft: Record<string, unknown>,
  ): Promise<SaveResult & { id?: string; bundle?: CampaignFixtureBundle }>;
  reorderNotes?(
    orderedIds: string[],
  ): Promise<SaveResult & { bundle?: CampaignFixtureBundle }>;
  /** False when the current user may only read. Defaults to true. */
  canEdit?: boolean;
}

export interface ServerBundleBackend {
  createServerBundleStore(
    campaign: CampaignSummary,
  ): ServerBundleStoreController;
  /** Create a new real campaign seeded from a fixture; resolves its id. */
  seedFromFixture(slug: string): Promise<string>;
}
