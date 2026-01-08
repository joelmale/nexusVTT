// D&D 5e Character Sheet Types and Interfaces

export type AbilityKey = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

export interface AbilityScore {
  score: number;
  modifier: number;
}

export type AbilityScores = Record<AbilityKey, AbilityScore>;

export interface SkillEntry {
  value: number;
  proficient: boolean;
  expertise?: boolean;
}

export type SkillMap = Record<string, SkillEntry>;

export interface SpellSlot {
  level: number;
  total: number;
  used: number;
}

export interface Spell {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  description: string;
  components: {
    verbal: boolean;
    somatic: boolean;
    material: boolean;
    materialComponent?: string;
  };
  prepared?: boolean;
  known?: boolean;
}

export interface Feature {
  id: string;
  name: string;
  source: string;
  description: string;
  uses?: {
    total: number;
    used: number;
    resetOn: 'short-rest' | 'long-rest' | 'dawn' | 'week';
  };
}

export interface Equipment {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'tool' | 'consumable' | 'treasure' | 'other';
  quantity: number;
  weight: number;
  description?: string;
  attuned?: boolean;
  equipped?: boolean;
  cost?: { amount: number; currency: string };
  damage?: {
    dice: string;
    type: string;
  };
  properties?: string[];
  armorClass?: number;
  stealthDisadvantage?: boolean;
}

export interface AttackAction {
  id: string;
  name: string;
  type: 'weapon' | 'spell' | 'other';
  attackBonus: number;
  damage: {
    dice: string;
    type: string;
    bonus: number;
  };
  additionalDamage?: {
    dice: string;
    type: string;
    condition?: string;
  };
  range: string;
  description?: string;
}

export interface Spellcasting {
  ability: AbilityKey;
  spellSaveDC: number;
  spellAttackBonus: number;
  cantripsKnown: string[];
  spellsKnown?: string[];
  spellbook?: string[];
  preparedSpells?: string[];
  spellSlots: number[];
  usedSpellSlots: number[];
  spellcastingType: 'known' | 'prepared' | 'wizard';
}

export interface InventoryItem {
  equipmentSlug: string;
  equipped?: boolean;
  quantity: number;
}

export interface EquippedWeapon {
  weaponSlug?: string;
  equipped?: boolean;
  quantity?: number;
}

export interface CharacterClass {
  name: string;
  level: number;
  hitDie: string; // e.g., "d10"
  subclass?: string;
  // Enhanced: Level-scaled properties for randomization
  proficienciesByLevel?: {
    [level: number]: {
      weaponProficiencies: string[];
      armorProficiencies: string[];
      toolProficiencies: string[];
      skillProficiencies: string[];
    };
  };
  featuresByLevel?: {
    [level: number]: Feature[];
  };
  spellsByLevel?: {
    [level: number]: Spell[];
  };
  subclassOptions?: string[];
  spellcasting?: {
    type: 'full' | 'half' | 'third' | 'pact' | 'none';
    ability?: keyof AbilityScores;
  };
}

export interface CharacterBackground {
  name: string;
  skillProficiencies: string[];
  languages: string[];
  equipment: string[];
  feature: string;
  description?: string;
  // Enhanced: Additional background properties for randomization
  toolProficiencies?: string[];
  personalityTraits?: string[];
  ideals?: string[];
  bonds?: string[];
  flaws?: string[];
  equipmentPack?: string;
}

export interface CharacterRace {
  name: string;
  subrace?: string;
  traits: string[];
  abilityScoreIncrease: Partial<Record<keyof AbilityScores, number>>;
  languages: string[];
  proficiencies: string[];
  // Enhanced: Racial features and traits for randomization
  features?: Feature[];
  subraceFeatures?: { [subrace: string]: Feature[] };
  size?: 'small' | 'medium';
  speed?: number;
}

// Equipment and Inventory Types
export interface Weapon {
  id: string;
  name: string;
  type: 'simple' | 'martial';
  category: 'melee' | 'ranged';
  damage: string; // e.g., "1d8", "2d6+2"
  properties: string[]; // e.g., ["versatile", "finesse", "light"]
  weight?: number;
  cost?: string;
  rarity?: 'common' | 'uncommon' | 'rare' | 'very rare' | 'legendary';
}

export interface Armor {
  id: string;
  name: string;
  type: 'light' | 'medium' | 'heavy' | 'shield';
  ac: number;
  strengthRequirement?: number;
  stealthDisadvantage?: boolean;
  weight?: number;
  cost?: string;
  rarity?: 'common' | 'uncommon' | 'rare' | 'very rare' | 'legendary';
}

export interface Tool {
  id: string;
  name: string;
  category: string; // e.g., "artisan", "gaming", "musical"
  weight?: number;
  cost?: string;
  rarity?: 'common' | 'uncommon' | 'rare' | 'very rare' | 'legendary';
}

// Personality Data
export interface PersonalityData {
  traits: string[];
  ideals: string[];
  bonds: string[];
  flaws: string[];
}

export interface Character {
  id: string;
  name: string;
  race?: string;
  species?: string;
  class?: string;
  level: number;
  alignment?: string;
  background?: string;
  edition?: '2014' | '2024' | string;
  inspiration?: boolean;
  proficiencyBonus?: number;
  armorClass?: number;
  hitPoints: number;
  maxHitPoints?: number;
  temporaryHitPoints?: number;
  hitDice?: {
    current: number;
    max: number;
    dieType: number;
  };
  speed?: number;
  initiative?: number;
  abilities: AbilityScores;
  skills: SkillMap;
  languages?: string[];
  featuresAndTraits?: {
    personality?: string;
    ideals?: string;
    bonds?: string;
    flaws?: string;
    classFeatures?: string[];
    racialTraits?: string[];
    backgroundFeatures?: Array<{ name: string; description: string }>;
  };
  selectedFeats?: string[];
  feats?: string[];
  srdFeatures?: {
    classFeatures?: string[];
    subclassFeatures?: string[];
  };
  subclass?: string | null;
  spellcasting?: Spellcasting;
  inventory?: InventoryItem[];
  currency?: {
    cp: number;
    sp: number;
    ep?: number;
    gp: number;
    pp: number;
  };
  equippedWeapons?: EquippedWeapon[];
  resources?: unknown[];
  deathSaves?: {
    successes: number;
    failures: number;
  };
  conditions?: string[];
  experiencePoints?: number;
  createdAt?: string;
  updatedAt?: string;
  playerId?: string;
}

// Character Creation Wizard State
export interface CharacterCreationState {
  playerId?: string;
  step: number;
  totalSteps: number;
  character: Partial<Character>;
  method: 'guided' | 'manual' | 'import';
  isComplete: boolean;
}

// Import/Export Support
export interface CharacterImportSource {
  type: 'forge' | 'roll20' | 'ddb' | 'google-sheets' | 'pdf' | 'json';
  name: string;
  description: string;
  icon: string;
  supported: boolean;
}

export interface CharacterExportFormat {
  type: 'pdf' | 'json' | 'roll20' | 'text';
  name: string;
  description: string;
  icon: string;
}

// Mob Management (for DM)
export interface Mob {
  id: string;
  name: string;
  type:
    | 'beast'
    | 'humanoid'
    | 'monstrosity'
    | 'undead'
    | 'fiend'
    | 'celestial'
    | 'elemental'
    | 'fey'
    | 'dragon'
    | 'giant'
    | 'construct'
    | 'ooze'
    | 'plant'
    | 'aberration';
  size: 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';
  challengeRating: string;
  armorClass: number;
  hitPoints: {
    maximum: number;
    dice: string; // e.g., "8d8+16"
  };
  speed: {
    walk: number;
    fly?: number;
    swim?: number;
    climb?: number;
    burrow?: number;
  };
  abilities: AbilityScores;
  savingThrows?: Partial<Record<keyof AbilityScores, number>>;
  skills?: Record<string, number>;
  damageResistances?: string[];
  damageImmunities?: string[];
  damageVulnerabilities?: string[];
  conditionImmunities?: string[];
  senses: string[];
  languages: string[];
  actions: AttackAction[];
  legendaryActions?: AttackAction[];
  reactions?: AttackAction[];
  traits: Feature[];
  description?: string;
  environment?: string[];
  source: string; // Monster Manual, Volo's, etc.
}

export interface MobGroup {
  id: string;
  name: string;
  mobs: Mob[];
  description?: string;
  environment: string;
  encounterLevel: string; // Easy, Medium, Hard, Deadly
}

// Helper functions
export function calculateAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function calculateProficiencyBonus(level: number): number {
  // Handle edge cases for levels below 1
  const normalizedLevel = Math.max(1, level);
  return Math.ceil(normalizedLevel / 4) + 1;
}

export function calculatePassivePerception(
  abilities: AbilityScores,
  skills: SkillMap,
  proficiencyBonus: number,
): number {
  const perceptionSkill = skills?.Perception;
  const wisdomModifier = abilities.WIS.modifier;

  if (!perceptionSkill) {
    return 10 + wisdomModifier;
  }

  let bonus = wisdomModifier;
  if (perceptionSkill.proficient) {
    bonus += perceptionSkill.expertise ? proficiencyBonus * 2 : proficiencyBonus;
  }

  return 10 + bonus;
}

export function createEmptyCharacter(playerId: string): Character {
  const abilities: AbilityScores = {
    STR: { score: 10, modifier: 0 },
    DEX: { score: 10, modifier: 0 },
    CON: { score: 10, modifier: 0 },
    INT: { score: 10, modifier: 0 },
    WIS: { score: 10, modifier: 0 },
    CHA: { score: 10, modifier: 0 },
  };

  const proficiencyBonus = calculateProficiencyBonus(1);
  const skills: SkillMap = {};

  STANDARD_SKILLS.forEach((skill) => {
    skills[skill.name] = {
      proficient: false,
      value: abilities[skill.ability].modifier,
    };
  });

  return {
    id: crypto.randomUUID(),
    playerId,
    name: '',
    level: 1,
    race: '',
    class: '',
    background: '',
    alignment: '',
    edition: '2014',
    inspiration: false,
    proficiencyBonus,
    armorClass: 10,
    hitPoints: 1,
    maxHitPoints: 1,
    temporaryHitPoints: 0,
    hitDice: {
      current: 1,
      max: 1,
      dieType: 8,
    },
    speed: 30,
    initiative: 0,
    abilities,
    skills,
    languages: ['Common'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// D&D 5e Standard Skills
export const STANDARD_SKILLS: Array<{ name: string; ability: AbilityKey }> = [
  { name: 'Acrobatics', ability: 'DEX' },
  { name: 'Animal Handling', ability: 'WIS' },
  { name: 'Arcana', ability: 'INT' },
  { name: 'Athletics', ability: 'STR' },
  { name: 'Deception', ability: 'CHA' },
  { name: 'History', ability: 'INT' },
  { name: 'Insight', ability: 'WIS' },
  { name: 'Intimidation', ability: 'CHA' },
  { name: 'Investigation', ability: 'INT' },
  { name: 'Medicine', ability: 'WIS' },
  { name: 'Nature', ability: 'INT' },
  { name: 'Perception', ability: 'WIS' },
  { name: 'Performance', ability: 'CHA' },
  { name: 'Persuasion', ability: 'CHA' },
  { name: 'Religion', ability: 'INT' },
  { name: 'Sleight of Hand', ability: 'DEX' },
  { name: 'Stealth', ability: 'DEX' },
  { name: 'Survival', ability: 'WIS' },
];

// D&D 5e Classes (for character creation wizard)
export const CHARACTER_CLASSES = [
  { name: 'Barbarian', hitDie: 'd12', primaryAbility: 'strength' },
  { name: 'Bard', hitDie: 'd8', primaryAbility: 'charisma' },
  { name: 'Cleric', hitDie: 'd8', primaryAbility: 'wisdom' },
  { name: 'Druid', hitDie: 'd8', primaryAbility: 'wisdom' },
  { name: 'Fighter', hitDie: 'd10', primaryAbility: 'strength' },
  { name: 'Monk', hitDie: 'd8', primaryAbility: 'dexterity' },
  { name: 'Paladin', hitDie: 'd10', primaryAbility: 'strength' },
  { name: 'Ranger', hitDie: 'd10', primaryAbility: 'dexterity' },
  { name: 'Rogue', hitDie: 'd8', primaryAbility: 'dexterity' },
  { name: 'Sorcerer', hitDie: 'd6', primaryAbility: 'charisma' },
  { name: 'Warlock', hitDie: 'd8', primaryAbility: 'charisma' },
  { name: 'Wizard', hitDie: 'd6', primaryAbility: 'intelligence' },
];

// D&D 5e Races (basic list for character creation)
export const CHARACTER_RACES = [
  { name: 'Human', subraces: ['Variant Human'] },
  { name: 'Elf', subraces: ['High Elf', 'Wood Elf', 'Dark Elf (Drow)'] },
  { name: 'Dwarf', subraces: ['Mountain Dwarf', 'Hill Dwarf'] },
  { name: 'Halfling', subraces: ['Lightfoot', 'Stout'] },
  { name: 'Dragonborn', subraces: [] },
  { name: 'Gnome', subraces: ['Forest Gnome', 'Rock Gnome'] },
  { name: 'Half-Elf', subraces: [] },
  { name: 'Half-Orc', subraces: [] },
  { name: 'Tiefling', subraces: [] },
];
