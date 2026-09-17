/**
 * @file src/services/serialization.test.ts
 * @description Characterization tests for SerializationService and
 * SerializingIndexedDBAdapter.
 *
 * IMPORTANT: these tests describe what the code does *today*, not what its doc
 * comments promise. `serialization.ts` advertises Transit.js support, but the
 * `transitWrite`/`transitRead` helpers are stubs over `JSON.stringify` /
 * `JSON.parse`. Every assertion below that looks lossy is deliberate and
 * carries a comment naming the gap, so a future refactor that swaps in real
 * Transit (or removes the stub) fails loudly here instead of silently changing
 * on-disk formats.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { encode, decode } from '@msgpack/msgpack';
import {
  SerializationService,
  SerializingIndexedDBAdapter,
} from '@/services/serialization';
import type { StorageAdapter } from '@/types/hybrid';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * In-memory StorageAdapter. Every method is a `vi.fn` so delegation can be
 * asserted with spies without wrapping the object again.
 */
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

/** Envelope shape written by SerializingIndexedDBAdapter.save(). */
interface SavedEnvelope {
  serialized: string | Uint8Array;
  format: string;
  timestamp: number;
}

/**
 * A JSON-safe payload whose serialized length exceeds the 50000-byte auto
 * threshold and which contains nothing `hasComplexTypes` recognises: no
 * `{x,y}`, no `{r,g,b}`, no Date/Map/Set/ArrayBuffer/Uint8Array.
 */
function makeLargeSimplePayload(): { entries: string[] } {
  return {
    entries: Array.from({ length: 1200 }, (_, i) => `entry-${i}-`.padEnd(60, 'z')),
  };
}

function makeCircular(): Record<string, unknown> {
  const circular: Record<string, unknown> = { label: 'loop' };
  circular.self = circular;
  return circular;
}

// The service console.errors on every throw path; keep suite output readable
// without hiding unexpected errors from other code (the spy is per-test and
// restored immediately).
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// SerializationService
// ---------------------------------------------------------------------------

describe('SerializationService', () => {
  describe('transit serialization', () => {
    it('round-trips JSON-safe objects, arrays and primitives unchanged', () => {
      const data = {
        id: 'scene-1',
        name: 'Goblin Ambush',
        active: true,
        order: 3,
        ratio: 1.25,
        parent: null,
        tags: ['forest', 'night'],
        nested: { grid: { size: 70, snap: false }, layers: [1, 2, 3] },
      };

      const serialized = SerializationService.serializeTransit(data);
      expect(typeof serialized).toBe('string');
      expect(SerializationService.deserializeTransit(serialized)).toEqual(data);
    });

    it('round-trips top-level primitives and null', () => {
      expect(
        SerializationService.deserializeTransit(
          SerializationService.serializeTransit(null),
        ),
      ).toBeNull();
      expect(
        SerializationService.deserializeTransit(
          SerializationService.serializeTransit(42),
        ),
      ).toBe(42);
      expect(
        SerializationService.deserializeTransit(
          SerializationService.serializeTransit('hello'),
        ),
      ).toBe('hello');
      expect(
        SerializationService.deserializeTransit(
          SerializationService.serializeTransit(false),
        ),
      ).toBe(false);
    });

    // GAP: the module doc claims Transit.js "handles complex data types", but
    // transitWrite/transitRead are JSON.stringify/JSON.parse stubs, so a Map's
    // entries are silently dropped. Verified empirically.
    it('drops Map entries entirely (JSON stub, not real Transit)', () => {
      const serialized = SerializationService.serializeTransit(
        new Map([
          ['a', 1],
          ['b', 2],
        ]),
      );
      expect(serialized).toBe('{}');
      expect(SerializationService.deserializeTransit(serialized)).toEqual({});
    });

    // GAP: same stub — Set members are lost.
    it('drops Set members entirely (JSON stub, not real Transit)', () => {
      const serialized = SerializationService.serializeTransit(
        new Set([1, 2, 3]),
      );
      expect(serialized).toBe('{}');
      expect(SerializationService.deserializeTransit(serialized)).toEqual({});
    });

    // GAP: a Date survives as an ISO *string*; callers that expect a Date back
    // get a string and will fail on `.getTime()`.
    it('degrades a Date into an ISO string instead of a Date', () => {
      const date = new Date('2026-09-17T12:34:56.000Z');
      const restored =
        SerializationService.deserializeTransit<unknown>(
          SerializationService.serializeTransit(date),
        );

      expect(restored).toBe('2026-09-17T12:34:56.000Z');
      expect(restored).not.toBeInstanceOf(Date);
    });

    // GAP: binary data becomes an index-keyed plain object, so byte payloads
    // round-tripped through this path are unusable without manual repair.
    it('degrades a Uint8Array into an index-keyed plain object', () => {
      const restored = SerializationService.deserializeTransit<unknown>(
        SerializationService.serializeTransit(new Uint8Array([1, 2, 255])),
      );

      expect(restored).toEqual({ '0': 1, '1': 2, '2': 255 });
      expect(restored).not.toBeInstanceOf(Uint8Array);
    });

    it('degrades complex values nested inside a plain object', () => {
      const restored = SerializationService.deserializeTransit<unknown>(
        SerializationService.serializeTransit({
          visited: new Set(['a']),
          byId: new Map([['a', 1]]),
          createdAt: new Date(0),
        }),
      );

      expect(restored).toEqual({
        visited: {},
        byId: {},
        createdAt: '1970-01-01T00:00:00.000Z',
      });
    });

    it('throws a wrapped error, preserving the cause, for circular data', () => {
      let thrown: unknown;
      try {
        SerializationService.serializeTransit(makeCircular());
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toContain(
        'Failed to serialize with Transit',
      );
      expect((thrown as Error).cause).toBeInstanceOf(TypeError);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('throws a wrapped error for a malformed serialized string', () => {
      let thrown: unknown;
      try {
        SerializationService.deserializeTransit('{"unterminated":');
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toContain(
        'Failed to deserialize with Transit',
      );
      expect((thrown as Error).cause).toBeInstanceOf(SyntaxError);
    });
  });

  describe('MessagePack serialization', () => {
    it('round-trips JSON-safe nested data', () => {
      const data = {
        scenes: [{ id: 's1', width: 1920 }, { id: 's2', width: 640 }],
        activeSceneId: 's1',
        flags: { fog: true, grid: false },
      };

      const packed = SerializationService.serializeMessagePack(data);
      expect(packed).toBeInstanceOf(Uint8Array);
      expect(SerializationService.deserializeMessagePack(packed)).toEqual(data);
    });

    // Unlike the transit stub, MessagePack genuinely preserves binary.
    it('preserves a Uint8Array as binary', () => {
      const bytes = new Uint8Array([0, 1, 127, 128, 255]);
      const restored = SerializationService.deserializeMessagePack<unknown>(
        SerializationService.serializeMessagePack(bytes),
      );

      expect(restored).toBeInstanceOf(Uint8Array);
      expect(Array.from(restored as Uint8Array)).toEqual([
        0, 1, 127, 128, 255,
      ]);
    });

    // MessagePack's timestamp extension is enabled by default, so this path
    // really does return a Date — which the transit path does not.
    it('preserves a Date as a Date', () => {
      const date = new Date('2026-09-17T12:34:56.000Z');
      const restored = SerializationService.deserializeMessagePack<unknown>(
        SerializationService.serializeMessagePack(date),
      );

      expect(restored).toBeInstanceOf(Date);
      expect((restored as Date).getTime()).toBe(date.getTime());
    });

    it('preserves a Date nested inside an object', () => {
      const restored = SerializationService.deserializeMessagePack<{
        createdAt: Date;
      }>(
        SerializationService.serializeMessagePack({
          createdAt: new Date(1234567890123),
        }),
      );

      expect(restored.createdAt).toBeInstanceOf(Date);
      expect(restored.createdAt.getTime()).toBe(1234567890123);
    });

    // GAP: @msgpack/msgpack has no Map/Set extension configured here, so both
    // encode as an object with no own enumerable properties and come back
    // empty. MessagePack is lossy for Map/Set exactly like the transit stub.
    it('drops Map and Set contents', () => {
      expect(
        SerializationService.deserializeMessagePack<unknown>(
          SerializationService.serializeMessagePack(new Map([['a', 1]])),
        ),
      ).toEqual({});
      expect(
        SerializationService.deserializeMessagePack<unknown>(
          SerializationService.serializeMessagePack(new Set([1, 2])),
        ),
      ).toEqual({});
    });

    it('throws a wrapped error for undecodable bytes', () => {
      let thrown: unknown;
      try {
        // 0xc1 is the never-used byte in the MessagePack spec.
        SerializationService.deserializeMessagePack(
          new Uint8Array([0xc1, 0xc1, 0xc1]),
        );
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toContain(
        'Failed to deserialize with MessagePack',
      );
      expect((thrown as Error).cause).toBeDefined();
    });

    it('throws a wrapped error when encoding recurses too deeply', () => {
      let thrown: unknown;
      try {
        SerializationService.serializeMessagePack(makeCircular());
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toContain(
        'Failed to serialize with MessagePack',
      );
    });
  });

  describe('serialize with an explicit format', () => {
    const data = { id: 'token-1', label: 'Goblin' };

    it('returns a transit string when asked for transit', () => {
      const result = SerializationService.serialize(data, 'transit');
      expect(typeof result).toBe('string');
      expect(result).toBe(JSON.stringify(data));
    });

    it('returns bytes when asked for msgpack', () => {
      const result = SerializationService.serialize(data, 'msgpack');
      expect(result).toBeInstanceOf(Uint8Array);
      expect(decode(result as Uint8Array)).toEqual(data);
    });

    it('returns a JSON string when asked for json', () => {
      expect(SerializationService.serialize(data, 'json')).toBe(
        JSON.stringify(data),
      );
    });

    // The transit stub and the json branch are byte-identical today; this pins
    // that so a real Transit implementation shows up as a failure here.
    it('produces identical output for transit and json today', () => {
      expect(SerializationService.serialize(data, 'transit')).toBe(
        SerializationService.serialize(data, 'json'),
      );
    });
  });

  describe('serialize in auto mode', () => {
    it('uses the transit string path when a Date is present', () => {
      const result = SerializationService.serialize(
        { createdAt: new Date(0) },
        'auto',
      );
      expect(typeof result).toBe('string');
      expect(result).toBe('{"createdAt":"1970-01-01T00:00:00.000Z"}');
    });

    it('uses the transit path when a Map, Set or Uint8Array is present', () => {
      for (const value of [new Map(), new Set(), new Uint8Array([1])]) {
        expect(typeof SerializationService.serialize({ value }, 'auto')).toBe(
          'string',
        );
      }
    });

    it('uses the transit path for a top-level ArrayBuffer', () => {
      expect(
        typeof SerializationService.serialize(new ArrayBuffer(8), 'auto'),
      ).toBe('string');
    });

    // The `{x, y}` heuristic is the dominant one in practice: every VTT token
    // position and camera object matches it, so nearly all real game data is
    // classified "complex" and routed to the JSON stub.
    it('treats a plain {x, y} position object as complex', () => {
      const result = SerializationService.serialize({ x: 10, y: 20 }, 'auto');
      expect(typeof result).toBe('string');
      expect(result).toBe('{"x":10,"y":20}');
    });

    it('treats a plain {r, g, b} colour object as complex', () => {
      expect(
        typeof SerializationService.serialize({ r: 1, g: 2, b: 3 }, 'auto'),
      ).toBe('string');
    });

    it('does not treat {r, g} without b as complex', () => {
      // Small + simple => plain JSON, which is the same string either way, so
      // assert via the large-payload switch instead in the msgpack test below.
      expect(SerializationService.serialize({ r: 1, g: 2 }, 'auto')).toBe(
        '{"r":1,"g":2}',
      );
    });

    it('detects a complex value nested inside an array', () => {
      const result = SerializationService.serialize(
        [{ id: 'a' }, { id: 'b', at: new Date(0) }],
        'auto',
      );
      expect(typeof result).toBe('string');
      expect(result).toContain('1970-01-01T00:00:00.000Z');
    });

    it('detects a complex value nested deep inside object values', () => {
      const large = makeLargeSimplePayload();
      const withNestedPosition = {
        ...large,
        scene: { tokens: { 't1': { pos: { x: 1, y: 2 } } } },
      };

      // Large enough for msgpack, but the nested {x,y} wins => string.
      expect(JSON.stringify(withNestedPosition).length).toBeGreaterThan(50000);
      expect(typeof SerializationService.serialize(withNestedPosition, 'auto'))
        .toBe('string');
    });

    it('uses msgpack for large payloads with no complex types', () => {
      const payload = makeLargeSimplePayload();
      expect(JSON.stringify(payload).length).toBeGreaterThan(50000);

      const result = SerializationService.serialize(payload, 'auto');
      expect(result).toBeInstanceOf(Uint8Array);
      expect(decode(result as Uint8Array)).toEqual(payload);
    });

    it('uses plain JSON for small, simple payloads', () => {
      const result = SerializationService.serialize(
        { roomCode: 'ABCD', players: ['a', 'b'] },
        'auto',
      );
      expect(typeof result).toBe('string');
      expect(result).toBe('{"roomCode":"ABCD","players":["a","b"]}');
    });

    // GAP: because a single `{x, y}` anywhere in the tree forces the transit
    // branch, the 50000-byte msgpack size optimisation is effectively
    // unreachable for real VTT game state (scenes contain token positions and
    // a camera). This test documents that ordering.
    it('never reaches msgpack for a large payload containing a position', () => {
      const payload = {
        ...makeLargeSimplePayload(),
        camera: { x: 0, y: 0, zoom: 1 },
      };
      expect(JSON.stringify(payload).length).toBeGreaterThan(50000);

      const result = SerializationService.serialize(payload, 'auto');
      expect(result).not.toBeInstanceOf(Uint8Array);
      expect(typeof result).toBe('string');
    });
  });

  describe('deserialize dispatch', () => {
    it('decodes Uint8Array input as MessagePack', () => {
      const packed = encode({ id: 'a', n: 1 });
      expect(SerializationService.deserialize(packed)).toEqual({
        id: 'a',
        n: 1,
      });
    });

    // Every serialized Entity carries a `type` field, so this branch is taken
    // constantly in production. Both paths are JSON today, so output matches.
    it('routes a string containing a type field through the transit branch', () => {
      const serialized = '{"type":"token","id":"t1"}';
      expect(SerializationService.deserialize(serialized)).toEqual({
        type: 'token',
        id: 't1',
      });
    });

    it('routes a string containing a transit tag through the transit branch', () => {
      // `~#` is Transit's tag marker; here it is just string content, and the
      // transit stub parses the surrounding JSON fine.
      const serialized = '{"tag":"~#set","values":[1,2]}';
      expect(SerializationService.deserialize(serialized)).toEqual({
        tag: '~#set',
        values: [1, 2],
      });
    });

    it('parses a plain JSON string without the transit branch', () => {
      expect(SerializationService.deserialize('{"id":"t1","n":2}')).toEqual({
        id: 't1',
        n: 2,
      });
    });

    // The documented "fall back to JSON" catch is reachable but cannot
    // succeed: the transit stub *is* JSON.parse, so if it throws, the fallback
    // throws the same way. The surfaced error is therefore the raw
    // SyntaxError, not the "Failed to deserialize with Transit" wrapper.
    it('surfaces the raw JSON SyntaxError when the transit branch fails', () => {
      let thrown: unknown;
      try {
        SerializationService.deserialize('{"type":"token", ');
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(SyntaxError);
      expect((thrown as Error).message).not.toContain(
        'Failed to deserialize with Transit',
      );
    });

    it('rejects input that is neither a string nor bytes', () => {
      // Deliberately invalid input to exercise the final guard.
      const invalid = 42 as unknown as string;
      expect(() => SerializationService.deserialize(invalid)).toThrow(
        'Invalid serialized data format',
      );
    });
  });

  describe('backup export and import', () => {
    const gameState = {
      sceneState: { scenes: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] },
      characterStore: { characters: [{ id: 'c1' }, { id: 'c2' }] },
      assetStore: { assets: { a1: {}, a2: {}, a3: {}, a4: {} } },
    };

    it('round-trips the wrapped game state with derived metadata', () => {
      const before = Date.now();
      const backup = SerializationService.createBackupData(gameState);
      expect(backup).toBeInstanceOf(Uint8Array);

      const parsed = SerializationService.parseBackupData<typeof gameState>(
        backup,
      );

      expect(parsed.version).toBe('1.0.0');
      expect(parsed.timestamp).toBeGreaterThanOrEqual(before);
      expect(parsed.data).toEqual(gameState);
      expect(parsed.metadata).toEqual({
        scenes: 3,
        characters: 2,
        assets: 4,
      });
    });

    it('records the exporter name in the envelope', () => {
      const decoded = decode(
        SerializationService.createBackupData(gameState),
      ) as { exportedBy: string };
      expect(decoded.exportedBy).toBe('Nexus VTT');
    });

    it('falls back to zero counts when the sub-stores are missing', () => {
      const parsed = SerializationService.parseBackupData(
        SerializationService.createBackupData({ somethingElse: true }),
      );

      expect(parsed.metadata).toEqual({
        scenes: 0,
        characters: 0,
        assets: 0,
      });
    });

    it('falls back to zero counts when the sub-stores are present but empty', () => {
      const parsed = SerializationService.parseBackupData(
        SerializationService.createBackupData({
          sceneState: {},
          characterStore: { characters: undefined },
          assetStore: { assets: undefined },
        }),
      );

      expect(parsed.metadata).toEqual({
        scenes: 0,
        characters: 0,
        assets: 0,
      });
    });

    it('rejects a payload with no version', () => {
      const packed = encode({ data: { anything: true } });
      expect(() => SerializationService.parseBackupData(packed)).toThrow(
        'Invalid backup file format',
      );
    });

    it('rejects a payload with no data', () => {
      const packed = encode({ version: '1.0.0', timestamp: 1 });
      expect(() => SerializationService.parseBackupData(packed)).toThrow(
        'Invalid backup file format',
      );
    });

    it('substitutes the current time when the timestamp is absent', () => {
      const before = Date.now();
      const parsed = SerializationService.parseBackupData(
        encode({ version: '1.0.0', data: { ok: true } }),
      );

      expect(parsed.timestamp).toBeGreaterThanOrEqual(before);
    });
  });
});

// ---------------------------------------------------------------------------
// SerializingIndexedDBAdapter
// ---------------------------------------------------------------------------

describe('SerializingIndexedDBAdapter', () => {
  let base: FakeAdapter;
  let adapter: SerializingIndexedDBAdapter;

  beforeEach(() => {
    base = createFakeAdapter();
    adapter = new SerializingIndexedDBAdapter(base);
  });

  describe('save', () => {
    it('stores the payload in a serialized envelope with a timestamp', async () => {
      const before = Date.now();
      await adapter.save('scene:1', { id: 's1', name: 'Cave' });

      const envelope = base.store.get('scene:1') as SavedEnvelope;
      expect(Object.keys(envelope).sort()).toEqual([
        'format',
        'serialized',
        'timestamp',
      ]);
      expect(envelope.serialized).toBe('{"id":"s1","name":"Cave"}');
      expect(envelope.timestamp).toBeGreaterThanOrEqual(before);
    });

    // GAP: save() hardcodes format 'transit', which routes *every* write
    // through the JSON stub regardless of content. The `msgpack` arm of the
    // ternary in save() is therefore dead code, and any Map/Set/Date handed to
    // this adapter would be silently flattened. EntityStore works around this
    // by flattening Maps/Sets itself before calling save, so nothing corrupts
    // today — but the latent gap is real.
    it('always labels the envelope transit, even for binary-ish data', async () => {
      await adapter.save('a', { bytes: new Uint8Array([1, 2, 3]) });
      await adapter.save('b', { at: new Date(0) });
      await adapter.save('c', { byId: new Map([['k', 1]]) });

      for (const key of ['a', 'b', 'c']) {
        expect((base.store.get(key) as SavedEnvelope).format).toBe('transit');
      }
      // The Map arrived as an empty object, proving the flattening.
      expect((base.store.get('c') as SavedEnvelope).serialized).toBe(
        '{"byId":{}}',
      );
    });
  });

  describe('load', () => {
    it('returns the value written by save', async () => {
      const value = { id: 's1', tags: ['a', 'b'], nested: { n: 1 } };
      await adapter.save('scene:1', value);

      expect(await adapter.load('scene:1')).toEqual(value);
    });

    it('returns null for a key that was never written', async () => {
      expect(await adapter.load('missing')).toBeNull();
    });

    it('returns a legacy record without an envelope as-is', async () => {
      const legacy = { id: 's1', name: 'Written before serialization' };
      await base.save('scene:legacy', legacy);

      expect(await adapter.load('scene:legacy')).toEqual(legacy);
    });
  });

  describe('delegation to the base adapter', () => {
    it('forwards delete', async () => {
      await adapter.delete('k');
      expect(vi.mocked(base.delete)).toHaveBeenCalledWith('k');
    });

    it('forwards clear', async () => {
      await adapter.clear();
      expect(vi.mocked(base.clear)).toHaveBeenCalledTimes(1);
    });

    // Note: saveBatch does NOT serialize; batched writes bypass the envelope
    // entirely, so loadBatch/load see raw data for those keys.
    it('forwards saveBatch without wrapping the items', async () => {
      const items = [{ key: 'a', data: { n: 1 } }];
      await adapter.saveBatch(items);

      expect(vi.mocked(base.saveBatch)).toHaveBeenCalledWith(items);
      expect(base.store.get('a')).toEqual({ n: 1 });
    });

    it('forwards loadBatch', async () => {
      await base.save('a', 1);
      expect(await adapter.loadBatch(['a', 'missing'])).toEqual([1, null]);
      expect(vi.mocked(base.loadBatch)).toHaveBeenCalledWith(['a', 'missing']);
    });

    it('forwards exists', async () => {
      await adapter.save('a', { n: 1 });
      expect(await adapter.exists('a')).toBe(true);
      expect(vi.mocked(base.exists)).toHaveBeenCalledWith('a');
    });

    it('forwards size', async () => {
      await adapter.save('a', { n: 1 });
      expect(await adapter.size()).toBe(1);
      expect(vi.mocked(base.size)).toHaveBeenCalledTimes(1);
    });

    it('forwards keys', async () => {
      await adapter.save('a', { n: 1 });
      expect(await adapter.keys()).toEqual(['a']);
      expect(vi.mocked(base.keys)).toHaveBeenCalledTimes(1);
    });
  });

  describe('exportData', () => {
    it('wraps the base adapter dump into a parseable backup', async () => {
      const dump = {
        sceneState: { scenes: [{ id: 's1' }] },
        characterStore: { characters: [] },
      };
      const exportingBase = Object.assign(createFakeAdapter(), {
        exportData: vi.fn(async () => dump),
      });
      const exporting = new SerializingIndexedDBAdapter(exportingBase);

      const bytes = await exporting.exportData!();

      expect(bytes).toBeInstanceOf(Uint8Array);
      const parsed = SerializationService.parseBackupData<typeof dump>(bytes);
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.data).toEqual(dump);
      expect(parsed.metadata).toEqual({
        scenes: 1,
        characters: 0,
        assets: 0,
      });
      expect(exportingBase.exportData).toHaveBeenCalledTimes(1);
    });

    it('throws when the base adapter cannot export', async () => {
      await expect(adapter.exportData!()).rejects.toThrow(
        'Base adapter does not support exportData',
      );
    });
  });

  describe('importData', () => {
    it('hands the unwrapped payload to the base adapter', async () => {
      const importingBase = Object.assign(createFakeAdapter(), {
        importData: vi.fn(async () => undefined),
      });
      const importing = new SerializingIndexedDBAdapter(importingBase);
      const gameState = { sceneState: { scenes: [{ id: 's1' }] } };

      await importing.importData!(
        SerializationService.createBackupData(gameState),
      );

      expect(importingBase.importData).toHaveBeenCalledTimes(1);
      expect(importingBase.importData).toHaveBeenCalledWith(gameState);
    });

    it('throws when the base adapter cannot import', async () => {
      await expect(
        adapter.importData!(SerializationService.createBackupData({})),
      ).rejects.toThrow('Base adapter does not support importData');
    });
  });
});
