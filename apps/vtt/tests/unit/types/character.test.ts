import { describe, it, expect } from 'vitest';
import {
  calculateAbilityModifier,
  calculateProficiencyBonus,
  calculatePassivePerception,
  createEmptyCharacter,
  STANDARD_SKILLS
} from '@/types/character';
import type { AbilityScores } from '@/types/character';

describe('Character Utility Functions', () => {
  describe('calculateAbilityModifier', () => {
    it('should calculate correct modifiers for various ability scores', () => {
      expect(calculateAbilityModifier(1)).toBe(-5);
      expect(calculateAbilityModifier(8)).toBe(-1);
      expect(calculateAbilityModifier(9)).toBe(-1);
      expect(calculateAbilityModifier(10)).toBe(0);
      expect(calculateAbilityModifier(11)).toBe(0);
      expect(calculateAbilityModifier(12)).toBe(1);
      expect(calculateAbilityModifier(13)).toBe(1);
      expect(calculateAbilityModifier(14)).toBe(2);
      expect(calculateAbilityModifier(15)).toBe(2);
      expect(calculateAbilityModifier(16)).toBe(3);
      expect(calculateAbilityModifier(17)).toBe(3);
      expect(calculateAbilityModifier(18)).toBe(4);
      expect(calculateAbilityModifier(20)).toBe(5);
      expect(calculateAbilityModifier(30)).toBe(10);
    });

    it('should handle edge cases', () => {
      expect(calculateAbilityModifier(0)).toBe(-5);
      expect(calculateAbilityModifier(-1)).toBe(-6);
      expect(calculateAbilityModifier(100)).toBe(45);
    });
  });

  describe('calculateProficiencyBonus', () => {
    it('should calculate correct proficiency bonus for character levels', () => {
      expect(calculateProficiencyBonus(1)).toBe(2);
      expect(calculateProficiencyBonus(2)).toBe(2);
      expect(calculateProficiencyBonus(3)).toBe(2);
      expect(calculateProficiencyBonus(4)).toBe(2);
      expect(calculateProficiencyBonus(5)).toBe(3);
      expect(calculateProficiencyBonus(6)).toBe(3);
      expect(calculateProficiencyBonus(7)).toBe(3);
      expect(calculateProficiencyBonus(8)).toBe(3);
      expect(calculateProficiencyBonus(9)).toBe(4);
      expect(calculateProficiencyBonus(10)).toBe(4);
      expect(calculateProficiencyBonus(11)).toBe(4);
      expect(calculateProficiencyBonus(12)).toBe(4);
      expect(calculateProficiencyBonus(13)).toBe(5);
      expect(calculateProficiencyBonus(14)).toBe(5);
      expect(calculateProficiencyBonus(15)).toBe(5);
      expect(calculateProficiencyBonus(16)).toBe(5);
      expect(calculateProficiencyBonus(17)).toBe(6);
      expect(calculateProficiencyBonus(18)).toBe(6);
      expect(calculateProficiencyBonus(19)).toBe(6);
      expect(calculateProficiencyBonus(20)).toBe(6);
    });

    it('should handle edge cases', () => {
      expect(calculateProficiencyBonus(0)).toBe(2); // Minimum level 1
      expect(calculateProficiencyBonus(-1)).toBe(2); // Minimum level 1
      expect(calculateProficiencyBonus(21)).toBe(7); // Beyond level 20
    });
  });

  describe('calculatePassivePerception', () => {
    const mockAbilities: AbilityScores = {
      STR: { score: 10, modifier: 0 },
      DEX: { score: 10, modifier: 0 },
      CON: { score: 10, modifier: 0 },
      INT: { score: 10, modifier: 0 },
      WIS: { score: 14, modifier: 2 },
      CHA: { score: 10, modifier: 0 },
    };

    it('should calculate passive perception without proficiency', () => {
      const skills = {
        Perception: { proficient: false, expertise: false, value: 2 },
      };

      const passivePerception = calculatePassivePerception(mockAbilities, skills, 2);
      expect(passivePerception).toBe(12); // 10 + wisdom modifier (2)
    });

    it('should calculate passive perception with proficiency', () => {
      const skills = {
        Perception: { proficient: true, expertise: false, value: 4 },
      };

      const passivePerception = calculatePassivePerception(mockAbilities, skills, 2);
      expect(passivePerception).toBe(14); // 10 + wisdom modifier (2) + proficiency (2)
    });

    it('should calculate passive perception with expertise', () => {
      const skills = {
        Perception: { proficient: true, expertise: true, value: 6 },
      };

      const passivePerception = calculatePassivePerception(mockAbilities, skills, 2);
      expect(passivePerception).toBe(16); // 10 + wisdom modifier (2) + double proficiency (4)
    });

    it('should handle high wisdom scores', () => {
      const highWisdomAbilities: AbilityScores = {
        ...mockAbilities,
        WIS: { score: 20, modifier: 5 },
      };

      const skills = {
        Perception: { proficient: true, expertise: true, value: 11 },
      };

      const passivePerception = calculatePassivePerception(highWisdomAbilities, skills, 3);
      expect(passivePerception).toBe(21); // 10 + wisdom modifier (5) + double proficiency (6)
    });
  });

  describe('createEmptyCharacter', () => {
    it('should create a character with default values', () => {
      const playerId = 'player-123';
      const character = createEmptyCharacter(playerId);

      expect(character.playerId).toBe(playerId);
      expect(character.name).toBe('');
      expect(character.level).toBe(1);
      expect(character.hitPoints).toBe(1);
      expect(character.maxHitPoints).toBe(1);
      expect(character.temporaryHitPoints).toBe(0);
      expect(character.armorClass).toBe(10);
      expect(character.proficiencyBonus).toBe(2);
    });

    it('should create character with proper ability scores', () => {
      const playerId = 'player-123';
      const character = createEmptyCharacter(playerId);

      expect(character.abilities.STR.score).toBe(10);
      expect(character.abilities.STR.modifier).toBe(0);
      expect(character.abilities.DEX.score).toBe(10);
      expect(character.abilities.DEX.modifier).toBe(0);
      expect(character.abilities.CON.score).toBe(10);
      expect(character.abilities.CON.modifier).toBe(0);
      expect(character.abilities.INT.score).toBe(10);
      expect(character.abilities.INT.modifier).toBe(0);
      expect(character.abilities.WIS.score).toBe(10);
      expect(character.abilities.WIS.modifier).toBe(0);
      expect(character.abilities.CHA.score).toBe(10);
      expect(character.abilities.CHA.modifier).toBe(0);
    });

    it('should create character with all standard skills', () => {
      const playerId = 'player-123';
      const character = createEmptyCharacter(playerId);

      expect(Object.keys(character.skills)).toHaveLength(STANDARD_SKILLS.length);

      // Check that all standard skills are present
      STANDARD_SKILLS.forEach(standardSkill => {
        const characterSkill = character.skills[standardSkill.name];
        expect(characterSkill).toBeDefined();
        expect(characterSkill?.proficient).toBe(false);
        expect(characterSkill?.expertise).toBeUndefined();
        expect(characterSkill?.value).toBe(0);
      });
    });

    it('should create character with empty arrays for collections', () => {
      const playerId = 'player-123';
      const character = createEmptyCharacter(playerId);

      expect(character.inventory).toBeUndefined();
    });

    it('should create character with valid timestamps', () => {
      const playerId = 'player-123';
      const beforeCreation = Date.now();
      const character = createEmptyCharacter(playerId);
      const afterCreation = Date.now();

      const createdAt = Date.parse(character.createdAt || '');
      const updatedAt = Date.parse(character.updatedAt || '');

      expect(createdAt).toBeGreaterThanOrEqual(beforeCreation);
      expect(createdAt).toBeLessThanOrEqual(afterCreation);
      expect(updatedAt).toBe(createdAt);
    });

    it('should create character with unique ID', () => {
      const playerId = 'player-123';
      const character1 = createEmptyCharacter(playerId);
      const character2 = createEmptyCharacter(playerId);

      expect(character1.id).toBeDefined();
      expect(character2.id).toBeDefined();
      expect(character1.id).not.toBe(character2.id);
    });

    it('should create character with default personality structure', () => {
      const playerId = 'player-123';
      const character = createEmptyCharacter(playerId);

      expect(character.featuresAndTraits).toBeUndefined();
    });
  });

  describe('STANDARD_SKILLS', () => {
    it('should contain all D&D 5e skills', () => {
      const expectedSkills = [
        'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception',
        'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine',
        'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion',
        'Sleight of Hand', 'Stealth', 'Survival'
      ];

      expect(STANDARD_SKILLS).toHaveLength(expectedSkills.length);

      expectedSkills.forEach(skillName => {
        const skill = STANDARD_SKILLS.find(s => s.name === skillName);
        expect(skill).toBeDefined();
      });
    });

    it('should map skills to correct abilities', () => {
      const skillAbilityMap = {
        'Acrobatics': 'DEX',
        'Animal Handling': 'WIS',
        'Arcana': 'INT',
        'Athletics': 'STR',
        'Deception': 'CHA',
        'History': 'INT',
        'Insight': 'WIS',
        'Intimidation': 'CHA',
        'Investigation': 'INT',
        'Medicine': 'WIS',
        'Nature': 'INT',
        'Perception': 'WIS',
        'Performance': 'CHA',
        'Persuasion': 'CHA',
        'Religion': 'INT',
        'Sleight of Hand': 'DEX',
        'Stealth': 'DEX',
        'Survival': 'WIS'
      };

      Object.entries(skillAbilityMap).forEach(([skillName, expectedAbility]) => {
        const skill = STANDARD_SKILLS.find(s => s.name === skillName);
        expect(skill?.ability).toBe(expectedAbility);
      });
    });
  });
});
