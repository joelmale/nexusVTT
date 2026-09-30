import type {
  CampaignFixtureBundle,
  CampaignHandout,
  FolderRecord,
  HandoutAudience,
} from '@/demo/fixture-registry';

export const UNFILED_ID = '__unfiled__';

export type AudienceMode = 'hidden' | 'all' | 'selected';

export function handoutFolders(
  bundle: Pick<CampaignFixtureBundle, 'folders'>,
): FolderRecord[] {
  return bundle.folders
    .filter((folder) => folder.kind === 'handout-folder')
    .map((folder, index) => ({ folder, index }))
    .sort(
      (a, b) =>
        (a.folder.order ?? 0) - (b.folder.order ?? 0) || a.index - b.index,
    )
    .map((entry) => entry.folder);
}

export function playerHandouts(
  bundle: Pick<CampaignFixtureBundle, 'handouts'>,
): CampaignHandout[] {
  return bundle.handouts.filter((handout) => handout.kind === 'handout');
}

export function handoutBody(handout: CampaignHandout): string {
  return handout.body ?? handout.content.join('\n\n');
}

export interface HandoutGroup {
  /** Folder id, or `UNFILED_ID`. */
  id: string;
  folder?: FolderRecord;
  label: string;
  items: CampaignHandout[];
}

function sortHandouts(items: CampaignHandout[]): CampaignHandout[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) => (a.item.order ?? 0) - (b.item.order ?? 0) || a.index - b.index,
    )
    .map((entry) => entry.item);
}

/**
 * Handouts grouped by folder, folders by order. Handouts whose folder is
 * missing fall into "Unfiled", listed last (and shown when non-empty, or when
 * there are no folders at all).
 */
export function buildHandoutGroups(
  bundle: Pick<CampaignFixtureBundle, 'folders' | 'handouts'>,
  search = '',
): HandoutGroup[] {
  const folders = handoutFolders(bundle);
  const needle = search.trim().toLowerCase();
  const handouts = playerHandouts(bundle).filter(
    (handout) =>
      !needle ||
      handout.title.toLowerCase().includes(needle) ||
      handoutBody(handout).toLowerCase().includes(needle),
  );
  const known = new Set(folders.map((folder) => folder.id));
  const groups: HandoutGroup[] = folders.map((folder) => ({
    id: folder.id,
    folder,
    label: folder.title,
    items: sortHandouts(
      handouts.filter((handout) => handout.folderId === folder.id),
    ),
  }));
  const unfiled = sortHandouts(
    handouts.filter(
      (handout) => !handout.folderId || !known.has(handout.folderId),
    ),
  );
  if (unfiled.length > 0 || groups.length === 0) {
    groups.push({ id: UNFILED_ID, label: 'Unfiled', items: unfiled });
  }
  return groups;
}

export interface OrderPatch {
  id: string;
  order: number;
}

/**
 * Move a handout by `delta` places inside its group and return the patches
 * that renumber the group 0..n-1 (changed items only). Renumbering makes ties
 * (every order 0) resolvable.
 */
export function moveHandoutPatches(
  items: readonly CampaignHandout[],
  id: string,
  delta: number,
): OrderPatch[] {
  const from = items.findIndex((item) => item.id === id);
  if (from < 0) return [];
  const to = Math.max(0, Math.min(items.length - 1, from + delta));
  if (to === from) return [];
  const ids = items.map((item) => item.id);
  ids.splice(from, 1);
  ids.splice(to, 0, id);
  const current = new Map(items.map((item) => [item.id, item.order ?? 0]));
  return ids
    .map((itemId, order) => ({ id: itemId, order }))
    .filter((patch) => current.get(patch.id) !== patch.order);
}

export function nextHandoutOrder(items: readonly CampaignHandout[]): number {
  return items.reduce((max, item) => Math.max(max, item.order ?? 0), -1) + 1;
}

export function nextFolderOrder(folders: readonly FolderRecord[]): number {
  return (
    folders.reduce((max, folder) => Math.max(max, folder.order ?? 0), -1) + 1
  );
}

export function audienceMode(
  audience: HandoutAudience | undefined,
): AudienceMode {
  if (audience === 'all') return 'all';
  if (Array.isArray(audience)) return 'selected';
  return 'hidden';
}

export function audienceIds(audience: HandoutAudience | undefined): string[] {
  return Array.isArray(audience) ? audience : [];
}

export function buildAudience(
  mode: AudienceMode,
  ids: string[],
): HandoutAudience {
  if (mode === 'all') return 'all';
  if (mode === 'selected') return ids;
  return 'hidden';
}

export function audienceSummary(
  audience: HandoutAudience | undefined,
  characters: ReadonlyArray<{ id: string; name: string }>,
): string {
  const mode = audienceMode(audience);
  if (mode === 'all') return 'Shared with all players';
  const ids = audienceIds(audience);
  if (mode === 'hidden' || ids.length === 0) return 'Hidden from players';
  const names = ids.map(
    (id) => characters.find((character) => character.id === id)?.name ?? id,
  );
  return `Shared with ${names.join(', ')}`;
}

export type LoreTab = 'notes' | 'handouts';

/**
 * Route `lore/:tab?/:itemId?`. An unknown `tab` is a legacy `/lore/<id>` link:
 * a handout id opens Handouts, anything else falls back to Notes (selecting a
 * note when the id matches one).
 */
export function resolveLoreRoute(
  tab: string | undefined,
  itemId: string | undefined,
  bundle: Pick<CampaignFixtureBundle, 'handouts' | 'notes'>,
): { tab: LoreTab; itemId?: string } {
  if (tab === 'notes' || tab === 'handouts') return { tab, itemId };
  if (tab) {
    if (bundle.handouts.some((handout) => handout.id === tab)) {
      return { tab: 'handouts', itemId: tab };
    }
    if (bundle.notes.some((note) => note.id === tab)) {
      return { tab: 'notes', itemId: tab };
    }
  }
  return { tab: 'notes' };
}
