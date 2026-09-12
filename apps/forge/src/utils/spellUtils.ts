// Spell management utilities for character creation and campaign play
import { SpellcastingType, Class, Character, SpellSelectionData } from '../types/dnd';
import { getCantripsByClass, getLeveledSpellsByClass, loadClasses, AppSpell, SPELLS_KNOWN_BY_CLASS } from '../services/dataService';
import { SPELL_SLOT_TABLES } from '../data/spellSlots';
import { SPELL_LEARNING_RULES } from '../data/spellLearning';
import spellcastingTypesData from '../data/spellcastingTypes.json';
import { SPELL_SAVE_DC_BASE, LEVEL_1_PROFICIENCY_BONUS, ABILITY_SCORE_BASE, ABILITY_MODIFIER_DIVISOR } from '../constants/combat';

// Map class slugs to spellcasting types
const SPELLCASTING_TYPE_MAP: Record<string, SpellcastingType> = spellcastingTypesData.SPELLCASTING_TYPE_MAP as Record<string, SpellcastingType>;

/**
 * Get the spellcasting type for a given class
 */
export function getSpellcastingType(classSlug: string): SpellcastingType | null {
  return SPELLCASTING_TYPE_MAP[classSlug] || null;
}

/**
 * Check if a class is a spellcaster
 */
export function isSpellcaster(classSlug: string): boolean {
  return getSpellcastingType(classSlug) !== null;
}

/**
 * Calculate spell save DC (Difficulty Class) for a spellcaster.
 *
 * The spell save DC is the target number that creatures must meet or exceed
 * on their saving throw to resist a spell's effects. This is a core spellcasting
 * statistic that remains constant for all of a character's spells.
 *
 * **Formula**: `8 + spellcasting ability modifier + proficiency bonus`
 *
 * **Note**: This function uses LEVEL_1_PROFICIENCY_BONUS (+2) as a constant.
 * For higher-level characters, the caller should recalculate with the appropriate
 * proficiency bonus for their level.
 *
 * @param abilities - Object mapping ability names to scores (e.g., { INT: 16, WIS: 14, ... })
 * @param spellcastingAbility - The ability used for spellcasting (e.g., 'INT' for Wizard,
 *                               'WIS' for Cleric, 'CHA' for Sorcerer)
 *
 * @returns The spell save DC value (typically ranges from 10-19 for level 1, higher at higher levels)
 *
 * @example
 * ```typescript
 * // Level 1 Wizard with INT 16 (+3 modifier)
 * const wizardDC = calculateSpellSaveDC({ INT: 16, WIS: 10, CHA: 8 }, 'INT');
 * // Returns: 13  (8 + 3 + 2)
 *
 * // Level 1 Cleric with WIS 18 (+4 modifier)
 * const clericDC = calculateSpellSaveDC({ INT: 10, WIS: 18, CHA: 12 }, 'WIS');
 * // Returns: 14  (8 + 4 + 2)
 * ```
 */
export function calculateSpellSaveDC(abilities: Record<string, number>, spellcastingAbility: string): number {
  const modifier = Math.floor((abilities[spellcastingAbility] - ABILITY_SCORE_BASE) / ABILITY_MODIFIER_DIVISOR);
  return SPELL_SAVE_DC_BASE + modifier + LEVEL_1_PROFICIENCY_BONUS;
}

/**
 * Calculate spell attack bonus for a spellcaster.
 *
 * The spell attack bonus is added to d20 rolls when making spell attacks
 * (spells that require an attack roll to hit, like Fire Bolt or Guiding Bolt).
 * This bonus applies to all spell attacks made by the character.
 *
 * **Formula**: `spellcasting ability modifier + proficiency bonus`
 *
 * **Attack Roll**: `d20 + spell attack bonus` vs target's AC
 *
 * **Note**: This function uses LEVEL_1_PROFICIENCY_BONUS (+2) as a constant.
 * For higher-level characters, the caller should recalculate with the appropriate
 * proficiency bonus for their level.
 *
 * @param abilities - Object mapping ability names to scores (e.g., { INT: 16, WIS: 14, ... })
 * @param spellcastingAbility - The ability used for spellcasting (e.g., 'INT' for Wizard,
 *                               'WIS' for Cleric, 'CHA' for Sorcerer)
 *
 * @returns The spell attack bonus value (typically ranges from +2 to +11 for level 1, higher at higher levels)
 *
 * @example
 * ```typescript
 * // Level 1 Wizard with INT 16 (+3 modifier)
 * const wizardAttack = calculateSpellAttackBonus({ INT: 16, WIS: 10, CHA: 8 }, 'INT');
 * // Returns: +5  (3 + 2)
 * // When casting Fire Bolt: rolls d20 + 5 to hit
 *
 * // Level 1 Warlock with CHA 18 (+4 modifier)
 * const warlockAttack = calculateSpellAttackBonus({ INT: 10, WIS: 12, CHA: 18 }, 'CHA');
 * // Returns: +6  (4 + 2)
 * // When casting Eldritch Blast: rolls d20 + 6 to hit
 * ```
 */
export function calculateSpellAttackBonus(abilities: Record<string, number>, spellcastingAbility: string): number {
  const modifier = Math.floor((abilities[spellcastingAbility] - ABILITY_SCORE_BASE) / ABILITY_MODIFIER_DIVISOR);
  return modifier + LEVEL_1_PROFICIENCY_BONUS;
}

/**
 * Get the maximum number of spells that can be prepared for prepared casters.
 *
 * Prepared casters (Cleric, Druid, Paladin, Artificer, and Wizard) can change
 * which spells they have prepared after a long rest. This function calculates
 * how many spells they can have prepared at any given time.
 *
 * **Formula**: `spellcasting ability modifier + character level` (minimum 1)
 *
 * **Applies to**:
 * - Clerics (WIS-based)
 * - Druids (WIS-based)
 * - Paladins (CHA-based)
 * - Artificers (INT-based)
 * - Wizards (INT-based) - prepare from their spellbook
 *
 * **Does NOT apply to**:
 * - Known casters (Bard, Sorcerer, Ranger, Warlock) - they have a fixed spell list
 *
 * @param abilities - Object mapping ability names to scores (e.g., { INT: 16, WIS: 14, ... })
 * @param spellcastingAbility - The ability used for spellcasting (e.g., 'INT', 'WIS', 'CHA')
 * @param characterLevel - The character's current level (1-20)
 *
 * @returns Maximum number of spells that can be prepared (always at least 1)
 *
 * @example
 * ```typescript
 * // Level 1 Cleric with WIS 16 (+3 modifier)
 * const clericPrepared = getMaxPreparedSpells({ WIS: 16, INT: 10 }, 'WIS', 1);
 * // Returns: 4  (3 + 1, minimum 1)
 *
 * // Level 5 Wizard with INT 18 (+4 modifier)
 * const wizardPrepared = getMaxPreparedSpells({ WIS: 12, INT: 18 }, 'INT', 5);
 * // Returns: 9  (4 + 5)
 *
 * // Level 3 Paladin with CHA 14 (+2 modifier)
 * const paladinPrepared = getMaxPreparedSpells({ WIS: 10, CHA: 14 }, 'CHA', 3);
 * // Returns: 5  (2 + 3)
 *
 * // Edge case: Low ability score
 * const lowStatCleric = getMaxPreparedSpells({ WIS: 8, INT: 10 }, 'WIS', 1);
 * // Returns: 1  (Minimum is always 1, even with negative modifier)
 * ```
 */
export function getMaxPreparedSpells(abilities: Record<string, number | string>, spellcastingAbility: string, characterLevel: number): number {
  const abilityScore = Number(abilities[spellcastingAbility]) || 0;
  const modifier = Math.floor((abilityScore - 10) / 2);
  return Math.max(1, modifier + characterLevel);
}

/**
 * Validate spell selection data for a given class and level
 */
export function validateSpellSelection(
  spellSelection: SpellSelectionData,
  classData: Class,
  characterLevel: number = 1
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const spellcastingType = getSpellcastingType(classData.slug);

  if (!spellcastingType || !classData.spellcasting) {
    return { isValid: true, errors: [] }; // Not a spellcaster
  }

  const spellcasting = classData.spellcasting;

  // Validate cantrips
  if (spellSelection.selectedCantrips.length !== spellcasting.cantripsKnown) {
    errors.push(`Must select exactly ${spellcasting.cantripsKnown} cantrips`);
  }

  // Validate based on spellcasting type
  switch (spellcastingType) {
    case 'known':
      if (!spellSelection.knownSpells || spellSelection.knownSpells.length !== spellcasting.spellsKnownOrPrepared) {
        errors.push(`Must select exactly ${spellcasting.spellsKnownOrPrepared} known spells`);
      }
      break;

    case 'prepared':
      if (!spellSelection.preparedSpells || spellSelection.preparedSpells.length !== spellcasting.spellsKnownOrPrepared) {
        errors.push(`Must select exactly ${spellcasting.spellsKnownOrPrepared} prepared spells`);
      }
      break;

    case 'wizard': {
      // Validate spellbook (6 spells)
      if (!spellSelection.spellbook || spellSelection.spellbook.length !== 6) {
        errors.push('Must select exactly 6 spells for your spellbook');
      }
      // Validate daily preparation (INT modifier + level)
      const maxPrepared = getMaxPreparedSpells({ INT: 16 }, 'INT', characterLevel); // Default INT 16 for validation
      if (!spellSelection.dailyPrepared || spellSelection.dailyPrepared.length > maxPrepared) {
        errors.push(`Can prepare at most ${maxPrepared} spells per day`);
      }
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Check if a class has spellcasting available at the current level
 */
export function hasSpellcastingAtLevel(classSlug: string, characterLevel: number = 1): boolean {
  const allClasses = loadClasses();
  const selectedClass = allClasses.find((c: Class) => c.slug === classSlug);

  if (!selectedClass || !selectedClass.spellcasting) {
    return false;
  }

  // Check if spellcasting is available at the character's current level
  return selectedClass.spellcasting.level <= characterLevel;
}

/**
 * Get available spells for character creation
 */
export function getAvailableSpellsForCreation(classSlug: string, level: number) {
  return {
    cantrips: getCantripsByClass(classSlug),
    spells: getLeveledSpellsByClass(classSlug, level)
  };
}

/**
 * Check if spell selections are complete for character creation
 */
export function areSpellSelectionsComplete(
  spellSelection: SpellSelectionData,
  classSlug: string,
  level: number,
  abilities: Record<string, number>
): boolean {
  const allClasses = loadClasses();
  const selectedClass = allClasses.find(c => c.slug === classSlug);

  if (!selectedClass?.spellcasting) {
    return true; // Non-spellcasters are always "complete"
  }

  const spellcasting = selectedClass.spellcasting;
  const spellcastingType = getSpellcastingType(classSlug);

  // Check cantrips
  const cantripsComplete = spellSelection.selectedCantrips.length === spellcasting.cantripsKnown;

  let spellsComplete = false;
  if (spellcastingType === 'known') {
    spellsComplete = (spellSelection.knownSpells?.length || 0) === spellcasting.spellsKnownOrPrepared;
  } else if (spellcastingType === 'prepared') {
    spellsComplete = (spellSelection.preparedSpells?.length || 0) === spellcasting.spellsKnownOrPrepared;
  } else if (spellcastingType === 'wizard') {
    const spellbookComplete = (spellSelection.spellbook?.length || 0) === 6;
    const maxPrepared = getMaxPreparedSpells(abilities, 'INT', level);
    const dailyComplete = (spellSelection.dailyPrepared?.length || 0) === maxPrepared;
    spellsComplete = spellbookComplete && dailyComplete;
  }

  return cantripsComplete && spellsComplete;
}

/**
 * Get the maximum spell level available for a class at a given character level
 */
export function getMaxSpellLevel(classSlug: string, characterLevel: number): number {
  const slotTable = SPELL_SLOT_TABLES[classSlug];
  if (!slotTable || !slotTable.byLevel || !slotTable.byLevel[characterLevel]) {
    return 0;
  }

  const slots = slotTable.byLevel[characterLevel];
  // Slots array: [cantrips, 1st, 2nd, 3rd, 4th, 5th, 6th, 7th, 8th, 9th]
  // Find the highest spell level with slots available
  for (let i = slots.length - 1; i >= 1; i--) {
    if (slots[i] > 0) {
      return i; // Return spell level (1-9)
    }
  }
  return 0; // No spell slots available
}

/**
 * Get all available spell levels for character creation
 * Returns array of available levels [1, 2, 3, etc.]
 */
export function getAvailableSpellLevels(classSlug: string, characterLevel: number): number[] {
  const maxLevel = getMaxSpellLevel(classSlug, characterLevel);
  const levels: number[] = [];
  for (let i = 1; i <= maxLevel; i++) {
    levels.push(i);
  }
  return levels;
}

/**
 * Clean up invalid spell selections when character data changes
 */
export function cleanupInvalidSpellSelections(
  spellSelection: SpellSelectionData,
  classSlug: string,
  level: number,
  abilities: Record<string, number>
): SpellSelectionData {
  const allClasses = loadClasses();
  const selectedClass = allClasses.find(c => c.slug === classSlug);

  if (!selectedClass?.spellcasting) {
    return spellSelection;
  }

  const spellcasting = selectedClass.spellcasting;
  const spellcastingType = getSpellcastingType(classSlug);
  const updatedSelection = { ...spellSelection };

  // Validate cantrips
  updatedSelection.selectedCantrips = spellSelection.selectedCantrips.slice(0, spellcasting.cantripsKnown);

  // Validate based on spellcasting type
  if (spellcastingType === 'known') {
    // For known casters, use level-aware spells known data
    const maxKnownSpells = (SPELLS_KNOWN_BY_CLASS as Record<string, Record<string, number>>)[classSlug]?.[level] || spellcasting.spellsKnownOrPrepared;
    updatedSelection.knownSpells = (spellSelection.knownSpells || []).slice(0, maxKnownSpells);
  } else if (spellcastingType === 'prepared') {
    // For prepared casters, calculate max prepared spells based on abilities and level
    const maxPreparedSpells = getMaxPreparedSpells(abilities, spellcasting.ability, level);
    updatedSelection.preparedSpells = (spellSelection.preparedSpells || []).slice(0, maxPreparedSpells);
  } else if (spellcastingType === 'wizard') {
    // Validate spellbook (6 spells)
    updatedSelection.spellbook = (spellSelection.spellbook || []).slice(0, 6);
    // Validate daily preparation
    const maxPrepared = getMaxPreparedSpells(abilities, 'INT', level);
    updatedSelection.dailyPrepared = (spellSelection.dailyPrepared || []).slice(0, maxPrepared);
  }

  return updatedSelection;
}

/**
 * Convert character creation spell selection to final character spellcasting data.
 *
 * This function transforms the spell selections made during character creation
 * into the complete spellcasting data structure stored on the Character object.
 * It handles the different spellcasting systems (known, prepared, wizard) and
 * populates all necessary fields including spell slots, spell save DC, and
 * spell attack bonus.
 *
 * **Handles Three Spellcasting Types**:
 * 1. **Known Casters** (Bard, Sorcerer, Ranger, Warlock)
 *    - Populates `spellsKnown` array with selected spells
 *    - Fixed spell list that doesn't change without leveling
 *
 * 2. **Prepared Casters** (Cleric, Druid, Paladin)
 *    - `spellsKnown` contains full class spell list
 *    - `preparedSpells` contains daily prepared subset
 *
 * 3. **Wizard (Spellbook)**
 *    - `spellbook` contains permanently learned spells (starts with 6)
 *    - `preparedSpells` contains daily prepared spells from spellbook
 *
 * **Calculates**:
 * - Spell save DC (8 + ability modifier + proficiency bonus)
 * - Spell attack bonus (ability modifier + proficiency bonus)
 * - Correct spell slots for character level
 * - Used spell slots (initialized to 0)
 *
 * @param spellSelection - Spell choices made during character creation wizard
 * @param classData - Full class data including spellcasting information
 * @param abilities - Object mapping ability names to scores (e.g., { INT: 16, WIS: 14, ... })
 * @param characterLevel - Character's level (default: 1)
 *
 * @returns Complete spellcasting data structure for Character object,
 *          or undefined if class is not a spellcaster
 *
 * @example
 * ```typescript
 * // Example: Level 1 Wizard
 * const wizardSpellSelection = {
 *   selectedCantrips: ['fire-bolt', 'mage-hand', 'prestidigitation'],
 *   spellbook: ['burning-hands', 'mage-armor', 'shield', 'magic-missile', 'detect-magic', 'identify'],
 *   dailyPrepared: ['shield', 'mage-armor', 'magic-missile', 'burning-hands']
 * };
 *
 * const spellcasting = migrateSpellSelectionToCharacter(
 *   wizardSpellSelection,
 *   wizardClassData,
 *   { INT: 16, WIS: 10, CHA: 8 },
 *   1
 * );
 * // Returns: {
 * //   ability: 'INT',
 * //   spellSaveDC: 13,
 * //   spellAttackBonus: 5,
 * //   cantripsKnown: ['fire-bolt', 'mage-hand', 'prestidigitation'],
 * //   spellSlots: [3, 2, 0, 0, 0, 0, 0, 0, 0, 0],  // Cantrips + level 1 slots
 * //   usedSpellSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
 * //   spellcastingType: 'wizard',
 * //   spellbook: ['burning-hands', 'mage-armor', ...],
 * //   preparedSpells: ['shield', 'mage-armor', ...]
 * // }
 * ```
 */
export function migrateSpellSelectionToCharacter(
  spellSelection: SpellSelectionData,
  classData: Class,
  abilities: Record<string, number>,
  characterLevel: number = 1
): Character['spellcasting'] {

  const spellcastingType = getSpellcastingType(classData.slug);
  if (!spellcastingType || !classData.spellcasting) {
    return undefined;
  }

  const spellcasting = classData.spellcasting;
  const slotRules = SPELL_SLOT_TABLES[classData.slug];
  const learningRules = SPELL_LEARNING_RULES[classData.slug];

  // Get correct spell slots for the character's level
  const spellSlots = slotRules?.byLevel?.[characterLevel] || spellcasting.spellSlots;

  const baseSpellcasting = {
    ability: spellcasting.ability,
    spellSaveDC: calculateSpellSaveDC(abilities, spellcasting.ability),
    spellAttackBonus: calculateSpellAttackBonus(abilities, spellcasting.ability),
    cantripsKnown: spellSelection.selectedCantrips,
    spellSlots: [...spellSlots],
    usedSpellSlots: new Array(spellSlots.length).fill(0),
    spellcastingType,
    cantripChoicesByLevel: { [characterLevel]: spellSelection.selectedCantrips.join(',') }
  };

  switch (learningRules?.type) {
    case 'known':
      return {
        ...baseSpellcasting,
        spellsKnown: spellSelection.knownSpells || spellSelection.selectedSpells || []
      };

    case 'prepared':
      return {
        ...baseSpellcasting,
        spellsKnown: getLeveledSpellsByClass(classData.slug, characterLevel).map((s: AppSpell) => s.slug),
        preparedSpells: spellSelection.preparedSpells || spellSelection.selectedSpells || []
      };

    case 'spellbook':
      return {
        ...baseSpellcasting,
        spellbook: spellSelection.spellbook || spellSelection.selectedSpells || [],
        preparedSpells: spellSelection.dailyPrepared || []
      };

    default:
      return baseSpellcasting;
  }
}