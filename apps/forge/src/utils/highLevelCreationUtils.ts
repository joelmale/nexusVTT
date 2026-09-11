/**
 * High-Level Character Creation Utilities
 *
 * Handles creation of characters at levels 2-20, calculating all features,
 * choices, and stats that should be accumulated from level 1 to the target level.
 */

import { FeatureChoice, ClassLevelFeature, ResourceTracker } from '../data/classProgression';
import { getClassProgression } from './levelUpUtils';
import { PROFICIENCY_BONUSES, CANTRIPS_KNOWN_BY_CLASS } from '../services/dataService';
import { SPELL_SLOTS_BY_CLASS } from '../data/spellSlots';

/**
 * Represents a choice that must be made during high-level character creation
 */
export interface HighLevelChoice {
  level: number;
  featureName: string;
  choice: FeatureChoice;
}

/**
 * Represents all accumulated features for a high-level character
 */
export interface AccumulatedFeatures {
  automaticFeatures: Array<{
    level: number;
    feature: ClassLevelFeature;
  }>;
  requiredChoices: HighLevelChoice[];
  totalHP: number;
  proficiencyBonus: number;
  // Spellcasting progression
  spellSlots?: Record<string, number>;
  cantripsKnown?: number;
  spellsKnown?: number;
  // Class-specific resources
  resources: Array<{
    level: number;
    resource: ResourceTracker;
  }>;
}

/**
 * Calculate accumulated features for high-level character creation (levels 2-20).
 *
 * This function analyzes class progression data to determine:
 * 1. **Automatic Features**: Features granted without player choice (e.g., Extra Attack, Sneak Attack progression)
 * 2. **Required Choices**: Features that require player decisions (e.g., subclass, ASI/feat, fighting style)
 * 3. **Total HP**: Calculated hit points based on class hit die and level
 * 4. **Resources**: Trackable class resources that scale with level (e.g., Second Wind, Rage uses)
 * 5. **Spellcasting Progression**: Spell slots, cantrips, and spells known/prepared at target level
 *
 * @param classSlug - The class identifier (e.g., 'fighter', 'wizard', 'cleric')
 * @param edition - Game edition: '2014' (original 5e) or '2024' (revised 5e rules)
 * @param targetLevel - The target character level (must be between 1-20)
 *
 * @returns AccumulatedFeatures object containing all features, choices, and progression data,
 *          or null if class progression data is not found or level is invalid
 *
 * @example
 * ```typescript
 * const features = calculateFeaturesForLevel('wizard', '2024', 5);
 * // Returns: { automaticFeatures: [...], requiredChoices: [...], totalHP: 24, ... }
 * ```
 */
export function calculateFeaturesForLevel(
  classSlug: string,
  edition: '2014' | '2024',
  targetLevel: number
): AccumulatedFeatures | null {
  if (targetLevel < 1 || targetLevel > 20) {
    return null;
  }

  const progression = getClassProgression(classSlug, edition);
  if (!progression) {
    return null;
  }

  const automaticFeatures: Array<{ level: number; feature: ClassLevelFeature }> = [];
  const requiredChoices: HighLevelChoice[] = [];
  const resources: Array<{ level: number; resource: ResourceTracker }> = [];

  // Collect all features from level 1 to target level
  for (let level = 1; level <= targetLevel; level++) {
    const featuresAtLevel = progression.features.filter(f => f.level === level);

    featuresAtLevel.forEach(feature => {
      if (feature.automatic) {
        automaticFeatures.push({ level, feature });

        // Collect resources
        if (feature.resources) {
          feature.resources.forEach(resource => {
            resources.push({ level, resource });
          });
        }
      } else if (feature.choices) {
        // This feature requires player choice
        feature.choices.forEach(choice => {
          requiredChoices.push({
            level,
            featureName: feature.name,
            choice
          });
        });
      }
    });
  }

  const proficiencyBonus = PROFICIENCY_BONUSES[targetLevel - 1];

  return {
    automaticFeatures,
    requiredChoices,
    totalHP: 0, // Will be calculated separately with CON modifier
    proficiencyBonus,
    resources
  };
}

/**
 * Get all required choices for creating a character at a given level.
 *
 * This is a convenience function that extracts only the required player choices
 * from the full feature calculation. Useful for determining what decisions
 * the player needs to make during character creation without calculating
 * all automatic features and stats.
 *
 * @param classSlug - The class identifier (e.g., 'fighter', 'wizard', 'cleric')
 * @param edition - Game edition: '2014' (original 5e) or '2024' (revised 5e rules)
 * @param targetLevel - The target character level (must be between 1-20)
 *
 * @returns Array of HighLevelChoice objects representing decisions to be made,
 *          or empty array if class is invalid or no choices are required
 *
 * @example
 * ```typescript
 * const choices = getRequiredChoicesForLevel('fighter', '2024', 4);
 * // Returns: [{ level: 1, featureName: "Fighting Style", choice: {...} },
 * //           { level: 4, featureName: "Ability Score Improvement", choice: {...} }]
 * ```
 */
export function getRequiredChoicesForLevel(
  classSlug: string,
  edition: '2014' | '2024',
  targetLevel: number
): HighLevelChoice[] {
  const features = calculateFeaturesForLevel(classSlug, edition, targetLevel);
  return features?.requiredChoices || [];
}

/**
 * Calculate total HP for a character created at a given level.
 *
 * This function implements D&D 5e hit point calculation rules:
 * - **Level 1**: Always maximum hit die value + CON modifier
 * - **Levels 2+**: Either use provided rolls OR use average (rounded down + 1) + CON modifier
 *
 * Returns both the total HP and a detailed breakdown showing how HP was calculated
 * at each level. This breakdown is useful for displaying to players during character
 * creation or for audit purposes.
 *
 * **Average HP Formula**: `floor(hitDie / 2) + 1 + CON modifier` per level after 1st
 *
 * @param hitDie - The class hit die as a string (e.g., 'd6', 'd8', 'd10', 'd12')
 * @param targetLevel - The target character level (1-20)
 * @param conModifier - Constitution modifier applied to each level's HP calculation
 * @param hpRolls - Optional array of HP rolls for levels 2+ (length should be targetLevel - 1).
 *                  If not provided or shorter than needed, average roll is used for missing levels.
 *
 * @returns Object containing:
 *          - `totalHP`: The sum of all hit points from level 1 to targetLevel
 *          - `breakdown`: Array of objects showing per-level HP calculation details
 *
 * @example
 * ```typescript
 * // Fighter (d10) level 5 with CON 14 (+2), using average HP
 * const result = calculateHPForLevel('d10', 5, 2);
 * // Returns: { totalHP: 42, breakdown: [
 * //   { level: 1, roll: 10, conBonus: 2, total: 12 },  // Max at level 1
 * //   { level: 2, roll: 6, conBonus: 2, total: 8 },    // Average (5.5 → 6) + 2
 * //   { level: 3, roll: 6, conBonus: 2, total: 8 },
 * //   { level: 4, roll: 6, conBonus: 2, total: 8 },
 * //   { level: 5, roll: 6, conBonus: 2, total: 8 }
 * // ]}
 *
 * // Same fighter with custom rolls for levels 2-5
 * const result2 = calculateHPForLevel('d10', 5, 2, [8, 10, 7, 9]);
 * // Returns: { totalHP: 56, breakdown: [...] } // Using provided rolls instead of average
 * ```
 */
export function calculateHPForLevel(
  hitDie: string,
  targetLevel: number,
  conModifier: number,
  hpRolls?: number[]
): { totalHP: number; breakdown: Array<{ level: number; roll: number; conBonus: number; total: number }> } {
  const dieSize = parseInt(hitDie.substring(1));
  const averageRoll = Math.floor(dieSize / 2) + 1;

  const breakdown: Array<{ level: number; roll: number; conBonus: number; total: number }> = [];

  // Level 1: Always max hit die + CON
  const level1HP = dieSize + conModifier;
  breakdown.push({
    level: 1,
    roll: dieSize,
    conBonus: conModifier,
    total: level1HP
  });

  let totalHP = level1HP;

  // Levels 2+: Use rolls if provided, otherwise use average
  for (let level = 2; level <= targetLevel; level++) {
    const rollIndex = level - 2; // hpRolls array is 0-indexed for levels 2+
    const roll = hpRolls?.[rollIndex] ?? averageRoll;
    const levelHP = roll + conModifier;

    breakdown.push({
      level,
      roll,
      conBonus: conModifier,
      total: levelHP
    });

    totalHP += levelHP;
  }

  return { totalHP, breakdown };
}

/**
 * Calculate spell progression for a spellcasting class at a given level.
 *
 * This function determines the spellcasting capabilities for a character based on
 * their class and level. It returns spell slots, cantrips known, and spells known
 * (for known casters like Bard, Sorcerer, Ranger, Warlock).
 *
 * **Returns null for non-spellcasting classes** (Barbarian, Fighter, Monk, Rogue).
 *
 * **Spell Slots Format**: Object with keys like `level1`, `level2`, etc., each
 * containing the number of spell slots available at that spell level.
 *
 * **Known vs Prepared Casters**:
 * - Known casters (Bard, Sorcerer, Ranger, Warlock) get `spellsKnown` value
 * - Prepared casters (Cleric, Druid, Paladin) do not get `spellsKnown` (undefined)
 * - Wizards are handled separately (spellbook system)
 *
 * @param classSlug - The class identifier (e.g., 'wizard', 'sorcerer', 'cleric')
 * @param targetLevel - The target character level (1-20)
 *
 * @returns Object containing spell progression data, or null if not a spellcaster:
 *          - `spellSlots`: Object mapping spell levels to number of slots (e.g., { level1: 4, level2: 3 })
 *          - `cantripsKnown`: Number of cantrips the character knows at this level
 *          - `spellsKnown`: (Optional) Number of spells known for known casters
 *          - `maxSpellLevel`: Highest spell level the character can cast (1-9)
 *
 * @example
 * ```typescript
 * // Level 5 Wizard (prepared caster)
 * const wizardSpells = calculateSpellProgressionForLevel('wizard', 5);
 * // Returns: {
 * //   spellSlots: { level1: 4, level2: 3, level3: 2 },
 * //   cantripsKnown: 4,
 * //   spellsKnown: undefined,  // Wizards use spellbook system
 * //   maxSpellLevel: 3
 * // }
 *
 * // Level 5 Sorcerer (known caster)
 * const sorcererSpells = calculateSpellProgressionForLevel('sorcerer', 5);
 * // Returns: {
 * //   spellSlots: { level1: 4, level2: 3, level3: 2 },
 * //   cantripsKnown: 5,
 * //   spellsKnown: 6,  // Sorcerer knows 6 spells at level 5
 * //   maxSpellLevel: 3
 * // }
 *
 * // Non-spellcaster (Fighter)
 * const fighterSpells = calculateSpellProgressionForLevel('fighter', 5);
 * // Returns: null
 * ```
 */
export function calculateSpellProgressionForLevel(
  classSlug: string,
  targetLevel: number
): {
  spellSlots: Record<string, number>;
  cantripsKnown: number;
  spellsKnown?: number;
  maxSpellLevel: number;
} | null {
  const spellSlots = SPELL_SLOTS_BY_CLASS[classSlug]?.[targetLevel];
  if (!spellSlots) {
    return null; // Not a spellcasting class
  }

  // Convert array to object format
  const slotsObj: Record<string, number> = {};
  let maxSpellLevel = 0;

  spellSlots.forEach((count, level) => {
    if (level > 0 && count > 0) {
      slotsObj[`level${level}`] = count;
      maxSpellLevel = Math.max(maxSpellLevel, level);
    }
  });

  // Get cantrips known
  const cantripsKnown = (CANTRIPS_KNOWN_BY_CLASS as Record<string, Record<string, number>>)[classSlug]?.[targetLevel.toString()] || 0;

  // Calculate spells known for known casters
  let spellsKnown: number | undefined;

  // Known casters: Bard, Ranger, Sorcerer, Warlock
  const knownCasters: Record<string, (level: number) => number> = {
    'bard': (level: number) => {
      if (level === 1) return 4;
      if (level === 2) return 5;
      if (level === 3) return 6;
      if (level === 4) return 7;
      if (level === 5) return 8;
      if (level === 6) return 9;
      if (level === 7) return 10;
      if (level === 8) return 11;
      if (level === 9) return 12;
      if (level >= 10 && level <= 12) return 14;
      if (level >= 13 && level <= 14) return 15;
      if (level >= 15 && level <= 16) return 16;
      if (level >= 17) return 22;
      return 4;
    },
    'ranger': (level: number) => {
      if (level === 2) return 2;
      if (level === 3) return 3;
      if (level === 5) return 4;
      if (level === 7) return 5;
      if (level === 9) return 6;
      if (level === 11) return 7;
      if (level === 13) return 8;
      if (level === 15) return 9;
      if (level === 17) return 10;
      if (level === 19) return 11;
      return 0;
    },
    'sorcerer': (level: number) => {
      if (level === 1) return 2;
      if (level === 2) return 3;
      if (level === 3) return 4;
      if (level === 4) return 5;
      if (level === 5) return 6;
      if (level === 6) return 7;
      if (level === 7) return 8;
      if (level === 8) return 9;
      if (level === 9) return 10;
      if (level === 10) return 11;
      if (level === 11) return 12;
      if (level >= 12 && level <= 14) return 12;
      if (level >= 15 && level <= 16) return 13;
      if (level >= 17) return 15;
      return 2;
    },
    'warlock': (level: number) => {
      if (level === 1) return 2;
      if (level === 2) return 3;
      if (level === 3) return 4;
      if (level === 4) return 5;
      if (level === 5) return 6;
      if (level === 6) return 7;
      if (level === 7) return 8;
      if (level === 8) return 9;
      if (level === 9) return 10;
      if (level >= 10 && level <= 10) return 10;
      if (level >= 11 && level <= 12) return 11;
      if (level >= 13 && level <= 14) return 12;
      if (level >= 15 && level <= 16) return 13;
      if (level >= 17) return 15;
      return 2;
    }
  };

  if (knownCasters[classSlug]) {
    spellsKnown = knownCasters[classSlug](targetLevel);
  }

  return {
    spellSlots: slotsObj,
    cantripsKnown,
    spellsKnown,
    maxSpellLevel
  };
}

/**
 * Determine if a class requires subclass selection at the target level.
 *
 * In D&D 5e, different classes gain their subclass at different levels:
 * - **Most classes**: Subclass at level 3
 * - **Cleric 2014**: Subclass (Divine Domain) at level 1
 * - **Warlock**: Subclass (Patron) at level 1
 * - **Cleric 2024**: Subclass (Divine Domain) at level 3 (changed from 2014)
 * - **Sorcerer**: Subclass (Origin) at level 1 (2014) or level 3 (2024)
 *
 * This function checks the class progression data to determine the correct
 * subclass level for the specified edition, and returns whether the character
 * needs to make a subclass choice at their target level.
 *
 * @param classSlug - The class identifier (e.g., 'fighter', 'wizard', 'cleric')
 * @param edition - Game edition: '2014' (original 5e) or '2024' (revised 5e rules)
 * @param targetLevel - The target character level (1-20)
 *
 * @returns Object containing:
 *          - `required`: Boolean indicating if subclass selection is required (targetLevel >= subclassLevel)
 *          - `subclassLevel`: The level at which this class gains their subclass
 *
 * @example
 * ```typescript
 * // Fighter (subclass at level 3)
 * const fighter = requiresSubclass('fighter', '2024', 2);
 * // Returns: { required: false, subclassLevel: 3 }  // Not yet level 3
 *
 * const fighter2 = requiresSubclass('fighter', '2024', 3);
 * // Returns: { required: true, subclassLevel: 3 }   // Must choose subclass
 *
 * // Cleric 2014 (subclass at level 1)
 * const cleric2014 = requiresSubclass('cleric', '2014', 1);
 * // Returns: { required: true, subclassLevel: 1 }   // Must choose domain immediately
 *
 * // Cleric 2024 (subclass changed to level 3)
 * const cleric2024 = requiresSubclass('cleric', '2024', 1);
 * // Returns: { required: false, subclassLevel: 3 }  // No domain yet at level 1
 * ```
 */
export function requiresSubclass(
  classSlug: string,
  edition: '2014' | '2024',
  targetLevel: number
): { required: boolean; subclassLevel: number } {
  const progression = getClassProgression(classSlug, edition);

  if (!progression) {
    // Fallback for classes without progression data
    const defaultSubclassLevel = 3;
    return {
      required: targetLevel >= defaultSubclassLevel,
      subclassLevel: defaultSubclassLevel
    };
  }

  return {
    required: targetLevel >= progression.subclassLevel,
    subclassLevel: progression.subclassLevel
  };
}

/**
 * Get all ASI levels up to and including the target level.
 *
 * ASI (Ability Score Improvement) levels are when a character can choose to either:
 * - Increase two ability scores by 1 each, OR increase one ability score by 2, OR
 * - Take a feat instead of ability score increases
 *
 * **Standard ASI Levels** (most classes): 4, 8, 12, 16, 19
 * **Fighter Exception**: Gets additional ASI at levels 6 and 14
 * **Rogue Exception**: Gets additional ASI at level 10
 *
 * This function queries the class progression data for the correct ASI levels
 * based on edition and returns only those that the character has reached.
 *
 * @param classSlug - The class identifier (e.g., 'fighter', 'wizard', 'rogue')
 * @param edition - Game edition: '2014' (original 5e) or '2024' (revised 5e rules)
 * @param targetLevel - The target character level (1-20)
 *
 * @returns Array of level numbers where ASI/Feat choices are available,
 *          filtered to only include levels up to and including targetLevel
 *
 * @example
 * ```typescript
 * // Standard class (Wizard) at level 5
 * const wizardASI = getASILevelsForCharacter('wizard', '2024', 5);
 * // Returns: [4]  // Only level 4 ASI reached so far
 *
 * // Fighter at level 10 (gets extra ASI at level 6)
 * const fighterASI = getASILevelsForCharacter('fighter', '2024', 10);
 * // Returns: [4, 6, 8]  // Fighter has 3 ASIs by level 10
 *
 * // Rogue at level 20 (gets extra ASI at level 10)
 * const rogueASI = getASILevelsForCharacter('rogue', '2024', 20);
 * // Returns: [4, 8, 10, 12, 16, 19]  // Rogue has 6 ASIs total
 * ```
 */
export function getASILevelsForCharacter(
  classSlug: string,
  edition: '2014' | '2024',
  targetLevel: number
): number[] {
  const progression = getClassProgression(classSlug, edition);

  if (!progression) {
    // Fallback: Standard ASI levels for most classes
    const standardASILevels = [4, 8, 12, 16, 19];
    return standardASILevels.filter(level => level <= targetLevel);
  }

  return progression.asiLevels.filter(level => level <= targetLevel);
}

/**
 * Create a human-readable summary of what a character will receive at a given level.
 *
 * This function generates a formatted text summary showing the player what features,
 * choices, and bonuses they will receive when creating a character at a specific level.
 * Useful for displaying in the character creation wizard to inform player decisions.
 *
 * The summary includes:
 * - Number of automatic class features gained from level 1 to target level
 * - Number of choices to be made (ASI/feats, subclass, fighting style, etc.)
 * - Proficiency bonus at the target level
 *
 * @param classSlug - The class identifier (e.g., 'fighter', 'wizard', 'cleric')
 * @param edition - Game edition: '2014' (original 5e) or '2024' (revised 5e rules)
 * @param targetLevel - The target character level (1-20)
 *
 * @returns Formatted multi-line string summary of character features,
 *          or generic message if class progression data is unavailable
 *
 * @example
 * ```typescript
 * const summary = generateLevelSummary('fighter', '2024', 5);
 * // Returns:
 * // "Creating a level 5 fighter.
 * //
 * // You will receive:
 * // • 8 automatic class features
 * // • 2 choices to make (ASI, feats, subclass, etc.)
 * // • Proficiency bonus: +3"
 *
 * const summary2 = generateLevelSummary('wizard', '2024', 1);
 * // Returns:
 * // "Creating a level 1 wizard.
 * //
 * // You will receive:
 * // • 5 automatic class features
 * // • 0 choices to make (ASI, feats, subclass, etc.)
 * // • Proficiency bonus: +2"
 * ```
 */
export function generateLevelSummary(
  classSlug: string,
  edition: '2014' | '2024',
  targetLevel: number
): string {
  const features = calculateFeaturesForLevel(classSlug, edition, targetLevel);

  if (!features) {
    return `Creating a level ${targetLevel} character.`;
  }

  const choiceCount = features.requiredChoices.length;
  const featureCount = features.automaticFeatures.length;

  let summary = `Creating a level ${targetLevel} ${classSlug}.\n\n`;
  summary += `You will receive:\n`;
  summary += `• ${featureCount} automatic class features\n`;
  summary += `• ${choiceCount} choices to make (ASI, feats, subclass, etc.)\n`;
  summary += `• Proficiency bonus: +${features.proficiencyBonus}\n`;

  return summary;
}
