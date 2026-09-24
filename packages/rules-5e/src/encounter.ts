/**
 * Canonical Challenge Rating (CR) to Experience Points (XP) mapping per D&D 5e SRD.
 */
export const CR_TO_XP: Record<string, number> = {
  '0': 10,
  '1/8': 25,
  '0.125': 25,
  '1/4': 50,
  '0.25': 50,
  '1/2': 100,
  '0.5': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
  '6': 2300,
  '7': 2900,
  '8': 3900,
  '9': 5000,
  '10': 5900,
  '11': 7200,
  '12': 8400,
  '13': 10000,
  '14': 11500,
  '15': 13000,
  '16': 15000,
  '17': 18000,
  '18': 20000,
  '19': 22000,
  '20': 25000,
  '21': 33000,
  '22': 41000,
  '23': 50000,
  '24': 62000,
  '30': 155000,
};

/**
 * Returns the experience points for a given challenge rating.
 */
export function getCrXp(cr: number | string): number {
  const key = String(cr);
  if (key in CR_TO_XP) {
    return CR_TO_XP[key];
  }
  const num = typeof cr === 'number' ? cr : parseFloat(cr);
  if (isNaN(num) || num < 0) return 0;
  return CR_TO_XP[String(num)] ?? Math.floor(Math.pow(num, 2) * 100);
}

/**
 * Calculates the standard encounter multiplier based on monster count and party size.
 */
export function getEncounterMultiplier(monsterCount: number, partySize: number = 4): number {
  if (monsterCount <= 0) return 1.0;

  const baseMultipliers = [
    { count: 1, mult: 1.0 },
    { count: 2, mult: 1.5 },
    { count: 6, mult: 2.0 },
    { count: 10, mult: 2.5 },
    { count: 14, mult: 3.0 },
    { count: Infinity, mult: 4.0 },
  ];

  let tier = 0;
  if (monsterCount === 1) tier = 0;
  else if (monsterCount === 2) tier = 1;
  else if (monsterCount <= 6) tier = 2;
  else if (monsterCount <= 10) tier = 3;
  else if (monsterCount <= 14) tier = 4;
  else tier = 5;

  // Party size adjustments (DMG p. 83)
  if (partySize < 3 && tier < 5) {
    tier += 1;
  } else if (partySize > 5 && tier > 0) {
    tier -= 1;
  }

  return baseMultipliers[tier].mult;
}

export interface MonsterGroupSpec {
  challengeRating: number | string;
  count: number;
}

export interface EncounterXpResult {
  rawXp: number;
  adjustedXp: number;
  multiplier: number;
  totalMonsters: number;
}

/**
 * Calculates raw and adjusted XP for an encounter.
 */
export function calculateEncounterXp(
  groups: MonsterGroupSpec[],
  partySize: number = 4,
): EncounterXpResult {
  let rawXp = 0;
  let totalMonsters = 0;

  for (const group of groups) {
    const xpPerMonster = getCrXp(group.challengeRating);
    const count = Math.max(0, group.count);
    rawXp += xpPerMonster * count;
    totalMonsters += count;
  }

  const multiplier = getEncounterMultiplier(totalMonsters, partySize);
  const adjustedXp = Math.floor(rawXp * multiplier);

  return {
    rawXp,
    adjustedXp,
    multiplier,
    totalMonsters,
  };
}

export interface InitiativeEntry {
  actorId: string;
  initiativeRoll: number;
  tieBreaker?: number;
}

/**
 * Sorts initiative entries descending by roll, using tieBreaker as secondary sort.
 */
export function sortInitiativeOrder<T extends InitiativeEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    if (b.initiativeRoll !== a.initiativeRoll) {
      return b.initiativeRoll - a.initiativeRoll;
    }
    const tieB = b.tieBreaker ?? 0;
    const tieA = a.tieBreaker ?? 0;
    return tieB - tieA;
  });
}
