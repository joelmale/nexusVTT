/**
 * Class Progression System - Type Definitions
 *
 * This module defines the data structures for tracking class-specific level progression,
 * features, choices, and resource management for the guided level-up wizard.
 */

/**
 * Types of choices a player must make when leveling up
 */
export type FeatureChoiceType =
  | 'asi'              // Ability Score Increase
  | 'feat'             // Feat selection
  | 'subclass'         // Subclass selection
  | 'spells'           // Learn new spells
  | 'fighting-style'   // Choose a fighting style
  | 'metamagic'        // Sorcerer Metamagic options
  | 'invocation'       // Warlock Eldritch Invocation
  | 'pact-boon'        // Warlock Pact Boon
  | 'wild-shape'       // Druid Wild Shape options
  | 'favored-enemy'    // Ranger favored enemy choice
  | 'natural-explorer' // Ranger natural explorer choice
  | 'skill-expertise'  // Wizard Scholar skill expertise
  | 'spell-mastery'    // Wizard Spell Mastery choices
  | 'signature-spells'; // Wizard Signature Spells choices

/**
 * Represents a choice the player must make at a specific level
 */
export interface FeatureChoice {
  type: FeatureChoiceType;
  description: string;
  count?: number; // Number of selections (e.g., 2 for ASI points, 1 for feat)
}

/**
 * Frequency at which a resource recharges
 */
export type ResourceRechargeType = 'short-rest' | 'long-rest' | 'daily' | 'none';

/**
 * Trackable resource that scales with level (e.g., Second Wind uses, Rage uses)
 */
export interface ResourceTracker {
  id: string;                      // Unique identifier (e.g., 'second-wind')
  name: string;                    // Display name (e.g., 'Second Wind')
  description: string;             // What the resource does
  maxUses: number;                 // Maximum uses per recharge
  rechargeType: ResourceRechargeType; // When it recharges
  currentUses?: number;            // Current uses remaining (runtime tracking)
}

/**
 * A feature gained at a specific class level
 */
export interface ClassLevelFeature {
  level: number;                   // Level at which this feature is gained
  name: string;                    // Feature name (e.g., 'Extra Attack')
  description: string;             // Feature description
  automatic: boolean;              // If true, applied automatically; if false, requires choice
  choices?: FeatureChoice[];       // Player choices required at this level
  resources?: ResourceTracker[];   // Resources gained or modified at this level
}

/**
 * Complete class progression data for levels 1-20
 */
export interface ClassProgression {
  classSlug: string;               // Class identifier (e.g., 'fighter')
  className: string;               // Display name (e.g., 'Fighter')
  edition: '2014' | '2024';        // Rules edition
  hitDie: string;                  // Hit die (e.g., 'd10')
  asiLevels: number[];             // Levels at which ASI/Feat is granted
  subclassLevel: number;           // Level at which subclass is chosen
  features: ClassLevelFeature[];   // All features by level
}

/**
 * Record of a completed level-up, stored in character history
 */
export interface LevelUpRecord {
  level: number;                   // Level reached
  timestamp: string;               // ISO timestamp of level-up
  hpRolled?: number;               // HP roll (if rolled, otherwise average)
  hpGained: number;                // Total HP gained (roll + CON modifier)
  asiChoices?: {                   // If ASI was chosen
    ability: string;               // Ability increased (e.g., 'STR')
    increase: number;              // Amount increased (usually +1)
  }[];
  featChosen?: string;             // Feat slug if feat was chosen instead of ASI
  subclassChosen?: string;         // Subclass slug if chosen at this level
  spellsLearned?: string[];        // Spell slugs learned at this level
  fightingStyleChosen?: string;    // Fighting style slug if chosen
  invocationChosen?: string;       // Eldritch Invocation if chosen
  featuresGained: string[];        // Names of automatic features gained
}

/**
 * Data calculated for a pending level-up
 */
export interface LevelUpData {
  fromLevel: number;               // Current level
  toLevel: number;                 // New level
  newProficiencyBonus: number;     // New proficiency bonus (if changed)
  hitDie: string;                  // Class hit die
  conModifier: number;             // CON modifier for HP calculation
  averageHpGain: number;           // Average HP increase (rounded up)
  newSpellSlots?: Record<string, number>; // New spell slots (for casters)
  newCantripsKnown?: number;       // New cantrips known (for casters)
  newSpellsKnown?: number;         // New spells known/prepared (for casters)
  features: ClassLevelFeature[];   // Features gained at this level
  requiresChoices: boolean;        // If true, wizard must be shown
  choices: FeatureChoice[];        // All choices to be made
}

/**
 * Helper to check if a level grants an ASI/Feat choice
 */
export function grantsASI(level: number, classSlug: string): boolean {
  // Fighter gets ASI at non-standard levels in 2024
  if (classSlug === 'fighter') {
    return [4, 6, 8, 12, 14, 16, 19].includes(level);
  }

  // Standard ASI levels for most classes
  return [4, 8, 12, 16, 19].includes(level);
}

/**
 * Helper to get all ASI levels for a class
 */
export function getASILevels(classSlug: string, edition: '2014' | '2024' = '2024'): number[] {
  if (edition === '2024' && classSlug === 'fighter') {
    return [4, 6, 8, 12, 14, 16, 19];
  }

  // Standard ASI levels for most classes in both editions
  return [4, 8, 12, 16, 19];
}
