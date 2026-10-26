import { CreationDraft, CreatorPresentation } from '../types/draft';
import { CreationMode } from '../components/CharacterCreator';
import { creationDataToDraft } from '../adapters/draftAdapter';
import { CharacterCreationData } from '../types/dnd';
import type { CharacterCreationResult } from '../api/types';

export const CURRENT_DRAFT_VERSION = 1;

export interface DurableDraftRecord {
  pendingCompletion?: CharacterCreationResult;
  version: number;
  updatedAt: string;
  clientTabId?: string;
  mode?: CreationMode;
  step?: number;
  draft: CreationDraft;
  presentation?: CreatorPresentation;
}

export interface DraftRecordInput {
  pendingCompletion?: CharacterCreationResult;
  draft: CreationDraft;
  presentation?: CreatorPresentation;
  clientTabId?: string;
  updatedAt?: string;
}

export type DecodedDraftRecord =
  | { status: 'ok'; record: DurableDraftRecord }
  | { status: 'unsupported'; version: number; raw: string }
  | { status: 'invalid'; raw: string; message: string };

function isDraft(value: unknown): value is CreationDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<CreationDraft>;
  return (
    draft.draftVersion === 1 &&
    typeof draft.draftId === 'string' &&
    typeof draft.characterId === 'string' &&
    (draft.revision === undefined ||
      (Number.isSafeInteger(draft.revision) && draft.revision >= 0)) &&
    ['standard', 'point-buy', 'manual', 'preset'].includes(
      draft.abilityMethod || '',
    ) &&
    ['2014', '2024'].includes(draft.edition || '') &&
    Number.isInteger(draft.level) &&
    (draft.level || 0) >= 1 &&
    (draft.level || 0) <= 20 &&
    typeof draft.name === 'string' &&
    !!draft.rawAbilityScores &&
    ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].every((key) =>
      Number.isFinite(
        draft.rawAbilityScores?.[key as keyof typeof draft.rawAbilityScores],
      ),
    ) &&
    [
      draft.skills,
      draft.expertise,
      draft.languages,
      draft.toolProficiencies,
    ].every(
      (list) =>
        Array.isArray(list) && list.every((item) => typeof item === 'string'),
    ) &&
    !!draft.abilityBonuses?.bonuses &&
    !!draft.spells &&
    [
      draft.spells.cantrips,
      draft.spells.prepared,
      draft.spells.knownOrBook,
    ].every(
      (list) =>
        Array.isArray(list) && list.every((item) => typeof item === 'string'),
    ) &&
    !!draft.loadout &&
    Array.isArray(draft.loadout.items) &&
    draft.loadout.items.every(
      (item) =>
        item &&
        typeof item.id === 'string' &&
        typeof item.slug === 'string' &&
        typeof item.name === 'string' &&
        typeof item.equipped === 'boolean' &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        ['class', 'background', 'purchased', 'custom'].includes(item.source),
    ) &&
    !!draft.loadout.currency &&
    ['cp', 'sp', 'ep', 'gp', 'pp'].every((key) => {
      const amount =
        draft.loadout!.currency[key as keyof typeof draft.loadout.currency];
      return Number.isInteger(amount) && amount >= 0;
    }) &&
    Object.values(draft.loadout.currency).every(
      (amount) => Number.isInteger(amount) && amount >= 0,
    )
  );
}

export function encodeDraftRecord(input: DraftRecordInput): string {
  if (!isDraft(input.draft))
    throw new Error('Invalid character creation draft.');
  return JSON.stringify({
    ...input,
    version: CURRENT_DRAFT_VERSION,
    updatedAt: input.updatedAt || new Date().toISOString(),
  });
}

export function decodeDraftRecord(raw: string): DecodedDraftRecord {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object')
      throw new Error('Draft record must be an object.');
    const record = parsed as Partial<DurableDraftRecord>;
    if (record.pendingCompletion) {
      const completion = record.pendingCompletion;
      if (
        !completion.character ||
        typeof completion.character.id !== 'string' ||
        typeof completion.character.name !== 'string' ||
        !Number.isFinite(completion.character.hitPoints) ||
        !completion.creationData ||
        typeof completion.creationData.name !== 'string' ||
        !['2014', '2024'].includes(completion.edition)
      )
        throw new Error('Pending completion is invalid.');
    }
    const bareVersion = (parsed as Partial<CreationDraft>).draftVersion;
    if (typeof bareVersion === 'number' && bareVersion > 1)
      return { status: 'unsupported', version: bareVersion, raw };
    if (record.version !== undefined && !Number.isInteger(record.version))
      throw new Error('Draft envelope version is invalid.');
    if (
      record.presentation &&
      (!['full', 'guided'].includes(record.presentation.mode) ||
        (record.presentation.step !== undefined &&
          (!Number.isInteger(record.presentation.step) ||
            record.presentation.step < 0 ||
            record.presentation.step > 14)))
    )
      throw new Error('Draft presentation is invalid.');
    if (
      typeof record.version === 'number' &&
      record.version > CURRENT_DRAFT_VERSION
    )
      return { status: 'unsupported', version: record.version, raw };
    if (
      record.draft &&
      typeof record.draft.draftVersion === 'number' &&
      record.draft.draftVersion > 1
    )
      return { status: 'unsupported', version: record.draft.draftVersion, raw };
    const draft = isDraft(record.draft)
      ? record.draft
      : migrateDraft(record.draft || parsed);
    if (!draft || !isDraft(draft))
      throw new Error('Draft fields are missing or invalid.');
    return {
      status: 'ok',
      record: {
        ...record,
        version: CURRENT_DRAFT_VERSION,
        updatedAt: record.updatedAt || new Date().toISOString(),
        draft,
      },
    };
  } catch (error) {
    return {
      status: 'invalid',
      raw,
      message: error instanceof Error ? error.message : 'Invalid draft.',
    };
  }
}

/**
 * Creates a unique, collision-free storage key for local draft persistence (CC-501)
 */
export function createDraftStorageKey(host: string, playerId: string): string {
  return `nexus_draft:${encodeURIComponent(host)}:${encodeURIComponent(playerId)}`;
}

/**
 * Attempts to migrate an older or unversioned draft payload into a valid CreationDraft
 */
export function migrateDraft(raw: unknown): CreationDraft | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const obj = raw as Record<string, unknown>;

  // Check if it's already a CreationDraft
  if (isDraft(raw)) return raw;
  if ('draftVersion' in obj) return null;

  // Check if it's a legacy CharacterCreationData
  if ('classSlug' in obj || 'speciesSlug' in obj || 'abilityScores' in obj) {
    try {
      return creationDataToDraft(obj as unknown as CharacterCreationData, {
        provenance: 'imported',
      });
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Saves a draft to localStorage or provided Storage with tab metadata (CC-501)
 */
export function saveDraftToStorage(
  storageKey: string,
  draft: CreationDraft,
  options?: {
    mode?: CreationMode;
    step?: number;
    clientTabId?: string;
    storage?: Storage;
  },
): DurableDraftRecord | null {
  try {
    const storage =
      options?.storage ??
      (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!storage) return null;

    const record: DurableDraftRecord = {
      version: CURRENT_DRAFT_VERSION,
      updatedAt: new Date().toISOString(),
      clientTabId: options?.clientTabId,
      mode: options?.mode,
      step: options?.step,
      draft,
    };

    storage.setItem(storageKey, JSON.stringify(record));
    return record;
  } catch (err) {
    console.warn(`[draftStorage] Failed to save draft for ${storageKey}:`, err);
    return null;
  }
}

export interface LoadDraftResult {
  record: DurableDraftRecord;
  isConflict: boolean;
}

/**
 * Loads a draft from storage, checking for version migration and multi-tab conflicts (CC-501)
 */
export function loadDraftFromStorage(
  storageKey: string,
  options?: {
    clientTabId?: string;
    storage?: Storage;
  },
): LoadDraftResult | null {
  try {
    const storage =
      options?.storage ??
      (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!storage) return null;

    const raw = storage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;

    const parsedObj = parsed as Partial<DurableDraftRecord>;

    // Tab conflict detection: if a different tab updated this draft within the last 10 minutes
    let isConflict = false;
    if (
      options?.clientTabId &&
      parsedObj.clientTabId &&
      parsedObj.clientTabId !== options.clientTabId &&
      parsedObj.updatedAt
    ) {
      const updatedTime = new Date(parsedObj.updatedAt).getTime();
      const now = Date.now();
      if (now - updatedTime < 10 * 60 * 1000) {
        isConflict = true;
      }
    }

    if (parsedObj.draft && parsedObj.version === CURRENT_DRAFT_VERSION) {
      return {
        record: parsedObj as DurableDraftRecord,
        isConflict,
      };
    }

    // Try migration
    const migrated = migrateDraft(parsedObj.draft || parsed);
    if (!migrated) return null;

    return {
      record: {
        version: CURRENT_DRAFT_VERSION,
        updatedAt: parsedObj.updatedAt || new Date().toISOString(),
        clientTabId: parsedObj.clientTabId,
        mode: parsedObj.mode,
        step: parsedObj.step,
        draft: migrated,
      },
      isConflict,
    };
  } catch (err) {
    console.warn(`[draftStorage] Failed to load draft for ${storageKey}:`, err);
    return null;
  }
}

/**
 * Clears a stored draft (called upon successful character save or explicit discard)
 */
export function clearDraftFromStorage(
  storageKey: string,
  options?: { storage?: Storage },
): void {
  try {
    const storage =
      options?.storage ??
      (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!storage) return;
    storage.removeItem(storageKey);
  } catch (err) {
    console.warn(
      `[draftStorage] Failed to clear draft for ${storageKey}:`,
      err,
    );
  }
}
