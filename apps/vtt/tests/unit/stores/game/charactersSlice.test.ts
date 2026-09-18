import { describe, it, expect, beforeEach } from 'vitest';
import { createCharactersSlice } from '@/stores/game/charactersSlice';
import type { PlayerCharacter } from '@/types/game';

interface MockCharacterStore {
  user: { id: string; name: string };
  getSavedCharacters?: () => PlayerCharacter[];
  [key: string]: unknown;
}

describe('charactersSlice', () => {
  let store: MockCharacterStore;
  let slice: ReturnType<typeof createCharactersSlice>;

  beforeEach(() => {
    localStorage.clear();
    store = {
      user: { id: 'player-1', name: 'Aragorn' },
    };
    const get = () => store;
    slice = createCharactersSlice(get);
    Object.assign(store, slice);
  });

  describe('createCharacter and getSavedCharacters', () => {
    it('creates a character with defaults and saves it to localStorage', () => {
      const created = slice.createCharacter({
        name: 'Strider',
        race: 'Human',
        class: 'Ranger',
        level: 5,
        hp: { current: 40, max: 40 },
        stats: {
          strength: 16,
          dexterity: 14,
          constitution: 14,
          intelligence: 10,
          wisdom: 16,
          charisma: 12,
        },
      } as unknown as Partial<PlayerCharacter> as PlayerCharacter);

      expect(created.id).toBeDefined();
      expect(created.name).toBe('Strider');
      expect(created.edition).toBe('2024');
      expect(created.playerId).toBe('player-1');
      expect(created.createdAt).toBeGreaterThan(0);

      const saved = slice.getSavedCharacters();
      expect(saved).toHaveLength(1);
      expect(saved[0].name).toBe('Strider');
    });

    it('returns empty array if localStorage is corrupted or empty', () => {
      expect(slice.getSavedCharacters()).toEqual([]);

      localStorage.setItem('nexus-characters', '{invalid json}');
      expect(slice.getSavedCharacters()).toEqual([]);
    });
  });

  describe('saveCharacter and deleteCharacter', () => {
    it('updates an existing character when saved', () => {
      const char = slice.createCharacter({ name: 'Legolas', level: 1 } as unknown as Partial<PlayerCharacter> as PlayerCharacter);

      const updated = { ...char, level: 2 };
      slice.saveCharacter(updated);

      const saved = slice.getSavedCharacters();
      expect(saved).toHaveLength(1);
      expect(saved[0].level).toBe(2);
    });

    it('adds a new character if saving one not currently present', () => {
      const newChar: PlayerCharacter = {
        id: 'external-char',
        name: 'Gimli',
        race: 'Dwarf',
        class: 'Fighter',
        level: 3,
        hp: { current: 30, max: 30 },
        stats: { strength: 18, dexterity: 10, constitution: 16, intelligence: 10, wisdom: 12, charisma: 8 },
        createdAt: Date.now(),
        playerId: 'player-1',
      } as unknown as Partial<PlayerCharacter> as PlayerCharacter;

      slice.saveCharacter(newChar);
      expect(slice.getSavedCharacters()).toHaveLength(1);
      expect(slice.getSavedCharacters()[0].name).toBe('Gimli');
    });

    it('deletes an existing character by ID', () => {
      const c1 = slice.createCharacter({ name: 'Frodo' } as unknown as Partial<PlayerCharacter> as PlayerCharacter);
      slice.createCharacter({ name: 'Sam' } as unknown as Partial<PlayerCharacter> as PlayerCharacter);

      expect(slice.getSavedCharacters()).toHaveLength(2);

      slice.deleteCharacter(c1.id);
      const remaining = slice.getSavedCharacters();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].name).toBe('Sam');
    });
  });

  describe('selectCharacter', () => {
    it('finds character by id without error', () => {
      const char = slice.createCharacter({ name: 'Gandalf' } as unknown as Partial<PlayerCharacter> as PlayerCharacter);

      expect(() => slice.selectCharacter(char.id)).not.toThrow();
      expect(() => slice.selectCharacter('non-existent')).not.toThrow();
    });
  });

  describe('exportCharacters and importCharacters', () => {
    it('exports characters in valid JSON format with metadata', () => {
      slice.createCharacter({ name: 'Boromir' } as unknown as Partial<PlayerCharacter> as PlayerCharacter);

      const jsonString = slice.exportCharacters();
      const parsed = JSON.parse(jsonString);

      expect(parsed.version).toBe(1);
      expect(parsed.playerId).toBe('player-1');
      expect(parsed.playerName).toBe('Aragorn');
      expect(parsed.characters).toHaveLength(1);
      expect(parsed.characters[0].name).toBe('Boromir');
    });

    it('imports standard nexus character format', () => {
      const payload = {
        version: 1,
        characters: [
          { id: 'import-1', name: 'Pippin', level: 1 },
          { id: 'import-2', name: 'Merry', level: 1 },
        ],
      };

      const result = slice.importCharacters(JSON.stringify(payload));
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Pippin');
      expect(result[1].name).toBe('Merry');

      const saved = slice.getSavedCharacters();
      expect(saved).toHaveLength(2);
      expect(saved.map((c) => c.name)).toEqual(['Pippin', 'Merry']);
    });

    it('imports 5e Character Forge schema format using adapter', () => {
      const forgePayload = [
        {
          name: 'Elrond',
          species: 'Elf',
          class: 'Wizard',
          level: 10,
          abilities: {
            INT: { score: 18 },
            WIS: { score: 16 },
          },
        },
      ];

      const result = slice.importCharacters(JSON.stringify(forgePayload));
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Elrond');
      expect(result[0].class).toBe('Wizard');

      const saved = slice.getSavedCharacters();
      expect(saved).toHaveLength(1);
      expect(saved[0].name).toBe('Elrond');
      expect(saved[0].class).toBe('Wizard');
    });

    it('throws when importing invalid JSON or invalid format', () => {
      expect(() => slice.importCharacters('invalid-json')).toThrow('Invalid character file format');
      expect(() => slice.importCharacters(JSON.stringify({ unsupported: true }))).toThrow('Invalid character file format');
    });
  });
});
