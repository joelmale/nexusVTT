/**
 * Combat and Character Constants
 *
 * Centralizes magic numbers used throughout the application for combat calculations,
 * armor class, spell mechanics, and other D&D 5e rules.
 */

// ============================================================================
// Armor Class Constants
// ============================================================================

/**
 * Base armor class for an unarmored character (10 + DEX modifier)
 */
export const BASE_ARMOR_CLASS = 10;

/**
 * AC bonus provided by equipping a shield
 */
export const SHIELD_AC_BONUS = 2;

/**
 * Maximum DEX modifier bonus allowed when wearing medium armor
 */
export const MAX_DEX_BONUS_MEDIUM_ARMOR = 2;

/**
 * Armor categories as defined in D&D 5e rules
 */
export const ARMOR_CATEGORIES = {
  LIGHT: 'Light' as const,
  MEDIUM: 'Medium' as const,
  HEAVY: 'Heavy' as const,
  SHIELD: 'Shield' as const,
} as const;

/**
 * Type for armor categories
 */
export type ArmorCategory = typeof ARMOR_CATEGORIES[keyof typeof ARMOR_CATEGORIES];

/**
 * Calculate armor class based on armor type
 * @param armorCategory - Type of armor worn
 * @param baseAC - Base AC from armor
 * @param dexModifier - Character's DEX modifier
 * @param maxDexBonus - Maximum DEX bonus allowed (for medium armor)
 * @param currentAC - Current AC (for shields, which add to existing AC)
 * @returns Calculated armor class
 */
export const calculateArmorClassByCategory = (
  armorCategory: ArmorCategory,
  baseAC: number,
  dexModifier: number,
  maxDexBonus?: number,
  currentAC?: number
): number => {
  switch (armorCategory) {
    case ARMOR_CATEGORIES.LIGHT:
      // Light armor: base + full DEX modifier
      return baseAC + dexModifier;

    case ARMOR_CATEGORIES.MEDIUM:
      // Medium armor: base + DEX modifier (max +2 or armor-specific max)
      return baseAC + Math.min(dexModifier, maxDexBonus ?? MAX_DEX_BONUS_MEDIUM_ARMOR);

    case ARMOR_CATEGORIES.HEAVY:
      // Heavy armor: base AC only (no DEX modifier)
      return baseAC;

    case ARMOR_CATEGORIES.SHIELD:
      // Shield: adds bonus to current AC
      return (currentAC ?? BASE_ARMOR_CLASS) + SHIELD_AC_BONUS;

    default:
      // Fallback: unarmored (10 + DEX)
      return BASE_ARMOR_CLASS + dexModifier;
  }
};

// ============================================================================
// Spellcasting Constants
// ============================================================================

/**
 * Base value for spell save DC calculation (8 + ability modifier + proficiency bonus)
 */
export const SPELL_SAVE_DC_BASE = 8;

/**
 * Proficiency bonus at level 1 (used for initial spell DC calculations)
 */
export const LEVEL_1_PROFICIENCY_BONUS = 2;

// ============================================================================
// Equipment Constants
// ============================================================================

/**
 * Probability threshold for receiving bonus items during character creation
 * Value of 0.7 means 30% chance (when Math.random() > 0.7)
 */
export const BONUS_ITEM_PROBABILITY = 0.7;

/**
 * Quantity of items to receive when bonus item roll succeeds
 */
export const BONUS_ITEM_QUANTITY = 2;

/**
 * Standard quantity for regular item grants
 */
export const STANDARD_ITEM_QUANTITY = 1;

// ============================================================================
// Ability Score Constants
// ============================================================================

/**
 * Base value used in ability modifier calculation: (score - 10) / 2
 */
export const ABILITY_SCORE_BASE = 10;

/**
 * Divisor used in ability modifier calculation: (score - 10) / 2
 */
export const ABILITY_MODIFIER_DIVISOR = 2;

/**
 * Maximum ability score achievable through normal means (before magic items)
 */
export const MAX_ABILITY_SCORE = 20;

/**
 * Minimum ability score (typically lowest possible roll)
 */
export const MIN_ABILITY_SCORE = 3;

// ============================================================================
// Movement Constants
// ============================================================================

/**
 * Default base walking speed for Medium creatures in feet per turn
 */
export const DEFAULT_WALKING_SPEED = 30;

// ============================================================================
// Currency Constants
// ============================================================================

/**
 * Default starting currency values for new characters
 */
export const DEFAULT_STARTING_CURRENCY = {
  cp: 0,
  sp: 0,
  gp: 0,
  pp: 0,
} as const;

// ============================================================================
// Character Creation Constants
// ============================================================================

/**
 * Default name for characters created without a specified name
 */
export const DEFAULT_CHARACTER_NAME = "Unnamed Hero";
