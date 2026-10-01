import {
  calculateEncounterXp,
  getCrXp,
  type MonsterGroupSpec,
} from './encounter.js';

export type RulesEdition = '2014' | '2024';

/** 2014 and 2024 both rate onto one scale; 'deadly' is above the top budget. */
export type EncounterDifficultyRating =
  'trivial' | 'low' | 'moderate' | 'high' | 'deadly';

/** 2014 DMG "XP thresholds by character level": easy, medium, hard, deadly. */
const THRESHOLDS_2014: Record<number, [number, number, number, number]> = {
  1: [25, 50, 75, 100],
  2: [50, 100, 150, 200],
  3: [75, 150, 225, 400],
  4: [125, 250, 375, 500],
  5: [250, 500, 750, 1100],
  6: [300, 600, 900, 1400],
  7: [350, 750, 1100, 1700],
  8: [450, 900, 1400, 2100],
  9: [550, 1100, 1600, 2400],
  10: [600, 1200, 1900, 2800],
  11: [800, 1600, 2400, 3600],
  12: [1000, 2000, 3000, 4500],
  13: [1100, 2200, 3400, 5100],
  14: [1250, 2500, 3800, 5700],
  15: [1400, 2800, 4300, 6400],
  16: [1600, 3200, 4800, 7200],
  17: [2000, 3900, 5900, 8800],
  18: [2100, 4200, 6300, 9500],
  19: [2400, 4900, 7300, 10900],
  20: [2800, 5700, 8500, 12700],
};

/** 2024 DMG "XP budget per character": low, moderate, high. */
const BUDGET_2024: Record<number, [number, number, number]> = {
  1: [50, 75, 100],
  2: [100, 150, 200],
  3: [150, 225, 400],
  4: [250, 375, 500],
  5: [500, 750, 1100],
  6: [600, 1000, 1400],
  7: [750, 1300, 1700],
  8: [1000, 1700, 2100],
  9: [1300, 2000, 2600],
  10: [1600, 2300, 3100],
  11: [1900, 2900, 4100],
  12: [2200, 3700, 4700],
  13: [2600, 4200, 5400],
  14: [2900, 4900, 6200],
  15: [3300, 5400, 7800],
  16: [3800, 6100, 9800],
  17: [4500, 7200, 11700],
  18: [5000, 8700, 14200],
  19: [5500, 10700, 17200],
  20: [6400, 13200, 22000],
};

export interface EncounterDifficultyInput {
  edition: RulesEdition;
  groups: MonsterGroupSpec[];
  /** One entry per party member. Levels are clamped to 1-20. */
  partyLevels: number[];
}

export interface EncounterDifficultyResult {
  rating: EncounterDifficultyRating;
  /** XP compared against the party budget (2014 applies the group multiplier). */
  xp: number;
  rawXp: number;
  /** Party-wide totals for each rating step; deadly is 2014 only. */
  budget: { low: number; moderate: number; high: number; deadly?: number };
}

function clampLevel(level: number): number {
  return Math.min(20, Math.max(1, Math.floor(Number.isFinite(level) ? level : 1)));
}

/**
 * Rates an encounter against a party. 2014 uses the DMG thresholds with the
 * monster-count multiplier; 2024 uses the XP budget and no multiplier. Returns
 * null when the party is empty or there are no monsters, since neither can be
 * rated.
 */
export function evaluateEncounterDifficulty(
  input: EncounterDifficultyInput,
): EncounterDifficultyResult | null {
  const levels = input.partyLevels.map(clampLevel);
  const monsters = input.groups.reduce(
    (total, group) => total + Math.max(0, group.count),
    0,
  );
  if (levels.length === 0 || monsters === 0) return null;

  if (input.edition === '2024') {
    const rawXp = input.groups.reduce(
      (total, group) => total + getCrXp(group.challengeRating) * Math.max(0, group.count),
      0,
    );
    const budget = { low: 0, moderate: 0, high: 0 };
    for (const level of levels) {
      const [low, moderate, high] = BUDGET_2024[level];
      budget.low += low;
      budget.moderate += moderate;
      budget.high += high;
    }
    const rating: EncounterDifficultyRating =
      rawXp > budget.high
        ? 'deadly'
        : rawXp === budget.high
          ? 'high'
          : rawXp >= budget.moderate
            ? 'moderate'
            : rawXp >= budget.low
              ? 'low'
              : 'trivial';
    return { rating, xp: rawXp, rawXp, budget };
  }

  const { rawXp, adjustedXp } = calculateEncounterXp(input.groups, levels.length);
  const budget = { low: 0, moderate: 0, high: 0, deadly: 0 };
  for (const level of levels) {
    const [easy, medium, hard, deadly] = THRESHOLDS_2014[level];
    budget.low += easy;
    budget.moderate += medium;
    budget.high += hard;
    budget.deadly += deadly;
  }
  const rating: EncounterDifficultyRating =
    adjustedXp >= budget.deadly
      ? 'deadly'
      : adjustedXp >= budget.high
        ? 'high'
        : adjustedXp >= budget.moderate
          ? 'moderate'
          : adjustedXp >= budget.low
            ? 'low'
            : 'trivial';
  return { rating, xp: adjustedXp, rawXp, budget };
}
