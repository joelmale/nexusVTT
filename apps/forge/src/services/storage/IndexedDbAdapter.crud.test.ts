import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Character, Encounter, NPC, UserMonster } from '../../types/dnd';
import type { SpellbookEntry } from './IStorageService';
import { IndexedDbAdapter } from './IndexedDbAdapter';

// The adapter stores whatever it is given; these fixtures only carry the
// fields the persistence layer reads, so they are cast rather than fully typed.
const character = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    name: `Hero ${id}`,
    edition: '2024',
    resources: [{}],
    ...extra,
  }) as unknown as Character;
const monster = (id: string) =>
  ({ id, name: `Monster ${id}` }) as unknown as UserMonster;
const npc = (id: string) => ({ id, name: `NPC ${id}` }) as unknown as NPC;
const spellbook = (id: string) =>
  ({ id, name: `Book ${id}` }) as unknown as SpellbookEntry;
const encounter = (id: string, monsterIds: string[] = ['m1']) =>
  ({ id, name: `Encounter ${id}`, monsterIds }) as unknown as Encounter;

let storage: IndexedDbAdapter;

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  storage = new IndexedDbAdapter();
});

describe('IndexedDbAdapter characters', () => {
  it('adds, updates and deletes characters', async () => {
    expect(await storage.addCharacter(character('a'))).toBe('a');
    await storage.addCharacter(character('b'));
    expect((await storage.getAllCharacters()).map((c) => c.id).sort()).toEqual([
      'a',
      'b',
    ]);

    await storage.updateCharacter(character('a', { name: 'Renamed' }));
    const all = await storage.getAllCharacters();
    expect(all.find((c) => c.id === 'a')?.name).toBe('Renamed');

    await storage.deleteCharacter('a');
    expect((await storage.getAllCharacters()).map((c) => c.id)).toEqual(['b']);
  });

  it('backfills a missing edition on read without rewriting other fields', async () => {
    await storage.addCharacter(
      character('legacy', { edition: undefined, hitPoints: 7 }),
    );
    const [loaded] = await storage.getAllCharacters();
    expect(loaded.edition).toBe('2014');
    expect(loaded).toMatchObject({ id: 'legacy', hitPoints: 7 });
  });
});

describe('IndexedDbAdapter custom monsters', () => {
  it('adds, updates and deletes custom monsters', async () => {
    expect(await storage.addCustomMonster(monster('m1'))).toBe('m1');
    await storage.updateCustomMonster({ ...monster('m1'), name: 'Changed' });
    expect(await storage.getAllCustomMonsters()).toEqual([
      expect.objectContaining({ id: 'm1', name: 'Changed' }),
    ]);
    await storage.deleteCustomMonster('m1');
    expect(await storage.getAllCustomMonsters()).toEqual([]);
  });

  it('rejects adding a monster whose id already exists', async () => {
    await storage.addCustomMonster(monster('dup'));
    await expect(storage.addCustomMonster(monster('dup'))).rejects.toBeTruthy();
  });
});

describe('IndexedDbAdapter favorites', () => {
  it('tracks favorite monsters', async () => {
    expect(await storage.isFavorite('goblin')).toBe(false);
    await storage.addFavorite('goblin');
    await storage.addFavorite('ogre');
    expect(await storage.isFavorite('goblin')).toBe(true);
    expect((await storage.getFavoriteMonsters()).sort()).toEqual([
      'goblin',
      'ogre',
    ]);

    await storage.removeFavorite('goblin');
    expect(await storage.isFavorite('goblin')).toBe(false);
    expect(await storage.getFavoriteMonsters()).toEqual(['ogre']);
  });
});

describe('IndexedDbAdapter encounters', () => {
  it('saves, reads and deletes encounters', async () => {
    expect(await storage.saveEncounter(encounter('e1'))).toBe('e1');
    expect(await storage.getEncounter('e1')).toMatchObject({
      name: 'Encounter e1',
    });
    expect(await storage.getEncounter('missing')).toBeUndefined();
    expect(await storage.getAllEncounters()).toHaveLength(1);

    await storage.saveEncounter({ ...encounter('e1'), name: 'Edited' });
    expect(await storage.getEncounter('e1')).toMatchObject({ name: 'Edited' });

    await storage.deleteEncounter('e1');
    expect(await storage.getAllEncounters()).toEqual([]);
  });

  it('rejects encounters that are incomplete or empty', async () => {
    await expect(
      storage.saveEncounter({
        id: '',
        name: 'x',
        monsterIds: ['m'],
      } as unknown as Encounter),
    ).rejects.toThrow('Invalid encounter data');
    await expect(
      storage.saveEncounter({ id: 'e', name: 'x' } as unknown as Encounter),
    ).rejects.toThrow('Invalid encounter data');
    await expect(storage.saveEncounter(encounter('e', []))).rejects.toThrow(
      'no monsters',
    );
  });
});

describe('IndexedDbAdapter NPCs', () => {
  it('adds, updates and deletes NPCs', async () => {
    expect(await storage.addNPC(npc('n1'))).toBe('n1');
    await storage.updateNPC({ ...npc('n1'), name: 'Changed' });
    expect(await storage.getAllNPCs()).toEqual([
      expect.objectContaining({ id: 'n1', name: 'Changed' }),
    ]);
    await storage.deleteNPC('n1');
    expect(await storage.getAllNPCs()).toEqual([]);
  });
});

describe('IndexedDbAdapter spellbooks', () => {
  it('adds, updates and deletes spellbooks', async () => {
    expect(await storage.addSpellbook(spellbook('s1'))).toBe('s1');
    await storage.updateSpellbook({ ...spellbook('s1'), name: 'Changed' });
    expect(await storage.getAllSpellbooks()).toEqual([
      expect.objectContaining({ id: 's1', name: 'Changed' }),
    ]);
    await storage.deleteSpellbook('s1');
    expect(await storage.getAllSpellbooks()).toEqual([]);
  });
});
