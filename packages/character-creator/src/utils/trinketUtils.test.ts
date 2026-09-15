import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rollRandomTrinket, getTrinketByRoll, getAllTrinkets, getTrinketsInRange } from '../utils/trinketUtils';

describe('Trinket Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rollRandomTrinket', () => {
    it('should return a trinket from standard table (d100)', () => {
      const result = rollRandomTrinket(false);

      expect(result).toBeDefined();
      expect(result.roll).toBeGreaterThanOrEqual(1);
      expect(result.roll).toBeLessThanOrEqual(100);
      expect(result.short_name).toBeDefined();
      expect(result.description).toBeDefined();
    });

    it('should return a trinket from extended table (d200)', () => {
      const result = rollRandomTrinket(true);

      expect(result).toBeDefined();
      expect(result.roll).toBeGreaterThanOrEqual(1);
      expect(result.roll).toBeLessThanOrEqual(200);
      expect(result.short_name).toBeDefined();
      expect(result.description).toBeDefined();
    });
  });

  describe('getTrinketByRoll', () => {
    it('should return correct trinket for valid roll', () => {
      const result = getTrinketByRoll(1);

      expect(result).toBeDefined();
      expect(result?.roll).toBe(1);
      expect(result?.short_name).toBeDefined();
    });

    it('should return undefined for invalid roll', () => {
      const result = getTrinketByRoll(999);

      expect(result).toBeUndefined();
    });
  });

  describe('getAllTrinkets', () => {
    it('should return all trinkets', () => {
      const result = getAllTrinkets();

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].roll).toBeDefined();
      expect(result[0].short_name).toBeDefined();
    });
  });

  describe('getTrinketsInRange', () => {
    it('should return trinkets within range', () => {
      const result = getTrinketsInRange(1, 10);

      expect(result.length).toBeGreaterThan(0);
      result.forEach(trinket => {
        expect(trinket.roll).toBeGreaterThanOrEqual(1);
        expect(trinket.roll).toBeLessThanOrEqual(10);
      });
    });

    it('should return empty array for range with no trinkets', () => {
      const result = getTrinketsInRange(1000, 2000);

      expect(result).toHaveLength(0);
    });
  });
});