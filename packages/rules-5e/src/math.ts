/**
 * Canonical mathematical formulas for D&D 5th Edition (2014 & 2024 revisions).
 * Pure functions with zero DOM, CSS, or framework dependencies.
 */

/**
 * Calculates the standard D&D 5e ability modifier from an ability score.
 * Formula: floor((score - 10) / 2)
 */
export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Calculates the proficiency bonus for a given character level (1 to 20+).
 * Formula: ceil(1 + level / 4)
 */
export function getProficiencyBonus(level: number): number {
  if (level < 1) return 2;
  return Math.ceil(1 + level / 4);
}

/**
 * Calculates a passive score (Perception, Insight, Investigation).
 * Formula: 10 + modifier + (proficiencyBonus if proficient) + advantageModifier (+5 advantage, -5 disadvantage)
 */
export function getPassiveScore(
  abilityModifier: number,
  isProficient: boolean,
  proficiencyBonus: number,
  advantageModifier: number = 0,
): number {
  return (
    10 +
    abilityModifier +
    (isProficient ? proficiencyBonus : 0) +
    advantageModifier
  );
}

/**
 * Calculates Spell Save DC.
 * Formula: 8 + spellcastingAbilityModifier + proficiencyBonus + optionalBonus
 */
export function calculateSpellSaveDC(
  abilityModifier: number,
  proficiencyBonus: number,
  bonus: number = 0,
): number {
  return 8 + abilityModifier + proficiencyBonus + bonus;
}

/**
 * Calculates Spell Attack Bonus.
 * Formula: spellcastingAbilityModifier + proficiencyBonus + optionalBonus
 */
export function calculateSpellAttackBonus(
  abilityModifier: number,
  proficiencyBonus: number,
  bonus: number = 0,
): number {
  return abilityModifier + proficiencyBonus + bonus;
}

/**
 * Canonical 5e Challenge Rating (CR) to Experience Points (XP) lookup table.
 */
export const CR_TO_XP_TABLE: Record<string, number> = {
  '0': 10,
  '0.125': 25,
  '1/8': 25,
  '0.25': 50,
  '1/4': 50,
  '0.5': 100,
  '1/2': 100,
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
  '25': 75000,
  '26': 90000,
  '27': 105000,
  '28': 120000,
  '29': 135000,
  '30': 155000,
};

/**
 * Returns XP value for a given Challenge Rating.
 */
export function getCrExperiencePoints(cr: number | string): number {
  const key = String(cr);
  if (key in CR_TO_XP_TABLE) {
    return CR_TO_XP_TABLE[key];
  }
  return 0;
}

/**
 * Character Level XP Thresholds table.
 */
export const LEVEL_XP_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500,
  6: 14000,
  7: 23000,
  8: 34000,
  9: 48000,
  10: 64000,
  11: 85000,
  12: 100000,
  13: 120000,
  14: 140000,
  15: 165000,
  16: 195000,
  17: 225000,
  18: 265000,
  19: 305000,
  20: 355000,
};

/**
 * Determines character level from total earned XP.
 */
export function getLevelFromExperience(xp: number): number {
  for (let lvl = 20; lvl >= 1; lvl -= 1) {
    if (xp >= LEVEL_XP_THRESHOLDS[lvl]) {
      return lvl;
    }
  }
  return 1;
}

/**
 * Calculates average Max HP progression:
 * Level 1: max die + CON mod (min 1)
 * Subsequent levels: floor(die / 2) + 1 + CON mod (min 1)
 */
export function calculateAverageHitPoints(
  hitDie: number,
  level: number,
  conModifier: number,
): number {
  if (level <= 0) return 1;
  const levelOneHp = Math.max(1, hitDie + conModifier);
  if (level === 1) return levelOneHp;

  const avgSubsequentPerLevel = Math.max(1, Math.floor(hitDie / 2) + 1 + conModifier);
  return levelOneHp + avgSubsequentPerLevel * (level - 1);
}
