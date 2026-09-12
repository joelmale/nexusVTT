/**
 * Derived State Initialization
 * Creates empty derived state structure from base facts
 *
 * PURE SEPARATION RULE: This contains NO game-specific values.
 * All initial values are neutral (empty arrays, zero bonuses, etc.)
 */

import type { BaseFacts } from '../types/baseFacts';
import { SKILL_TO_ABILITY, type DerivedState } from '../types/derived';
import { ABILITIES, SKILLS } from '../types/common';

/**
 * Initialize an empty derived state from base facts
 * All effects will be applied to this initial state
 *
 * @param facts - Base character facts
 * @returns Empty derived state ready for effect application
 */
export function initializeDerivedState(facts: BaseFacts): DerivedState {
  // Initialize abilities from base facts (no modifiers yet)
  const abilities = ABILITIES.reduce(
    (acc, ability) => {
      const score = facts.abilities[ability];
      acc[ability] = {
        score,
        modifier: calculateModifier(score),
      };
      return acc;
    },
    {} as DerivedState['abilities']
  );

  // Calculate proficiency bonus from level
  const proficiencyBonus = calculateProficiencyBonus(facts.level);

  // Initialize empty proficiencies
  const proficiencies: DerivedState['proficiencies'] = {
    armor: [],
    weapons: [],
    tools: [],
    languages: [],
    savingThrows: [],
    skills: [],
  };

  // Initialize empty expertise
  const expertise: DerivedState['expertise'] = {
    skills: [],
    tools: [],
  };

  // Initialize saves (no proficiency yet)
  const saves = ABILITIES.reduce(
    (acc, ability) => {
      acc[ability] = {
        proficient: false,
        bonus: 0,
        advantage: [],
        disadvantage: [],
      };
      return acc;
    },
    {} as DerivedState['saves']
  );

  // Initialize skills (no proficiency yet)
  const skills = SKILLS.reduce(
    (acc, skill) => {
      acc[skill] = {
        proficient: false,
        expertise: false,
        bonus: 0,
        ability: SKILL_TO_ABILITY[skill],
      };
      return acc;
    },
    {} as DerivedState['skills']
  );

  // Initialize combat stats
  const ac: DerivedState['ac'] = {
    value: 10, // Base AC (unarmored)
    sources: [],
  };

  const initiative: DerivedState['initiative'] = {
    bonus: 0,
    advantage: [],
    disadvantage: [],
  };

  const hitPoints = 0;

  // Initialize movement (no speed set yet)
  const speed: DerivedState['speed'] = {};

  // Initialize senses (empty)
  const senses: DerivedState['senses'] = [];

  // Initialize resources (empty)
  const resources: DerivedState['resources'] = {};

  // Initialize features (empty)
  const features: DerivedState['features'] = [];

  // Initialize choices (empty)
  const choices: DerivedState['choices'] = [];

  // Initialize equipment restrictions (empty)
  const equipmentRestrictions: DerivedState['equipmentRestrictions'] = {
    cannotWear: [],
    cannotWield: [],
    requiresAttunement: [],
  };

  // Initialize attunement (3 slots by default)
  const attunement: DerivedState['attunement'] = {
    attunedItems: [],
    maxAttunedItems: 3,
  };

  // Initialize tags from base facts
  const tags: string[] = [...facts.tags];

  // Add equipment tags from equipped items
  // These need to be available immediately for predicate evaluation
  if (facts.equippedArmor) {
    tags.push('wearing-armor');
    // Note: Specific armor type tags (wearing-light-armor, etc.) will be added by equipment effects
  }

  if (facts.equippedWeapons && facts.equippedWeapons.length > 0) {
    tags.push('wielding-weapon');
  }

  // Shield check - if 'shield' is in equipped items
  if (facts.equippedItems?.includes('shield')) {
    tags.push('wielding-shield');
  }

  // Initialize provenance log (empty)
  const appliedEffects: DerivedState['appliedEffects'] = [];

  return {
    abilities,
    proficiencyBonus,
    proficiencies,
    expertise,
    saves,
    skills,
    ac,
    initiative,
    hitPoints,
    speed,
    senses,
    resources,
    features,
    choices,
    equipmentRestrictions,
    attunement,
    tags,
    appliedEffects,
  };
}

/**
 * Calculate ability modifier from score
 * Formula: floor((score - 10) / 2)
 *
 * This is a mathematical constant, not game logic.
 */
function calculateModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Recalculate ability modifiers after score changes
 *
 * @param derived - Derived state to update
 */
export function recalculateAbilityModifiers(derived: DerivedState): void {
  for (const ability of ABILITIES) {
    const score = derived.abilities[ability].score;
    derived.abilities[ability].modifier = calculateModifier(score);
  }
}

/**
 * Calculate proficiency bonus from character level
 * Formula: floor((level - 1) / 4) + 2
 *
 * This is a mathematical constant based on 5e rules, not game logic.
 *
 * @param level - Character level (1-20)
 * @returns Proficiency bonus (+2 to +6)
 */
function calculateProficiencyBonus(level: number): number {
  return Math.floor((level - 1) / 4) + 2;
}
