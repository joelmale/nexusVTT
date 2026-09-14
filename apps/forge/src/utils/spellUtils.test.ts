// Tests for spell management utilities
import { describe, it, expect } from 'vitest';
import {
  getSpellcastingType,
  isSpellcaster,
  calculateSpellSaveDC,
  calculateSpellAttackBonus,
  getMaxPreparedSpells
} from '../utils/spellUtils';

describe('Spell Utilities', () => {
  describe('getSpellcastingType', () => {
    it('should return correct spellcasting type for each class', () => {
      expect(getSpellcastingType('wizard')).toBe('wizard');
      expect(getSpellcastingType('bard')).toBe('known');
      expect(getSpellcastingType('cleric')).toBe('prepared');
      expect(getSpellcastingType('fighter')).toBe(null);
    });
  });

  describe('isSpellcaster', () => {
    it('should return true for spellcasting classes', () => {
      expect(isSpellcaster('wizard')).toBe(true);
      expect(isSpellcaster('fighter')).toBe(false);
    });
  });

  describe('calculateSpellSaveDC', () => {
    it('should calculate correct spell save DC', () => {
      const abilities = { INT: 16, WIS: 14, CHA: 12 };
      expect(calculateSpellSaveDC(abilities, 'INT')).toBe(13); // 8 + 3 (INT mod) + 2 (proficiency)
    });
  });

  describe('calculateSpellAttackBonus', () => {
    it('should calculate correct spell attack bonus', () => {
      const abilities = { INT: 16, WIS: 14, CHA: 12 };
      expect(calculateSpellAttackBonus(abilities, 'INT')).toBe(5); // 3 (INT mod) + 2 (proficiency)
    });
  });

  describe('getMaxPreparedSpells', () => {
    it('should calculate max prepared spells correctly', () => {
      const abilities = { INT: 16, WIS: 14, CHA: 12 };
      expect(getMaxPreparedSpells(abilities, 'INT', 1)).toBe(4); // 3 (INT mod) + 1 (level)
      expect(getMaxPreparedSpells(abilities, 'WIS', 1)).toBe(3); // 2 (WIS mod) + 1 (level)
    });
  });
});