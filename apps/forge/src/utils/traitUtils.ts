import { CharacterCreationData } from '../types/dnd';

/**
 * Randomize personality traits for character creation
 */
import characterTraitsData from '../data/characterTraits.json';
import backgroundDefaultsData from '../data/backgroundDefaults.json';

export const randomizePersonality = (): Partial<CharacterCreationData> => {
  const personalityTraits = characterTraitsData.personalities;

  const ideals = characterTraitsData.ideals;

  const bonds = characterTraitsData.bonds;

  const flaws = characterTraitsData.flaws;

  return {
    personality: personalityTraits[Math.floor(Math.random() * personalityTraits.length)],
    ideals: ideals[Math.floor(Math.random() * ideals.length)],
    bonds: bonds[Math.floor(Math.random() * bonds.length)],
    flaws: flaws[Math.floor(Math.random() * flaws.length)]
  };
};

/**
 * Get default traits for a specific background
 */
export const getBackgroundDefaults = (background: string): Partial<CharacterCreationData> => {
  return (backgroundDefaultsData.BACKGROUND_DEFAULTS as Record<string, Partial<CharacterCreationData>>)[background] || {};
};

/**
 * Validate that all required traits are filled
 */
export const validateTraits = (data: Partial<CharacterCreationData>): boolean => {
  return !!(data.name && data.name.trim() && data.personality && data.ideals && data.bonds && data.flaws);
};

/**
 * Calculate starting hit points based on class and constitution
 */
export const calculateStartingHP = (
  hitDie: number,
  constitutionScore: number,
  method: 'max' | 'rolled',
  rolledValue?: number
): number => {
  const conModifier = Math.floor((constitutionScore - 10) / 2);

  if (method === 'max') {
    return hitDie + conModifier;
  } else if (method === 'rolled' && rolledValue) {
    return rolledValue + conModifier;
  }

  return 0;
};