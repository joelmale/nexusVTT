/**
 * Zod schemas for common types
 */

import { z } from 'zod';

/**
 * Ability schema
 */
export const abilitySchema = z.enum(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']);

/**
 * Skill schema
 */
export const skillSchema = z.enum([
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
]);

/**
 * Proficiency type schema
 */
export const proficiencyTypeSchema = z.enum([
  'armor',
  'weapon',
  'tool',
  'language',
  'savingThrow',
  'skill',
]);

/**
 * Edition schema
 */
export const editionSchema = z.enum(['2014', '2024']);

/**
 * Effect priority schema
 */
export const effectPrioritySchema = z.enum(['base', 'additive', 'multiplicative', 'override', 'flag']);

/**
 * Stacking rule schema
 */
export const stackingRuleSchema = z.enum(['stack', 'highest', 'flag', 'sources']);

/**
 * Bonus type schema
 */
export const bonusTypeSchema = z.enum([
  'enhancement',
  'armor',
  'shield',
  'natural',
  'deflection',
  'dodge',
  'circumstance',
  'untyped',
]);

/**
 * Movement type schema
 */
export const movementTypeSchema = z.enum(['walk', 'fly', 'swim', 'climb', 'burrow']);

/**
 * Sense type schema
 */
export const senseTypeSchema = z.enum(['darkvision', 'blindsight', 'tremorsense', 'truesight']);

/**
 * Resource type schema
 */
export const resourceTypeSchema = z.enum([
  'spellSlot',
  'perLongRest',
  'perShortRest',
  'perTurn',
  'unlimited',
]);

/**
 * Spellcasting type schema
 */
export const spellcastingTypeSchema = z.enum([
  'innate',
  'known',
  'alwaysPrepared',
  'prepared',
  'spellbook',
]);
