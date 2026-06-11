import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from 'react';
import { useCharacterStore } from '@/stores/characterStore';
import type { Character } from '@/types/character';
import {
  createEmptyCharacter,
  calculateAbilityModifier,
} from '@/types/character';
vi.mock('@/services/linearFlowStorage', () => ({
  getLinearFlowStorage: vi.fn(() => ({
    saveCharacter: vi.fn(),
    getBrowserId: vi.fn(() => 'browser-id'),
  })),
}));

// Mock the character types utilities
describe('CharacterStore', () => {
  vi.mock('@/types/character', async () => {
    const actual = await vi.importActual('@/types/character');
    return {
      ...actual,
      createEmptyCharacter: vi.fn(),
      calculateAbilityModifier: (score: number) => Math.floor((score - 10) / 2),
      calculateProficiencyBonus: (level: number) => Math.ceil(level / 4) + 1,
      calculatePassivePerception: vi.fn().mockReturnValue(10),
    };
  });
  let idCounter = 0;
  const createMockCharacter = (playerId: string): Character => {
    idCounter++;
    return JSON.parse(
      JSON.stringify({
        id: `char-${idCounter}`,
        playerId,
        name: `Test Character ${idCounter}`,
        level: 1,
        race: 'Human',
        class: 'Fighter',
        background: 'Soldier',
        abilities: {
          STR: { score: 10, modifier: 0 },
          DEX: { score: 10, modifier: 0 },
          CON: { score: 10, modifier: 0 },
          INT: { score: 10, modifier: 0 },
          WIS: { score: 10, modifier: 0 },
          CHA: { score: 10, modifier: 0 },
        },
        skills: {
          Athletics: { proficient: false, expertise: false, value: 0 },
          Acrobatics: { proficient: false, expertise: false, value: 0 },
          Perception: { proficient: false, expertise: false, value: 0 },
          Stealth: { proficient: false, expertise: false, value: 0 },
        },
        hitPoints: 10,
        maxHitPoints: 10,
        temporaryHitPoints: 0,
        armorClass: 10,
        proficiencyBonus: 2,
        savingThrowProficiencies: {
          STR: false, DEX: false, CON: false,
          INT: false, WIS: false, CHA: false,
        },
        inventory: [],
        languages: ['Common'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        alignment: 'Neutral',
        experiencePoints: 0,
        hitDice: { current: 1, max: 1, dieType: 10 },
        inspiration: false,
      }),
    );
  };

  beforeEach(() => {
    act(() => {
      useCharacterStore.getState().reset();
    });
    idCounter = 0;
    vi.mocked(createEmptyCharacter).mockImplementation(createMockCharacter);
    vi.useFakeTimers();
  });

  describe('Character Creation', () => {
    it('should create a new character with valid player ID', () => {
      const playerId = 'player-123';
      let characterId: string | undefined;

      act(() => {
        characterId = useCharacterStore.getState().createCharacter(playerId);
      });

      const { characters } = useCharacterStore.getState();
      expect(characterId).toBe('char-1');
      expect(characters).toHaveLength(1);
      expect(characters[0].playerId).toBe(playerId);
      expect(createEmptyCharacter).toHaveBeenCalledWith(playerId);
    });

    it('should update an existing character', () => {
      vi.useFakeTimers();
      const playerId = 'player-123';
      let characterId: string | undefined;
      act(() => {
        characterId = useCharacterStore.getState().createCharacter(playerId);
      });

      const updates = {
        name: 'Updated Name',
        level: 2,
      };

      // Advance time by 1ms to ensure updatedAt > createdAt
      vi.advanceTimersByTime(1);

      act(() => {
        useCharacterStore.getState().updateCharacter(characterId!, updates);
      });

      const character = useCharacterStore.getState().getCharacter(characterId!);
      expect(character?.name).toBe('Updated Name');
      expect(character?.level).toBe(2);
      const createdAt = character?.createdAt
        ? Date.parse(character.createdAt)
        : 0;
      const updatedAt = character?.updatedAt
        ? Date.parse(character.updatedAt)
        : 0;
      expect(updatedAt).toBeGreaterThanOrEqual(createdAt);
    });

    it('should delete a character', () => {
      const playerId = 'player-123';
      let characterId: string | undefined;
      act(() => {
        characterId = useCharacterStore.getState().createCharacter(playerId);
      });

      expect(useCharacterStore.getState().characters).toHaveLength(1);

      act(() => {
        useCharacterStore.getState().deleteCharacter(characterId!);
      });

      expect(useCharacterStore.getState().characters).toHaveLength(0);
      expect(
        useCharacterStore.getState().getCharacter(characterId!),
      ).toBeUndefined();
    });

    it('should set and get active character', () => {
      const playerId = 'player-123';
      let characterId: string | undefined;
      act(() => {
        characterId = useCharacterStore.getState().createCharacter(playerId);
      });

      expect(useCharacterStore.getState().activeCharacterId).toBeNull();

      act(() => {
        useCharacterStore.getState().setActiveCharacter(characterId!);
      });

      expect(useCharacterStore.getState().activeCharacterId).toBe(characterId);

      act(() => {
        useCharacterStore.getState().setActiveCharacter(null);
      });

      expect(useCharacterStore.getState().activeCharacterId).toBeNull();
    });

    it('should get characters by player ID', () => {
      const playerId1 = 'player-1';
      const playerId2 = 'player-2';
      let char1: string | undefined,
        char2: string | undefined,
        char3: string | undefined;

      act(() => {
        char1 = useCharacterStore.getState().createCharacter(playerId1);
        char2 = useCharacterStore.getState().createCharacter(playerId1);
        char3 = useCharacterStore.getState().createCharacter(playerId2);
      });

      const player1Characters = useCharacterStore
        .getState()
        .getCharactersByPlayer(playerId1);
      const player2Characters = useCharacterStore
        .getState()
        .getCharactersByPlayer(playerId2);

      expect(player1Characters).toHaveLength(2);
      expect(player2Characters).toHaveLength(1);
      expect(player1Characters.map((c) => c.id)).toContain(char1);
      expect(player1Characters.map((c) => c.id)).toContain(char2);
      expect(player2Characters.map((c) => c.id)).toContain(char3);
    });
  });

  describe('Character Stats Management', () => {
    let characterId: string;

    beforeEach(() => {
      act(() => {
        characterId = useCharacterStore
          .getState()
          .createCharacter('player-123');
      });
    });

    it('should update ability scores and recalculate modifiers', () => {
      act(() => {
        useCharacterStore
          .getState()
          .updateAbilityScore(characterId, 'STR', 16);
      });

      const character = useCharacterStore.getState().getCharacter(characterId);
      expect(character?.abilities.STR.score).toBe(16);
      expect(character?.abilities.STR.modifier).toBe(
        calculateAbilityModifier(16),
      );
    });

    it('should update skill proficiency', () => {
      act(() => {
        useCharacterStore
          .getState()
          .updateSkillProficiency(characterId, 'Athletics', true, false);
      });

      const character = useCharacterStore.getState().getCharacter(characterId);
      const athleticsSkill = character?.skills?.Athletics;
      expect(athleticsSkill?.proficient).toBe(true);
      expect(athleticsSkill?.expertise).toBe(false);
    });

    it('should update skill expertise', () => {
      act(() => {
        useCharacterStore
          .getState()
          .updateSkillProficiency(characterId, 'Stealth', true, true);
      });

      const character = useCharacterStore.getState().getCharacter(characterId);
      const stealthSkill = character?.skills?.Stealth;
      expect(stealthSkill?.proficient).toBe(true);
      expect(stealthSkill?.expertise).toBe(true);
    });

    it('should update saving throw proficiency', () => {
      act(() => {
        useCharacterStore
          .getState()
          .updateSavingThrowProficiency(characterId, 'STR', true);
      });

      const character = useCharacterStore.getState().getCharacter(characterId);
      expect(character?.savingThrowProficiencies?.STR).toBe(true);
      expect(character?.savingThrowProficiencies?.DEX).toBe(false);
    });

    it('should recalculate all stats correctly', () => {
      act(() => {
        useCharacterStore
          .getState()
          .updateAbilityScore(characterId, 'STR', 16);
        useCharacterStore
          .getState()
          .updateAbilityScore(characterId, 'DEX', 14);
        useCharacterStore
          .getState()
          .updateSkillProficiency(characterId, 'Athletics', true);
      });

      act(() => {
        useCharacterStore.getState().recalculateStats(characterId);
      });

      const character = useCharacterStore.getState().getCharacter(characterId);
      expect(character?.abilities.STR.modifier).toBe(3);
      expect(character?.abilities.DEX.modifier).toBe(2);

      const athleticsSkill = character?.skills?.Athletics;
      expect(athleticsSkill?.value).toBe(3 + 2); // STR modifier + proficiency bonus
    });
  });

  describe('Equipment Management', () => {
    let characterId: string;

    beforeEach(() => {
      act(() => {
        characterId = useCharacterStore
          .getState()
          .createCharacter('player-123');
      });
    });

    it('should add equipment to character', () => {
      const equipment = {
        name: 'Longsword',
        type: 'weapon',
        weight: 3,
        cost: { amount: 15, currency: 'gp' },
        properties: ['versatile'],
        equipped: false,
        quantity: 1,
      };

      act(() => {
        useCharacterStore.getState().addEquipment(characterId, equipment);
      });

      const character = useCharacterStore.getState().getCharacter(characterId);
      expect(character?.inventory).toHaveLength(1);
      expect(character?.inventory?.[0].equipmentSlug).toBe('longsword');
      expect(character?.inventory?.[0].name).toBe('Longsword');
      expect(character?.inventory?.[0].equipped).toBe(false);
    });

    it('should update existing equipment', () => {
      const equipment = {
        name: 'Shield',
        type: 'armor',
        weight: 6,
        cost: { amount: 10, currency: 'gp' },
        equipped: false,
        quantity: 1,
      };

      act(() => {
        useCharacterStore.getState().addEquipment(characterId, equipment);
      });
      const character = useCharacterStore.getState().getCharacter(characterId);
      const equipmentId = character?.inventory?.[0]?.equipmentSlug;

      if (!equipmentId) throw new Error('Equipment not found');

      act(() => {
        useCharacterStore
          .getState()
          .updateEquipment(characterId, equipmentId, { equipped: true });
      });

      const updatedCharacter = useCharacterStore
        .getState()
        .getCharacter(characterId);
      expect(updatedCharacter?.inventory?.[0].equipped).toBe(true);
    });

    it('should remove equipment from character', () => {
      const equipment = {
        name: 'Dagger',
        type: 'weapon',
        weight: 1,
        cost: { amount: 2, currency: 'gp' },
        equipped: false,
        quantity: 1,
      };

      act(() => {
        useCharacterStore.getState().addEquipment(characterId, equipment);
      });
      const character = useCharacterStore.getState().getCharacter(characterId);
      const equipmentId = character?.inventory?.[0]?.equipmentSlug;

      if (!equipmentId) throw new Error('Equipment not found');

      act(() => {
        useCharacterStore.getState().removeEquipment(characterId, equipmentId);
      });

      const updatedCharacter = useCharacterStore
        .getState()
        .getCharacter(characterId);
      expect(updatedCharacter?.inventory).toHaveLength(0);
    });

    it('should equip and unequip items', () => {
      const equipment = {
        name: 'Plate Armor',
        type: 'armor',
        weight: 65,
        cost: { amount: 1500, currency: 'gp' },
        equipped: false,
        quantity: 1,
      };

      act(() => {
        useCharacterStore.getState().addEquipment(characterId, equipment);
      });
      const character = useCharacterStore.getState().getCharacter(characterId);
      const equipmentId = character?.inventory?.[0]?.equipmentSlug;

      if (!equipmentId) throw new Error('Equipment not found');

      act(() => {
        useCharacterStore.getState().equipItem(characterId, equipmentId);
      });
      let updatedCharacter = useCharacterStore
        .getState()
        .getCharacter(characterId);
      expect(updatedCharacter?.inventory?.[0].equipped).toBe(true);

      act(() => {
        useCharacterStore.getState().unequipItem(characterId, equipmentId);
      });
      updatedCharacter = useCharacterStore.getState().getCharacter(characterId);
      expect(updatedCharacter?.inventory?.[0].equipped).toBe(false);
    });
  });

  describe('Character Creation Wizard', () => {
    it('should start character creation with guided method', () => {
      const playerId = 'player-123';

      act(() => {
        useCharacterStore.getState().startCharacterCreation(playerId, 'guided');
      });

      const { creationState } = useCharacterStore.getState();
      expect(creationState).toBeDefined();
      expect(creationState?.playerId).toBe(playerId);
      expect(creationState?.method).toBe('guided');
      expect(creationState?.step).toBe(1);
    });

    it('should update creation state', () => {
      const playerId = 'player-123';
      act(() => {
        useCharacterStore.getState().startCharacterCreation(playerId, 'manual');
      });

      const updates = {
        character: {
          name: 'Test Character',
          race: 'Elf',
        },
      };

      act(() => {
        useCharacterStore.getState().updateCreationState(updates);
      });

      const { creationState } = useCharacterStore.getState();
      expect(creationState?.character?.name).toBe('Test Character');
      expect(creationState?.character?.race).toBe('Elf');
    });

    it('should navigate through creation steps', () => {
      const playerId = 'player-123';
      act(() => {
        useCharacterStore.getState().startCharacterCreation(playerId, 'guided');
      });

      expect(useCharacterStore.getState().creationState?.step).toBe(1);

      act(() => {
        useCharacterStore.getState().nextCreationStep();
      });
      expect(useCharacterStore.getState().creationState?.step).toBe(2);

      act(() => {
        useCharacterStore.getState().nextCreationStep();
      });
      expect(useCharacterStore.getState().creationState?.step).toBe(3);

      act(() => {
        useCharacterStore.getState().previousCreationStep();
      });
      expect(useCharacterStore.getState().creationState?.step).toBe(2);
    });

    it('should not go below step 1 or above total steps', () => {
      const playerId = 'player-123';
      act(() => {
        useCharacterStore.getState().startCharacterCreation(playerId, 'guided');
      });

      act(() => {
        useCharacterStore.getState().previousCreationStep();
      });
      expect(useCharacterStore.getState().creationState?.step).toBe(1);

      const totalSteps =
        useCharacterStore.getState().creationState?.totalSteps || 4;
      for (let i = 1; i < totalSteps; i++) {
        act(() => {
          useCharacterStore.getState().nextCreationStep();
        });
      }

      act(() => {
        useCharacterStore.getState().nextCreationStep();
      });
      expect(useCharacterStore.getState().creationState?.step).toBe(totalSteps);
    });

    it('should complete character creation and add to characters list', async () => {
      const playerId = 'player-123';
      act(() => {
        useCharacterStore.getState().startCharacterCreation(playerId, 'manual');
      });

      act(() => {
        useCharacterStore.getState().updateCreationState({
          character: {
            name: 'Test Character',
            race: 'Human',
            class: 'Fighter',
            abilities: {
              STR: { score: 10, modifier: 0 },
              DEX: { score: 10, modifier: 0 },
              CON: { score: 10, modifier: 0 },
              INT: { score: 10, modifier: 0 },
              WIS: { score: 10, modifier: 0 },
              CHA: { score: 10, modifier: 0 },
            },
          },
        });
      });

      const result = await useCharacterStore
        .getState()
        .completeCharacterCreation();

      const { characters, creationState } = useCharacterStore.getState();
      expect(result?.id).toBeDefined();
      expect(characters).toHaveLength(1);
      expect(creationState).toBeNull();
      expect(characters[0].name).toBe('Test Character');
    });

    it('should cancel character creation', () => {
      const playerId = 'player-123';
      act(() => {
        useCharacterStore.getState().startCharacterCreation(playerId, 'guided');
      });

      expect(useCharacterStore.getState().creationState).toBeDefined();

      act(() => {
        useCharacterStore.getState().cancelCharacterCreation();
      });

      const { characters, creationState } = useCharacterStore.getState();
      expect(creationState).toBeNull();
      expect(characters).toHaveLength(0);
    });
  });

  describe('Combat Integration', () => {
    let characterId: string;

    beforeEach(() => {
      act(() => {
        characterId = useCharacterStore
          .getState()
          .createCharacter('player-123');
      });
    });

    it('should update character HP', () => {
      act(() => {
        useCharacterStore.getState().updateCharacterHP(characterId, 8, 2);
      });

      const character = useCharacterStore.getState().getCharacter(characterId);
      expect(character?.hitPoints).toBe(8);
      expect(character?.temporaryHitPoints).toBe(2);
    });

    it('should update character HP without temporary HP', () => {
      act(() => {
        useCharacterStore.getState().updateCharacterHP(characterId, 5);
      });

      const character = useCharacterStore.getState().getCharacter(characterId);
      expect(character?.hitPoints).toBe(5);
      expect(character?.temporaryHitPoints).toBe(0);
    });
  });

  describe('Store Reset', () => {
    it('should reset store to initial state', () => {
      const playerId = 'player-123';
      act(() => {
        useCharacterStore.getState().createCharacter(playerId);
        useCharacterStore.getState().startCharacterCreation(playerId, 'guided');
      });

      expect(useCharacterStore.getState().characters).toHaveLength(1);
      expect(useCharacterStore.getState().creationState).toBeDefined();

      act(() => {
        useCharacterStore.getState().reset();
      });

      const {
        characters,
        activeCharacterId,
        creationState,
        mobs,
        mobGroups,
        selectedMobs,
      } = useCharacterStore.getState();
      expect(characters).toHaveLength(0);
      expect(activeCharacterId).toBeNull();
      expect(creationState).toBeNull();
      expect(mobs).toHaveLength(0);
      expect(mobGroups).toHaveLength(0);
      expect(selectedMobs).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle updates to non-existent character gracefully', () => {
      act(() => {
        expect(() => {
          useCharacterStore
            .getState()
            .updateCharacter('non-existent', { name: 'Test' });
        }).not.toThrow();
      });

      act(() => {
        expect(() => {
          useCharacterStore
            .getState()
            .updateAbilityScore('non-existent', 'STR', 16);
        }).not.toThrow();
      });

      act(() => {
        expect(() => {
          useCharacterStore.getState().updateCharacterHP('non-existent', 10);
        }).not.toThrow();
      });
    });

    it('should handle deletion of non-existent character gracefully', () => {
      act(() => {
        expect(() => {
          useCharacterStore.getState().deleteCharacter('non-existent');
        }).not.toThrow();
      });

      expect(useCharacterStore.getState().characters).toHaveLength(0);
    });
  });
});
