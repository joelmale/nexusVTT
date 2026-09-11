/**
 * Widget System Types for 2024 Universal Character Creation
 *
 * Widgets are reusable UI components for Level 1 class feature selection.
 * Each widget type handles a different selection pattern.
 */

import { CharacterCreationData } from './dnd';

// ============================================================================
// Widget Type Definitions
// ============================================================================

export type WidgetType = 'selection_pool' | 'branch_choice' | 'list_selection' | 'automatic';

export type WidgetSource =
  | 'skills'                // Skill proficiencies only
  | 'weapons'               // Weapon proficiencies only
  | 'tools'                 // Tool proficiencies only
  | 'skills_and_tools'      // Skills + specific tools (e.g., Thieves' Tools)
  | 'fighting_styles'       // Fighting style feats
  | 'feats';                // General feats

export type WidgetEffect =
  | 'double_proficiency'    // Expertise: proficiency bonus × 2
  | 'mastery'               // Weapon Mastery: unlock mastery property
  | 'grant_proficiency'     // Grant new proficiency (armor, weapon, etc.)
  | 'grant_feature'         // Grant automatic feature
  | 'grant_language';       // Grant language proficiency

// ============================================================================
// Widget Configuration Interfaces
// ============================================================================

/**
 * Selection Pool Widget Config
 * Used for: Expertise, Weapon Mastery, skill choices
 */
export interface SelectionPoolConfig {
  source: WidgetSource;
  count: number;                          // Number of selections required
  filter: 'current_proficiencies' | 'proficient_weapons' | 'proficient_melee_weapons' | 'all';
  effect: WidgetEffect;
  include_tools?: string[];               // Specific tools to include (e.g., ['thieves_tools'])
  show_mastery_property?: boolean;        // Show weapon mastery properties
}

/**
 * Branch Choice Widget Config
 * Used for: Divine Order, Primal Order, Pact Boon
 */
export interface BranchChoiceConfig {
  options: BranchOption[];
}

export interface BranchOption {
  id: string;                             // e.g., 'protector', 'thaumaturge'
  label: string;                          // Display name
  description: string;                    // Full description
  icon?: string;                          // Optional icon
  grants?: GrantConfig[];                 // What this choice grants
}

/**
 * List Selection Widget Config
 * Used for: Fighting Styles, Eldritch Invocations, simple feat selection
 */
export interface ListSelectionConfig {
  type: 'fighting_style' | 'invocation' | 'feat';
  count: number;
  filter?: string;                        // Optional filter tag (e.g., 'level_1_compatible')
}

/**
 * Automatic Widget Config
 * Used for: Sneak Attack, Thieves' Cant (features that don't require user choice)
 */
export interface AutomaticConfig {
  grants?: string[];                      // Automatic grants (e.g., ['language_thieves_cant'])
  bonus_language_choices?: number;        // Additional language choices
  effect?: string;                        // Effect description (e.g., 'sneak_attack_1d6')
  uses?: number;                          // Limited-use abilities (e.g., Rage uses)
  recovery?: 'short_rest' | 'long_rest' | string; // Recovery cadence
}

/**
 * Grant Configuration
 * Defines what a choice grants to the character
 */
export interface GrantConfig {
  type: 'proficiency' | 'skill_bonus' | 'cantrip_bonus' | 'language' | 'feature';
  // New SRD 2024 grant shape
  category?: 'armor' | 'weapons' | 'tools' | string;
  items?: string[];
  skills?: string[];
  bonus?: string;
  value?: number;
  // Legacy/alternate shapes
  proficiency_type?: 'armor' | 'weapon' | 'tool';
  proficiencies?: string[];               // e.g., ['heavy-armor', 'martial-weapons']
  skill_bonuses?: Array<{                 // e.g., Thaumaturge +WIS to Arcana
    skill: string;
    bonus_type?: 'ability_modifier';
    ability?: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
  }>;
  cantrip_bonus?: number;                 // Additional cantrips known
  languages?: string[];                   // Language grants
  features?: string[];                    // Feature slugs
}

// ============================================================================
// Level 1 Feature Definition (from JSON)
// ============================================================================

export interface Level1Feature {
  id: string;                             // e.g., 'expertise', 'weapon_mastery'
  name: string;                           // Display name
  desc: string;                           // Description text
  widget_type: WidgetType;
  widget_config: SelectionPoolConfig | BranchChoiceConfig | ListSelectionConfig | AutomaticConfig;
}

// ============================================================================
// Widget Component Props
// ============================================================================

/**
 * Base props for all widget components
 */
export interface BaseWidgetProps {
  feature: Level1Feature;
  data: CharacterCreationData;
  setData: (data: CharacterCreationData) => void;
}

/**
 * Selection Pool Widget Props
 */
export interface SelectionPoolWidgetProps extends BaseWidgetProps {
  feature: Level1Feature & { widget_config: SelectionPoolConfig };
  currentSelection: string[];
  onSelectionChange: (selection: string[]) => void;
}

/**
 * Branch Choice Widget Props
 */
export interface BranchChoiceWidgetProps extends BaseWidgetProps {
  feature: Level1Feature & { widget_config: BranchChoiceConfig };
  currentChoice: string | undefined;
  onChoiceChange: (choice: string) => void;
}

/**
 * List Selection Widget Props
 */
export interface ListSelectionWidgetProps extends BaseWidgetProps {
  feature: Level1Feature & { widget_config: ListSelectionConfig };
  currentSelection: string[];
  onSelectionChange: (selection: string[]) => void;
}

/**
 * Automatic Widget Props
 */
export interface AutomaticWidgetProps extends BaseWidgetProps {
  feature: Level1Feature & { widget_config: AutomaticConfig };
}

// ============================================================================
// Helper Types for Widget Data
// ============================================================================

/**
 * Skill Option for Selection
 */
export interface SkillOption {
  id: string;                             // e.g., 'stealth', 'thieves_tools'
  name: string;                           // Display name
  type: 'skill' | 'tool';
  source: 'background' | 'class' | 'race';
  ability?: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
}

/**
 * Weapon Option for Weapon Mastery
 */
export interface WeaponOption {
  slug: string;                           // Equipment slug
  name: string;                           // Display name
  damage: string;                         // e.g., '1d6 piercing'
  properties: string[];                   // e.g., ['finesse', 'light']
  mastery: string | undefined;            // Mastery property (e.g., 'nick', 'vex')
  category: 'simple' | 'martial';
  isTwoHanded: boolean;                   // Is weapon two-handed
  weaponRange: string;                    // 'Melee' or 'Ranged'
}

/**
 * Fighting Style Option
 */
export interface FightingStyleOption {
  slug: string;
  name: string;
  description: string;
  prerequisites?: string[];
}
