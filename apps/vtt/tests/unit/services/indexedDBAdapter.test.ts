import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  IndexedDBAdapter,
  createIndexedDBAdapter,
} from '@/services/indexedDBAdapter';

describe('IndexedDBAdapter', () => {
  let adapter: IndexedDBAdapter;
  const testDbName = 'nexus-test-db';

  beforeEach(async () => {
    adapter = createIndexedDBAdapter({
      dbName: `${testDbName}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      version: 1,
    });
  });

  afterEach(async () => {
    if (adapter) {
      try {
        await adapter.destroy();
      } catch {
        // Ignore destroy error on cleanup
      }
    }
  });

  it('saves and loads data in default gameState store', async () => {
    const data = { roomId: 'room-123', scene: 'dungeon', tokens: [1, 2, 3] };
    await adapter.save('current-state', data);

    const loaded = await adapter.load<typeof data>('current-state');
    expect(loaded).toEqual(data);
  });

  it('returns null when loading non-existent key', async () => {
    const loaded = await adapter.load('missing-key');
    expect(loaded).toBeNull();
  });

  it('saves and loads in custom configured store (metadata)', async () => {
    const meta = { author: 'DM', lastSync: 12345678 };
    await adapter.save('meta-1', meta, 'metadata');

    const loaded = await adapter.load<typeof meta>('meta-1', 'metadata');
    expect(loaded).toEqual(meta);
  });

  it('deletes data by key', async () => {
    await adapter.save('to-delete', { val: 'delete-me' });
    expect(await adapter.exists('to-delete')).toBe(true);

    await adapter.delete('to-delete');
    expect(await adapter.exists('to-delete')).toBe(false);
    expect(await adapter.load('to-delete')).toBeNull();
  });

  it('clears all data in the store', async () => {
    await adapter.save('item-1', { a: 1 });
    await adapter.save('item-2', { b: 2 });
    expect(await adapter.size()).toBe(2);

    await adapter.clear();
    expect(await adapter.size()).toBe(0);
    expect(await adapter.keys()).toEqual([]);
  });

  it('handles batch save and load operations', async () => {
    const batchItems = [
      { key: 'k1', data: { name: 'Item 1' } },
      { key: 'k2', data: { name: 'Item 2' } },
      { key: 'k3', data: { name: 'Item 3' } },
    ];

    await adapter.saveBatch(batchItems);
    expect(await adapter.size()).toBe(3);

    const loaded = await adapter.loadBatch<{ name: string }>(['k1', 'k2', 'k3', 'k4']);
    expect(loaded).toHaveLength(4);
    expect(loaded[0]).toEqual({ name: 'Item 1' });
    expect(loaded[1]).toEqual({ name: 'Item 2' });
    expect(loaded[2]).toEqual({ name: 'Item 3' });
    expect(loaded[3]).toBeNull();

    // Empty batch operations should resolve cleanly
    await expect(adapter.saveBatch([])).resolves.not.toThrow();
    const emptyLoad = await adapter.loadBatch([]);
    expect(emptyLoad).toEqual([]);
  });

  it('verifies exists, size, and keys query helpers', async () => {
    expect(await adapter.exists('any-key')).toBe(false);
    expect(await adapter.size()).toBe(0);
    expect(await adapter.keys()).toEqual([]);

    await adapter.save('alpha', 100);
    await adapter.save('beta', 200);

    expect(await adapter.exists('alpha')).toBe(true);
    expect(await adapter.exists('gamma')).toBe(false);
    expect(await adapter.size()).toBe(2);

    const keys = await adapter.keys();
    expect(keys).toContain('alpha');
    expect(keys).toContain('beta');
  });

  it('exports and imports data', async () => {
    await adapter.save('user_prefs', { theme: 'dark', grid: true });
    await adapter.save('session_info', { id: 's1' });

    const exported = await adapter.exportData();
    expect(exported).toEqual({
      user_prefs: { theme: 'dark', grid: true },
      session_info: { id: 's1' },
    });

    await adapter.clear();
    expect(await adapter.size()).toBe(0);

    await adapter.importData(exported);
    expect(await adapter.size()).toBe(2);
    expect(await adapter.load('user_prefs')).toEqual({ theme: 'dark', grid: true });
  });

  it('vacuums storage by exporting, clearing, and re-importing', async () => {
    await adapter.save('persist-me', { counter: 42 });
    await adapter.vacuum();

    expect(await adapter.size()).toBe(1);
    expect(await adapter.load('persist-me')).toEqual({ counter: 42 });
  });

  it('closes and reopens database connection', async () => {
    await adapter.save('before-close', 'hello');
    await adapter.close();

    // Next operation should reopen database connection transparently
    const loaded = await adapter.load<string>('before-close');
    expect(loaded).toBe('hello');
  });

  it('destroys the database completely', async () => {
    const dbName = `destroy-test-${Date.now()}`;
    const customAdapter = createIndexedDBAdapter({ dbName });

    await customAdapter.save('temp', 123);
    await customAdapter.destroy();

    // Recreate adapter with same dbName and verify empty
    const freshAdapter = createIndexedDBAdapter({ dbName });
    expect(await freshAdapter.size()).toBe(0);
    await freshAdapter.destroy();
  });
});
