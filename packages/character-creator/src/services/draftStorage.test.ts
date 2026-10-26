import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDraftStorageKey,
  saveDraftToStorage,
  loadDraftFromStorage,
  clearDraftFromStorage,
  migrateDraft,
  CURRENT_DRAFT_VERSION,
  decodeDraftRecord,
  encodeDraftRecord,
} from './draftStorage';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';
import { creationDataToDraft } from '../adapters/draftAdapter';

describe('draftStorage (CC-501)', () => {
  let mockStorage: Record<string, string>;
  let fakeStorage: Storage;

  beforeEach(() => {
    mockStorage = {};
    fakeStorage = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
      key: (idx: number) => Object.keys(mockStorage)[idx] ?? null,
      length: 0,
    };
  });

  it('generates stable keys without colliding punctuation or identity case', () => {
    const key = createDraftStorageKey('Nexus-VTT!', 'User_123$');
    expect(key).toBe(createDraftStorageKey('Nexus-VTT!', 'User_123$'));
    expect(key).not.toBe(createDraftStorageKey('nexus-vtt', 'user_123'));
    expect(createDraftStorageKey('a:b', 'c')).not.toBe(
      createDraftStorageKey('a', 'b:c'),
    );
  });

  it('retains unsupported future envelopes and bare drafts for recovery', () => {
    const draft = creationDataToDraft(REFERENCE_BUILDS.F24.creationData);
    const future = JSON.stringify({ version: 99, draft });
    expect(decodeDraftRecord(future)).toEqual({
      status: 'unsupported',
      version: 99,
      raw: future,
    });
    expect(
      decodeDraftRecord(JSON.stringify({ ...draft, draftVersion: 2 })).status,
    ).toBe('unsupported');
  });

  it('rejects corrupt nested inventory and presentation without replacing the original bytes', () => {
    const draft = creationDataToDraft(REFERENCE_BUILDS.F24.creationData);
    const corrupt = JSON.stringify({
      version: 1,
      draft: { ...draft, loadout: { ...draft.loadout, items: [null] } },
    });
    expect(decodeDraftRecord(corrupt)).toMatchObject({
      status: 'invalid',
      raw: corrupt,
    });
    const missingCoins = JSON.stringify({
      version: 1,
      draft: { ...draft, loadout: { ...draft.loadout, currency: {} } },
    });
    expect(decodeDraftRecord(missingCoins).status).toBe('invalid');
    const encoded = encodeDraftRecord({
      draft,
      presentation: { mode: 'full', step: 3 },
    });
    expect(decodeDraftRecord(encoded).status).toBe('ok');
    expect(
      decodeDraftRecord(encoded.replace('"step":3', '"step":-1')).status,
    ).toBe('invalid');
  });

  it('saves and loads a draft successfully', () => {
    const draft = creationDataToDraft(REFERENCE_BUILDS.F14.creationData);
    const key = createDraftStorageKey('vtt', 'player1');

    const saved = saveDraftToStorage(key, draft, {
      clientTabId: 'tab-A',
      mode: 'guided',
      step: 2,
      storage: fakeStorage,
    });
    expect(saved).not.toBeNull();
    expect(saved?.version).toBe(CURRENT_DRAFT_VERSION);

    const loaded = loadDraftFromStorage(key, {
      clientTabId: 'tab-A',
      storage: fakeStorage,
    });
    expect(loaded).not.toBeNull();
    expect(loaded?.isConflict).toBe(false);
    expect(loaded?.record.draft.classSlug).toBe('fighter');
    expect(loaded?.record.mode).toBe('guided');
    expect(loaded?.record.step).toBe(2);
  });

  it('detects tab conflicts when another tab updated recently', () => {
    const draft = creationDataToDraft(REFERENCE_BUILDS.F24.creationData);
    const key = createDraftStorageKey('vtt', 'player1');

    saveDraftToStorage(key, draft, {
      clientTabId: 'tab-A',
      storage: fakeStorage,
    });

    const loadedFromTabB = loadDraftFromStorage(key, {
      clientTabId: 'tab-B',
      storage: fakeStorage,
    });

    expect(loadedFromTabB?.isConflict).toBe(true);
  });

  it('clears draft from storage upon completion or discard', () => {
    const draft = creationDataToDraft(REFERENCE_BUILDS.R14.creationData);
    const key = createDraftStorageKey('vtt', 'player1');

    saveDraftToStorage(key, draft, { storage: fakeStorage });
    expect(fakeStorage.getItem(key)).not.toBeNull();

    clearDraftFromStorage(key, { storage: fakeStorage });
    expect(fakeStorage.getItem(key)).toBeNull();
  });

  it('migrates legacy CharacterCreationData format to CreationDraft', () => {
    const legacy = REFERENCE_BUILDS.W24.creationData;
    const migrated = migrateDraft(legacy);

    expect(migrated).not.toBeNull();
    expect(migrated?.classSlug).toBe('wizard');
    expect(migrated?.edition).toBe('2024');
  });
});
