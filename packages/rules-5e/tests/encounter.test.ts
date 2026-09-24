import { describe, it, expect } from 'vitest';
import {
  getCrXp,
  getEncounterMultiplier,
  calculateEncounterXp,
  sortInitiativeOrder,
} from '../src/encounter';

describe('encounter & combat math', () => {
  describe('getCrXp', () => {
    it('returns exact XP for standard challenge ratings', () => {
      expect(getCrXp(0)).toBe(10);
      expect(getCrXp('1/8')).toBe(25);
      expect(getCrXp('1/4')).toBe(50);
      expect(getCrXp('1/2')).toBe(100);
      expect(getCrXp(1)).toBe(200);
      expect(getCrXp(5)).toBe(1800);
      expect(getCrXp(20)).toBe(25000);
    });

    it('handles decimal string and number inputs', () => {
      expect(getCrXp('0.5')).toBe(100);
      expect(getCrXp(0.25)).toBe(50);
    });

    it('returns calculated fallback or 0 for invalid CR', () => {
      expect(getCrXp(-1)).toBe(0);
      expect(getCrXp('invalid')).toBe(0);
      expect(getCrXp(25)).toBe(62500); // 25^2 * 100
    });
  });

  describe('getEncounterMultiplier', () => {
    it('returns correct base multiplier for standard party of 4', () => {
      expect(getEncounterMultiplier(1, 4)).toBe(1.0);
      expect(getEncounterMultiplier(2, 4)).toBe(1.5);
      expect(getEncounterMultiplier(4, 4)).toBe(2.0);
      expect(getEncounterMultiplier(8, 4)).toBe(2.5);
      expect(getEncounterMultiplier(12, 4)).toBe(3.0);
      expect(getEncounterMultiplier(16, 4)).toBe(4.0);
      expect(getEncounterMultiplier(0, 4)).toBe(1.0);
    });

    it('shifts multiplier up for small party (<3)', () => {
      // 1 monster with small party shifts up from 1.0 to 1.5
      expect(getEncounterMultiplier(1, 2)).toBe(1.5);
      // 2 monsters shifts from 1.5 to 2.0
      expect(getEncounterMultiplier(2, 1)).toBe(2.0);
    });

    it('shifts multiplier down for large party (>5)', () => {
      // 2 monsters with large party shifts down from 1.5 to 1.0
      expect(getEncounterMultiplier(2, 6)).toBe(1.0);
      // 1 monster cannot shift below 1.0
      expect(getEncounterMultiplier(1, 6)).toBe(1.0);
    });
  });

  describe('calculateEncounterXp', () => {
    it('calculates total raw and adjusted XP for multiple monster groups', () => {
      const groups = [
        { challengeRating: 1, count: 2 }, // 200 * 2 = 400
        { challengeRating: 2, count: 1 }, // 450 * 1 = 450
      ];
      // Total 3 monsters: multiplier is 2.0
      const result = calculateEncounterXp(groups, 4);
      expect(result.totalMonsters).toBe(3);
      expect(result.rawXp).toBe(850);
      expect(result.multiplier).toBe(2.0);
      expect(result.adjustedXp).toBe(1700);
    });

    it('handles negative or zero counts gracefully', () => {
      const groups = [{ challengeRating: 1, count: -5 }];
      const result = calculateEncounterXp(groups);
      expect(result.totalMonsters).toBe(0);
      expect(result.rawXp).toBe(0);
      expect(result.adjustedXp).toBe(0);
    });
  });

  describe('sortInitiativeOrder', () => {
    it('sorts participants descending by roll with tie breaker', () => {
      const participants = [
        { actorId: 'a1', initiativeRoll: 14, tieBreaker: 2 },
        { actorId: 'a2', initiativeRoll: 20, tieBreaker: 3 },
        { actorId: 'a3', initiativeRoll: 14, tieBreaker: 4 }, // higher tiebreaker
        { actorId: 'a4', initiativeRoll: 8, tieBreaker: 0 },
      ];

      const sorted = sortInitiativeOrder(participants);
      expect(sorted.map((p) => p.actorId)).toEqual(['a2', 'a3', 'a1', 'a4']);
    });
  });
});
