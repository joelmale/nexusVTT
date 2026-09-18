/**
 * Player-character slice — the localStorage-backed `nexus-characters` CRUD
 * that came over from the old appFlowStore, plus the Forge JSON import path.
 *
 * Extracted verbatim from gameStore.ts. These actions are read-only with
 * respect to store state (they only call `get()`); their durable record is
 * the browser's `nexus-characters` localStorage key, NOT the canonical
 * server snapshot — so nothing here feeds buildGameStateProjection(). See
 * CLAUDE.md s.12.5 ("Character data is browser-local").
 *
 * Note this is the `PlayerCharacter` lobby/setup model, which is distinct
 * from `@/stores/characterStore`'s full 5e `Character` sheet state.
 */

import { v4 as uuidv4 } from 'uuid';
import type { PlayerCharacter } from '@/types/game';
import type { GameStore, GameStoreGet } from '@/stores/game/types';

export type CharactersSlice = Pick<
  GameStore,
  | 'createCharacter'
  | 'selectCharacter'
  | 'saveCharacter'
  | 'getSavedCharacters'
  | 'deleteCharacter'
  | 'exportCharacters'
  | 'importCharacters'
>;

export const createCharactersSlice = (
  get: GameStoreGet,
): CharactersSlice => ({
  createCharacter: (characterData) => {
    const character: PlayerCharacter = {
      ...characterData,
      id: uuidv4(),
      createdAt: Date.now(),
      edition: characterData.edition || '2024',
      playerId: get().user.id,
    };

    // Save to localStorage
    const existing = get().getSavedCharacters();
    const updated = [...existing, character];
    localStorage.setItem('nexus-characters', JSON.stringify(updated));

    console.log('Created character:', character.name);
    return character;
  },

  selectCharacter: (characterId: string) => {
    const characters = get().getSavedCharacters();
    const character = characters.find((c) => c.id === characterId);
    if (character) {
      console.log('Selected character:', character.name);
      // Character selection handled by UI components
    }
  },

  saveCharacter: (character: PlayerCharacter) => {
    try {
      const existing = get().getSavedCharacters();
      const existingIndex = existing.findIndex(
        (c) => c.id === character.id,
      );
      if (existingIndex >= 0) {
        // Update existing character
        existing[existingIndex] = character;
      } else {
        // Add new character
        existing.push(character);
      }
      localStorage.setItem('nexus-characters', JSON.stringify(existing));
      console.log('Saved character:', character.name);
    } catch (error) {
      console.error('Failed to save character to localStorage:', error);
    }
  },

  getSavedCharacters: (): PlayerCharacter[] => {
    try {
      const stored = localStorage.getItem('nexus-characters');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load characters from localStorage:', error);
      return [];
    }
  },

  deleteCharacter: (characterId: string) => {
    try {
      const existing = get().getSavedCharacters();
      const filtered = existing.filter((c) => c.id !== characterId);
      localStorage.setItem('nexus-characters', JSON.stringify(filtered));
      console.log('Deleted character:', characterId);
    } catch (error) {
      console.error('Failed to delete character from localStorage:', error);
    }
  },

  exportCharacters: (): string => {
    const characters = get().getSavedCharacters();
    return JSON.stringify(
      {
        version: 1,
        exportedAt: Date.now(),
        playerId: get().user.id,
        playerName: get().user.name,
        characters,
      },
      null,
      2,
    );
  },

  importCharacters: (jsonData: string) => {
    try {
      const data = JSON.parse(jsonData);
      const now = Date.now();

      const skillAbilityMap: Record<
        string,
        keyof PlayerCharacter['stats']
      > = {
        Acrobatics: 'dexterity',
        'Animal Handling': 'wisdom',
        Arcana: 'intelligence',
        Athletics: 'strength',
        Deception: 'charisma',
        History: 'intelligence',
        Insight: 'wisdom',
        Intimidation: 'charisma',
        Investigation: 'intelligence',
        Medicine: 'wisdom',
        Nature: 'intelligence',
        Perception: 'wisdom',
        Performance: 'charisma',
        Persuasion: 'charisma',
        Religion: 'intelligence',
        'Sleight of Hand': 'dexterity',
        Stealth: 'dexterity',
        Survival: 'wisdom',
      };

      const abilityMod = (score: number) => Math.floor((score - 10) / 2);
      const proficiencyFromLevel = (level: number) =>
        Math.ceil(Math.max(1, level) / 4) + 1;

      type CharacterForgeImport = {
        edition?: string;
        level?: number;
        proficiencyBonus?: number;
        abilities?: Record<
          string,
          {
            score?: number;
            proficient?: boolean;
          }
        >;
        skills?: Record<
          string,
          {
            proficient?: boolean;
            expertise?: boolean;
            value?: number;
          }
        >;
        savingThrows?: Record<string, boolean>;
        armorClass?: number;
        hitPoints?: number;
        currentHitPoints?: number;
        tempHitPoints?: number;
        speed?: number;
        senses?: {
          darkvision?: number;
          blindsight?: number;
          tremorsense?: number;
          truesight?: number;
        };
        name?: string;
        class?: string;
        species?: string;
        background?: string;
        alignment?: string;
      };

      const mapCharacterForge = (
        c: CharacterForgeImport,
      ): PlayerCharacter => {
        const edition = c.edition || '2024';
        const level = typeof c.level === 'number' ? c.level : 1;
        const profBonus =
          typeof c.proficiencyBonus === 'number'
            ? c.proficiencyBonus
            : proficiencyFromLevel(level);

        // Build stats from abilities map (fallback to 10)
        const stats: PlayerCharacter['stats'] = {
          strength: c.abilities?.STR?.score ?? 10,
          dexterity: c.abilities?.DEX?.score ?? 10,
          constitution: c.abilities?.CON?.score ?? 10,
          intelligence: c.abilities?.INT?.score ?? 10,
          wisdom: c.abilities?.WIS?.score ?? 10,
          charisma: c.abilities?.CHA?.score ?? 10,
        };

        // Compute skills even if missing: ability mod + proficiency if flagged
        const skills: Record<
          string,
          {
            value: number;
            proficient?: boolean;
            expertise?: boolean;
            ability?: string;
          }
        > = {};

        Object.entries(skillAbilityMap).forEach(
          ([skillName, abilityKey]) => {
            const skillData = c.skills?.[skillName];
            const abilityScore = stats[abilityKey];
            const mod = abilityMod(abilityScore);
            const proficient = !!skillData?.proficient;
            const expertise = !!skillData?.expertise;
            const bonus = proficient
              ? expertise
                ? profBonus * 2
                : profBonus
              : 0;
            const computedValue =
              typeof skillData?.value === 'number'
                ? skillData.value
                : mod + bonus;

            skills[skillName] = {
              value: computedValue,
              proficient,
              expertise,
              ability: abilityKey,
            };
          },
        );

        return {
          id: uuidv4(),
          playerId: get().user.id,
          name: c.name || 'Unnamed Hero',
          race: c.species || 'Unknown',
          class: c.class || 'Adventurer',
          background: c.background || '',
          level,
          edition,
          stats,
          skills,
          createdAt: now,
        };
      };

      let importedCharacters: PlayerCharacter[] = [];

      if (Array.isArray(data)) {
        // Raw array export from 5e Character Forge
        importedCharacters = data.map(mapCharacterForge);
      } else if (data.characters && Array.isArray(data.characters)) {
        // Existing Nexus export format
        importedCharacters = data.characters.map((c: PlayerCharacter) => ({
          ...c,
          id: uuidv4(),
          playerId: get().user.id,
          createdAt: c.createdAt || now,
          edition: c.edition || '2024',
        }));
      } else {
        throw new Error('Invalid character data format');
      }

      // Merge with existing characters
      const existing = get().getSavedCharacters();
      const merged = [...existing, ...importedCharacters];
      localStorage.setItem('nexus-characters', JSON.stringify(merged));

      console.log(`Imported ${importedCharacters.length} characters`);
      return importedCharacters;
    } catch (error) {
      console.error('Failed to import characters:', error);
      throw new Error('Invalid character file format', { cause: error });
    }
  },
});
