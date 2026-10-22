/**
 * Wealth Tracker adhering to 2024 DMG guidelines.
 * Calculates total placed campaign wealth and evaluates it against expected wealth thresholds.
 */
import type { CampaignItem, PlayerCharacter } from '../../demo/fixture-registry/types';

export interface ExpectedWealthRange {
  tier: 1 | 2 | 3 | 4;
  minGp: number;
  maxGp: number;
  perCharacterMinGp: number;
  perCharacterMaxGp: number;
}

export interface WealthEvaluation {
  totalGp: number;
  partySize: number;
  averageLevel: number;
  range: ExpectedWealthRange;
  status: 'below' | 'expected' | 'above';
  percentOfMax: number;
  label: string;
}

/**
 * Expected wealth per character according to 2024 DMG treasure budget progression.
 */
const WEALTH_BY_LEVEL: Array<{ level: number; minGp: number; maxGp: number; tier: 1 | 2 | 3 | 4 }> = [
  { level: 1, minGp: 10, maxGp: 150, tier: 1 },
  { level: 2, minGp: 50, maxGp: 300, tier: 1 },
  { level: 3, minGp: 150, maxGp: 600, tier: 1 },
  { level: 4, minGp: 300, maxGp: 1000, tier: 1 },
  { level: 5, minGp: 800, maxGp: 2500, tier: 2 },
  { level: 6, minGp: 1500, maxGp: 4000, tier: 2 },
  { level: 7, minGp: 2500, maxGp: 6000, tier: 2 },
  { level: 8, minGp: 4000, maxGp: 9000, tier: 2 },
  { level: 9, minGp: 6000, maxGp: 13000, tier: 2 },
  { level: 10, minGp: 9000, maxGp: 18000, tier: 2 },
  { level: 11, minGp: 13000, maxGp: 25000, tier: 3 },
  { level: 12, minGp: 18000, maxGp: 35000, tier: 3 },
  { level: 13, minGp: 25000, maxGp: 50000, tier: 3 },
  { level: 14, minGp: 35000, maxGp: 70000, tier: 3 },
  { level: 15, minGp: 50000, maxGp: 95000, tier: 3 },
  { level: 16, minGp: 70000, maxGp: 130000, tier: 3 },
  { level: 17, minGp: 100000, maxGp: 200000, tier: 4 },
  { level: 18, minGp: 150000, maxGp: 300000, tier: 4 },
  { level: 19, minGp: 220000, maxGp: 450000, tier: 4 },
  { level: 20, minGp: 300000, maxGp: 700000, tier: 4 },
];

export function calculateItemsWealth(items: readonly CampaignItem[]): number {
  return items.reduce((sum, item) => {
    const unitVal = typeof item.valueGp === 'number' && !Number.isNaN(item.valueGp) ? item.valueGp : 0;
    const qty = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
    return sum + unitVal * qty;
  }, 0);
}

export function getExpectedWealthRange(partySize: number, averageLevel: number): ExpectedWealthRange {
  const size = Math.max(1, partySize);
  const clampedLevel = Math.max(1, Math.min(20, Math.round(averageLevel)));
  const row = WEALTH_BY_LEVEL[clampedLevel - 1] || WEALTH_BY_LEVEL[0];

  return {
    tier: row.tier,
    perCharacterMinGp: row.minGp,
    perCharacterMaxGp: row.maxGp,
    minGp: row.minGp * size,
    maxGp: row.maxGp * size,
  };
}

export function getPartyAverageLevel(pcs: readonly PlayerCharacter[]): number {
  if (pcs.length === 0) return 1;
  const sum = pcs.reduce((acc, pc) => acc + (pc.level || 1), 0);
  return Math.round((sum / pcs.length) * 10) / 10;
}

export function evaluatePartyWealth(
  totalGp: number,
  partySize: number,
  averageLevel: number,
): WealthEvaluation {
  const range = getExpectedWealthRange(partySize, averageLevel);
  const percentOfMax = range.maxGp > 0 ? Math.round((totalGp / range.maxGp) * 100) : 100;

  let status: 'below' | 'expected' | 'above' = 'expected';
  let label = `On track for Tier ${range.tier}`;

  if (totalGp < range.minGp) {
    status = 'below';
    label = `Below Tier ${range.tier} expectation`;
  } else if (totalGp > range.maxGp) {
    status = 'above';
    label = `Abundant for Tier ${range.tier}`;
  }

  return {
    totalGp,
    partySize: Math.max(1, partySize),
    averageLevel,
    range,
    status,
    percentOfMax,
    label,
  };
}
