import { describe, expect, it } from 'vitest';

import { evaluateEncounterDifficulty } from '../src/encounterDifficulty';

const PARTY_4_L3 = [3, 3, 3, 3];

describe('evaluateEncounterDifficulty', () => {
  it('returns null for an empty party or no monsters', () => {
    expect(
      evaluateEncounterDifficulty({
        edition: '2014',
        groups: [{ challengeRating: 1, count: 1 }],
        partyLevels: [],
      }),
    ).toBeNull();
    expect(
      evaluateEncounterDifficulty({
        edition: '2024',
        groups: [{ challengeRating: 1, count: 0 }],
        partyLevels: PARTY_4_L3,
      }),
    ).toBeNull();
  });

  describe('2014 thresholds with multiplier', () => {
    it('sums party thresholds', () => {
      const result = evaluateEncounterDifficulty({
        edition: '2014',
        groups: [{ challengeRating: '1/4', count: 1 }],
        partyLevels: PARTY_4_L3,
      })!;
      expect(result.budget).toEqual({
        low: 300,
        moderate: 600,
        high: 900,
        deadly: 1600,
      });
      expect(result.rating).toBe('trivial'); // 50 xp
    });

    it('applies the group multiplier before rating', () => {
      // 4 x CR1 = 800 raw, x2 = 1600 adjusted -> deadly for four level 3s.
      const result = evaluateEncounterDifficulty({
        edition: '2014',
        groups: [{ challengeRating: 1, count: 4 }],
        partyLevels: PARTY_4_L3,
      })!;
      expect(result.rawXp).toBe(800);
      expect(result.xp).toBe(1600);
      expect(result.rating).toBe('deadly');
    });

    it('adjusts the multiplier for small and large parties', () => {
      const group = [{ challengeRating: 1, count: 2 }];
      const small = evaluateEncounterDifficulty({
        edition: '2014',
        groups: group,
        partyLevels: [3, 3],
      })!;
      const large = evaluateEncounterDifficulty({
        edition: '2014',
        groups: group,
        partyLevels: [3, 3, 3, 3, 3, 3],
      })!;
      expect(small.xp).toBe(400 * 2); // x1.5 shifts up one tier to x2
      expect(large.xp).toBe(400 * 1); // x1.5 shifts down one tier to x1
    });

    it('rates each band at its threshold', () => {
      // One monster keeps the multiplier at 1 for a party of four.
      // Level 5 x4: easy 1000, medium 2000, hard 3000, deadly 4400.
      const ratingFor = (cr: number) =>
        evaluateEncounterDifficulty({
          edition: '2014',
          groups: [{ challengeRating: cr, count: 1 }],
          partyLevels: [5, 5, 5, 5],
        })!.rating;
      expect(ratingFor(3)).toBe('trivial'); // 700
      expect(ratingFor(4)).toBe('low'); // 1100
      expect(ratingFor(6)).toBe('moderate'); // 2300
      expect(ratingFor(8)).toBe('high'); // 3900
      expect(ratingFor(9)).toBe('deadly'); // 5000
    });
  });

  describe('2024 XP budget without multiplier', () => {
    it('sums per-character budget', () => {
      const result = evaluateEncounterDifficulty({
        edition: '2024',
        groups: [{ challengeRating: 1, count: 1 }],
        partyLevels: PARTY_4_L3,
      })!;
      expect(result.budget).toEqual({ low: 600, moderate: 900, high: 1600 });
    });

    it('ignores group size multipliers', () => {
      // 4 x CR1 = 800 raw: between low (600) and moderate (900).
      const result = evaluateEncounterDifficulty({
        edition: '2024',
        groups: [{ challengeRating: 1, count: 4 }],
        partyLevels: PARTY_4_L3,
      })!;
      expect(result.xp).toBe(800);
      expect(result.rating).toBe('low');
    });

    it('rates exactly at the high budget as high and above it as deadly', () => {
      const at = evaluateEncounterDifficulty({
        edition: '2024',
        groups: [{ challengeRating: 3, count: 1 }, { challengeRating: 3, count: 1 }, { challengeRating: 0, count: 20 }],
        partyLevels: PARTY_4_L3, // high = 1600; 700+700+200 = 1600
      })!;
      expect(at.xp).toBe(1600);
      expect(at.rating).toBe('high');
      const over = evaluateEncounterDifficulty({
        edition: '2024',
        groups: [{ challengeRating: 5, count: 1 }],
        partyLevels: PARTY_4_L3, // 1800 > 1600
      })!;
      expect(over.rating).toBe('deadly');
    });
  });

  it('clamps out-of-range levels', () => {
    const result = evaluateEncounterDifficulty({
      edition: '2024',
      groups: [{ challengeRating: 1, count: 1 }],
      partyLevels: [0, 99],
    })!;
    expect(result.budget).toEqual({ low: 50 + 6400, moderate: 75 + 13200, high: 100 + 22000 });
  });
});
