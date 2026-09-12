/**
 * Derived state types - outputs from the rules engine
 * All values here are computed, never stored
 */

import type { Ability, Skill } from './common';

/**
 * Derived ability score information
 */
export interface DerivedAbility {
  score: number;
  modifier: number;
}

/**
 * Derived saving throw information
 */
export interface DerivedSave {
  proficient: boolean;
  bonus: number;
  advantage: string[]; // source IDs granting advantage
  disadvantage: string[]; // source IDs granting disadvantage
}

/**
 * Derived skill information
 */
export interface DerivedSkill {
  proficient: boolean;
  expertise: boolean;
  bonus: number;
  ability: Ability;
}

/**
 * Derived armor class information
 */
export interface DerivedAC {
  value: number;
  sources: string[]; // source IDs contributing to AC
}

/**
 * Derived initiative information
 */
export interface DerivedInitiative {
  bonus: number;
  advantage: string[];
  disadvantage: string[];
}

/**
 * Derived sense information
 */
export interface DerivedSense {
  type: string;
  range: number;
  sources: string[];
}

/**
 * Derived spellcasting information
 */
export interface DerivedSpellcasting {
  ability: Ability;
  saveDC: number;
  attackBonus: number;
  slots: Record<number, { max: number; used: number }>;
  spellsKnown: string[];
  spellsPrepared: string[];
  spellsAlwaysPrepared: string[];
  cantrips: string[];
}

/**
 * Derived resource information
 */
export interface DerivedResource {
  id: string;
  max: number;
  current: number;
  type: 'spellSlot' | 'perLongRest' | 'perShortRest' | 'perTurn' | 'unlimited';
  sources: string[];
}

/**
 * Derived feature information
 */
export interface DerivedFeature {
  id: string;
  name: string;
  description: string;
  source: string;
}

/**
 * Proficiencies organized by type
 */
export interface DerivedProficiencies {
  armor: string[];
  weapons: string[];
  tools: string[];
  languages: string[];
  savingThrows: Ability[];
  skills: Skill[];
}

/**
 * Expertise tracking
 */
export interface DerivedExpertise {
  skills: Skill[];
  tools: string[];
}

/**
 * Provenance log entry
 */
export interface ProvenanceEntry {
  sourceId: string;
  effectId: string;
  applied: boolean;
  reason?: string; // Why it was not applied, if applicable
  value?: unknown; // Value that was applied
}

/**
 * Pending choice information
 */
export interface DerivedChoice {
  id: string;
  prompt: string;
  type: 'select' | 'multiselect' | 'number' | 'text';
  options: Array<{
    value: string;
    label: string;
    description?: string;
  }>;
  min?: number;
  max?: number;
}

/**
 * Equipment restriction information
 */
export interface DerivedEquipmentRestrictions {
  cannotWear: string[]; // Item tags that cannot be worn
  cannotWield: string[]; // Item tags that cannot be wielded
  requiresAttunement: string[]; // Item tags that require attunement
}

/**
 * Attunement tracking
 */
export interface DerivedAttunement {
  attunedItems: string[]; // Item slugs currently attuned
  maxAttunedItems: number; // Maximum number of attuned items (usually 3)
}

/**
 * Complete derived state for a character
 */
export interface DerivedState {
  // Abilities
  abilities: Record<Ability, DerivedAbility>;

  // Proficiency Bonus
  proficiencyBonus: number;

  // Proficiencies
  proficiencies: DerivedProficiencies;

  // Expertise
  expertise: DerivedExpertise;

  // Saving Throws
  saves: Record<Ability, DerivedSave>;

  // Skills
  skills: Record<Skill, DerivedSkill>;

  // Combat Stats
  ac: DerivedAC;
  initiative: DerivedInitiative;
  hitPoints: number;

  // Movement
  speed: Record<string, number>; // movement type -> speed

  // Senses
  senses: DerivedSense[];

  // Spellcasting (optional)
  spellcasting?: DerivedSpellcasting;

  // Resources
  resources: Record<string, DerivedResource>;

  // Features
  features: DerivedFeature[];

  // Choices (pending player decisions)
  choices: DerivedChoice[];

  // Equipment Restrictions
  equipmentRestrictions: DerivedEquipmentRestrictions;

  // Attunement
  attunement: DerivedAttunement;

  // Tags
  tags: string[];

  // Provenance Log
  appliedEffects: ProvenanceEntry[];
}

/** @deprecated Use DerivedState instead. */
export type DerivedStats = Partial<DerivedState> & { hitPoints: number };

/**
 * Skill to ability mapping
 */
export const SKILL_TO_ABILITY: Record<Skill, Ability> = {
  'Acrobatics': 'DEX',
  'Animal Handling': 'WIS',
  'Arcana': 'INT',
  'Athletics': 'STR',
  'Deception': 'CHA',
  'History': 'INT',
  'Insight': 'WIS',
  'Intimidation': 'CHA',
  'Investigation': 'INT',
  'Medicine': 'WIS',
  'Nature': 'INT',
  'Perception': 'WIS',
  'Performance': 'CHA',
  'Persuasion': 'CHA',
  'Religion': 'INT',
  'Sleight of Hand': 'DEX',
  'Stealth': 'DEX',
  'Survival': 'WIS',
};
