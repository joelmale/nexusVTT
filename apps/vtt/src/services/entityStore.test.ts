/**
 * @file src/services/entityStore.test.ts
 * @description Characterization tests for EntityStore, with the emphasis on the
 * durability path: the "throttled" save, forceSave, the IndexedDB round-trip
 * and backup import/export.
 *
 * IMPORTANT: like `serialization.test.ts`, these tests describe what the code
 * does *today*, not what its names and doc comments promise. Three behaviours
 * asserted below are almost certainly bugs and are marked `BUG:` so a fix shows
 * up here as a failure rather than a silent change:
 *
 *   1. `scheduleThrottledSave()` is a *debounce*, not a throttle. A steady
 *      stream of mutations closer together than 2s postpones the write
 *      indefinitely, so a tab close loses everything.
 *   2. `importBackup()` never calls `markDirty()`, so its `saveToStorage()`
 *      early-returns whenever the store happened to be clean — the imported
 *      data is only in memory and is lost on reload.
 *   3. `create()` spreads caller data *after* the generated `id`/`type`, so a
 *      payload carrying its own `type` (every `Drawing` does) overwrites the
 *      entity type while the index is still keyed by the `type` argument.
 *      `createScene()` therefore produces drawings that
 *      `getSceneWithRelations()` cannot find.
 *
 * Tests never touch the `getEntityStore()` singleton; each constructs
 * `new EntityStore(<unique db name>)` so no state bleeds between tests.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type MockInstance,
} from 'vitest';
import {
  EntityStore,
  type Entity,
  type Relationship,
} from '@/services/entityStore';
import { SerializationService } from '@/services/serialization';
import { createIndexedDBAdapter } from '@/services/indexedDBAdapter';
import type { StorageAdapter } from '@/types/hybrid';
import type { Scene } from '@/types/game';
import type { PlacedToken } from '@/types/token';
import { defaultDrawingStyle, type PencilDrawing } from '@/types/drawing';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let dbCounter = 0;
/** Unique IndexedDB name per store so tests cannot observe each other. */
function uniqueDbName(): string {
  dbCounter += 1;
  return `entity-store-test-${Date.now()}-${dbCounter}`;
}

/** In-memory StorageAdapter; every method is a spy so writes can be counted. */
interface FakeAdapter extends StorageAdapter {
  store: Map<string, unknown>;
}

function createFakeAdapter(): FakeAdapter {
  const store = new Map<string, unknown>();
  return {
    store,
    save: vi.fn(async (key: string, data: unknown): Promise<void> => {
      store.set(key, data);
    }),
    // `vi.fn` cannot express a generic signature, so the two generic members
    // of StorageAdapter are cast back to their declared shape.
    load: vi.fn(async (key: string) =>
      store.has(key) ? store.get(key) : null,
    ) as StorageAdapter['load'],
    delete: vi.fn(async (key: string): Promise<void> => {
      store.delete(key);
    }),
    clear: vi.fn(async (): Promise<void> => {
      store.clear();
    }),
    saveBatch: vi.fn(
      async (items: Array<{ key: string; data: unknown }>): Promise<void> => {
        items.forEach(({ key, data }) => store.set(key, data));
      },
    ),
    loadBatch: vi.fn(async (keys: string[]) =>
      keys.map((key) => (store.has(key) ? store.get(key) : null)),
    ) as StorageAdapter['loadBatch'],
    exists: vi.fn(async (key: string): Promise<boolean> => store.has(key)),
    size: vi.fn(async (): Promise<number> => store.size),
    keys: vi.fn(async (): Promise<string[]> => Array.from(store.keys())),
  };
}

/**
 * Private surface of EntityStore that these tests need. Injecting a fake
 * adapter keeps the save path free of real async I/O (which matters once fake
 * timers are installed), and reading `state.indexes` is the only way to prove
 * the index Sets are rehydrated as Sets. Deliberately a narrow cast rather
 * than a production change.
 */
interface EntityStoreInternals {
  storage: StorageAdapter;
  isDirty: boolean;
  saveTimer: ReturnType<typeof setTimeout> | null;
  state: {
    entities: Map<string, Entity>;
    relationships: Map<string, Relationship>;
    indexes: Map<string, Set<string>>;
    lastSaved: number;
    version: number;
  };
  loadFromStorage: () => Promise<void>;
}

function internals(store: EntityStore): EntityStoreInternals {
  return store as unknown as EntityStoreInternals;
}

/**
 * Swap in a plain `StorageAdapter`.
 *
 * CAVEAT: the injected surface is deliberately narrower than production's
 * `SerializingIndexedDBAdapter` -- it is the bare `StorageAdapter` interface,
 * without the optional `exportData`/`importData` members that the serializing
 * wrapper adds. Nothing EntityStore calls today needs them, but if EntityStore
 * ever starts using a wrapper-only method, the failure here will be a confusing
 * "not a function" rather than a meaningful assertion. Widen this to a stub of
 * `SerializingIndexedDBAdapter` if that happens.
 */
function injectAdapter(store: EntityStore, adapter: StorageAdapter): void {
  internals(store).storage = adapter;
}

/**
 * Every store built by `createSettledStore`, so `afterEach` can cancel the
 * pending 2000ms save timer each one may be holding.
 *
 * Without this, suites that do not install fake timers leak a real
 * `setTimeout` per mutation; it fires about a second after the file finishes and
 * writes into a torn-down fake-indexeddb and into restored console spies.
 */
const liveStores: EntityStore[] = [];

/** Cancel any pending save timer so nothing fires after teardown. */
function cancelPendingSaves(): void {
  for (const store of liveStores.splice(0)) {
    const timer = internals(store).saveTimer;
    if (timer) clearTimeout(timer);
    internals(store).saveTimer = null;
  }
}

/**
 * Construct a store and wait for its initial load.
 *
 * The EntityStore constructor kicks off an un-awaited `initialize()`, so a
 * freshly constructed store is not settled when the constructor returns. The
 * only externally visible completion signal is the log line at the end of
 * `initialize()`, so wait for that.
 */
async function createSettledStore(
  dbName: string,
  logSpy: MockInstance,
): Promise<EntityStore> {
  const before = logSpy.mock.calls.length;
  const store = new EntityStore(dbName);
  liveStores.push(store);
  await vi.waitFor(
    () => {
      const settled = logSpy.mock.calls
        .slice(before)
        .some(
          (call) =>
            typeof call[0] === 'string' &&
            call[0].includes('store initialized with'),
        );
      expect(settled).toBe(true);
    },
    { timeout: 5000, interval: 5 },
  );
  return store;
}

function makeSceneData(
  overrides: Partial<Omit<Scene, 'id' | 'createdAt' | 'updatedAt'>> = {},
): Omit<Scene, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: 'Goblin Ambush',
    description: 'A narrow forest track',
    roomCode: 'ABCD',
    visibility: 'shared',
    isEditable: true,
    createdBy: 'host-1',
    gridSettings: {
      enabled: true,
      size: 70,
      color: '#ffffff',
      opacity: 0.4,
      snapToGrid: true,
      showToPlayers: true,
    },
    lightingSettings: {
      enabled: false,
      globalIllumination: true,
      ambientLight: 1,
      darkness: 0,
    },
    drawings: [],
    placedTokens: [],
    placedProps: [],
    isActive: true,
    playerCount: 0,
    ...overrides,
  };
}

function makePlacedToken(id: string): PlacedToken {
  return {
    id,
    tokenId: 'base-goblin',
    sceneId: 'scene-1',
    roomCode: 'ABCD',
    x: 10,
    y: 20,
    rotation: 0,
    scale: 1,
    layer: 'tokens',
    visibleToPlayers: true,
    dmNotesOnly: false,
    conditions: [],
    placedBy: 'host-1',
    createdAt: 1,
    updatedAt: 1,
  };
}

function makePencilDrawing(id: string): PencilDrawing {
  return {
    id,
    type: 'pencil',
    style: defaultDrawingStyle,
    layer: 'tokens',
    roomCode: 'ABCD',
    createdAt: 1,
    updatedAt: 1,
    createdBy: 'host-1',
    points: [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
    ],
  };
}

// EntityStore logs on essentially every operation; stub both channels so suite
// output stays readable. Spies are per-test (vitest restoreMocks is on).
let logSpy: MockInstance;
let errorSpy: MockInstance;

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  // Cancel first, while the timer implementation still matches whichever one
  // scheduled the pending callback, then hand the timers back whether or not a
  // test installed fakes.
  cancelPendingSaves();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Throttled (actually debounced) save scheduling
// ---------------------------------------------------------------------------

describe('EntityStore throttled save scheduling', () => {
  let store: EntityStore;
  let adapter: FakeAdapter;

  beforeEach(async () => {
    // Construct and settle under REAL timers: the constructor's load hits
    // fake-indexeddb, which schedules on real macrotasks. Only after that is
    // the adapter swapped for an in-memory fake and fake timers installed, so
    // the save path under test has no real async I/O at all.
    store = await createSettledStore(uniqueDbName(), logSpy);
    adapter = createFakeAdapter();
    injectAdapter(store, adapter);
    vi.useFakeTimers();
  });

  it('does not write anything before the 2000ms window elapses', async () => {
    store.create('token', { name: 'Goblin' });

    expect(store.getStats().isDirty).toBe(true);
    await vi.advanceTimersByTimeAsync(1999);
    expect(vi.mocked(adapter.save)).not.toHaveBeenCalled();
  });

  it('writes exactly once at 2000ms and clears the dirty flag', async () => {
    store.create('token', { name: 'Goblin' });

    await vi.advanceTimersByTimeAsync(2000);

    expect(vi.mocked(adapter.save)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(adapter.save).mock.calls[0][0]).toBe('store-state');
    expect(store.getStats().isDirty).toBe(false);
    expect(store.getStats().lastSaved).toBeGreaterThan(0);
  });

  it('collapses many rapid mutations into a single write', async () => {
    for (let i = 0; i < 25; i += 1) {
      store.create('token', { name: `Goblin ${i}` });
    }

    await vi.advanceTimersByTimeAsync(2000);

    expect(vi.mocked(adapter.save)).toHaveBeenCalledTimes(1);
    expect(store.getStats().entities).toBe(25);
  });

  // BUG: `scheduleThrottledSave` clears the pending timer and starts a fresh
  // 2000ms one on *every* mutation, so it debounces instead of throttling.
  // Sustained editing (dragging a token, drawing a stroke) therefore never
  // reaches a write, and the window is unbounded: 3000ms and three mutations
  // in, nothing has been persisted. On tab close all of it is lost. A real
  // throttle would have written at least once by now.
  it('never writes while mutations keep arriving inside the window', async () => {
    store.create('token', { name: 'first' });
    await vi.advanceTimersByTimeAsync(1500);
    store.create('token', { name: 'second' });
    await vi.advanceTimersByTimeAsync(1500);
    store.create('token', { name: 'third' });
    await vi.advanceTimersByTimeAsync(1500);

    expect(vi.mocked(adapter.save)).not.toHaveBeenCalled();
    expect(store.getStats().isDirty).toBe(true);
    expect(store.getStats().entities).toBe(3);

    // A quiet period finally lets the write through.
    await vi.advanceTimersByTimeAsync(2000);
    expect(vi.mocked(adapter.save)).toHaveBeenCalledTimes(1);
  });

  it('forceSave writes immediately and cancels the pending timer', async () => {
    store.create('token', { name: 'Goblin' });
    await vi.advanceTimersByTimeAsync(500);
    expect(internals(store).saveTimer).not.toBeNull();

    await store.forceSave();
    expect(vi.mocked(adapter.save)).toHaveBeenCalledTimes(1);
    expect(store.getStats().isDirty).toBe(false);

    // The handle itself must be cleared. Asserting only on the write count
    // would not detect a missing clearTimeout: the surviving timer still fires
    // at t=2000, but `saveToStorage`'s `if (!this.isDirty) return` makes it a
    // silent no-op, so the count stays 1 either way.
    expect(internals(store).saveTimer).toBeNull();

    // The cancelled timer must not produce a second write.
    await vi.advanceTimersByTimeAsync(5000);
    expect(vi.mocked(adapter.save)).toHaveBeenCalledTimes(1);
    expect(internals(store).saveTimer).toBeNull();
  });

  it('forceSave is a no-op when the store is not dirty', async () => {
    store.create('token', { name: 'Goblin' });
    await store.forceSave();
    expect(vi.mocked(adapter.save)).toHaveBeenCalledTimes(1);

    await store.forceSave();
    expect(vi.mocked(adapter.save)).toHaveBeenCalledTimes(1);
  });

  it('forceSave on a never-mutated store writes nothing', async () => {
    await store.forceSave();
    expect(vi.mocked(adapter.save)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Which methods mark the store dirty
// ---------------------------------------------------------------------------

describe('EntityStore dirty marking per mutation', () => {
  let store: EntityStore;
  let adapter: FakeAdapter;

  beforeEach(async () => {
    store = await createSettledStore(uniqueDbName(), logSpy);
    adapter = createFakeAdapter();
    injectAdapter(store, adapter);
    vi.useFakeTimers();
  });

  /** Drive the store to a clean, quiesced state so the next assertion is about
   * the method under test alone. */
  async function settleClean(): Promise<void> {
    await store.forceSave();
    vi.mocked(adapter.save).mockClear();
    expect(store.getStats().isDirty).toBe(false);
  }

  it('create marks dirty and schedules a write', async () => {
    store.create('token', { name: 'Goblin' });
    expect(store.getStats().isDirty).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(vi.mocked(adapter.save)).toHaveBeenCalledTimes(1);
  });

  it('update marks dirty and schedules a write', async () => {
    const token = store.create('token', { name: 'Goblin' });
    await settleClean();

    expect(store.update(token.id, { name: 'Hobgoblin' })).not.toBeNull();
    expect(store.getStats().isDirty).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(vi.mocked(adapter.save)).toHaveBeenCalledTimes(1);
  });

  it('update on a missing id returns null and does not schedule a write', async () => {
    store.create('token', { name: 'Goblin' });
    await settleClean();

    expect(store.update('no-such-entity', { name: 'x' })).toBeNull();
    expect(store.getStats().isDirty).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(vi.mocked(adapter.save)).not.toHaveBeenCalled();
  });

  it('delete marks dirty and schedules a write', async () => {
    const token = store.create('token', { name: 'Goblin' });
    await settleClean();

    expect(store.delete(token.id)).toBe(true);
    expect(store.getStats().isDirty).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(vi.mocked(adapter.save)).toHaveBeenCalledTimes(1);
  });

  it('delete of a missing entity returns false without marking dirty', async () => {
    store.create('token', { name: 'Goblin' });
    await settleClean();

    expect(store.delete('no-such-entity')).toBe(false);
    expect(store.getStats().isDirty).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(vi.mocked(adapter.save)).not.toHaveBeenCalled();
  });

  it('relate marks dirty and schedules a write', async () => {
    const a = store.create('scene', { name: 'Cave' });
    const b = store.create('token', { name: 'Goblin' });
    await settleClean();

    store.relate(a.id, b.id, 'contains');
    expect(store.getStats().isDirty).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(vi.mocked(adapter.save)).toHaveBeenCalledTimes(1);
  });

  it('unrelate marks dirty and schedules a write', async () => {
    const a = store.create('scene', { name: 'Cave' });
    const b = store.create('token', { name: 'Goblin' });
    store.relate(a.id, b.id, 'contains');
    await settleClean();

    expect(store.unrelate(a.id, b.id, 'contains')).toBe(true);
    expect(store.getStats().isDirty).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(vi.mocked(adapter.save)).toHaveBeenCalledTimes(1);
  });

  it('unrelate of a missing relationship returns false without marking dirty', async () => {
    const a = store.create('scene', { name: 'Cave' });
    const b = store.create('token', { name: 'Goblin' });
    store.relate(a.id, b.id, 'contains');
    await settleClean();

    // Right pair, wrong type.
    expect(store.unrelate(a.id, b.id, 'lights')).toBe(false);
    // Right type, wrong pair.
    expect(store.unrelate(b.id, a.id, 'contains')).toBe(false);
    expect(store.getStats().isDirty).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(vi.mocked(adapter.save)).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Save failure handling
// ---------------------------------------------------------------------------

describe('EntityStore save failure handling', () => {
  let store: EntityStore;
  let adapter: FakeAdapter;

  beforeEach(async () => {
    store = await createSettledStore(uniqueDbName(), logSpy);
    adapter = createFakeAdapter();
    adapter.save = vi.fn(async () => {
      throw new Error('QuotaExceededError');
    });
    injectAdapter(store, adapter);
    vi.useFakeTimers();
  });

  // Correct behaviour worth pinning: the write error is swallowed (the timer
  // callback is not awaited by anyone, so throwing would be an unhandled
  // rejection) but `isDirty` stays true, so the data is not marked clean.
  it('swallows the write error and leaves the store dirty', async () => {
    store.create('token', { name: 'Goblin' });

    await vi.advanceTimersByTimeAsync(2000);

    expect(vi.mocked(adapter.save)).toHaveBeenCalledTimes(1);
    expect(store.getStats().isDirty).toBe(true);
    expect(store.getStats().lastSaved).toBe(0);
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to save store:',
      expect.any(Error),
    );
  });

  // ...but nothing reschedules after a failure: the fired timer is gone, so
  // the dirty state sits there until some *other* mutation happens to
  // schedule another attempt. There is no retry of its own.
  it('does not retry on its own after a failed write', async () => {
    store.create('token', { name: 'Goblin' });
    await vi.advanceTimersByTimeAsync(2000);
    expect(vi.mocked(adapter.save)).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(vi.mocked(adapter.save)).toHaveBeenCalledTimes(1);

    // An explicit forceSave does retry, because the store is still dirty.
    await store.forceSave();
    expect(vi.mocked(adapter.save)).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// IndexedDB persistence round-trip (real fake-indexeddb)
// ---------------------------------------------------------------------------

describe('EntityStore IndexedDB persistence', () => {
  // This is the safety net for the serialization stub: `serialization.test.ts`
  // shows that `SerializingIndexedDBAdapter` flattens Map/Set/Date, and
  // `saveToStorage` works around that by flattening its Maps and Sets into
  // arrays by hand before saving. These tests prove entity data is NOT
  // corrupted today, so a change to either side fails loudly here.
  it('round-trips entities, relationships and index Sets through a reload', async () => {
    const dbName = uniqueDbName();
    const first = await createSettledStore(dbName, logSpy);

    const scene = first.create('scene', { name: 'Cave', roomCode: 'ABCD' });
    const goblin = first.create('token', { name: 'Goblin', x: 10, y: 20 });
    const drawing = first.create('drawing', { strokes: 3 });
    const relationship = first.relate(scene.id, goblin.id, 'contains', {
      note: 'guard',
    });
    await first.forceSave();

    const second = await createSettledStore(dbName, logSpy);

    expect(second.getStats().entities).toBe(3);
    expect(second.getStats().relationships).toBe(1);
    expect(second.getStats().types).toBe(3);
    expect(second.get(scene.id)).toEqual(scene);
    expect(second.get(goblin.id)).toEqual(goblin);
    expect(second.get(drawing.id)).toEqual(drawing);
    expect(second.getRelated(scene.id, 'contains').map((e) => e.id)).toEqual([
      goblin.id,
    ]);

    // `indexes` must come back as Map<string, Set<string>>, not arrays: the
    // manual array-flattening in saveToStorage and the `new Set(ids)` rebuild
    // in loadFromStorage are the only reason this survives the JSON stub.
    const indexes = internals(second).state.indexes;
    expect(indexes).toBeInstanceOf(Map);
    expect(indexes.get('token')).toBeInstanceOf(Set);
    expect(indexes.get('token')?.has(goblin.id)).toBe(true);
    expect(Array.from(indexes.keys()).sort()).toEqual([
      'drawing',
      'scene',
      'token',
    ]);

    // And the rehydrated index is actually usable by the query path.
    expect(second.getByType('token').map((e) => e.id)).toEqual([goblin.id]);

    // Relationship metadata survives too (plain JSON, so it does).
    expect(
      internals(second).state.relationships.get(relationship.id)?.metadata,
    ).toEqual({ note: 'guard' });
  });

  it('starts empty against an unused database without throwing', async () => {
    const store = await createSettledStore(uniqueDbName(), logSpy);

    expect(store.getStats()).toEqual({
      entities: 0,
      relationships: 0,
      types: 0,
      lastSaved: 0,
      isDirty: false,
    });
  });

  // The constructor swallows initialization errors, so a malformed record
  // leaves a usable-but-empty store rather than an exception.
  it('logs and starts empty when the stored record is malformed', async () => {
    const dbName = uniqueDbName();
    // Write a record the loader cannot digest: `new Map('nope')` throws.
    const raw = createIndexedDBAdapter({ dbName, version: 1 });
    await raw.save('store-state', { entities: 'nope' });

    const store = await createSettledStore(dbName, logSpy);

    expect(store.getStats().entities).toBe(0);
    expect(errorSpy).toHaveBeenCalledWith(
      '📂 Ogres-style store: Failed to load store:',
      expect.any(Error),
    );
  });

  // "Keeps" is only a meaningful claim on a populated store: on an empty one,
  // keeping and wiping are indistinguishable. Both loader-failure tests below
  // therefore create an entity first.
  it('logs and keeps the existing state when the load itself rejects', async () => {
    const store = await createSettledStore(uniqueDbName(), logSpy);
    const survivor = store.create('token', { name: 'Goblin' });
    const failing = createFakeAdapter();
    failing.load = vi.fn(async () => {
      throw new Error('IndexedDB unavailable');
    }) as StorageAdapter['load'];
    injectAdapter(store, failing);
    errorSpy.mockClear();

    // Re-run the private loader directly; the constructor path is identical.
    await expect(internals(store).loadFromStorage()).resolves.toBeUndefined();

    expect(store.getStats().entities).toBe(1);
    expect(store.get(survivor.id)).toEqual(survivor);
    expect(errorSpy).toHaveBeenCalledWith(
      '📂 Ogres-style store: Failed to load store:',
      expect.any(Error),
    );
  });

  it('keeps its current state when the saved record is absent', async () => {
    const store = await createSettledStore(uniqueDbName(), logSpy);
    const survivor = store.create('token', { name: 'Goblin' });
    injectAdapter(store, createFakeAdapter());

    await internals(store).loadFromStorage();

    // The early `if (!saved) return` must leave the loaded state alone, not
    // reset it.
    expect(store.getStats().entities).toBe(1);
    expect(store.get(survivor.id)).toEqual(survivor);
    expect(store.getByType('token').map((e) => e.id)).toEqual([survivor.id]);
  });

  it('reads lastSaved and version back from the saved record', async () => {
    const store = await createSettledStore(uniqueDbName(), logSpy);
    const adapter = createFakeAdapter();
    adapter.store.set('store-state', {
      entities: [],
      lastSaved: 1_700_000_000_000,
      version: 7,
    });
    injectAdapter(store, adapter);

    await internals(store).loadFromStorage();

    expect(internals(store).state.lastSaved).toBe(1_700_000_000_000);
    expect(internals(store).state.version).toBe(7);
  });

  it('defaults missing lastSaved and version to 0 and 1, not to the current values', async () => {
    const store = await createSettledStore(uniqueDbName(), logSpy);
    const adapter = createFakeAdapter();
    adapter.store.set('store-state', { entities: [] });
    injectAdapter(store, adapter);

    // Seed non-default in-memory values so `|| 0` / `|| 1` is distinguishable
    // from a "keep what we already have" fallback such as
    // `saved.version ?? this.state.version`. Nothing in production ever
    // advances `version`, so these have to be set directly.
    internals(store).state.lastSaved = 99;
    internals(store).state.version = 42;

    await internals(store).loadFromStorage();

    expect(internals(store).state.lastSaved).toBe(0);
    expect(internals(store).state.version).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Backup export / import
// ---------------------------------------------------------------------------

describe('EntityStore backup export and import', () => {
  it('round-trips entities and relationships and rebuilds indexes', async () => {
    const source = await createSettledStore(uniqueDbName(), logSpy);
    const scene = source.create('scene', { name: 'Cave' });
    const goblin = source.create('token', { name: 'Goblin' });
    source.relate(scene.id, goblin.id, 'contains');
    await source.forceSave();

    const backup = await source.exportBackup();
    expect(backup).toBeInstanceOf(Uint8Array);

    const target = await createSettledStore(uniqueDbName(), logSpy);
    await target.importBackup(backup);

    expect(target.getStats().entities).toBe(2);
    expect(target.getStats().relationships).toBe(1);
    expect(target.get(goblin.id)).toEqual(goblin);
    expect(Array.from(internals(target).state.indexes.keys()).sort()).toEqual([
      'scene',
      'token',
    ]);
    expect(target.getByType('token').map((e) => e.id)).toEqual([goblin.id]);
  });

  it('wraps the export in the shared backup envelope with entity metadata', async () => {
    const store = await createSettledStore(uniqueDbName(), logSpy);
    store.create('token', { name: 'Goblin' });
    const parsed = SerializationService.parseBackupData<{
      entities: Array<[string, Entity]>;
      metadata: { entityCount: number; version: number };
    }>(await store.exportBackup());

    expect(parsed.version).toBe('1.0.0');
    expect(parsed.data.entities).toHaveLength(1);
    expect(parsed.data.metadata.entityCount).toBe(1);
    expect(parsed.data.metadata.version).toBe(1);
  });

  // Fact 4: exportBackup's "ensure latest data" saveToStorage() early-returns
  // when the store is clean, so it performs no write. Harmless here because
  // the export reads from in-memory state regardless -- but the line does not
  // do what its comment claims.
  it('exportBackup writes nothing when the store is already clean', async () => {
    const store = await createSettledStore(uniqueDbName(), logSpy);
    const adapter = createFakeAdapter();
    injectAdapter(store, adapter);

    store.create('token', { name: 'Goblin' });
    await store.forceSave();
    vi.mocked(adapter.save).mockClear();

    const parsed = SerializationService.parseBackupData<{
      entities: Array<[string, Entity]>;
    }>(await store.exportBackup());

    expect(vi.mocked(adapter.save)).not.toHaveBeenCalled();
    expect(parsed.data.entities).toHaveLength(1);
  });

  // Correct ordering: parseBackupData runs BEFORE the state is cleared, so an
  // undecodable file rethrows without destroying what is already loaded.
  it('rethrows on undecodable bytes and leaves existing data intact', async () => {
    const store = await createSettledStore(uniqueDbName(), logSpy);
    const token = store.create('token', { name: 'Goblin' });

    // 0xc1 is the never-used byte in the MessagePack spec.
    await expect(
      store.importBackup(new Uint8Array([0xc1, 0xc1, 0xc1])),
    ).rejects.toThrow('Failed to deserialize with MessagePack');

    expect(store.getStats().entities).toBe(1);
    expect(store.get(token.id)).not.toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to import backup:',
      expect.any(Error),
    );
  });

  // BUG: a *decodable* backup whose payload is structurally wrong fails AFTER
  // the clear, so the caller's existing entities are destroyed and the import
  // still rethrows. A failed import is not atomic.
  it('destroys existing data when a decodable backup has a bad payload', async () => {
    const store = await createSettledStore(uniqueDbName(), logSpy);
    store.create('token', { name: 'Goblin' });
    store.create('scene', { name: 'Cave' });
    expect(store.getStats().entities).toBe(2);

    const poisoned = SerializationService.createBackupData({
      entities: 'not-an-entry-list',
    });

    // Matched precisely: a bare `.toThrow()` would also be satisfied by a
    // throw from `parseBackupData`, which happens BEFORE the clear and so would
    // not destroy anything. The message below is V8's for
    // `new Map('not-an-entry-list')`, i.e. the post-clear rebuild.
    await expect(store.importBackup(poisoned)).rejects.toThrow(
      /Iterator value n is not an entry object/,
    );

    expect(store.getStats().entities).toBe(0);
    expect(store.getStats().types).toBe(0);
  });

  // BUG (fact 3): importBackup rebuilds in-memory state and then calls
  // saveToStorage(), but never markDirty() -- and saveToStorage() early-returns
  // on `!isDirty`. When the store is clean at import time (the normal case
  // right after a forceSave or a fresh load) the imported data is never
  // persisted. A reload silently resurrects the pre-import state.
  it('does not persist an import when the store was clean', async () => {
    const dbName = uniqueDbName();
    const target = await createSettledStore(dbName, logSpy);
    const original = target.create('token', { name: 'Pre-import' });
    await target.forceSave();
    expect(target.getStats().isDirty).toBe(false);

    const source = await createSettledStore(uniqueDbName(), logSpy);
    const imported = source.create('token', { name: 'From backup' });
    const backup = await source.exportBackup();

    await target.importBackup(backup);

    // In memory the import looks like it worked...
    expect(target.get(imported.id)).not.toBeNull();
    expect(target.get(original.id)).toBeNull();
    expect(target.getStats().isDirty).toBe(false);

    // ...but nothing was written, so a reload sees the pre-import state.
    const reloaded = await createSettledStore(dbName, logSpy);
    expect(reloaded.get(original.id)).not.toBeNull();
    expect(reloaded.get(imported.id)).toBeNull();
  });

  // The flip side of the same bug: when the store happens to be dirty, the
  // very same import IS persisted. Durability depends on unrelated prior
  // mutations, which is what makes this so easy to miss.
  it('persists an import when the store happened to be dirty', async () => {
    const dbName = uniqueDbName();
    const target = await createSettledStore(dbName, logSpy);
    target.create('token', { name: 'Pre-import' });
    expect(target.getStats().isDirty).toBe(true);

    const source = await createSettledStore(uniqueDbName(), logSpy);
    const imported = source.create('token', { name: 'From backup' });
    const backup = await source.exportBackup();

    await target.importBackup(backup);
    expect(target.getStats().isDirty).toBe(false);

    const reloaded = await createSettledStore(dbName, logSpy);
    expect(reloaded.get(imported.id)).not.toBeNull();
  });

  it('treats a backup with no entities or relationships as an empty store', async () => {
    const store = await createSettledStore(uniqueDbName(), logSpy);
    store.create('token', { name: 'Goblin' });

    await store.importBackup(
      SerializationService.createBackupData({ somethingElse: true }),
    );

    expect(store.getStats()).toMatchObject({
      entities: 0,
      relationships: 0,
      types: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// Entity CRUD
// ---------------------------------------------------------------------------

describe('EntityStore entity CRUD', () => {
  let store: EntityStore;

  beforeEach(async () => {
    store = await createSettledStore(uniqueDbName(), logSpy);
    injectAdapter(store, createFakeAdapter());
    vi.useFakeTimers();
  });

  it('assigns an id, type and timestamps and indexes by type', () => {
    const entity = store.create('token', { name: 'Goblin', hp: 7 });

    expect(entity.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(entity.type).toBe('token');
    expect(entity.createdAt).toBe(entity.updatedAt);
    expect(entity.name).toBe('Goblin');
    expect(store.get(entity.id)).toEqual(entity);
    expect(store.getByType('token').map((e) => e.id)).toEqual([entity.id]);
    expect(internals(store).state.indexes.get('token')?.has(entity.id)).toBe(
      true,
    );
  });

  // Data is spread AFTER the generated fields, so a caller-supplied id or type
  // silently wins. Harmless for hand-written calls; see the createScene tests
  // for where it actually breaks.
  it('lets caller data overwrite the generated id and type', () => {
    const entity = store.create('token', {
      id: 'caller-id',
      type: 'not-a-token',
      createdAt: 1,
      updatedAt: 2,
    });

    expect(entity.id).toBe('caller-id');
    expect(entity.type).toBe('not-a-token');
    expect(entity.createdAt).toBe(1);
    // Indexed under the `type` ARGUMENT, not the resulting entity.type.
    expect(internals(store).state.indexes.get('token')?.has('caller-id')).toBe(
      true,
    );
    expect(internals(store).state.indexes.has('not-a-token')).toBe(false);
  });

  it('merges updates and advances updatedAt without touching createdAt', () => {
    const entity = store.create('token', { name: 'Goblin', hp: 7 });
    vi.advanceTimersByTime(50);

    const updated = store.update<Entity>(entity.id, { hp: 3 });

    expect(updated).not.toBeNull();
    expect(updated?.name).toBe('Goblin');
    expect(updated?.hp).toBe(3);
    expect(updated?.createdAt).toBe(entity.createdAt);
    expect(updated?.updatedAt).toBeGreaterThan(entity.updatedAt);
    expect(store.get(entity.id)).toEqual(updated);
  });

  it('returns null from get for an unknown id', () => {
    expect(store.get('missing')).toBeNull();
  });

  it('delete removes the entity, its index entry and its relationships', () => {
    const scene = store.create('scene', { name: 'Cave' });
    const goblin = store.create('token', { name: 'Goblin' });
    const orc = store.create('token', { name: 'Orc' });
    store.relate(scene.id, goblin.id, 'contains');
    store.relate(goblin.id, orc.id, 'allies');
    store.relate(scene.id, orc.id, 'contains');

    expect(store.delete(goblin.id)).toBe(true);

    expect(store.get(goblin.id)).toBeNull();
    // Both relationships touching the deleted entity are gone, the third stays.
    expect(store.getStats().relationships).toBe(1);
    expect(store.getRelated(scene.id, 'contains').map((e) => e.id)).toEqual([
      orc.id,
    ]);
    // 'token' index still exists because Orc is in it.
    expect(internals(store).state.indexes.get('token')?.has(goblin.id)).toBe(
      false,
    );
  });

  it('drops the type index entirely once its last entity is deleted', () => {
    const only = store.create('trap', { name: 'Pit' });
    expect(internals(store).state.indexes.has('trap')).toBe(true);

    store.delete(only.id);

    expect(internals(store).state.indexes.has('trap')).toBe(false);
    expect(store.getStats().types).toBe(0);
    expect(store.getByType('trap')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Query system
// ---------------------------------------------------------------------------

describe('EntityStore query', () => {
  let store: EntityStore;
  let ids: string[];

  beforeEach(async () => {
    store = await createSettledStore(uniqueDbName(), logSpy);
    injectAdapter(store, createFakeAdapter());
    vi.useFakeTimers();

    ids = [
      store.create('token', { name: 'Goblin', level: 1, faction: 'foe' }).id,
      store.create('token', { name: 'Hobgoblin', level: 5, faction: 'foe' }).id,
      store.create('token', { name: 'Ranger', level: 9, faction: 'ally' }).id,
    ];
    store.create('scene', { name: 'Cave' });
  });

  it('returns every entity when no type is given', () => {
    expect(store.query({})).toHaveLength(4);
  });

  it('filters by type via the index', () => {
    expect(store.query({ type: 'token' }).map((e) => e.id)).toEqual(ids);
  });

  it('returns an empty array for an unknown type', () => {
    expect(store.query({ type: 'nope' })).toEqual([]);
  });

  it('filters by an exact where value', () => {
    expect(
      store.query({ type: 'token', where: { faction: 'ally' } }).map(
        (e) => e.name,
      ),
    ).toEqual(['Ranger']);
  });

  it('requires every where key to match', () => {
    expect(
      store.query({ type: 'token', where: { faction: 'foe', level: 5 } }),
    ).toHaveLength(1);
    expect(
      store.query({ type: 'token', where: { faction: 'ally', level: 5 } }),
    ).toHaveLength(0);
  });

  it('supports the comparison and membership operators', () => {
    const names = (where: Record<string, unknown>) =>
      store
        .query({ type: 'token', where })
        .map((e) => e.name as string)
        .sort();

    expect(names({ level: { $eq: 5 } })).toEqual(['Hobgoblin']);
    expect(names({ level: { $ne: 5 } })).toEqual(['Goblin', 'Ranger']);
    expect(names({ level: { $gt: 5 } })).toEqual(['Ranger']);
    expect(names({ level: { $gte: 5 } })).toEqual(['Hobgoblin', 'Ranger']);
    expect(names({ level: { $lt: 5 } })).toEqual(['Goblin']);
    expect(names({ level: { $lte: 5 } })).toEqual(['Goblin', 'Hobgoblin']);
    expect(names({ level: { $in: [1, 9] } })).toEqual(['Goblin', 'Ranger']);
    expect(names({ level: { $nin: [1, 9] } })).toEqual(['Hobgoblin']);
  });

  // An object value with no recognised `$` operator falls through to a
  // strict-equality comparison, which can never match a fresh literal.
  it('never matches a plain object where-value', () => {
    store.create('prop', { name: 'Chest', pos: { x: 1, y: 2 } });
    expect(store.query({ type: 'prop', where: { pos: { x: 1, y: 2 } } })).toEqual(
      [],
    );
  });

  it('applies offset and limit, in that order', () => {
    expect(store.query({ type: 'token', limit: 2 }).map((e) => e.id)).toEqual(
      ids.slice(0, 2),
    );
    expect(store.query({ type: 'token', offset: 1 }).map((e) => e.id)).toEqual(
      ids.slice(1),
    );
    expect(
      store.query({ type: 'token', offset: 1, limit: 1 }).map((e) => e.id),
    ).toEqual([ids[1]]);
  });

  // `offset: 0` and `limit: 0` are falsy, so both slices are skipped. `limit: 0`
  // therefore returns everything rather than nothing.
  it('treats limit 0 as no limit', () => {
    expect(store.query({ type: 'token', limit: 0 })).toHaveLength(3);
  });

  // GAP: `include` is part of the EntityQuery type and is documented as
  // relationship expansion, but query() never reads it. Nothing is expanded
  // and no error is raised -- callers get plain entities.
  it('silently ignores the include option', () => {
    const scene = store.create('scene', { name: 'Ruins' });
    store.relate(scene.id, ids[0], 'contains');

    const withInclude = store.query({ type: 'token', include: ['contains'] });
    expect(withInclude).toEqual(store.query({ type: 'token' }));
    expect(withInclude[0]).not.toHaveProperty('contains');
  });
});

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

describe('EntityStore relationships', () => {
  let store: EntityStore;

  beforeEach(async () => {
    store = await createSettledStore(uniqueDbName(), logSpy);
    injectAdapter(store, createFakeAdapter());
    vi.useFakeTimers();
  });

  it('relate records a typed edge with optional metadata', () => {
    const a = store.create('scene', { name: 'Cave' });
    const b = store.create('token', { name: 'Goblin' });

    const rel = store.relate(a.id, b.id, 'contains', { slot: 1 });

    expect(rel).toMatchObject({
      sourceId: a.id,
      targetId: b.id,
      type: 'contains',
      metadata: { slot: 1 },
    });
    expect(store.getStats().relationships).toBe(1);
  });

  it('getRelated walks the edge in both directions', () => {
    const scene = store.create('scene', { name: 'Cave' });
    const goblin = store.create('token', { name: 'Goblin' });
    store.relate(scene.id, goblin.id, 'contains');

    expect(store.getRelated(scene.id).map((e) => e.id)).toEqual([goblin.id]);
    expect(store.getRelated(goblin.id).map((e) => e.id)).toEqual([scene.id]);
  });

  it('getRelated filters by relationship type when one is given', () => {
    const scene = store.create('scene', { name: 'Cave' });
    const goblin = store.create('token', { name: 'Goblin' });
    const lamp = store.create('prop', { name: 'Lamp' });
    store.relate(scene.id, goblin.id, 'contains');
    store.relate(scene.id, lamp.id, 'lights');

    expect(store.getRelated(scene.id, 'lights').map((e) => e.id)).toEqual([
      lamp.id,
    ]);
    expect(store.getRelated(scene.id).map((e) => e.id).sort()).toEqual(
      [goblin.id, lamp.id].sort(),
    );
    expect(store.getRelated(scene.id, 'nope')).toEqual([]);
  });

  // Relationships are only pruned for the entity passed to delete(), so a
  // dangling edge can exist if state is mutated another way. The Boolean
  // filter keeps getRelated from returning undefined in that case.
  it('getRelated skips edges whose other end no longer exists', () => {
    const scene = store.create('scene', { name: 'Cave' });
    const goblin = store.create('token', { name: 'Goblin' });
    store.relate(scene.id, goblin.id, 'contains');
    internals(store).state.entities.delete(goblin.id);

    expect(store.getRelated(scene.id, 'contains')).toEqual([]);
  });

  it('unrelate without a type removes the first matching edge of any type', () => {
    const a = store.create('scene', { name: 'Cave' });
    const b = store.create('token', { name: 'Goblin' });
    store.relate(a.id, b.id, 'contains');
    store.relate(a.id, b.id, 'lights');

    expect(store.unrelate(a.id, b.id)).toBe(true);
    expect(store.getStats().relationships).toBe(1);

    // A second call removes the remaining one, so repeated calls do clear all
    // types between the pair -- but a single call does not.
    expect(store.unrelate(a.id, b.id)).toBe(true);
    expect(store.getStats().relationships).toBe(0);
    expect(store.unrelate(a.id, b.id)).toBe(false);
  });

  it('relate does not require either endpoint to exist', () => {
    const rel = store.relate('ghost-a', 'ghost-b', 'contains');

    expect(store.getStats().relationships).toBe(1);
    expect(store.getRelated('ghost-a')).toEqual([]);
    expect(rel.metadata).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Scene helpers
// ---------------------------------------------------------------------------

describe('EntityStore scene helpers', () => {
  let store: EntityStore;

  beforeEach(async () => {
    store = await createSettledStore(uniqueDbName(), logSpy);
    injectAdapter(store, createFakeAdapter());
    vi.useFakeTimers();
  });

  it('createScene stores the scene alone when it has no content', () => {
    const scene = store.createScene(makeSceneData());

    expect(scene.type).toBe('scene');
    expect(scene.name).toBe('Goblin Ambush');
    expect(store.getStats().entities).toBe(1);
    expect(store.getStats().relationships).toBe(0);
  });

  it('createScene creates a contained token entity per placed token', () => {
    const scene = store.createScene(
      makeSceneData({ placedTokens: [makePlacedToken('pt-1')] }),
    );

    expect(store.getStats().entities).toBe(2);
    // The placed token's own id wins over the generated uuid (see the CRUD
    // test above), so the entity is addressable by the PlacedToken id.
    const token = store.get('pt-1');
    expect(token?.type).toBe('token');
    expect(store.getRelated(scene.id, 'contains').map((e) => e.id)).toEqual([
      'pt-1',
    ]);
  });

  it('getSceneWithRelations returns the scene and its tokens', () => {
    const scene = store.createScene(
      makeSceneData({
        placedTokens: [makePlacedToken('pt-1'), makePlacedToken('pt-2')],
      }),
    );

    const result = store.getSceneWithRelations(scene.id);

    expect(result.scene?.id).toBe(scene.id);
    expect(result.tokens.map((t) => t.id).sort()).toEqual(['pt-1', 'pt-2']);
    expect(result.drawings).toEqual([]);
  });

  it('getSceneWithRelations returns nulls for an unknown scene', () => {
    expect(store.getSceneWithRelations('missing')).toEqual({
      scene: null,
      tokens: [],
      drawings: [],
    });
  });

  // BUG: `create()` spreads the drawing payload after the generated fields, and
  // every Drawing carries its own `type` (here 'pencil'). The entity's `type`
  // becomes 'pencil' while `addToIndex` still uses the 'drawing' argument, so
  // getSceneWithRelations -- which filters on `entity.type === 'drawing'` --
  // finds nothing. Scene drawings are effectively unreachable through this API.
  it('loses scene drawings because the drawing type overwrites entity.type', () => {
    const scene = store.createScene(
      makeSceneData({ drawings: [makePencilDrawing('dr-1')] }),
    );

    // The entity exists and is related to the scene...
    expect(store.getStats().entities).toBe(2);
    expect(store.getRelated(scene.id, 'contains').map((e) => e.id)).toEqual([
      'dr-1',
    ]);
    expect(store.get('dr-1')?.type).toBe('pencil');
    // ...and the index is keyed 'drawing' even though entity.type is 'pencil'.
    expect(internals(store).state.indexes.has('drawing')).toBe(true);
    expect(internals(store).state.indexes.has('pencil')).toBe(false);

    // ...but the accessor cannot see it.
    expect(store.getSceneWithRelations(scene.id).drawings).toEqual([]);
  });

  // Consequence of the same mismatch: rebuildIndexes() keys off entity.type,
  // so a backup round-trip silently moves the entity from the 'drawing' index
  // to a 'pencil' one and getByType('drawing') stops working.
  it('re-keys drawing entities after a backup round-trip', async () => {
    store.createScene(makeSceneData({ drawings: [makePencilDrawing('dr-1')] }));
    expect(store.getByType('drawing').map((e) => e.id)).toEqual(['dr-1']);

    vi.useRealTimers();
    const backup = await store.exportBackup();
    await store.importBackup(backup);

    expect(store.getByType('drawing')).toEqual([]);
    expect(store.getByType('pencil').map((e) => e.id)).toEqual(['dr-1']);
  });
});

// ---------------------------------------------------------------------------
// Listeners
// ---------------------------------------------------------------------------

describe('EntityStore listeners', () => {
  let store: EntityStore;

  beforeEach(async () => {
    store = await createSettledStore(uniqueDbName(), logSpy);
    injectAdapter(store, createFakeAdapter());
    vi.useFakeTimers();
  });

  it('notifies entity:created, entity:updated and entity:deleted', () => {
    const created = vi.fn();
    const updated = vi.fn();
    const deleted = vi.fn();
    store.on('entity:created', created);
    store.on('entity:updated', updated);
    store.on('entity:deleted', deleted);

    const entity = store.create('token', { name: 'Goblin' });
    expect(created).toHaveBeenCalledTimes(1);
    expect(created).toHaveBeenCalledWith(entity);
    expect(updated).not.toHaveBeenCalled();

    const after = store.update(entity.id, { name: 'Hobgoblin' });
    expect(updated).toHaveBeenCalledWith(after);

    store.delete(entity.id);
    // The deleted event carries the entity as it was before removal.
    expect(deleted).toHaveBeenCalledWith(after);
  });

  it('supports multiple listeners on the same event', () => {
    const first = vi.fn();
    const second = vi.fn();
    store.on('entity:created', first);
    store.on('entity:created', second);

    store.create('token', { name: 'Goblin' });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('registers each callback only once', () => {
    const callback = vi.fn();
    store.on('entity:created', callback);
    store.on('entity:created', callback);

    store.create('token', { name: 'Goblin' });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('stops notifying a callback after off', () => {
    const callback = vi.fn();
    store.on('entity:created', callback);
    store.create('token', { name: 'a' });
    store.off('entity:created', callback);

    store.create('token', { name: 'b' });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('off is a no-op for an event or callback that was never registered', () => {
    const callback = vi.fn();
    expect(() => store.off('never-registered', callback)).not.toThrow();
    store.on('entity:created', vi.fn());
    expect(() => store.off('entity:created', callback)).not.toThrow();
  });

  // relate/unrelate emit nothing, so relationship changes are invisible to
  // listeners even though they mark the store dirty.
  it('emits no event for relationship changes', () => {
    const anyEvent = vi.fn();
    for (const event of [
      'entity:created',
      'entity:updated',
      'entity:deleted',
      'relationship:created',
    ]) {
      store.on(event, anyEvent);
    }
    const a = store.create('scene', { name: 'Cave' });
    const b = store.create('token', { name: 'Goblin' });
    anyEvent.mockClear();

    store.relate(a.id, b.id, 'contains');
    store.unrelate(a.id, b.id, 'contains');

    expect(anyEvent).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// clearDatabase and stats
// ---------------------------------------------------------------------------

describe('EntityStore clearDatabase and stats', () => {
  let store: EntityStore;
  let adapter: FakeAdapter;

  beforeEach(async () => {
    store = await createSettledStore(uniqueDbName(), logSpy);
    adapter = createFakeAdapter();
    injectAdapter(store, adapter);
    vi.useFakeTimers();
  });

  it('clearDatabase clears the underlying storage', async () => {
    store.create('token', { name: 'Goblin' });
    await store.forceSave();
    expect(adapter.store.size).toBe(1);

    await store.clearDatabase();

    expect(vi.mocked(adapter.clear)).toHaveBeenCalledTimes(1);
    expect(adapter.store.size).toBe(0);
    // In-memory state is deliberately untouched by clearDatabase.
    expect(store.getStats().entities).toBe(1);
  });

  it('clearDatabase swallows and logs a storage failure', async () => {
    adapter.clear = vi.fn(async () => {
      throw new Error('blocked');
    });

    await expect(store.clearDatabase()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      '🗑️ Ogres-style store: Failed to clear database:',
      expect.any(Error),
    );
  });

  it('getStats reports counts, last save time and the dirty flag', async () => {
    expect(Object.keys(store.getStats()).sort()).toEqual([
      'entities',
      'isDirty',
      'lastSaved',
      'relationships',
      'types',
    ]);

    const a = store.create('token', { name: 'Goblin' });
    const b = store.create('scene', { name: 'Cave' });
    store.relate(b.id, a.id, 'contains');

    expect(store.getStats()).toMatchObject({
      entities: 2,
      relationships: 1,
      types: 2,
      isDirty: true,
    });

    await store.forceSave();
    const stats = store.getStats();
    expect(stats.isDirty).toBe(false);
    expect(stats.lastSaved).toBeGreaterThan(0);
  });
});
