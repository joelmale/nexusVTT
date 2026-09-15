import gameConstantsData from '../data/gameConstants.json';
import type { Level1Feature } from './widgets';
import type { ResourceTracker, LevelUpRecord } from '../data/classProgression';
import type { InitiativeEntry, PlayerEntry } from './encounterCombat';

export const ABILITY_SCORES = gameConstantsData.ABILITY_SCORES as readonly ('STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA')[];
export type Ability = typeof ABILITY_SCORES[number];

export interface Alignment {
  name: string;
  description: string;
}

export interface Background {
  slug: string; // Unique identifier
  name: string;
  edition: Edition; // '2014' | '2024'
  description: string;
  details?: string; // Additional detailed description
  detailedDescription?: string; // Even more detailed
  skill_proficiencies: string[];
  languages?: string[];
  equipment: string[];
  equipmentOptions?: EquipmentOption[];
  
  // 2014 Legacy Fields
  feature?: string;
  feature_description?: string;
  
  // 2024 Fields
  abilityScores?: {
    choose: number;
    from: AbilityName[];
    fixed?: Partial<Record<AbilityName, number>>;
  };
  originFeat?: string;
  tool_proficiencies?: string[]; // 2024 specific

  personality_traits: string[];
  ideals: string[];
  bonds: string[];
  flaws: string[];
  roleplaying_suggestions?: string;
}

export interface EquipmentOption {
  label: string;
  items?: string[];
  gold?: number;
}


export interface EquipmentPackage {
  name: string;
  level?: number;
  startingGold?: number; // in gp
  items: Array<{
    name: string;
    quantity: number;
    slug?: string;
    equipped?: boolean;
  }>;
  recommendedItems?: string[]; // Text descriptions for DM to add
  recommendedFor?: string[]; // Array of class slugs this pack is recommended for
  description?: string; // Optional description of the pack
}

export interface FightingStyle {
  slug: string;
  name: string;
  description: string;
  prerequisite: string;
}

export type SpellSlotsByClass = Record<string, number[][]>;
export type CantripsKnownByClass = Record<string, number[]>;

// --- D&D 5e Character Interface (Must be adhered to) ---
export interface AbilityScore { score: number; modifier: number; }
export interface Skill {
  value: number;
  proficient: boolean;
  expertise?: boolean; // True if skill has expertise (double proficiency bonus)
}

export type Edition = '2014' | '2024';

export interface Character {
  id: string;
  name: string;
  species: string;
  /** @deprecated Legacy field retained for migrations. */
  race?: string;
  selectedSpeciesVariant?: string; // For human variants
  class: string;
  classSlug?: string;
  level: number;
  alignment: string;
  background: string;
  edition: Edition; // D&D edition (2014 or 2024 rules)

  // 2024 Level 1 Feature Choices (class-specific)
  divineOrder?: 'protector' | 'thaumaturge'; // 2024 Cleric Level 1 choice
  primalOrder?: 'magician' | 'warden'; // 2024 Druid Level 1 choice
  pactBoon?: 'blade' | 'chain' | 'tome'; // 2024 Warlock Level 1 choice (moved from Level 3)
  expertiseSkills?: string[]; // Rogue, Ranger, Bard: Skills/tools with double proficiency
  weaponMastery?: string[]; // Rogue, Fighter, Barbarian, Paladin: Mastered weapon slugs
  fightingStyle?: string; // Fighter, Paladin, Ranger: Fighting Style slug
  eldritchInvocations?: string[]; // Warlock: Eldritch Invocation slugs
  secondWindUses?: number; // Fighter: Second Wind uses remaining

  // Background data (2024)
  backgroundFeat?: string; // Origin Feat from background (Legacy/Internal use)
  originFeat?: string; // 2024 Origin Feat (can be from Background or Human)

  inspiration: boolean;
  heroicInspiration?: boolean; // 2024 Mechanics (resets on Long Rest)
  proficiencyBonus: number;
  armorClass: number;
  hitPoints: number;
  maxHitPoints: number;
  hitDice: {
    current: number;
    max: number;
    dieType: number; // d6, d8, d10, d12, etc.
  };
  speed: number;
  initiative: number;
  abilities: {
    STR: AbilityScore; DEX: AbilityScore; CON: AbilityScore;
    INT: AbilityScore; WIS: AbilityScore; CHA: AbilityScore;
  };
  skills: {
    Acrobatics: Skill; AnimalHandling: Skill; Arcana: Skill; Athletics: Skill; Deception: Skill; History: Skill; Insight: Skill; Intimidation: Skill; Investigation: Skill; Medicine: Skill; Nature: Skill; Perception: Skill; Performance: Skill; Persuasion: Skill; Religion: Skill; SleightOfHand: Skill; Stealth: Skill; Survival: Skill;
  };
   languages?: string[]; // Known languages
   proficiencies?: {
     armor?: string[];
     weapons?: string[];
     tools?: string[];
   };
    featuresAndTraits: {
     personality: string;
     ideals: string;
     bonds: string;
     flaws: string;
      classFeatures: string[];
      speciesTraits: string[];
      backgroundFeatures: Array<{name: string, description: string}>; // Background features and descriptions
      musicalInstrumentProficiencies: string[]; // Musical instruments proficient in (for bards)
   };

  // Sprint 2: Spellcasting data (enhanced for differentiated types)
  spellcasting?: {
    ability: 'INT' | 'WIS' | 'CHA';
    spellSaveDC: number;
    spellAttackBonus: number;

    // Cantrips (always known, chosen at character creation)
    cantripsKnown: string[];

    // Spell knowledge based on casting type
    spellsKnown?: string[];        // Known casters: fixed list (Bard, Sorcerer, etc.)
    spellbook?: string[];          // Wizards: permanent spellbook
    preparedSpells?: string[];     // Prepared casters: daily selection (Cleric, Druid, etc.)

    // Spell slots and usage
    spellSlots: number[];          // Maximum slots by level [cantrips, 1st, 2nd, ...]
    usedSpellSlots: number[];      // Currently used slots by level

    // Feat-granted spells (special casting rules)
    featGrantedSpells?: Array<{
      spellSlug: string;
      spellcastingAbility: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
      usesPerDay?: number;
      rechargeType: 'at-will' | 'long-rest' | 'short-rest';
      featSlug: string;
    }>;

    // Metadata and progression
    spellcastingType: 'known' | 'prepared' | 'wizard';
    cantripChoicesByLevel: Record<number, string>;
    spellChoicesByLevel?: Record<number, string>; // For tracking spell learning
  };

  // Sprint 3: Character advancement
  subclass?: string | null; // Subclass slug (e.g., "berserker")
  experiencePoints?: number; // Current XP
  feats?: string[]; // Feat slugs (deprecated - use selectedFeats)
  selectedFightingStyle?: string | null; // Fighting Style name (Fighter/Paladin/Ranger)

  // Sprint 5: Features, Subclasses, and Feats
  srdFeatures?: {
    classFeatures: Array<{ name: string; slug: string; level: number; source: 'class' }>;
    subclassFeatures: Array<{ name: string; slug: string; level: number; source: 'subclass' }>;

  };
  selectedFeats?: string[]; // Feat slugs selected during character creation
  featChoices?: Record<string, FeatChoiceMap>; // Additional choices for feats (e.g., Elemental Adept damage type)

  // Sprint 4: Equipment and inventory
  inventory?: EquippedItem[]; // All carried items
  currency?: {
    cp: number;
    sp: number;
    ep?: number; // Electrum pieces (optional, less common)
    gp: number;
    pp: number;
  };
  equippedArmor?: string; // Equipment slug of equipped armor
  equippedWeapons?: string[]; // Equipment slugs of equipped weapons (primary, offhand, etc.)
  trinket?: TrinketData; // Optional trinket rolled during character creation

  // Combat state
  temporaryHitPoints?: number;
  actionSurgeUsed?: number; // Number of Action Surge uses this rest period
  deathSaves?: {
    successes: number;
    failures: number;
  };
  conditions?: string[];

  // Level progression and resource tracking
  resources?: ResourceTracker[]; // Trackable class resources (Second Wind, Action Surge, etc.)
  levelHistory?: LevelUpRecord[]; // Record of all level-ups and choices made

  // Feat effects and bonuses
  featEffects?: {
    // Resource-based feat effects
    luckPoints?: {
      current: number;
      max: number;
    };

    // Initiative and awareness bonuses
    initiativeBonus?: number; // From Alert feat
    cantBeSurprised?: boolean; // From Alert feat
    noAdvantageFromUnseen?: boolean; // From Alert feat

    // Combat bonuses
    greatWeaponMaster?: boolean; // Enables GWM mechanics
    polearmMaster?: boolean; // Enables polearm opportunity attacks
    crossbowExpert?: boolean; // Enables crossbow expert mechanics
    gunner?: boolean; // Enables gunner mechanics
    crusher?: boolean; // Force damage on crits
    piercer?: boolean; // Piercing damage on crits
    slasher?: boolean; // Slashing damage on crits

    // Advanced combat state
    gwmBonusAttackAvailable?: boolean; // GWM bonus attack available this turn

    // Damage type resistances ignored
    ignoredResistances?: string[]; // From Elemental Adept

    // Dragon breath weapons
    dragonBreathWeapon?: {
      damageType: string;
      damageDice: string;
      saveType: string;
      range: string;
    };

    // Spell-related bonuses
    spellSniper?: boolean; // Double range, ignore half cover
    warCaster?: boolean; // Concentration advantage, opportunity casting

    // Skill and utility bonuses
    mimicryAdvantage?: boolean; // From Actor feat
    standUpFree?: boolean; // From Athlete feat
    climbSpeedBonus?: number; // From Athlete feat
    swimSpeedBonus?: number; // From Athlete feat
    jumpDistanceBonus?: number; // From Athlete feat

    // Special abilities
    inspiringLeader?: boolean; // Can rally allies for temp HP
    linguist?: boolean; // Can create ciphers and forgeries
    bountifulLuck?: boolean; // Can let allies reroll 1s (Halfling feat)
    secondChance?: boolean; // Can force creature to reroll attack

    // Movement & utility
    mobile?: boolean; // +10 speed, difficult terrain benefits
    dualWielder?: boolean; // AC bonus when dual wielding
  };

  // Metadata
  createdAt?: string;
  updatedAt?: string;
}

// --- Intermediate Wizard Data Structure ---
export type AbilityName = keyof Character['abilities'];
export type SkillName = keyof Character['skills'];

// Equipment and Skill interfaces for character creation
export interface EquipmentItem {
  name: string;
  type: 'weapon' | 'armor' | 'gear' | 'tool';
  quantity: number;
  weight?: number;
}

export interface EquipmentChoice {
  choiceId: string;
  description: string;
  options: EquipmentItem[][];
  selected: number | null; // Index of selected option
}

// Sprint 2: Spell system interfaces
// Spellcasting type classification
export type SpellcastingType = 'known' | 'prepared' | 'wizard';

export interface SpellSelectionData {
  // All spellcasters - cantrips chosen at character creation
  selectedCantrips: string[]; // Spell slugs

  // Known Casters (Bard, Sorcerer, Warlock, Ranger)
  knownSpells?: string[]; // Fixed spells known at level 1

  // Prepared Casters (Cleric, Druid, Paladin, Artificer)
  preparedSpells?: string[]; // Initially prepared spells from full class list

  // Wizard Special Case
  spellbook?: string[]; // 6 spells permanently in spellbook
  dailyPrepared?: string[]; // Spells prepared for the day from spellbook

  // Legacy support (deprecated - use type-specific fields above)
  selectedSpells?: string[]; // For backward compatibility
}

// Sprint 3: Feat system (interface moved to Sprint 5 section below)

// Sprint 4: Equipment system
export interface Equipment {
  index: string; // SRD index (e.g., 'club', 'dagger')
  slug: string;
  name: string;
  year: number; // 2014 or 2024
   equipment_category: string; // 'Weapon', 'Armor', 'Adventuring Gear', 'Tools', etc.
   equipable?: boolean; // Can this item be equipped? (weapons, armor, clothing)
   cost: {
     quantity: number;
     unit: 'cp' | 'sp' | 'gp' | 'pp';
   };
   weight: number;
   description?: string;

  // Weapon-specific fields
  weapon_category?: 'Simple' | 'Martial';
  weapon_range?: 'Melee' | 'Ranged';
  damage?: {
    damage_dice: string;
    damage_type: string;
  };
  range?: {
    normal: number;
    long?: number;
  };
  properties?: Array<{
    index: string;
    name: string;
    url?: string;
  }>;
  two_handed_damage?: {
    damage_dice: string;
    damage_type: string;
  };
  mastery?: {
    index: string; // e.g., 'graze', 'cleave', 'topple'
    name: string;  // e.g., 'Graze', 'Cleave', 'Topple'
    url?: string;
  };

  // Armor-specific fields
  armor_category?: 'Light' | 'Medium' | 'Heavy' | 'Shield';
  armor_class?: {
    base: number;
    dex_bonus: boolean;
    max_bonus?: number; // For medium armor
  };
  str_minimum?: number;
  stealth_disadvantage?: boolean;
  don_time?: string; // 2024 only
  doff_time?: string; // 2024 only

  // Tool/Gear-specific fields
  tool_category?: string;
  gear_category?: string;
  contents?: Array<{ item_index: string; item_name: string; quantity: number }>; // For containers
  capacity?: string; // For containers
}

export interface EquippedItem {
  equipmentSlug: string; // Reference to Equipment slug
  quantity: number;
  equipped: boolean; // Is this item currently equipped?
  attuned?: boolean; // Is this magic item attuned? (requires attunement slot)
  notes?: string; // Player notes about the item
  trinket?: TrinketData; // If this is a trinket item
}

// Sprint 5: Class Features, Subclasses, and Feats
export interface Feature {
  slug: string;
  name: string;
  class: string; // 'barbarian', 'fighter', etc.
  subclass?: string; // Optional for subclass-specific features
  level: number; // Level when feature is gained
  desc: string[]; // Array of description paragraphs
  featureSpecific?: {
    subfeatureOptions?: {
      choose: number;
      type: string;
      from: { options: Array<{ option_type?: string; item?: { index: string; name: string; url: string }; ability_score?: { index: string; name: string; url: string } }> };
    };
  };
}

export interface Subclass {
  slug: string;
  name: string;
  class: string; // Parent class slug
  desc: string[];
  subclassFlavor: string; // e.g., "Path of the Berserker"

  // Enhanced subclass data
  description?: string;
  detailedDescription?: string;
  keyFeatures?: string[];
  roleplayingTips?: string[];
  source?: string;
  edition?: Edition; // D&D edition (2014 or 2024 rules)
  icon?: string;
  themeColor?: string;
}

export interface Feat {
  slug: string;
  name: string;
  source: string; // 'PHB', 'XGtE', 'TCoE', 'FToD', 'SRD'
  year: number; // 2014 or 2024
  category: 'origin' | 'fighting_style' | 'general' | 'epic_boon'; // 2024 feat categories
  prerequisite: string | null;
  prerequisites?: { // Enhanced prerequisite structure for 2024
    level?: number;
    stats?: Record<AbilityName, number>;
    features?: string[];
    spellcasting?: boolean;
  };
  abilityScoreIncrease?: {
    choices: number;
    options: AbilityName[];
    amount: number;
  };
  benefits: string[];
  description: string;
}

// Validation types for enhanced wizard feedback
export interface ValidationResult {
  isComplete: boolean;
  missingSelections: string[];
  warnings?: string[];
  nextRequiredAction?: string;
}

export interface StepValidation {
  canProceed: boolean;
  blockingIssues: string[];
  optionalItems?: string[];
  progressPercentage?: number;
}

export interface CharacterCreationData {
  name: string;
  level: number;
  edition: Edition; // D&D edition (2014 or 2024 rules)
  speciesSlug: string;
  selectedSpeciesVariant?: string; // e.g., "standard", "variant"
  selectedLineage?: string; // 2024 lineage choice when applicable

  // Variant Human Choices
  variantAbilityBonuses?: Record<AbilityName, number>; // +1 to two abilities
  variantSkillProficiency?: SkillName; // One skill proficiency
  variantFeat?: string; // One feat choice

  classSlug: string;
  abilities: Record<AbilityName, number>; // Raw scores only during creation
  abilityScoreMethod: 'standard-array' | 'standard-roll' | 'classic-roll' | '5d6-drop-2' | 'point-buy' | 'custom';
  background: string;
  alignment: string;

  // 2024 Universal Wizard Flow Fields
  backgroundSkills?: string[]; // Skills granted by background (Step 1)
  backgroundTools?: string[]; // Tools granted by background (Step 1)
  speciesFeat?: string; // 2024: Feat chosen from species options
  humanVersatileFeat?: string; // 2024: Extra Origin Feat for humans
  backgroundFeat?: string; // Origin Feat from background (Step 1)
  backgroundAbilityChoices?: {
    method: '2/1' | '1/1/1';
    bonuses: Partial<Record<AbilityName, number>>;
  };
  humanOriginFeat?: string; // 2024 Human bonus Origin Feat

  // Sprint 1 additions
  selectedSkills: SkillName[]; // Skills chosen from class options (Step 2)
  selectedMusicalInstruments: string[]; // Musical instruments chosen from class options (Step 2)
  overflowSkills?: string[]; // Skills chosen via "Any Skill" duplicate rule (Step 2)
   equipmentChoices: EquipmentChoice[]; // Equipment selection choices
   equipmentChoice?: 'background' | 'gold' | null; // 2024: Choose background equipment or gold
   equipmentGold?: number; // Gold amount for gold choice
   hpCalculationMethod: 'max' | 'rolled';
  rolledHP?: number; // If rolled, store the result

  // 2024 Level 1 Feature Choices (Step 3 - Variable by Class)
  divineOrder?: 'protector' | 'thaumaturge'; // 2024 Cleric
  primalOrder?: 'magician' | 'warden'; // 2024 Druid
  pactBoon?: 'blade' | 'chain' | 'tome'; // 2024 Warlock
  expertiseSkills?: string[]; // Rogue, Ranger, Bard: 2 skills/tools
  weaponMastery?: string[]; // Rogue, Fighter, Barbarian, Paladin: 2-3 weapons
   fightingStyle?: string; // Fighter, Paladin, Ranger
   eldritchInvocations?: string[]; // Warlock: Eldritch Invocation slugs
   secondWindUses?: number; // 2024 Fighter: Second Wind uses remaining

   // Sprint 2: Spell selection
  spellSelection: SpellSelectionData;

  // Sprint 4: Custom equipment additions
  startingInventory?: EquippedItem[];

  // Sprint 5: Subclass, Fighting Style, and Feats
  subclassSlug?: string | null;
  selectedFightingStyle?: string | null;
  selectedFeats?: string[]; // Array of feat slugs
  featChoices?: Record<string, FeatChoiceMap>; // Additional choices for feats (e.g., Elemental Adept damage type)

  // Language selection
  knownLanguages?: string[]; // Array of selected language names

  // Trinket selection
  selectedTrinket?: TrinketData;

  // Custom text for traits
  personality: string;
  ideals: string;
  bonds: string;
  flaws: string;

  // High-Level Character Creation (Level 2+)
  highLevelSetup?: {
    hpRolls?: number[]; // HP rolls for levels 2+ (if not using average)
    totalHP: number; // Calculated total HP
    useAverage: boolean; // Whether to use average HP or rolls
  };
  cumulativeASI?: Array<{
    level: number; // Level where ASI was gained
    type: 'asi' | 'feat'; // Whether ASI or Feat was chosen
    asiAllocations?: Record<AbilityName, number>; // Ability score increases
    featSlug?: string; // Feat slug if feat was chosen
  }>;
}

export interface SpeciesVariant {
  slug: string;
  name: string;
  description: string;
  ability_bonuses: Partial<Record<AbilityName, number>>;
  species_traits: string[];
  features: string[];
}

export interface Species {
  slug: string;
  name: string;
  edition: Edition; // '2014' | '2024'
  source: string;
  /** List of all sources this species draws from (for deduped records) */
  sources?: string[];
  speed: number;
  ability_bonuses?: Partial<Record<AbilityName, number>>; // Optional in 2024 (moved to Background)
   species_traits: string[];
   description: string;
   detailedDescription?: string;
   typicalRoles: string[];
  variants?: SpeciesVariant[];
  defaultVariant?: string;
  /** Flag species as 2024 PHB core entry */
  core?: boolean;
  /** Flag species as non-core expanded option */
  expanded?: boolean;
  /** Tag species for category filtering (e.g., monstrous, planar, exotic) */
  tags?: string[];
  /** Mark legacy-only species (2014 or deprecated) */
  legacy?: boolean;
  /** Alternate historical slugs for migration */
  legacySlugs?: string[];
  /** Additional aliases used in saved data */
  slugAliases?: string[];

  // 2024 Fields
  creatureType?: 'Humanoid' | 'Construct' | 'Undead' | string;
  speciesFeat?: string | null; // Fixed feat for species like Half-Elf Prodigy
  speciesFeatOptions?: string[]; // Choice of feats for species like Elf, Dwarf, etc.
  traits?: string[]; // Core species traits for 2024
  lineages?: Record<string, SpeciesLineage>; // Lineage choices (Elf, Gnome)
  fiendishLegacies?: Record<string, FiendishLegacy>; // Tiefling options
  giantAncestry?: Record<string, string>; // Goliath options
  ancestries?: Record<string, string[] | string>; // Dragonborn options
  celestialRevelationOptions?: string[]; // Aasimar options

  // Mechanical bonuses (data-driven instead of hardcoded)
  baseSpeed?: number; // Base walking speed in feet (default 30)
  mechanicalBonuses?: {
    hpPerLevel?: number; // HP bonus per character level (e.g., Dwarf Toughness)
  };
}

export interface SpeciesLineage {
  traits?: string[];
  spells?: string[];
  baseSpeed?: number; // Override base speed (e.g., Wood Elf = 35 ft)
}

export interface FiendishLegacy {
  resistance: string;
  spells: string[];
}

export interface SpeciesCategory {
  name: string;
  icon: string;
  description: string;
  species: Species[];
}

// Backwards compatibility aliases (deprecated - use Species instead)
/** @deprecated Use Species instead */
export type Race = Species;
/** @deprecated Use SpeciesVariant instead */
export type RaceVariant = SpeciesVariant;
/** @deprecated Use SpeciesCategory instead */
export type RaceCategory = SpeciesCategory;

export interface StartingEquipmentPackage {
  level: number;
  description: string;
  startingGold: number; // in gp
  items: Array<{ slug: string; quantity: number; equipped?: boolean }>;
  recommendedItems: string[]; // Text descriptions for DM to add
}

export interface Class {
  slug: string;
  name: string;
  source: string;
  edition: Edition; // D&D edition (2014 or 2024 rules)
  hit_die: number;
  primary_stat: string;
  save_throws: string[];
  skill_proficiencies: string[]; // Available skill choices
  num_skill_choices?: number; // How many skills to choose (filled by helper if missing)
  musical_instrument_proficiencies: string[]; // Available musical instrument choices (for bards)
  num_instrument_choices?: number; // How many instruments to choose (filled by helper if missing)
  class_features: string[];
  description: string;
  keyRole: string;
  /** Core proficiencies pulled from SRD data */
  proficiencies?: {
    armor: string[];
    weapons: string[];
    tools: string[];
  };
  equipment_choices?: EquipmentChoice[]; // Starting equipment options (filled by helper if missing)

  // Sprint 2: Spellcasting configuration
  spellcasting?: {
    level: number; // Level at which spellcasting is gained (usually 1, but 2 for some classes)
    ability: 'INT' | 'WIS' | 'CHA'; // Spellcasting ability modifier
    type: SpellcastingType; // How spells are learned/prepared
    cantripsKnown: number; // Number of cantrips at level 1
    spellsKnownOrPrepared: number; // Number of spells known (sorcerer/bard) or can prepare (cleric/druid)
    spellSlots: number[]; // Spell slots by level [0, 2, 0, 0...] means 2 1st-level slots

    // Legacy support
    mode?: 'known' | 'prepared' | 'book'; // Deprecated - use type instead
  };

  // Sprint 3: Subclass support
  isSubclass?: boolean; // True if this is a subclass (archetype)
  parentClass?: string; // Parent class slug (e.g., 'wizard' for 'wizard-evocation')
  subclassLevel?: number; // Level at which this subclass is chosen (usually 3)
  subclassFeatures?: Record<number, string[]>; // Features gained at specific levels

  // Enhanced class data for rich selection experience
  category: 'Martial' | 'Arcane' | 'Divine' | 'Primal';
  abilityPriorities?: AbilityName[]; // Optimal ability score priority order for standard array distribution
  detailedDescription: string;
  roleplayingTips: string[];
  keyFeatures: string[];
  icon: string;
  themeColor: string;

  // 2024 Universal Widget System
  level_1_features?: Level1Feature[]; // Widget-driven Level 1 features
}

export interface ClassCategory {
  name: string;
  icon: string;
  description: string;
  classes: Class[];
}

// Trinket data structure
export interface TrinketData {
  roll: number;
  description: string;
  short_name: string;
  source: string;
  type: string;
  tags: string[];
  roleplay_prompt: string;
  dm_hook: string;
}

export type ClassWithDefaults = Omit<Class, 'num_skill_choices' | 'equipment_choices'> & {
  num_skill_choices: number;
  equipment_choices: EquipmentChoice[];
};

export interface AlignmentData {
  index: string;
  name: string;
  abbreviation: string;
  short_desc: string;  // SRD creature examples
  long_desc: string;   // Our detailed character descriptions
  category: string;
  examples: string[];
}

// Spell Learning Rules
export interface SpellLearningRules {
  type: 'prepared' | 'known' | 'spellbook' | 'none';
  spellsKnown?: number[];          // Spells known by level (known casters)
  spellsPrepared?: number[];        // Spells prepared by level (prepared casters)
  spellbookCapacity?: number[];     // Spellbook capacity by level (wizards)
  domainSpells?: string[];          // Cleric domain spells
  circleSpells?: string[];          // Druid circle spells
  magicalSecrets?: number[];        // Bard magical secrets by level
  invocationsKnown?: number[];      // Warlock invocations by level
}

export type FeatChoiceValue = string | number | boolean | string[];
export type FeatChoiceMap = Record<string, FeatChoiceValue>;

// ==================== Monster System ====================

export type MonsterSize = 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';

export type MonsterType =
  | 'aberration'
  | 'beast'
  | 'celestial'
  | 'construct'
  | 'dragon'
  | 'elemental'
  | 'fey'
  | 'fiend'
  | 'giant'
  | 'humanoid'
  | 'monstrosity'
  | 'ooze'
  | 'plant'
  | 'undead';

export interface MonsterSpeed {
  walk?: string;
  fly?: string;
  swim?: string;
  burrow?: string;
  climb?: string;
  hover?: boolean;
}

export interface MonsterArmorClass {
  type: 'dex' | 'natural' | 'armor' | 'condition';
  value: number;
  armor?: Array<{ name: string; url?: string }>;
  spell?: { name: string; url?: string };
  desc?: string;
}

export interface MonsterProficiency {
  value: number;
  proficiency: {
    index: string;
    name: string;
    url: string;
  };
}

export interface MonsterDamageType {
  index: string;
  name: string;
  url: string;
}

export interface MonsterConditionImmunity {
  index: string;
  name: string;
  url: string;
}

export interface MonsterAbilityDC {
  dc_type: {
    index: string;
    name: string;
    url: string;
  };
  dc_value: number;
  success_type: string;
}

export interface MonsterDamage {
  damage_type: {
    index: string;
    name: string;
    url?: string;
  };
  damage_dice: string;
}

export interface MonsterUsage {
  type: string;
  times?: number;
  rest_types?: string[];
  dice?: string;
  min_value?: number;
}

export interface MonsterAction {
  name: string;
  desc: string;
  multiattack_type?: string;
  attack_bonus?: number;
  damage?: MonsterDamage[];
  dc?: MonsterAbilityDC;
  usage?: MonsterUsage;
  attacks?: Array<{
    name: string;
    dc?: MonsterAbilityDC;
    damage?: MonsterDamage[];
  }>;
  options?: {
    choose: number;
    from: {
      option_set_type: string;
      options: Array<{
        option_type: string;
        name: string;
        desc: string;
        attack_bonus?: number;
        damage?: MonsterDamage[];
        dc?: MonsterAbilityDC;
      }>;
    };
  };
}

export interface MonsterSpecialAbility {
  name: string;
  desc: string;
  attack_bonus?: number;
  damage?: MonsterDamage[];
  dc?: MonsterAbilityDC;
  usage?: MonsterUsage;
  spellcasting?: {
    ability: {
      index: string;
      name: string;
      url: string;
    };
    dc?: number;
    modifier?: number;
    components_required?: string[];
    school?: string;
    slots?: Record<string, number>;
    spells?: Array<{
      name: string;
      level: number;
      url: string;
      usage?: MonsterUsage;
      notes?: string;
    }>;
  };
}

export interface MonsterLegendaryAction {
  name: string;
  desc: string;
  attack_bonus?: number;
  damage?: MonsterDamage[];
  dc?: MonsterAbilityDC;
}

export interface MonsterReaction {
  name: string;
  desc: string;
  dc?: MonsterAbilityDC;
}

export interface Monster {
  index: string;
  name: string;
  size: MonsterSize;
  type: MonsterType;
  subtype?: string;
  alignment: string;
  armor_class: MonsterArmorClass[];
  hit_points: number;
  hit_dice: string;
  hit_points_roll: string;
  speed: MonsterSpeed;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  proficiencies: MonsterProficiency[];
  damage_vulnerabilities: string[];
  damage_resistances: string[];
  damage_immunities: string[];
  condition_immunities: MonsterConditionImmunity[];
  senses: Record<string, string | number>;
  languages: string;
  challenge_rating: number;
  proficiency_bonus: number;
  xp: number;
  special_abilities?: MonsterSpecialAbility[];
  actions?: MonsterAction[];
  legendary_actions?: MonsterLegendaryAction[];
  reactions?: MonsterReaction[];
  url?: string;
  image?: string;
  desc?: string[];
}

export interface UserMonster extends Monster {
  id: string;
  isCustom: true;
  createdAt: number;
  updatedAt: number;
}

export interface Encounter {
  id: string;
  name: string;
  monsterIds: string[];
  createdAt: number;
  updatedAt: number;
  // NEW: Combat state (can be saved mid-session)
  combatState?: {
    round: number;
    currentTurn: number;
    initiativeOrder: InitiativeEntry[];
    players: PlayerEntry[];
    savedAt?: number; // Timestamp for mid-session saves
  };
}

// ==================== Level Up System ====================

/**
 * Choices made during the level-up wizard flow.
 * Tracks all player decisions during character leveling.
 */
export interface LevelUpChoices {
  /** Hit points rolled (if not using average) */
  hpRoll?: number;

  /** Hit points gained (final amount added to character) */
  hpGained?: number;

  /** Fighting style chosen (Fighter, Paladin, Ranger) */
  fightingStyleChosen?: string;

  /** Ability score increases selected */
  asiChoices?: Array<{
    ability: AbilityName;
    increase: number;
  }>;

  /** Feat chosen (if taking feat instead of ASI) */
  featChosen?: string;

  /** Subclass chosen */
  subclassChosen?: string;

  /** Spells learned at this level */
  spellsLearned?: string[];

  /** Cantrips learned at this level */
  cantripsLearned?: string[];

  /** Expertise skills chosen (Bard, Rogue) */
  expertiseChosen?: string[];

  /** Weapon masteries chosen */
  weaponMasteriesChosen?: string[];

  /** Eldritch invocations chosen (Warlock) */
  eldritchInvocationsChosen?: string[];
}

// ==================== NPC System ====================

export interface NPC {
  id: string;
  name: string;
  species: string; // Race
  occupation: string;
  personalityTraits: string[];
  abilityScores: Record<AbilityName, number>; // STR, DEX, CON, INT, WIS, CHA
  alignment: string;
  relationshipStatus: string;
  sexualOrientation: string;
  plotHook: string;
  notes: string; // Rich text as HTML
  createdAt: number;
  updatedAt: number;
}
