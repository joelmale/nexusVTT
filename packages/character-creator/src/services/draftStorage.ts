import { CreationDraft } from '../types/draft';
import { CreationMode } from '../components/CharacterCreator';
import { creationDataToDraft } from '../adapters/draftAdapter';
import { CharacterCreationData } from '../types/dnd';

export const CURRENT_DRAFT_VERSION = 1;

export interface DurableDraftRecord {
  version: number;
  updatedAt: string;
  clientTabId?: string;
  mode?: CreationMode;
  step?: number;
  draft: CreationDraft;
}

/**
 * Creates a unique, collision-free storage key for local draft persistence (CC-501)
 */
export function createDraftStorageKey(host: string, playerId: string): string {
  const sanitizedHost = host.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const sanitizedPlayer = playerId.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return `nexus_draft_${sanitizedHost}_${sanitizedPlayer}`;
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
  if (
    typeof obj.edition === 'string' &&
    typeof obj.level === 'number' &&
    obj.abilities &&
    obj.skills &&
    obj.spells &&
    obj.loadout
  ) {
    return obj as unknown as CreationDraft;
  }

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
  }
): DurableDraftRecord | null {
  try {
    const storage = options?.storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
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
  }
): LoadDraftResult | null {
  try {
    const storage = options?.storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
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
  options?: { storage?: Storage }
): void {
  try {
    const storage = options?.storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!storage) return;
    storage.removeItem(storageKey);
  } catch (err) {
    console.warn(`[draftStorage] Failed to clear draft for ${storageKey}:`, err);
  }
}
