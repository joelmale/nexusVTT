/**
 * Base facts - inputs to the rules engine
 * These are the raw character choices/state before any effects are applied
 */

import type { Ability, Edition } from './common';

/**
 * Base facts about a character used for rules evaluation
 */
export interface BaseFacts {
  // Character Identity
  level: number;
  classSlug: string;
  classLevel: Record<string, number>; // For multiclassing
  subclassSlug?: string;
  speciesSlug: string;
  lineageSlug?: string;
  backgroundSlug: string;
  edition: Edition;

  // Base Ability Scores (before any effects)
  abilities: Record<Ability, number>;

  // Choices Made (for effects with choices)
  choices: Record<string, string | string[] | number>;

  // Equipment State
  equippedArmor?: string;
  equippedWeapons: string[];
  equippedItems: string[];

  // Active Conditions
  conditions: string[];

  // Initial Tags (can be added by effects)
  tags: string[];

  // Feat Selections
  feats: string[]; // feat slugs

  // Current Resource Usage
  resourceUsage?: Record<string, number>; // resourceId -> used count
}

/**
 * Character choices for effects that require selection
 */
export interface CharacterChoices {
  [choiceId: string]: string | string[] | number;
}
