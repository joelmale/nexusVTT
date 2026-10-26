import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Character } from '../../types/dnd';
import { IndexedDbAdapter } from './IndexedDbAdapter';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('Forge creation recovery storage', () => {
  it('upgrades an existing character database without changing saved play state', async () => {
    const original = {
      id: 'existing',
      name: 'Original',
      edition: '2014',
      hitPoints: 3,
      resources: [{ currentUses: 0 }],
    };
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('NexusForge', 13);
      request.onupgradeneeded = () =>
        request.result
          .createObjectStore('characters', { keyPath: 'id' })
          .put(original);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
    });
    const storage = new IndexedDbAdapter();
    await storage.saveCreatorDraft(
      { id: 'draft', value: 'recoverable', revision: 1, clientTabId: 'tab-a' },
      0,
    );
    expect(await storage.getCreatorDraft('draft')).toMatchObject({
      value: 'recoverable',
      revision: 1,
    });
    expect(await storage.getAllCharacters()).toEqual([original]);
  });

  it('rejects concurrent/stale updates and deletion without overwriting the winner', async () => {
    const storage = new IndexedDbAdapter();
    const a = { id: 'draft', value: 'a', revision: 1, clientTabId: 'a' };
    const results = await Promise.allSettled([
      storage.saveCreatorDraft(a, 0),
      storage.saveCreatorDraft({ ...a, value: 'b', clientTabId: 'b' }, 0),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const saved = await storage.getCreatorDraft('draft');
    expect(saved?.revision).toBe(1);
    await expect(storage.deleteCreatorDraft('draft', 0)).rejects.toThrow(
      'another tab',
    );
    expect(await storage.getCreatorDraft('draft')).toEqual(saved);
    await storage.deleteCreatorDraft('draft', 1);
    expect(await storage.getCreatorDraft('draft')).toBeUndefined();
  });

  it('retries the same saved character identity without adding a second copy', async () => {
    const storage = new IndexedDbAdapter();
    const character = {
      id: 'same-attempt',
      name: 'Retry',
      edition: '2014',
      hitPoints: 4,
    } as Character;
    await storage.addCharacter(character);
    await storage.addCharacter(character);
    expect(await storage.getAllCharacters()).toEqual([character]);
  });
});
