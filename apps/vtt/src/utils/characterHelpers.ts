/**
 * Helper functions for character creation and management
 */

/**
 * Get the hit die size for a given D&D 5e class
 */
export const getHitDieForClass = (className: string): number => {
  const hitDiceMap: Record<string, number> = {
    'Barbarian': 12,
    'Fighter': 10,
    'Paladin': 10,
    'Ranger': 10,
    'Bard': 8,
    'Cleric': 8,
    'Druid': 8,
    'Monk': 8,
    'Rogue': 8,
    'Warlock': 8,
    'Sorcerer': 6,
    'Wizard': 6,
  };

  return hitDiceMap[className] || 8; // Default to d8 if unknown
};

/**
 * Calculate estimated HP for a character based on class and level
 * Uses average roll (half hit die + 1) per level after 1st
 */
export const estimateHP = (className: string, level: number, constitutionModifier: number = 0): number => {
  const hitDie = getHitDieForClass(className);

  // 1st level: max hit die + con modifier
  const firstLevelHP = hitDie + constitutionModifier;

  // Additional levels: average roll + con modifier per level
  const averageRoll = Math.floor(hitDie / 2) + 1;
  const additionalLevelsHP = (level - 1) * (averageRoll + constitutionModifier);

  return Math.max(1, firstLevelHP + additionalLevelsHP);
};

/**
 * Get primary ability score for a class
 */
export const getPrimaryAbilityForClass = (className: string): string => {
  const primaryAbilities: Record<string, string> = {
    'Barbarian': 'strength',
    'Fighter': 'strength',
    'Paladin': 'strength',
    'Ranger': 'dexterity',
    'Bard': 'charisma',
    'Cleric': 'wisdom',
    'Druid': 'wisdom',
    'Monk': 'dexterity',
    'Rogue': 'dexterity',
    'Warlock': 'charisma',
    'Sorcerer': 'charisma',
    'Wizard': 'intelligence',
  };

  return primaryAbilities[className] || 'strength';
};

/**
 * Get default armor class for a character
 * Quick entry characters get AC 10 + dex modifier (unarmored)
 */
export const getDefaultArmorClass = (dexterityScore: number): number => {
  const dexModifier = Math.floor((dexterityScore - 10) / 2);
  return 10 + dexModifier;
};
