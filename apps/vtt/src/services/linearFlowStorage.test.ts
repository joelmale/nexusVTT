/**
 * @file src/services/linearFlowStorage.test.ts
 * @description Characterization tests for LinearFlowStorage, focused on the
 * migration and cleanup paths (`migrateDrawingData`, `migrateFromLocalStorage`,
 * `needsMigration`, `needsDrawingMigration`, `cleanupMigrationData`).
 *
 * IMPORTANT: like `serialization.test.ts` and `entityStore.test.ts`, these tests
 * describe what the code does *today*, not what its names promise. Several
 * asserted behaviours are defects; each is marked `BUG:` so a fix shows up here
 * as a failing test rather than a silent change:
 *
 *   1. `migrateDrawingData()` removes `nexus-drawings-<sceneId>` *outside* the
 *      `if (data.drawings && Array.isArray(...))` guard, so a record whose
 *      `drawings` field is missing or not an array is deleted without ever being
 *      migrated. Silent data loss.
 *   2. `cleanupMigrationData()` removes `nexus-browser-id`. Per CLAUDE.md §12.5
 *      browser-local characters are keyed by that id, so cleanup orphans them.
 *   3. `migrateDrawingData()` keeps `nexus-scenes` when any `saveScene` rejects,
 *      while already-migrated scenes stay in the entity store — a retry
 *      re-migrates them.
 *   4. `getBrowserId()` looks the browser id up with `store.get('browser-id')`,
 *      but `EntityStore.create()` assigns a fresh `uuidv4()` as the entity id, so
 *      that lookup can never hit. Every call therefore mints a *new* browser id.
 *      Session save/load and character reads silently stop matching.
 *   5. Because `getBrowserId()` always returns a truthy id, `stats.browserId` is
 *      always `true`, so `migrateFromLocalStorage()` reports `migrated: true`
 *      and writes `nexus-migration-complete` even on an empty localStorage.
 *      The `'No data found to migrate'` branch is unreachable.
 *   6. `EntityStore.create()` spreads caller data after `type`, so a `Drawing`
 *      is stored with `type: 'pencil'` while indexed under `'drawing'`.
 *      `deleteDrawings()` then cannot un-index it, and the next read of that
 *      scene throws a TypeError on a dangling index entry.
 *
 * Isolation: `LinearFlowStorage` captures `getEntityStore()` (a module
 * singleton) in a field initialiser. The module is mocked below so each
 * construction gets its own real `EntityStore` on a unique IndexedDB name —
 * real store semantics, no cross-test bleed. Tests always construct
 * `new LinearFlowStorage()` and never touch `getLinearFlowStorage()`, which is
 * itself a singleton shared with `drawingPersistence.ts`.
 *
 * localStorage: the global harness (`tests/setup.ts`) replaces `localStorage`
 * with a plain object that keeps its data in a *closure*, so
 * `Object.keys(localStorage)` yields the mock's own method names instead of the
 * stored keys. Every production path here that enumerates localStorage
 * (`migrateDrawingData`, `needsMigration`, `needsDrawingMigration`,
 * `cleanupMigrationData`) is therefore untestable against that mock, and any
 * test written against it would assert the wrong thing. These tests install a
 * browser-faithful stand-in (data as own enumerable properties, behind a Proxy)
 * for their duration and restore the global afterwards. See the report for the
 * suggested fix to `tests/setup.ts`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { EntityStore } from '@/services/entityStore';
import type { Scene } from '@/types/game';
import type { PlayerCharacter, GameConfig } from '@/types/game';
import { defaultDrawingStyle, type PencilDrawing } from '@/types/drawing';

// Each LinearFlowStorage gets a private, real EntityStore on its own database.
// A plain function (not `vi.fn`) because the suite runs with `mockReset: true`,
// which would otherwise strip the implementation between tests.
vi.mock('@/services/entityStore', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/services/entityStore')>();
  let counter = 0;
  return {
    ...actual,
    getEntityStore: (): EntityStore => {
      counter += 1;
      return new actual.EntityStore(`linear-flow-test-${Date.now()}-${counter}`);
    },
  };
});

import { LinearFlowStorage } from '@/services/linearFlowStorage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Private surface the tests need: the captured entity store (to observe what
 * migration actually wrote) and the private browser-id helper. Deliberately a
 * narrow cast rather than a production change.
 */
interface LinearFlowStorageInternals {
  store: EntityStore;
  getBrowserId: () => string;
}

function internals(storage: LinearFlowStorage): LinearFlowStorageInternals {
  return storage as unknown as LinearFlowStorageInternals;
}

/** EntityStore's pending debounce timer, cleared after each test. */
interface EntityStoreTimer {
  saveTimer: ReturnType<typeof setTimeout> | null;
}

const liveStorages: LinearFlowStorage[] = [];

/** Construct a storage instance and register it for timer cleanup. */
function newStorage(): LinearFlowStorage {
  const storage = new LinearFlowStorage();
  liveStorages.push(storage);
  return storage;
}

function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: 'scene-1',
    name: 'Goblin Ambush',
    description: 'A narrow forest track',
    roomCode: 'ABCD',
    visibility: 'shared',
    isEditable: true,
    createdBy: 'host-1',
    createdAt: 1000,
    updatedAt: 1000,
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

function makeDrawing(id: string): PencilDrawing {
  return {
    id,
    type: 'pencil',
    style: defaultDrawingStyle,
    layer: 'overlay',
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

function makeCharacter(id: string, name: string): PlayerCharacter {
  return {
    id,
    name,
    race: 'Elf',
    class: 'Ranger',
    background: 'Outlander',
    level: 3,
    stats: {
      strength: 10,
      dexterity: 16,
      constitution: 12,
      intelligence: 11,
      wisdom: 14,
      charisma: 8,
    },
    createdAt: 5,
    playerId: 'player-1',
  };
}

function makeGameConfig(): GameConfig {
  return {
    name: 'Test Campaign',
    description: 'A campaign',
    estimatedTime: '3h',
    campaignType: 'campaign',
    maxPlayers: 5,
  };
}

/** Sorted snapshot of the current localStorage keys. */
function lsKeys(): string[] {
  return Object.keys(localStorage).sort();
}

// --- browser-faithful localStorage -----------------------------------------

/** Number of `getItem` calls since the last reset; see the read-path test. */
let getItemCalls = 0;
/** When true, `getItem` throws — the only way into `migrateDrawingData`'s outer catch. */
let getItemThrows = false;

/**
 * A localStorage whose entries are own enumerable properties, so
 * `Object.keys(localStorage)` behaves as it does in a real browser. A Proxy over
 * the data object keeps the API methods off the key list.
 */
function createBrowserLikeLocalStorage(): Storage {
  const data: Record<string, string> = {};
  const api: Record<string, unknown> = {
    getItem: (key: string): string | null => {
      getItemCalls += 1;
      if (getItemThrows) throw new Error('storage unavailable');
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem: (key: string, value: string): void => {
      data[key] = String(value);
    },
    removeItem: (key: string): void => {
      delete data[key];
    },
    clear: (): void => {
      Object.keys(data).forEach((key) => delete data[key]);
    },
    key: (index: number): string | null => Object.keys(data)[index] ?? null,
  };

  return new Proxy(data, {
    get: (target, prop) => {
      if (prop === 'length') return Object.keys(target).length;
      if (typeof prop === 'string' && prop in api) return api[prop];
      return target[prop as string];
    },
    has: (target, prop) =>
      (typeof prop === 'string' && prop in api) || prop in target,
  }) as unknown as Storage;
}

let originalLocalStorage: PropertyDescriptor | undefined;

function installLocalStorage(value: Storage): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value,
    configurable: true,
    writable: true,
  });
}

// LinearFlowStorage and EntityStore log on nearly every operation; stub all
// three channels so suite output stays readable (restoreMocks is on).
beforeEach(() => {
  originalLocalStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    'localStorage',
  );
  getItemCalls = 0;
  getItemThrows = false;
  installLocalStorage(createBrowserLikeLocalStorage());
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  // Drop each store's pending 2s debounce so no write lands after teardown.
  while (liveStorages.length > 0) {
    const storage = liveStorages.pop()!;
    const timer = internals(storage).store as unknown as EntityStoreTimer;
    if (timer.saveTimer) {
      clearTimeout(timer.saveTimer);
      timer.saveTimer = null;
    }
  }
  getItemThrows = false;
  localStorage.clear();
  // Hand the global back exactly as it was, so no other suite inherits this.
  if (originalLocalStorage) {
    Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
    originalLocalStorage = undefined;
  }
});

// ---------------------------------------------------------------------------
// Test-harness assumptions
// ---------------------------------------------------------------------------

describe('localStorage harness assumptions', () => {
  it('exposes seeded keys through Object.keys, which the production code relies on', () => {
    localStorage.setItem('nexus-scenes', '[]');
    localStorage.setItem('nexus-drawings-scene-1', '{}');

    // `migrateDrawingData`, `needsMigration` and `cleanupMigrationData` all
    // enumerate via `Object.keys(localStorage)`. The global mock in
    // tests/setup.ts does NOT satisfy this; the local stand-in does.
    expect(lsKeys()).toEqual(['nexus-drawings-scene-1', 'nexus-scenes']);
    expect(localStorage.length).toBe(2);
    expect(localStorage.key(0)).toBe('nexus-scenes');
    expect(localStorage.getItem('missing')).toBeNull();
  });

  it('starts every test with an empty localStorage', () => {
    expect(lsKeys()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// migrateDrawingData()
// ---------------------------------------------------------------------------

describe('LinearFlowStorage.migrateDrawingData', () => {
  it('migrates scenes and drawing sets, then removes the source keys', async () => {
    const storage = newStorage();
    localStorage.setItem(
      'nexus-scenes',
      JSON.stringify([
        makeScene({ id: 'scene-1', name: 'One' }),
        makeScene({ id: 'scene-2', name: 'Two' }),
      ]),
    );
    localStorage.setItem(
      'nexus-drawings-scene-1',
      JSON.stringify({ drawings: [makeDrawing('d1'), makeDrawing('d2')] }),
    );
    localStorage.setItem(
      'nexus-drawings-scene-2',
      JSON.stringify({ drawings: [makeDrawing('d3')] }),
    );
    localStorage.setItem('unrelated-key', 'keep me');

    const result = await storage.migrateDrawingData();

    expect(result).toEqual({
      migratedScenes: 2,
      migratedDrawings: 3,
      errors: [],
    });
    // Every source key consumed; unrelated keys untouched.
    expect(lsKeys()).toEqual(['unrelated-key']);

    expect(storage.getScenes().map((scene) => scene.id).sort()).toEqual([
      'scene-1',
      'scene-2',
    ]);
    expect(storage.getDrawings('scene-1')).toHaveLength(2);
    expect(storage.getDrawings('scene-2')).toHaveLength(1);
  });

  it('returns zeros and removes nothing when there is nothing to migrate', async () => {
    const storage = newStorage();
    localStorage.setItem('nexus-app-flow', '{"state":{}}');

    const result = await storage.migrateDrawingData();

    expect(result).toEqual({
      migratedScenes: 0,
      migratedDrawings: 0,
      errors: [],
    });
    expect(lsKeys()).toEqual(['nexus-app-flow']);
  });

  it('reports a "Failed to migrate scenes" error and keeps the key when nexus-scenes is not JSON', async () => {
    const storage = newStorage();
    localStorage.setItem('nexus-scenes', '{not json');

    const result = await storage.migrateDrawingData();

    expect(result.migratedScenes).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/^Failed to migrate scenes: /);
    // The removeItem sits after the parse inside the same try, so a malformed
    // payload is retained. That is the safe outcome here.
    expect(localStorage.getItem('nexus-scenes')).toBe('{not json');
  });

  it('records a partial scene count and keeps nexus-scenes when a saveScene rejects', async () => {
    const storage = newStorage();
    localStorage.setItem(
      'nexus-scenes',
      JSON.stringify([
        makeScene({ id: 'scene-1', name: 'One' }),
        makeScene({ id: 'scene-2', name: 'Two' }),
        makeScene({ id: 'scene-3', name: 'Three' }),
      ]),
    );

    const realSaveScene = storage.saveScene.bind(storage);
    let calls = 0;
    vi.spyOn(storage, 'saveScene').mockImplementation(async (scene: Scene) => {
      calls += 1;
      if (calls === 2) {
        throw new Error('entity store unavailable');
      }
      await realSaveScene(scene);
    });

    const result = await storage.migrateDrawingData();

    expect(result.migratedScenes).toBe(1);
    expect(result.errors).toEqual([
      'Failed to migrate scenes: Error: entity store unavailable',
    ]);

    // BUG (fact 5): the loop aborts before `removeItem`, so `nexus-scenes`
    // survives *with all three scenes* while scene-1 is already committed to
    // the entity store. A retry re-migrates scene-1 — `saveScene` upserts by id
    // so this particular shape self-heals, but the source of truth is now
    // duplicated across two stores with no record of what succeeded.
    expect(localStorage.getItem('nexus-scenes')).not.toBeNull();
    const retained: Scene[] = JSON.parse(
      localStorage.getItem('nexus-scenes') as string,
    );
    expect(retained.map((scene) => scene.id)).toEqual([
      'scene-1',
      'scene-2',
      'scene-3',
    ]);
    expect(storage.getScenes().map((scene) => scene.id)).toEqual(['scene-1']);
  });

  it('reports a per-key error for a malformed drawing record and still migrates the others', async () => {
    const storage = newStorage();
    localStorage.setItem('nexus-drawings-scene-bad', '{not json');
    localStorage.setItem(
      'nexus-drawings-scene-good',
      JSON.stringify({ drawings: [makeDrawing('d1')] }),
    );

    const result = await storage.migrateDrawingData();

    expect(result.migratedDrawings).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(
      /^Failed to migrate drawings for nexus-drawings-scene-bad: /,
    );
    expect(storage.getDrawings('scene-good')).toHaveLength(1);
    // The parse throws before `removeItem`, so the malformed record is kept.
    expect(localStorage.getItem('nexus-drawings-scene-bad')).toBe('{not json');
    expect(localStorage.getItem('nexus-drawings-scene-good')).toBeNull();
  });

  it('BUG: deletes a drawing record whose `drawings` field is missing, migrating nothing', async () => {
    const storage = newStorage();
    localStorage.setItem('nexus-drawings-scene-1', JSON.stringify({}));

    const result = await storage.migrateDrawingData();

    // `localStorage.removeItem(key)` sits *after* the
    // `if (data.drawings && Array.isArray(data.drawings))` guard but inside the
    // same try, so a record the guard rejects is destroyed anyway. This is
    // silent, unrecoverable data loss: no error is reported and the payload is
    // gone.
    expect(result.migratedDrawings).toBe(0);
    expect(result.errors).toEqual([]);
    expect(localStorage.getItem('nexus-drawings-scene-1')).toBeNull();
    expect(storage.getDrawings('scene-1')).toEqual([]);
  });

  it('BUG: deletes a drawing record whose `drawings` field is not an array', async () => {
    const storage = newStorage();
    localStorage.setItem(
      'nexus-drawings-scene-1',
      JSON.stringify({ drawings: 'not-an-array' }),
    );
    localStorage.setItem(
      'nexus-drawings-scene-2',
      JSON.stringify({ drawings: { '0': makeDrawing('d1') } }),
    );

    const result = await storage.migrateDrawingData();

    // Same gap as above via the `Array.isArray` half of the guard. A legacy
    // record stored in any other shape is dropped on the floor.
    expect(result.migratedDrawings).toBe(0);
    expect(result.errors).toEqual([]);
    expect(lsKeys()).toEqual([]);
  });

  it('consumes an empty drawings array without counting or erroring', async () => {
    const storage = newStorage();
    localStorage.setItem(
      'nexus-drawings-scene-1',
      JSON.stringify({ drawings: [] }),
    );

    const result = await storage.migrateDrawingData();

    expect(result).toEqual({
      migratedScenes: 0,
      migratedDrawings: 0,
      errors: [],
    });
    expect(localStorage.getItem('nexus-drawings-scene-1')).toBeNull();
  });

  it('ignores a drawing record stored as the empty string', async () => {
    const storage = newStorage();
    localStorage.setItem('nexus-drawings-scene-1', '');

    const result = await storage.migrateDrawingData();

    // `if (drawingsData)` is falsy for '', so the parse is skipped — but the
    // key is still removed by the unguarded `removeItem`.
    expect(result.errors).toEqual([]);
    expect(result.migratedDrawings).toBe(0);
    expect(localStorage.getItem('nexus-drawings-scene-1')).toBeNull();
  });

  it('wraps a failure raised outside the inner try blocks as "Migration failed"', async () => {
    const storage = newStorage();
    // The first `localStorage.getItem` call happens in the outer try but before
    // any inner try, so it is the only reachable path into the outer catch.
    getItemThrows = true;

    const result = await storage.migrateDrawingData();

    expect(result).toEqual({
      migratedScenes: 0,
      migratedDrawings: 0,
      errors: ['Migration failed: Error: storage unavailable'],
    });
  });
});

// ---------------------------------------------------------------------------
// needsDrawingMigration()
// ---------------------------------------------------------------------------

describe('LinearFlowStorage.needsDrawingMigration', () => {
  it('is false on an empty localStorage', () => {
    expect(newStorage().needsDrawingMigration()).toBe(false);
  });

  it('is true when nexus-scenes is present', () => {
    const storage = newStorage();
    localStorage.setItem('nexus-scenes', '[]');
    expect(storage.needsDrawingMigration()).toBe(true);
  });

  it('is true when only a nexus-drawings-* key is present', () => {
    const storage = newStorage();
    localStorage.setItem('nexus-drawings-scene-1', '{"drawings":[]}');
    expect(storage.needsDrawingMigration()).toBe(true);
  });

  it('is true for an empty-string nexus-scenes value, because the check is `!== null`', () => {
    const storage = newStorage();
    localStorage.setItem('nexus-scenes', '');
    // Not `if (scenesData)` but `!== null`, so an empty value still claims
    // migration is needed even though `migrateDrawingData()` would skip it.
    expect(storage.needsDrawingMigration()).toBe(true);
  });

  it('ignores the bare `nexus-drawings` key (no trailing dash)', () => {
    const storage = newStorage();
    localStorage.setItem('nexus-drawings', '{"drawings":[]}');
    expect(storage.needsDrawingMigration()).toBe(false);
  });

  it('ignores unrelated keys', () => {
    const storage = newStorage();
    localStorage.setItem('nexus-app-flow', '{}');
    localStorage.setItem('some-other-app', '{}');
    expect(storage.needsDrawingMigration()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// migrateFromLocalStorage()
// ---------------------------------------------------------------------------

describe('LinearFlowStorage.migrateFromLocalStorage', () => {
  it('migrates session, game state scenes and characters, and reports full stats', async () => {
    const storage = newStorage();
    localStorage.setItem(
      'nexus-session',
      JSON.stringify({ roomCode: 'ABCD', userId: 'u1' }),
    );
    localStorage.setItem(
      'nexus-game-state',
      JSON.stringify({
        scenes: [
          makeScene({ id: 'scene-1', name: 'One' }),
          makeScene({ id: 'scene-2', name: 'Two' }),
        ],
        characters: [makeCharacter('c1', 'Arden')],
      }),
    );

    const stats = await storage.migrateFromLocalStorage();

    expect(stats).toEqual({
      migrated: true,
      scenes: 2,
      characters: 1,
      sessions: 0,
      legacySessions: 1,
      browserId: true,
    });
    // Both keys are consumed together at the end of the branch.
    expect(localStorage.getItem('nexus-session')).toBeNull();
    expect(localStorage.getItem('nexus-game-state')).toBeNull();
    expect(
      internals(storage).store.getByType('session-legacy'),
    ).toHaveLength(2);
  });

  it('counts legacySessions once even when only nexus-session is present', async () => {
    const storage = newStorage();
    localStorage.setItem('nexus-session', JSON.stringify({ roomCode: 'ABCD' }));

    const stats = await storage.migrateFromLocalStorage();

    expect(stats.legacySessions).toBe(1);
    expect(stats.scenes).toBe(0);
    expect(stats.characters).toBe(0);
    // `saveLegacySessionData(parsedSession, null)` writes one record only.
    expect(
      internals(storage).store.getByType('session-legacy'),
    ).toHaveLength(1);
  });

  it('migrates a lone nexus-game-state', async () => {
    const storage = newStorage();
    localStorage.setItem(
      'nexus-game-state',
      JSON.stringify({ scenes: [makeScene()], characters: [] }),
    );

    const stats = await storage.migrateFromLocalStorage();

    expect(stats.legacySessions).toBe(1);
    expect(stats.scenes).toBe(1);
    expect(stats.characters).toBe(0);
    expect(
      internals(storage).store.getByType('session-legacy'),
    ).toHaveLength(1);
  });

  it('skips the scenes/characters loops when the game state omits them', async () => {
    const storage = newStorage();
    localStorage.setItem(
      'nexus-game-state',
      JSON.stringify({ user: { id: 'u1' } }),
    );

    const stats = await storage.migrateFromLocalStorage();

    expect(stats.scenes).toBe(0);
    expect(stats.characters).toBe(0);
    expect(stats.legacySessions).toBe(1);
  });

  it('skips scenes/characters that are present but not arrays', async () => {
    const storage = newStorage();
    localStorage.setItem(
      'nexus-game-state',
      JSON.stringify({ scenes: { a: 1 }, characters: 'nope' }),
    );

    const stats = await storage.migrateFromLocalStorage();

    // Guarded by `Array.isArray`, so non-array payloads are silently dropped —
    // no error and no counter, same lossy shape as the drawing guard above.
    expect(stats.scenes).toBe(0);
    expect(stats.characters).toBe(0);
    expect(storage.getScenes()).toEqual([]);
  });

  it('swallows malformed nexus-session JSON and keeps both keys', async () => {
    const storage = newStorage();
    localStorage.setItem('nexus-session', '{not json');
    localStorage.setItem('nexus-game-state', JSON.stringify({ scenes: [] }));

    const stats = await storage.migrateFromLocalStorage();

    expect(stats.legacySessions).toBe(0);
    // The parse throws before the cleanup, so both keys survive. The only
    // signal is a console.error — the returned stats still say migrated: true
    // because of the browserId short-circuit (see below).
    expect(localStorage.getItem('nexus-session')).toBe('{not json');
    expect(localStorage.getItem('nexus-game-state')).not.toBeNull();
  });

  it('swallows malformed nexus-game-state JSON', async () => {
    const storage = newStorage();
    localStorage.setItem('nexus-game-state', '{not json');

    const stats = await storage.migrateFromLocalStorage();

    expect(stats.legacySessions).toBe(0);
    expect(stats.scenes).toBe(0);
    expect(localStorage.getItem('nexus-game-state')).toBe('{not json');
  });

  it('migrates the nexus-app-flow session, game config and selected character, and keeps the key', async () => {
    const storage = newStorage();
    localStorage.setItem(
      'nexus-app-flow',
      JSON.stringify({
        state: {
          user: { name: 'Dana', type: 'host', id: 'u1' },
          roomCode: 'WXYZ',
          view: 'game',
          gameConfig: makeGameConfig(),
          selectedCharacter: makeCharacter('c9', 'Selected'),
        },
      }),
    );

    const stats = await storage.migrateFromLocalStorage();

    expect(stats.sessions).toBe(1);
    expect(stats.characters).toBe(1);
    // Explicitly retained for Zustand persistence.
    expect(localStorage.getItem('nexus-app-flow')).not.toBeNull();
    expect(storage.getGameConfig('WXYZ')?.name).toBe('Test Campaign');
    expect(internals(storage).store.getByType('session')).toHaveLength(1);
  });

  it('defaults the app-flow view to "game" when absent', async () => {
    const storage = newStorage();
    localStorage.setItem(
      'nexus-app-flow',
      JSON.stringify({
        state: {
          user: { name: 'Dana', type: 'host', id: 'u1' },
          roomCode: 'WXYZ',
        },
      }),
    );

    await storage.migrateFromLocalStorage();

    const sessions = internals(storage).store.getByType('session');
    expect(sessions).toHaveLength(1);
    expect(sessions[0].view).toBe('game');
    expect(sessions[0].isConnected).toBe(false);
  });

  it('skips the app-flow session when the user name or room code is missing', async () => {
    const storage = newStorage();
    localStorage.setItem(
      'nexus-app-flow',
      JSON.stringify({ state: { user: { id: 'u1' }, roomCode: 'WXYZ' } }),
    );

    const stats = await storage.migrateFromLocalStorage();

    expect(stats.sessions).toBe(0);
    expect(internals(storage).store.getByType('session')).toHaveLength(0);
  });

  it('ignores nexus-app-flow without a `state` envelope', async () => {
    const storage = newStorage();
    localStorage.setItem('nexus-app-flow', JSON.stringify({ version: 1 }));

    const stats = await storage.migrateFromLocalStorage();

    expect(stats.sessions).toBe(0);
    expect(stats.characters).toBe(0);
  });

  it('swallows malformed nexus-app-flow JSON', async () => {
    const storage = newStorage();
    localStorage.setItem('nexus-app-flow', '{not json');

    const stats = await storage.migrateFromLocalStorage();

    expect(stats.sessions).toBe(0);
    expect(localStorage.getItem('nexus-app-flow')).toBe('{not json');
  });

  it('migrates standalone nexus-characters and removes the key', async () => {
    const storage = newStorage();
    localStorage.setItem(
      'nexus-characters',
      JSON.stringify([makeCharacter('c1', 'A'), makeCharacter('c2', 'B')]),
    );

    const stats = await storage.migrateFromLocalStorage();

    expect(stats.characters).toBe(2);
    expect(localStorage.getItem('nexus-characters')).toBeNull();
    expect(internals(storage).store.getByType('character')).toHaveLength(2);
  });

  it('removes nexus-characters even when the payload is not an array', async () => {
    const storage = newStorage();
    localStorage.setItem('nexus-characters', JSON.stringify({ c1: {} }));

    const stats = await storage.migrateFromLocalStorage();

    // `Array.isArray` skips the loop, but the `removeItem` that follows is
    // unguarded — the same silent-loss shape as the drawing record above.
    expect(stats.characters).toBe(0);
    expect(localStorage.getItem('nexus-characters')).toBeNull();
  });

  it('swallows malformed nexus-characters JSON and keeps the key', async () => {
    const storage = newStorage();
    localStorage.setItem('nexus-characters', '{not json');

    const stats = await storage.migrateFromLocalStorage();

    expect(stats.characters).toBe(0);
    expect(localStorage.getItem('nexus-characters')).toBe('{not json');
  });

  it('consumes an existing nexus-browser-id rather than generating one', async () => {
    const storage = newStorage();
    localStorage.setItem('nexus-browser-id', 'browser-abc');

    await storage.migrateFromLocalStorage();

    // `getBrowserId()` moves the id into the entity store and deletes the
    // localStorage copy, so the migrated value is observable only there.
    const ids = internals(storage).store.getByType('browser-id');
    expect(ids.map((entity) => entity.value)).toContain('browser-abc');
    expect(localStorage.getItem('nexus-browser-id')).toBeNull();
  });

  it('BUG: reports migrated: true and writes nexus-migration-complete on an empty localStorage', async () => {
    const storage = newStorage();

    const stats = await storage.migrateFromLocalStorage();

    // `getBrowserId()` always returns a freshly minted uuid, so
    // `if (browserId) stats.browserId = true` is unconditional and the success
    // branch always runs. The `'No data found to migrate'` else branch is
    // unreachable, and `needsMigration()` is permanently short-circuited after
    // any call to this method — even one that migrated nothing.
    expect(stats).toEqual({
      migrated: true,
      scenes: 0,
      characters: 0,
      sessions: 0,
      legacySessions: 0,
      browserId: true,
    });
    expect(localStorage.getItem('nexus-migration-complete')).toBe('true');
    expect(storage.needsMigration()).toBe(false);
  });

  it('returns zeroed stats when the migration throws before any branch', async () => {
    const storage = newStorage();
    vi.spyOn(
      internals(storage).store,
      'get',
    ).mockImplementation(() => {
      throw new Error('store unavailable');
    });

    const stats = await storage.migrateFromLocalStorage();

    // The outer catch logs and falls through to `return stats`, so a total
    // failure is indistinguishable from "nothing to do" apart from the log.
    expect(stats).toEqual({
      migrated: false,
      scenes: 0,
      characters: 0,
      sessions: 0,
      legacySessions: 0,
      browserId: false,
    });
    expect(localStorage.getItem('nexus-migration-complete')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// needsMigration()
// ---------------------------------------------------------------------------

describe('LinearFlowStorage.needsMigration', () => {
  it('is false on an empty localStorage', () => {
    expect(newStorage().needsMigration()).toBe(false);
  });

  it.each([
    'nexus-session',
    'nexus-game-state',
    'nexus-browser-id',
    'nexus-characters',
    'nexus-scenes',
  ])('is true when %s is present', (key) => {
    const storage = newStorage();
    localStorage.setItem(key, 'x');
    expect(storage.needsMigration()).toBe(true);
  });

  it('is true when only a nexus-drawings-* key is present', () => {
    const storage = newStorage();
    localStorage.setItem('nexus-drawings-scene-1', '{}');
    expect(storage.needsMigration()).toBe(true);
  });

  it('short-circuits to false when nexus-migration-complete is exactly "true", even with migratable data', () => {
    const storage = newStorage();
    localStorage.setItem('nexus-migration-complete', 'true');
    localStorage.setItem('nexus-scenes', JSON.stringify([makeScene()]));
    localStorage.setItem('nexus-drawings-scene-1', '{"drawings":[]}');

    // The flag wins outright: real un-migrated data is ignored. Combined with
    // the unconditional flag write above, one no-op migration run permanently
    // hides any legacy data that appears later.
    expect(storage.needsMigration()).toBe(false);
    expect(storage.needsDrawingMigration()).toBe(true);
  });

  it.each(['TRUE', 'True', '1', 'yes', ''])(
    'does not short-circuit for the flag value %o (exact === "true" comparison)',
    (flag) => {
      const storage = newStorage();
      localStorage.setItem('nexus-migration-complete', flag);
      localStorage.setItem('nexus-scenes', '[]');
      expect(storage.needsMigration()).toBe(true);
    },
  );

  it('is false when the only nexus key is one that is kept', () => {
    const storage = newStorage();
    localStorage.setItem('nexus-app-flow', '{}');
    localStorage.setItem('nexus-sessions', '[]');
    // `nexus-sessions` is on the cleanup list but NOT on the needsMigration
    // list, so its presence alone never triggers a migration.
    expect(storage.needsMigration()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// cleanupMigrationData()
// ---------------------------------------------------------------------------

describe('LinearFlowStorage.cleanupMigrationData', () => {
  it('removes every legacy key that is present and reports them', () => {
    const storage = newStorage();
    localStorage.setItem('nexus-session', '{}');
    localStorage.setItem('nexus-game-state', '{}');
    localStorage.setItem('nexus-browser-id', 'browser-abc');
    localStorage.setItem('nexus-characters', '[]');
    localStorage.setItem('nexus-scenes', '[]');

    const result = storage.cleanupMigrationData();

    expect(result.removedKeys.sort()).toEqual([
      'nexus-browser-id',
      'nexus-characters',
      'nexus-game-state',
      'nexus-scenes',
      'nexus-session',
    ]);
    expect(lsKeys()).toEqual([]);
  });

  it('skips keys that are absent', () => {
    const storage = newStorage();
    localStorage.setItem('nexus-scenes', '[]');

    const result = storage.cleanupMigrationData();

    expect(result.removedKeys).toEqual(['nexus-scenes']);
  });

  it('removes every nexus-drawings-* key', () => {
    const storage = newStorage();
    localStorage.setItem('nexus-drawings-scene-1', '{"drawings":[]}');
    localStorage.setItem('nexus-drawings-scene-2', '{"drawings":[]}');

    const result = storage.cleanupMigrationData();

    expect(result.removedKeys.sort()).toEqual([
      'nexus-drawings-scene-1',
      'nexus-drawings-scene-2',
    ]);
    expect(lsKeys()).toEqual([]);
  });

  it('reports nexus-app-flow and nexus-migration-complete as kept without removing them', () => {
    const storage = newStorage();
    localStorage.setItem('nexus-app-flow', '{"state":{}}');
    localStorage.setItem('nexus-migration-complete', 'true');

    const result = storage.cleanupMigrationData();

    expect(result.removedKeys).toEqual([]);
    expect(result.keptKeys).toEqual([
      'nexus-app-flow',
      'nexus-migration-complete',
    ]);
    expect(lsKeys()).toEqual(['nexus-app-flow', 'nexus-migration-complete']);
  });

  it('omits kept keys from keptKeys when they are absent', () => {
    const storage = newStorage();
    localStorage.setItem('nexus-app-flow', '{}');

    expect(storage.cleanupMigrationData().keptKeys).toEqual(['nexus-app-flow']);
  });

  it('BUG: removes nexus-browser-id, orphaning every browser-local character', () => {
    const storage = newStorage();
    localStorage.setItem('nexus-browser-id', 'browser-abc');

    const result = storage.cleanupMigrationData();

    // Per CLAUDE.md §12.5 character data is browser-local and "linked to the
    // browser via nexus-browser-id". Cleanup deletes that link unconditionally
    // — it does not check that the id was first copied into the entity store —
    // so any character still keyed by 'browser-abc' becomes unreachable and the
    // next `getBrowserId()` mints a different id.
    expect(result.removedKeys).toContain('nexus-browser-id');
    expect(localStorage.getItem('nexus-browser-id')).toBeNull();
    expect(internals(storage).store.getByType('browser-id')).toEqual([]);
  });

  it('leaves unrelated and other nexus- keys untouched', () => {
    const storage = newStorage();
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('nexus-sessions', '[]');
    localStorage.setItem('nexus-active-session', '{}');
    localStorage.setItem('nexus-connection-context', '{}');

    const result = storage.cleanupMigrationData();

    expect(result.removedKeys).toEqual([]);
    // `nexus-sessions` (plural) is never cleaned up despite being removed by
    // `resetDatabase()` — the two key lists disagree.
    expect(lsKeys()).toEqual([
      'nexus-active-session',
      'nexus-connection-context',
      'nexus-sessions',
      'theme',
    ]);
  });

  it('is idempotent', () => {
    const storage = newStorage();
    localStorage.setItem('nexus-scenes', '[]');

    expect(storage.cleanupMigrationData().removedKeys).toEqual([
      'nexus-scenes',
    ]);
    expect(storage.cleanupMigrationData()).toEqual({
      removedKeys: [],
      keptKeys: [],
    });
  });
});

// ---------------------------------------------------------------------------
// Browser identity — the key the migration paths hang off
// ---------------------------------------------------------------------------

describe('LinearFlowStorage browser identity', () => {
  it('migrates an existing nexus-browser-id into the entity store and deletes the localStorage copy', () => {
    const storage = newStorage();
    localStorage.setItem('nexus-browser-id', 'browser-abc');

    expect(internals(storage).getBrowserId()).toBe('browser-abc');
    expect(localStorage.getItem('nexus-browser-id')).toBeNull();
    // NOTE: contrary to its doc comment, it never writes `nexus-browser-id`
    // back to localStorage — the id lives only in the entity store.
  });

  it('generates a uuid when no id exists anywhere', () => {
    const storage = newStorage();

    const id = internals(storage).getBrowserId();

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(localStorage.getItem('nexus-browser-id')).toBeNull();
  });

  it('BUG: mints a new browser id on every call because the lookup id is wrong', () => {
    const storage = newStorage();

    const first = internals(storage).getBrowserId();
    const second = internals(storage).getBrowserId();
    const third = internals(storage).getBrowserId();

    // `getBrowserId()` reads `store.get('browser-id')`, but
    // `EntityStore.create('browser-id', { value })` assigns `uuidv4()` as the
    // entity *id* — nothing is ever stored under the literal key 'browser-id',
    // so the cache lookup can never hit.
    expect(new Set([first, second, third]).size).toBe(3);
    // ...and each miss leaks another entity.
    expect(internals(storage).store.getByType('browser-id')).toHaveLength(3);
  });

  it('BUG: a saved session cannot be loaded back, because the browser id changed', () => {
    const storage = newStorage();

    storage.saveSession({
      user: { name: 'Dana', type: 'host', id: 'u1' },
      roomCode: 'ABCD',
      view: 'game',
      isConnected: true,
    });

    // Downstream consequence of the id churn: `loadSession()` queries by a
    // *different* browser id than `saveSession()` wrote, so the round-trip is
    // broken for every caller.
    expect(internals(storage).store.getByType('session')).toHaveLength(1);
    expect(storage.loadSession()).toBeNull();
  });

  it('BUG: saveSession never replaces the previous session for the browser', () => {
    const storage = newStorage();
    const session = {
      user: { name: 'Dana', type: 'host', id: 'u1' },
      roomCode: 'ABCD',
      view: 'game',
      isConnected: true,
    };

    storage.saveSession(session);
    storage.saveSession({ ...session, roomCode: 'WXYZ' });

    // The "remove any existing session for this browser" query matches nothing
    // for the same reason, so sessions accumulate without bound.
    expect(internals(storage).store.getByType('session')).toHaveLength(2);
  });

  it('BUG: saved characters cannot be read back by getCharacters()', () => {
    const storage = newStorage();

    storage.saveCharacter(makeCharacter('c1', 'Arden'));

    expect(internals(storage).store.getByType('character')).toHaveLength(1);
    expect(storage.getCharacters()).toEqual([]);
  });

  it('BUG: legacy session data cannot be read back either', () => {
    const storage = newStorage();

    storage.saveLegacySessionData({ roomCode: 'ABCD' }, { scenes: [] });

    expect(internals(storage).store.getByType('session-legacy')).toHaveLength(
      2,
    );
    expect(storage.loadLegacySessionData()).toEqual({
      session: null,
      gameState: null,
    });
  });

  it('writes nothing for null legacy session inputs', () => {
    const storage = newStorage();

    storage.saveLegacySessionData(null, null);

    expect(internals(storage).store.getByType('session-legacy')).toEqual([]);
  });

  it('does return the cached value once an entity really is keyed "browser-id"', () => {
    const storage = newStorage();
    // What `getBrowserId()` is trying to read. `EntityStore` offers no way to
    // create an entity with a chosen id, so the entity map is seeded directly to
    // show the intended path works — the defect is purely that `create()` never
    // produces this shape.
    const entities = (
      internals(storage).store as unknown as {
        state: { entities: Map<string, unknown> };
      }
    ).state.entities;
    entities.set('browser-id', {
      id: 'browser-id',
      type: 'browser-id',
      createdAt: 0,
      updatedAt: 0,
      value: 'browser-cached',
    });

    expect(internals(storage).getBrowserId()).toBe('browser-cached');
    expect(internals(storage).getBrowserId()).toBe('browser-cached');
  });

  it('clearSession removes nothing, for the same browser-id mismatch', () => {
    const storage = newStorage();
    storage.saveSession({
      user: { name: 'Dana', type: 'host', id: 'u1' },
      roomCode: 'ABCD',
      view: 'game',
      isConnected: true,
    });

    storage.clearSession();

    expect(internals(storage).store.getByType('session')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Session round-trips with a stable browser id
//
// Everything below passes only because `getBrowserId()` is pinned to one value.
// It is the control group for the bugs above: the session/character APIs are
// correct in themselves, and the id churn is the whole defect.
// ---------------------------------------------------------------------------

describe('LinearFlowStorage session round-trips (browser id pinned)', () => {
  function pinnedStorage(): LinearFlowStorage {
    const storage = newStorage();
    vi.spyOn(internals(storage), 'getBrowserId').mockReturnValue(
      'browser-fixed',
    );
    return storage;
  }

  const sessionData = {
    user: { name: 'Dana', type: 'host', id: 'u1' },
    roomCode: 'ABCD',
    view: 'game',
    isConnected: true,
  };

  it('saves and loads a session', () => {
    const storage = pinnedStorage();

    storage.saveSession(sessionData);
    const loaded = storage.loadSession();

    expect(loaded).toMatchObject({
      roomCode: 'ABCD',
      view: 'game',
      isConnected: true,
      browserId: 'browser-fixed',
    });
    expect(loaded?.lastActivity).toBeTypeOf('number');
  });

  it('replaces the previous session for the browser', () => {
    const storage = pinnedStorage();

    storage.saveSession(sessionData);
    storage.saveSession({ ...sessionData, roomCode: 'WXYZ' });

    expect(internals(storage).store.getByType('session')).toHaveLength(1);
    expect(storage.loadSession()?.roomCode).toBe('WXYZ');
  });

  it('round-trips legacy session data by dataType', () => {
    const storage = pinnedStorage();

    storage.saveLegacySessionData(
      { roomCode: 'ABCD' },
      { scenes: [], characters: [] },
    );
    const loaded = storage.loadLegacySessionData();

    expect(loaded.session).toMatchObject({
      roomCode: 'ABCD',
      dataType: 'session',
    });
    expect(loaded.gameState).toMatchObject({ dataType: 'gameState' });
  });

  it('clearSession removes both the session and the legacy records', () => {
    const storage = pinnedStorage();
    storage.saveSession(sessionData);
    storage.saveLegacySessionData({ roomCode: 'ABCD' }, { scenes: [] });

    storage.clearSession();

    expect(storage.loadSession()).toBeNull();
    expect(storage.loadLegacySessionData()).toEqual({
      session: null,
      gameState: null,
    });
  });

  it('saves and reads back characters', () => {
    const storage = pinnedStorage();

    storage.saveCharacter(makeCharacter('c1', 'Arden'));

    expect(storage.getCharacters().map((c) => c.name)).toEqual(['Arden']);
  });
});

// ---------------------------------------------------------------------------
// Read/write shape — the sync-read vs async-write asymmetry
// ---------------------------------------------------------------------------

describe('LinearFlowStorage read/write asymmetry', () => {
  it('reads synchronously from the in-memory entity store, not from localStorage', async () => {
    const storage = newStorage();
    await storage.saveScene(makeScene({ id: 'scene-1' }));

    // Despite the module name, `getScenes`/`getDrawings`/`getCharacters` never
    // touch localStorage: they are synchronous queries over EntityStore's
    // in-memory maps. Only the migration/cleanup helpers read localStorage.
    getItemCalls = 0;
    const scenes = storage.getScenes();
    storage.getDrawings('scene-1');
    storage.getCharacters();

    expect(scenes.map((scene) => scene.id)).toEqual(['scene-1']);
    // `getCharacters()` -> `getBrowserId()` is the sole reader, and it reads the
    // legacy `nexus-browser-id` key only.
    expect(getItemCalls).toBe(1);
  });

  it('awaits saveScene but nothing is persisted when it resolves', async () => {
    const storage = newStorage();
    const forceSave = vi.spyOn(internals(storage).store, 'forceSave');

    await storage.saveScene(makeScene({ id: 'scene-1' }));

    // `saveScene`/`saveDrawings` are `async` decoration only: the body is
    // entirely synchronous and durability is left to EntityStore's 2s debounce.
    // A caller that awaits the write and then closes the tab loses it.
    expect(forceSave).not.toHaveBeenCalled();
    expect(storage.getStats().isDirty).toBe(true);
  });

  it('substitutes now for a falsy createdAt on scenes and drawings', async () => {
    const storage = newStorage();
    await storage.saveScene(makeScene({ id: 'scene-1', createdAt: 0 }));
    await storage.saveDrawings('scene-1', [
      { ...makeDrawing('d1'), createdAt: 0 },
    ]);
    const added = storage.addDrawing('scene-2', {
      ...makeDrawing('d2'),
      createdAt: 0,
    });

    // `createdAt || Date.now()` — a legitimately zero timestamp is rewritten
    // rather than preserved.
    expect(storage.getScenes()[0].createdAt).toBeGreaterThan(0);
    expect(storage.getDrawings('scene-1')[0].createdAt).toBeGreaterThan(0);
    expect(added.createdAt).toBeGreaterThan(0);
  });

  it('saveScene upserts by id rather than duplicating', async () => {
    const storage = newStorage();
    await storage.saveScene(makeScene({ id: 'scene-1', name: 'First' }));
    await storage.saveScene(makeScene({ id: 'scene-1', name: 'Renamed' }));

    const scenes = storage.getScenes();
    expect(scenes).toHaveLength(1);
    expect(scenes[0].name).toBe('Renamed');
  });

  it('filters scenes by roomCode when asked', async () => {
    const storage = newStorage();
    await storage.saveScene(makeScene({ id: 'scene-1', roomCode: 'ABCD' }));
    await storage.saveScene(makeScene({ id: 'scene-2', roomCode: 'WXYZ' }));

    expect(storage.getScenes('ABCD').map((scene) => scene.id)).toEqual([
      'scene-1',
    ]);
    expect(storage.getScenes()).toHaveLength(2);
  });

  it('BUG: re-saving the drawings of a scene corrupts the drawing index', async () => {
    const storage = newStorage();
    await storage.saveDrawings('scene-1', [makeDrawing('d1')]);
    await storage.saveDrawings('scene-1', [makeDrawing('d2')]);

    // `EntityStore.create()` spreads the drawing after `type`, so the entity is
    // stored with `type: 'pencil'` while indexed under `'drawing'`.
    // `deleteDrawings()` then un-indexes 'pencil' and leaves a dangling id in
    // the 'drawing' index, which the next query dereferences.
    //
    // Consequence for the migration path: re-running `migrateDrawingData()` for
    // a scene that already has drawings throws instead of being idempotent.
    expect(() => storage.getDrawings('scene-1')).toThrow(TypeError);
    await expect(
      storage.saveDrawings('scene-1', [makeDrawing('d3')]),
    ).rejects.toThrow(TypeError);
  });

  it('filters drawings by roomCode when asked', async () => {
    const storage = newStorage();
    const local = makeDrawing('d1');
    const other = { ...makeDrawing('d2'), roomCode: 'WXYZ' };
    await storage.saveDrawings('scene-1', [local, other]);

    expect(storage.getDrawings('scene-1', 'ABCD').map((d) => d.id)).toEqual([
      'd1',
    ]);
  });

  it('addDrawing, updateDrawing and deleteDrawing operate on a single drawing', () => {
    const storage = newStorage();
    storage.addDrawing('scene-1', makeDrawing('d1'));

    expect(storage.updateDrawing('d1', { layer: 'effects' })?.layer).toBe(
      'effects',
    );
    expect(storage.updateDrawing('missing', {})).toBeNull();
    expect(storage.deleteDrawing('d1')).toBe(true);
    expect(storage.deleteDrawing('d1')).toBe(false);
  });

  it('createScene, updateScene, deleteScene and getSceneWithData round-trip', async () => {
    const storage = newStorage();
    const { id, ...sceneData } = makeScene();
    void id;
    const created = await storage.createScene(sceneData);

    expect(storage.updateScene(created.id, { name: 'Renamed' })?.name).toBe(
      'Renamed',
    );
    expect(storage.getSceneWithData(created.id).scene?.id).toBe(created.id);
    expect(storage.getSceneWithData('missing')).toEqual({
      scene: null,
      tokens: [],
      drawings: [],
    });
    expect(storage.deleteScene(created.id)).toBe(true);
    expect(storage.deleteScene(created.id)).toBe(false);
  });

  it('getGameConfig returns null when no config exists for the room', () => {
    const storage = newStorage();
    storage.saveGameConfig('ABCD', makeGameConfig());

    expect(storage.getGameConfig('ABCD')?.maxPlayers).toBe(5);
    expect(storage.getGameConfig('WXYZ')).toBeNull();
  });

  it('deleteCharacter deletes by id', () => {
    const storage = newStorage();
    const saved = storage.saveCharacter(makeCharacter('c1', 'Arden'));

    expect(storage.deleteCharacter(saved.id)).toBe(true);
    expect(storage.deleteCharacter(saved.id)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Stats and the remaining cheap destructive helpers
// ---------------------------------------------------------------------------

describe('LinearFlowStorage stats and teardown helpers', () => {
  it('getStats proxies the entity store counters', async () => {
    const storage = newStorage();
    expect(storage.getStats()).toMatchObject({
      entities: 0,
      relationships: 0,
      types: 0,
      isDirty: false,
    });

    await storage.saveScene(makeScene());

    expect(storage.getStats()).toMatchObject({ entities: 1, isDirty: true });
  });

  it('createTestData seeds a session, scene and character', () => {
    const storage = newStorage();

    storage.createTestData();

    const store = internals(storage).store;
    expect(store.getByType('session')).toHaveLength(1);
    expect(store.getByType('scene')).toHaveLength(1);
    // BUG (same `create()` spread as the drawings): the character payload
    // carries `type: 'player'`, so the entity's own type is overwritten while
    // it stays indexed under 'character'.
    expect(store.getByType('character')).toHaveLength(1);
    expect(store.getByType('character')[0].type).toBe('player');
  });

  it('clearGameData deletes scenes and drawings but keeps characters', async () => {
    const storage = newStorage();
    await storage.saveScene(makeScene({ id: 'scene-1' }));
    await storage.saveDrawings('scene-1', [makeDrawing('d1')]);
    storage.saveCharacter(makeCharacter('c1', 'Arden'));

    await storage.clearGameData();

    const store = internals(storage).store;
    expect(store.getByType('scene')).toEqual([]);
    expect(store.getByType('character')).toHaveLength(1);
    // 1 character + 2 'browser-id' entities: one per `getBrowserId()` call
    // (`saveCharacter`, then `clearSession`). The scene and drawing entities are
    // gone, though the 'drawing' index retains dangling ids (see above).
    expect(storage.getStats().entities).toBe(3);
    expect(store.getByType('browser-id')).toHaveLength(2);
  });

  it('exportCampaign/importCampaign round-trip through the entity store', async () => {
    const source = newStorage();
    await source.saveScene(makeScene({ id: 'scene-1', name: 'Exported' }));

    const backup = await source.exportCampaign();
    expect(backup.byteLength).toBeGreaterThan(0);

    const target = newStorage();
    await target.importCampaign(backup);

    expect(target.getScenes().map((scene) => scene.name)).toEqual(['Exported']);
  });

  it('syncScenesWithGameStore pushes entity scenes into gameStore and picks an active scene', async () => {
    const storage = newStorage();
    await storage.saveScene(makeScene({ id: 'scene-1', name: 'One' }));

    const result = await storage.syncScenesWithGameStore();

    expect(result).toEqual({ synced: 1, errors: [] });
    const { useGameStore } = await import('@/stores/gameStore');
    const sceneState = useGameStore.getState().sceneState;
    expect(sceneState.scenes.map((scene) => scene.id)).toEqual(['scene-1']);
    expect(sceneState.activeSceneId).toBe('scene-1');
  });

  it('syncScenesWithGameStore reports the error instead of throwing', async () => {
    const storage = newStorage();
    vi.spyOn(storage, 'getScenes').mockImplementation(() => {
      throw new Error('query failed');
    });

    await expect(storage.syncScenesWithGameStore()).resolves.toEqual({
      synced: 0,
      errors: ['Error: query failed'],
    });
  });

  it('resetDatabase clears its three localStorage keys and resolves', async () => {
    const storage = newStorage();
    localStorage.setItem('nexus-app-flow', '{}');
    localStorage.setItem('nexus-characters', '[]');
    localStorage.setItem('nexus-sessions', '[]');
    localStorage.setItem('nexus-scenes', '[]');

    await storage.resetDatabase();

    // Note the mismatch with `cleanupMigrationData()`: this path clears
    // `nexus-app-flow` and `nexus-sessions` but leaves `nexus-scenes`.
    expect(lsKeys()).toEqual(['nexus-scenes']);
  });

  it('resetDatabase resolves even when a database deletion errors or is blocked', async () => {
    const storage = newStorage();
    let call = 0;
    const deleteDatabase = vi
      .spyOn(indexedDB, 'deleteDatabase')
      .mockImplementation(() => {
        call += 1;
        const request = {
          error: new Error('locked'),
          onsuccess: null,
          onerror: null as null | (() => void),
          onblocked: null as null | (() => void),
        };
        // Fire on the next tick, once the production code has attached handlers.
        queueMicrotask(() => {
          if (call === 1) request.onerror?.();
          else request.onblocked?.();
        });
        return request as unknown as IDBOpenDBRequest;
      });

    await expect(storage.resetDatabase()).resolves.toBeUndefined();
    expect(deleteDatabase).toHaveBeenCalledTimes(2);
  });

  it('clearAllData only drops the migration flag, despite its name and warning', async () => {
    const storage = newStorage();
    localStorage.setItem('nexus-migration-complete', 'true');
    await storage.saveScene(makeScene());

    await storage.clearAllData();

    expect(localStorage.getItem('nexus-migration-complete')).toBeNull();
    // No campaign data is cleared at all.
    expect(storage.getScenes()).toHaveLength(1);
  });
});
