import { Character } from '../types/dnd';
import { ResourceTracker } from '../data/classProgression';
import { COMBAT_ACTIONS, CombatAction } from '../services/dataService';

/**
 * Initialize resources for a character based on their class features
 */
export const initializeCharacterResources = (character: Character): ResourceTracker[] => {
  const resources: ResourceTracker[] = [];

  // Get all limited-use combat actions for this character's class and level
  const classActions = COMBAT_ACTIONS.classFeatureActions.filter(action => {
    return action.class === character.class.toLowerCase() &&
           (action.minLevel || 1) <= character.level &&
           action.usageType === 'limited';
  });

  // Convert to ResourceTracker format
  classActions.forEach(action => {
    const maxUses = calculateMaxUses(action, character.level);

    resources.push({
      id: action.slug,
      name: action.name,
      description: action.description,
      maxUses,
      rechargeType: action.rechargeType === 'short' ? 'short-rest' :
                   action.rechargeType === 'long' ? 'long-rest' : 'none',
      currentUses: maxUses // Start with full uses
    });
  });

  return resources;
};

/**
 * Calculate maximum uses for a limited action at given level
 */
const calculateMaxUses = (action: CombatAction, level: number): number => {
  if (!action.usesPerLevel) {
    return 1;
  }

  const usesAtLevel = action.usesPerLevel[level.toString()];

  if (typeof usesAtLevel === 'number') {
    return usesAtLevel;
  }

  if (usesAtLevel === 'CHA') {
    // For abilities like Bardic Inspiration that scale with CHA modifier
    return Math.max(1, Math.floor(level / 10) + 1); // Rough approximation
  }

  // Default to level 1 value or 1 if not specified
  const level1Uses = action.usesPerLevel['1'];
  return typeof level1Uses === 'number' ? level1Uses : 1;
};

/**
 * Consume uses from a resource
 */
export const consumeResource = (character: Character, resourceId: string, uses: number = 1): Character => {
  if (!character.resources) return character;

  const updatedResources = character.resources.map(resource => {
    if (resource.id === resourceId) {
      return {
        ...resource,
        currentUses: Math.max(0, (resource.currentUses || 0) - uses)
      };
    }
    return resource;
  });

  return { ...character, resources: updatedResources };
};

/**
 * Check if a resource can be used
 */
export const canUseResource = (character: Character, resourceId: string): boolean => {
  const resource = character.resources?.find(r => r.id === resourceId);
  return resource ? (resource.currentUses || 0) > 0 : false;
};

/**
 * Get current uses for a resource
 */
export const getResourceUses = (character: Character, resourceId: string): { current: number, max: number } => {
  const resource = character.resources?.find(r => r.id === resourceId);
  return resource ? { current: resource.currentUses || 0, max: resource.maxUses } : { current: 0, max: 0 };
};

/**
 * Reset resources based on recharge type
 */
export const resetResources = (character: Character, rechargeType: 'short-rest' | 'long-rest'): Character => {
  if (!character.resources) return character;

  const updatedResources = character.resources.map(resource => {
    if (resource.rechargeType === rechargeType ||
        (rechargeType === 'long-rest' && resource.rechargeType === 'short-rest')) {
      return {
        ...resource,
        currentUses: resource.maxUses
      };
    }
    return resource;
  });

  return { ...character, resources: updatedResources };
};