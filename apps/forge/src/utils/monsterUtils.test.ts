import { describe, it, expect } from 'vitest';
import { generateMonsterSlug, isCustomMonsterId, getCustomMonsterDbId } from '../utils/monsterUtils';

describe('monsterUtils', () => {
  describe('generateMonsterSlug', () => {
    it('should convert monster name to lowercase slug', () => {
      expect(generateMonsterSlug('Ancient Red Dragon')).toBe('ancient-red-dragon');
    });

    it('should replace spaces with hyphens', () => {
      expect(generateMonsterSlug('Fire Elemental')).toBe('fire-elemental');
    });

    it('should remove special characters', () => {
      expect(generateMonsterSlug('Orc (Warrior)')).toBe('orc-warrior');
    });

    it('should handle multiple spaces and hyphens', () => {
      expect(generateMonsterSlug('  Ancient -- Red -- Dragon  ')).toBe('ancient-red-dragon');
    });

    it('should remove leading and trailing hyphens', () => {
      expect(generateMonsterSlug('-Orc-')).toBe('orc');
    });
  });

  describe('isCustomMonsterId', () => {
    it('should return true for custom monster IDs', () => {
      expect(isCustomMonsterId('custom-123')).toBe(true);
    });

    it('should return false for SRD monster IDs', () => {
      expect(isCustomMonsterId('orc')).toBe(false);
      expect(isCustomMonsterId('ancient-red-dragon')).toBe(false);
    });
  });

  describe('getCustomMonsterDbId', () => {
    it('should extract database ID from custom monster ID', () => {
      expect(getCustomMonsterDbId('custom-123')).toBe('123');
    });

    it('should return original ID if not custom', () => {
      expect(getCustomMonsterDbId('orc')).toBe('orc');
    });
  });
});