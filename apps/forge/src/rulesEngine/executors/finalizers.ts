/**
 * Finalizers - Calculate final derived values after all effects are applied
 *
 * PURE SEPARATION RULE: This module contains NO game-specific logic.
 * All calculations are pure math based on D&D 5e formulas.
 */

import { SKILL_TO_ABILITY, type DerivedState } from '../types/derived';
import { ABILITIES, SKILLS } from '../types/common';

/**
 * Finalize all derived values
 * Runs after all effects have been applied
 *
 * @param derived - Derived state to finalize
 */
export function finalizeDerivedState(derived: DerivedState): void {
  finalizeSavingThrows(derived);
  finalizeSkills(derived);
  finalizeSpellcasting(derived);
  finalizeArmorClass(derived);
  finalizeInitiative(derived);
}

/**
 * Calculate final saving throw bonuses
 * Formula: ability modifier + proficiency bonus (if proficient) + additional bonuses
 *
 * @param derived - Derived state to finalize
 */
function finalizeSavingThrows(derived: DerivedState): void {
  for (const ability of ABILITIES) {
    const save = derived.saves[ability];
    const abilityData = derived.abilities[ability];

    // Check if proficient
    const isProficient = derived.proficiencies.savingThrows.includes(ability);
    save.proficient = isProficient;

    // Calculate final bonus
    let totalBonus = abilityData.modifier;

    if (isProficient) {
      totalBonus += derived.proficiencyBonus;
    }

    // Add any additional bonuses from effects
    totalBonus += save.bonus;

    // Update final bonus
    save.bonus = totalBonus;
  }
}

/**
 * Calculate final skill bonuses
 * Formula: ability modifier + proficiency bonus (if proficient) + expertise bonus (if expertise) + additional bonuses
 *
 * @param derived - Derived state to finalize
 */
function finalizeSkills(derived: DerivedState): void {
  for (const skill of SKILLS) {
    const skillData = derived.skills[skill];
    const ability = SKILL_TO_ABILITY[skill];
    const abilityData = derived.abilities[ability];

    // Calculate final bonus
    let totalBonus = abilityData.modifier;

    if (skillData.proficient) {
      totalBonus += derived.proficiencyBonus;
    }

    if (skillData.expertise) {
      // Expertise doubles proficiency bonus
      totalBonus += derived.proficiencyBonus;
    }

    // Add any additional bonuses from effects
    totalBonus += skillData.bonus;

    // Update final bonus
    skillData.bonus = totalBonus;
  }
}

/**
 * Calculate spell save DC and spell attack bonus
 * Formulas:
 * - Spell Save DC = 8 + proficiency bonus + spellcasting ability modifier
 * - Spell Attack Bonus = proficiency bonus + spellcasting ability modifier
 *
 * @param derived - Derived state to finalize
 */
function finalizeSpellcasting(derived: DerivedState): void {
  // Only finalize if character has spellcasting
  if (!derived.spellcasting) {
    return;
  }

  const abilityModifier = derived.abilities[derived.spellcasting.ability].modifier;
  const profBonus = derived.proficiencyBonus;

  // Spell Save DC = 8 + proficiency bonus + ability modifier
  derived.spellcasting.saveDC = 8 + profBonus + abilityModifier;

  // Spell Attack Bonus = proficiency bonus + ability modifier
  derived.spellcasting.attackBonus = profBonus + abilityModifier;
}

/**
 * Calculate final armor class
 * Uses priority system to determine base AC, then applies bonuses
 *
 * Priority order:
 * 1. base - Default unarmored (10 + DEX)
 * 2. additive - Armor AC calculations, unarmored defense
 * 3. multiplicative - (not commonly used for AC)
 * 4. override - Complete AC replacement (rare)
 * 5. flag - Bonuses that stack (shields, rings, spells)
 *
 * @param derived - Derived state to finalize
 */
function finalizeArmorClass(derived: DerivedState): void {
  // Get AC contributions from temporary storage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const acContributions = (derived as any).acContributions || [];

  // Default AC: 10 + DEX modifier
  const baseAC = 10 + derived.abilities.DEX.modifier;
  let finalAC = baseAC;

  // Priority order for AC calculations
  const priorityOrder: Array<'base' | 'additive' | 'multiplicative' | 'override' | 'flag'> = [
    'base',
    'additive',
    'multiplicative',
    'override',
    'flag',
  ];

  // Group contributions by priority
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contributionsByPriority: Record<string, any[]> = {
    base: [],
    additive: [],
    multiplicative: [],
    override: [],
    flag: [],
  };

  for (const contribution of acContributions) {
    const priority = contribution.priority || 'flag';
    contributionsByPriority[priority].push(contribution);
  }

  // Process each priority level
  for (const priority of priorityOrder) {
    const contributions = contributionsByPriority[priority];

    if (priority === 'base' || priority === 'additive') {
      // For base and additive, take the highest value (these are competing AC calculations)
      if (contributions.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const highest = Math.max(...contributions.map((c: any) => c.value));
        finalAC = highest;
      }
    } else if (priority === 'flag') {
      // For flag (bonuses), stack all of them
      for (const contribution of contributions) {
        if (contribution.stacking === 'stack') {
          finalAC += contribution.value;
        } else if (contribution.stacking === 'max') {
          // Already handled by taking max, but this shouldn't happen for flags
          finalAC = Math.max(finalAC, contribution.value);
        }
      }
    } else if (priority === 'override') {
      // Override completely replaces AC
      if (contributions.length > 0) {
        finalAC = contributions[contributions.length - 1].value;
      }
    }
  }

  // Update final AC
  derived.ac.value = finalAC;

  // Clean up temporary storage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (derived as any).acContributions;
}

/**
 * Calculate final initiative bonus
 * Formula: DEX modifier + bonuses
 *
 * @param derived - Derived state to finalize
 */
function finalizeInitiative(derived: DerivedState): void {
  // Initiative = DEX modifier + bonuses
  const dexMod = derived.abilities.DEX.modifier;
  const bonuses = derived.initiative.bonus || 0;

  derived.initiative.bonus = dexMod + bonuses;
}
