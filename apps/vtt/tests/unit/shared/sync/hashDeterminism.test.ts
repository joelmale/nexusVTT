// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  canonicalStringify,
  hashState,
  type JsonValue,
} from '../../../../shared/sync/contracts.js';
import { hashSync } from '../../../../shared/sync/hashSync.js';

describe('hash determinism', () => {
  describe('canonicalStringify: key-order independence', () => {
    it('produces identical output for objects with different key insertion order', () => {
      const obj1 = { a: 1, b: 2, c: 3 };
      const obj2 = { c: 3, a: 1, b: 2 };
      const obj3 = { b: 2, c: 3, a: 1 };

      const str1 = canonicalStringify(obj1);
      const str2 = canonicalStringify(obj2);
      const str3 = canonicalStringify(obj3);

      expect(str1).toBe(str2);
      expect(str2).toBe(str3);
      // Verify lexicographic order: a, b, c
      expect(str1).toBe('{"a":1,"b":2,"c":3}');
    });

    it('handles deeply nested objects with reordered keys at multiple depths', () => {
      const obj1 = {
        root: { z: 1, a: 2 },
        nested: { y: 3, b: 4, x: { q: 5, p: 6 } },
      };
      const obj2 = {
        nested: { x: { p: 6, q: 5 }, b: 4, y: 3 },
        root: { a: 2, z: 1 },
      };

      const str1 = canonicalStringify(obj1);
      const str2 = canonicalStringify(obj2);

      expect(str1).toBe(str2);
      // Verify all keys are sorted at each level
      expect(str1).toContain('{"nested":{"b":4,"x":{"p":6,"q":5},"y":3},"root":{"a":2,"z":1}}');
    });

    it('preserves array element order (order matters for arrays)', () => {
      const arr1 = [1, 2, 3];
      const arr2 = [3, 2, 1];

      const str1 = canonicalStringify(arr1);
      const str2 = canonicalStringify(arr2);

      expect(str1).toBe('[1,2,3]');
      expect(str2).toBe('[3,2,1]');
      expect(str1).not.toBe(str2);
    });

    it('sorts keys correctly with numeric-looking strings', () => {
      const obj1 = { '10': 'a', '2': 'b', '1': 'c' };
      const obj2 = { '2': 'b', '10': 'a', '1': 'c' };

      const str1 = canonicalStringify(obj1);
      const str2 = canonicalStringify(obj2);

      expect(str1).toBe(str2);
      // Lexicographic order: '1', '10', '2' (not numeric order)
      expect(str1).toBe('{"1":"c","10":"a","2":"b"}');
    });
  });

  describe('hashState vs hashSync: cross-runtime invariant', () => {
    const testFixtures: Array<[string, JsonValue]> = [
      ['empty object', {}],
      ['empty array', []],
      ['null', null],
      ['boolean true', true],
      ['boolean false', false],
      ['integer', 42],
      ['negative integer', -42],
      ['zero', 0],
      ['float', 3.14159],
      ['string', 'hello world'],
      ['empty string', ''],
      ['unicode emoji', '🎮🎲✨'],
      ['accented chars', 'café naïve résumé'],
      ['simple object', { name: 'test', value: 123 }],
      ['simple array', [1, 'two', true, null]],
      [
        'nested structure',
        {
          level1: {
            level2: {
              level3: [1, 2, { deep: 'value' }],
            },
          },
        },
      ],
      [
        'mixed arrays and objects',
        [
          { id: 1, tags: ['a', 'b'] },
          { id: 2, tags: ['c', 'd'] },
          null,
          [1, 2, 3],
        ],
      ],
    ];

    testFixtures.forEach(([label, fixture]) => {
      it(`async hashState === sync hashSync for: ${label}`, async () => {
        const asyncHash = await hashState(fixture);
        const syncHash = hashSync(fixture);

        expect(asyncHash).toBe(syncHash);
        expect(typeof asyncHash).toBe('string');
        expect(asyncHash.length).toBe(64); // SHA-256 hex is 64 chars
      });
    });
  });

  describe('hashState & hashSync: order sensitivity for arrays', () => {
    it('different array order produces different hash', async () => {
      const arr1 = [1, 2, 3];
      const arr2 = [3, 2, 1];

      const hash1 = await hashState(arr1);
      const hash2 = await hashState(arr2);

      expect(hash1).not.toBe(hash2);
    });

    it('different array order produces different sync hash', () => {
      const arr1 = [1, 2, 3];
      const arr2 = [3, 2, 1];

      const hash1 = hashSync(arr1);
      const hash2 = hashSync(arr2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('realistic SyncableGameState fixtures', () => {
    // Build the same logical state with different object key orders
    const buildGameState1 = () => ({
      scenes: [
        {
          id: 'scene-1',
          name: 'Tavern',
          map: 'tavern.png',
          tokens: [
            { id: 'token-1', x: 100, y: 200, label: 'Goblin' },
            { id: 'token-2', x: 300, y: 400, label: 'Orc' },
          ],
        },
      ],
      activeSceneId: 'scene-1',
      characters: [
        { id: 'char-1', name: 'Wizard', hp: 15, ac: 12 },
        { id: 'char-2', name: 'Rogue', hp: 12, ac: 14 },
      ],
      initiative: [
        { characterId: 'char-1', roll: 18 },
        { characterId: 'char-2', roll: 14 },
      ],
    });

    const buildGameState2 = () => ({
      // Reorder keys at root level
      activeSceneId: 'scene-1',
      initiative: [
        { roll: 18, characterId: 'char-1' },
        { roll: 14, characterId: 'char-2' },
      ],
      characters: [
        { hp: 15, id: 'char-1', ac: 12, name: 'Wizard' },
        { ac: 14, name: 'Rogue', id: 'char-2', hp: 12 },
      ],
      scenes: [
        {
          tokens: [
            { label: 'Goblin', id: 'token-1', x: 100, y: 200 },
            { y: 400, label: 'Orc', x: 300, id: 'token-2' },
          ],
          map: 'tavern.png',
          name: 'Tavern',
          id: 'scene-1',
        },
      ],
    });

    it('produces identical canonicalStringify for logically identical game state with different key orders', () => {
      const state1 = buildGameState1();
      const state2 = buildGameState2();

      const str1 = canonicalStringify(state1);
      const str2 = canonicalStringify(state2);

      expect(str1).toBe(str2);
    });

    it('produces identical async hash for logically identical game state with different key orders', async () => {
      const state1 = buildGameState1();
      const state2 = buildGameState2();

      const hash1 = await hashState(state1);
      const hash2 = await hashState(state2);

      expect(hash1).toBe(hash2);
    });

    it('produces identical sync hash for logically identical game state with different key orders', () => {
      const state1 = buildGameState1();
      const state2 = buildGameState2();

      const hash1 = hashSync(state1);
      const hash2 = hashSync(state2);

      expect(hash1).toBe(hash2);
    });

    it('produces different hash when logical state differs', async () => {
      const state1 = buildGameState1();
      const state2 = buildGameState2();

      // Modify state2 logically
      const mutableChar = state2.characters[0] as Record<string, unknown>;
      mutableChar.hp = 10; // Changed from 15

      const hash1 = await hashState(state1);
      const hash2 = await hashState(state2);

      expect(hash1).not.toBe(hash2);
    });

    it('produces different sync hash when logical state differs', () => {
      const state1 = buildGameState1();
      const state2 = buildGameState2();

      // Modify state2 logically
      const mutableChar = state2.characters[0] as Record<string, unknown>;
      mutableChar.hp = 10; // Changed from 15

      const hash1 = hashSync(state1);
      const hash2 = hashSync(state2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('edge cases', () => {
    it('handles very deep nesting', async () => {
      let deep: JsonValue = { value: 42 };
      for (let i = 0; i < 20; i++) {
        deep = { nested: deep };
      }

      const asyncHash = await hashState(deep);
      const syncHash = hashSync(deep);

      expect(asyncHash).toBe(syncHash);
    });

    it('handles large arrays', async () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        data: `item-${i}`,
      }));

      const asyncHash = await hashState(largeArray);
      const syncHash = hashSync(largeArray);

      expect(asyncHash).toBe(syncHash);
    });

    it('handles unicode across all object depths', async () => {
      const state = {
        日本語: {
          '中文': ['한글', '🎮'],
          emoji: { test: '✨🎲🎯' },
        },
        русский: [
          { עברית: 'مصر' },
        ],
      };

      const asyncHash = await hashState(state);
      const syncHash = hashSync(state);

      expect(asyncHash).toBe(syncHash);
    });

    it('handles numbers with various formats', async () => {
      const state = {
        zero: 0,
        negative: -999,
        float: 3.141592653589793,
        largeInt: 9007199254740991, // MAX_SAFE_INTEGER
        scientific: 1e-10,
      };

      const asyncHash = await hashState(state);
      const syncHash = hashSync(state);

      expect(asyncHash).toBe(syncHash);
    });

    it('produces different hash when same values in different structure', async () => {
      const state1 = { items: [1, 2, 3] };
      const state2 = { items: [[1, 2, 3]] };

      const hash1 = await hashState(state1);
      const hash2 = await hashState(state2);

      expect(hash1).not.toBe(hash2);
    });

    it('produces different hash for similar objects with different shapes', () => {
      const state1 = { a: { b: 1 } };
      const state2 = { a: [{ b: 1 }] };

      const hash1 = hashSync(state1);
      const hash2 = hashSync(state2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('consistency across multiple calls', () => {
    it('produces same hash when called multiple times with same input', async () => {
      const state = { scenes: [{ id: '1', tokens: [] }], activeSceneId: '1' };

      const hash1 = await hashState(state);
      const hash2 = await hashState(state);
      const hash3 = await hashState(state);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it('sync hash is consistent across multiple calls', () => {
      const state = { scenes: [{ id: '1', tokens: [] }], activeSceneId: '1' };

      const hash1 = hashSync(state);
      const hash2 = hashSync(state);
      const hash3 = hashSync(state);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });
  });
});
