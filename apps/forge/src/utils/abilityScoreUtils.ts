import { AbilityName } from '../types/dnd';
import { rollDice } from '../services/diceService';
import { getEnhancedClassData } from '../services/dataService';

import abilityScoreConfig from '../data/abilityScoreConfig.json';

export const ABILITY_NAMES: AbilityName[] = abilityScoreConfig.ABILITY_NAMES as AbilityName[];
export const STANDARD_ARRAY_SCORES = [15, 14, 13, 12, 10, 8] as const;
export const POINT_BUY_COSTS: Record<number, number> = abilityScoreConfig.POINT_BUY_COSTS;
export const ABILITY_METHOD_TITLES: Record<string, string> = abilityScoreConfig.ABILITY_METHOD_TITLES;

/**
 * Assign ability scores using standard array based on class priorities
 * @param classSlug - The class identifier (e.g., 'warlock', 'wizard')
 * @returns Record of ability scores optimized for the class
 */
export const assignAbilityScoresByClass = (classSlug: string): Record<AbilityName, number> => {
  // Get enhanced class data which includes ability priorities
  const enhancedData = getEnhancedClassData(classSlug.toLowerCase());

  // Get priority array from enhanced data, fallback to balanced distribution if not found
  const priorities = enhancedData?.abilityPriorities || ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

  // Create abilities object
  const abilities: Record<AbilityName, number> = {} as Record<AbilityName, number>;

  // Assign standard array values in priority order
  priorities.forEach((ability, index) => {
    abilities[ability] = STANDARD_ARRAY_SCORES[index];
  });

  return abilities;
};

/**
 * Generate ability scores using standard array method
 */
export const generateStandardArray = (): Record<AbilityName, number> => {
  const scores = [...STANDARD_ARRAY_SCORES];
  const shuffled = [...ABILITY_NAMES].sort(() => Math.random() - 0.5);

  const abilities: Record<AbilityName, number> = {} as Record<AbilityName, number>;
  shuffled.forEach((ability, index) => {
    abilities[ability] = scores[index];
  });

  return abilities;
};

/**
 * Generate ability scores using point buy method
 */
export const generatePointBuy = (): Record<AbilityName, number> => {
  const abilities: Record<AbilityName, number> = {
    STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8
  };
  let points = 27;

  while (points > 0) {
    const ability = ABILITY_NAMES[Math.floor(Math.random() * ABILITY_NAMES.length)];
    const current = abilities[ability];
    const cost = current >= 13 ? 2 : 1; // 14+ costs 2 points

    if (current < 15 && points >= cost) {
      abilities[ability] = current + 1;
      points -= cost;
    }
  }

  return abilities;
};

/**
 * Generate ability scores using dice rolling methods
 */
export const generateDiceRoll = (method: 'standard-roll' | 'classic-roll' | '5d6-drop-2'): Record<AbilityName, number> => {
  const abilities: Record<AbilityName, number> = {} as Record<AbilityName, number>;

  if (method === 'classic-roll') {
    // 3d6 straight for each ability in order
    ABILITY_NAMES.forEach(ability => {
      const rolls = rollDice(3, 6);
      abilities[ability] = rolls.reduce((a, b) => a + b, 0);
    });
  } else {
    // Generate sets for each ability
    ABILITY_NAMES.forEach(ability => {
      let rolls: number[];

      if (method === 'standard-roll') {
        // 4d6, drop lowest
        rolls = rollDice(4, 6).sort((a, b) => b - a).slice(0, 3);
      } else {
        // 5d6, drop two lowest
        rolls = rollDice(5, 6).sort((a, b) => b - a).slice(0, 3);
      }

      abilities[ability] = rolls.reduce((a, b) => a + b, 0);
    });
  }

  return abilities;
};

/**
 * Calculate point buy cost for a score change
 */
export const calculatePointBuyCost = (oldScore: number, newScore: number): number => {
  const oldCost = POINT_BUY_COSTS[oldScore] || 0;
  const newCost = POINT_BUY_COSTS[newScore] || 0;
  return newCost - oldCost;
};

/**
 * Check if a point buy change is valid
 */
export const isValidPointBuyChange = (oldScore: number, newScore: number, currentPoints: number): boolean => {
  if (newScore < 8 || newScore > 15) return false;
  const cost = calculatePointBuyCost(oldScore, newScore);
  return currentPoints - cost >= 0;
};

/**
 * Get available scores for standard array assignment
 */
export const getAvailableStandardArrayScores = (usedScores: number[]): number[] => {
  return STANDARD_ARRAY_SCORES.filter(score => !usedScores.includes(score));
};

/**
 * Check if ability scores are complete (all > 0)
 */
export const areAbilityScoresComplete = (abilities: Record<AbilityName, number>): boolean => {
  return Object.values(abilities).every(score => score > 0);
};