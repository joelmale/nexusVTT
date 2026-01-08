/**
 * Type definitions for 5e Character Forge export format
 * These types match the Forge's character schema for import compatibility
 */

export type ForgeEdition = '2014' | '2024';
export type ForgeAbility = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

export interface ForgeAbilityScore {
  score: number;
  modifier: number;
}

export interface ForgeSkill {
  value: number;
  proficient: boolean;
  expertise?: boolean;
}

export interface ForgeSpell {
  slug?: string;
  name: string;
  level: number;
  school?: string;
  castingTime?: string;
  range?: string;
  duration?: string;
  concentration?: boolean;
  ritual?: boolean;
  description?: string;
  prepared?: boolean;
  known?: boolean;
}

export interface ForgeEquippedItem {
  id?: string;
  name: string;
  quantity: number;
  weight?: number;
  equipped?: boolean;
  attuned?: boolean;
  description?: string;
  type?: string;
}

export interface ForgeCharacter {
  // Basic Info
  id: string;
  name: string;
  race?: string;
  species: string;
  selectedSpeciesVariant?: string;
  class: string;
  level: number;
  alignment: string;
  background: string;
  edition: ForgeEdition;

  // Stats
  proficiencyBonus: number;
  armorClass: number;
  hitPoints: number;
  maxHitPoints: number;
  temporaryHitPoints?: number;
  hitDice: {
    current: number;
    max: number;
    dieType: number;
  };
  speed: number;
  initiative: number;

  // Abilities
  abilities: {
    STR: ForgeAbilityScore;
    DEX: ForgeAbilityScore;
    CON: ForgeAbilityScore;
    INT: ForgeAbilityScore;
    WIS: ForgeAbilityScore;
    CHA: ForgeAbilityScore;
  };

  // Skills
  skills: {
    Acrobatics: ForgeSkill;
    AnimalHandling: ForgeSkill;
    Arcana: ForgeSkill;
    Athletics: ForgeSkill;
    Deception: ForgeSkill;
    History: ForgeSkill;
    Insight: ForgeSkill;
    Intimidation: ForgeSkill;
    Investigation: ForgeSkill;
    Medicine: ForgeSkill;
    Nature: ForgeSkill;
    Perception: ForgeSkill;
    Performance: ForgeSkill;
    Persuasion: ForgeSkill;
    Religion: ForgeSkill;
    SleightOfHand: ForgeSkill;
    Stealth: ForgeSkill;
    Survival: ForgeSkill;
  };

  // Proficiencies
  languages?: string[];
  proficiencies?: {
    armor?: string[];
    weapons?: string[];
    tools?: string[];
  };

  // Features and Traits
  featuresAndTraits?: {
    personality?: string;
    ideals?: string;
    bonds?: string;
    flaws?: string;
    classFeatures?: string[];
    speciesTraits?: string[];
    backgroundFeatures?: Array<{ name: string; description: string }>;
  };
  srdFeatures?: {
    classFeatures?: string[];
    subclassFeatures?: string[];
  };

  // Spellcasting
  spellcasting?: {
    ability: ForgeAbility;
    spellSaveDC: number;
    spellAttackBonus: number;
    cantripsKnown: string[];
    spellsKnown?: string[];
    spellbook?: string[];
    preparedSpells?: string[];
    spellSlots: number[];
    usedSpellSlots: number[];
    spellcastingType: 'known' | 'prepared' | 'wizard';
  };

  // Inventory
  inventory?: ForgeEquippedItem[];
  currency?: {
    cp: number;
    sp: number;
    ep?: number;
    gp: number;
    pp: number;
  };
  equippedWeapons?: Array<{
    weaponSlug?: string;
    equipped?: boolean;
    quantity?: number;
  }>;

  // Character Advancement
  subclass?: string | null;
  experiencePoints?: number;
  selectedFeats?: string[];
  feats?: string[];
  inspiration?: boolean;
  resources?: unknown[];
  deathSaves?: {
    successes: number;
    failures: number;
  };
  conditions?: string[];
  createdAt?: string;
  updatedAt?: string;

  // Export metadata (added in Phase 2)
  _export?: {
    version: string;
    timestamp: number;
    sourceApp: string;
    exportFormat: string;
    compatibilityNotes?: string[];
  };
}

/**
 * Import metadata attached to imported characters
 */
export interface ImportMetadata {
  sourceType: 'forge' | 'roll20' | 'ddb' | 'generic';
  sourceVersion: string;
  importedAt: number;
  sourceUrl?: string; // For Phase 3 URL imports
  originalId?: string; // Original character ID from source
}

/**
 * Result of a single character import
 */
export interface ImportResult {
  success: boolean;
  character?: unknown; // Will be NexusVTT Character type when wired up
  metadata?: ImportMetadata;
  error?: string;
  warnings?: string[];
  fileName?: string;
}

/**
 * Batch import results
 */
export interface BatchImportResult {
  total: number;
  successful: number;
  failed: number;
  results: ImportResult[];
}
