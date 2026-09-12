/**
 * Common types used across the rules engine
 */

/**
 * D&D 5e ability scores
 */
export type Ability = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

/**
 * All ability scores as an array
 */
export const ABILITIES: Ability[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

/**
 * D&D 5e skills
 */
export type Skill =
  | 'Acrobatics'
  | 'Animal Handling'
  | 'Arcana'
  | 'Athletics'
  | 'Deception'
  | 'History'
  | 'Insight'
  | 'Intimidation'
  | 'Investigation'
  | 'Medicine'
  | 'Nature'
  | 'Perception'
  | 'Performance'
  | 'Persuasion'
  | 'Religion'
  | 'Sleight of Hand'
  | 'Stealth'
  | 'Survival';

/**
 * All skills as an array
 */
export const SKILLS: Skill[] = [
  'Acrobatics',
  'Animal Handling',
  'Arcana',
  'Athletics',
  'Deception',
  'History',
  'Insight',
  'Intimidation',
  'Investigation',
  'Medicine',
  'Nature',
  'Perception',
  'Performance',
  'Persuasion',
  'Religion',
  'Sleight of Hand',
  'Stealth',
  'Survival',
];

/**
 * Proficiency types
 */
export type ProficiencyType = 'armor' | 'weapon' | 'tool' | 'language' | 'savingThrow' | 'skill';

/**
 * D&D editions supported
 */
export type Edition = '2014' | '2024';

/**
 * Effect priority for execution ordering
 */
export type EffectPriority = 'base' | 'additive' | 'multiplicative' | 'override' | 'flag';

/**
 * Stacking rules for bonuses
 */
export type StackingRule = 'stack' | 'highest' | 'max' | 'flag' | 'sources';

/**
 * Bonus types for stacking logic
 */
export type BonusType =
  | 'enhancement'
  | 'armor'
  | 'shield'
  | 'natural'
  | 'deflection'
  | 'dodge'
  | 'circumstance'
  | 'untyped';

/**
 * Movement types
 */
export type MovementType = 'walk' | 'fly' | 'swim' | 'climb' | 'burrow';

/**
 * Sense types
 */
export type SenseType = 'darkvision' | 'blindsight' | 'tremorsense' | 'truesight';

/**
 * Resource types
 */
export type ResourceType =
  | 'spellSlot'
  | 'perLongRest'
  | 'perShortRest'
  | 'perTurn'
  | 'unlimited';

/**
 * Spellcasting types
 */
export type SpellcastingType = 'innate' | 'known' | 'alwaysPrepared' | 'prepared' | 'spellbook';
