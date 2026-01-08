// Data Manager for Admin Panel - Centralized data access and modification
// Provides CRUD operations for all character generation data sources

import type {
  Weapon,
  Armor,
  Tool,
  Spell,
  Equipment,
  Feature,
  PersonalityData,
  CharacterClass,
  CharacterRace,
  CharacterBackground,
} from '@/types/character';
import { getCodeGenerator } from './codeGenerator';
import { getFileSystemManager, getDataFilename } from './fileSystem';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface AllData {
  weapons: Weapon[];
  armor: Armor[];
  tools: Tool[];
  spells: Spell[];
  equipment: Equipment[];
  features: Feature[];
  personality: PersonalityData;
  classes: CharacterClass[];
  races: CharacterRace[];
  backgrounds: CharacterBackground[];
}

export interface DataManager {
  // Core data access
  getWeapons(): Weapon[];
  getArmor(): Armor[];
  getTools(): Tool[];
  getSpells(): Spell[];
  getEquipment(): Equipment[];
  getFeatures(): Feature[];
  getPersonalityData(): PersonalityData;
  getClasses(): CharacterClass[];
  getRaces(): CharacterRace[];
  getBackgrounds(): CharacterBackground[];

  // Modification methods
  addWeapon(weapon: Omit<Weapon, 'id'>): Weapon;
  updateWeapon(id: string, updates: Partial<Weapon>): Weapon;
  deleteWeapon(id: string): void;

  addArmor(armor: Omit<Armor, 'id'>): Armor;
  updateArmor(id: string, updates: Partial<Armor>): Armor;
  deleteArmor(id: string): void;

  addTool(tool: Omit<Tool, 'id'>): Tool;
  updateTool(id: string, updates: Partial<Tool>): Tool;
  deleteTool(id: string): void;

  // Bulk operations
  importData(jsonData: string): ValidationResult;
  exportData(): string;

  // Persistence (Phase 3)
  saveToCode(): Promise<{ success: boolean; message: string; files: string[] }>;
  loadFromCode(): Promise<{ success: boolean; message: string }>;
  exportDataFile(): string;

  // Validation
  validateWeapon(weapon: Weapon): ValidationResult;
  validateArmor(armor: Armor): ValidationResult;
  validateAllData(): ValidationResult[];
}

// D&D 5e Weapons Data
const PLACEHOLDER_WEAPONS: Weapon[] = [
  // Simple Melee Weapons
  {
    id: 'club',
    name: 'Club',
    type: 'simple',
    category: 'melee',
    damage: '1d4',
    properties: ['light'],
    weight: 2,
    cost: '1 sp',
  },
  {
    id: 'dagger',
    name: 'Dagger',
    type: 'simple',
    category: 'melee',
    damage: '1d4',
    properties: ['finesse', 'light', 'thrown'],
    weight: 1,
    cost: '2 gp',
  },
  {
    id: 'greatclub',
    name: 'Greatclub',
    type: 'simple',
    category: 'melee',
    damage: '1d8',
    properties: ['two-handed'],
    weight: 10,
    cost: '2 sp',
  },
  {
    id: 'handaxe',
    name: 'Handaxe',
    type: 'simple',
    category: 'melee',
    damage: '1d6',
    properties: ['light', 'thrown'],
    weight: 2,
    cost: '5 gp',
  },
  {
    id: 'javelin',
    name: 'Javelin',
    type: 'simple',
    category: 'melee',
    damage: '1d6',
    properties: ['thrown'],
    weight: 2,
    cost: '5 sp',
  },
  {
    id: 'light-hammer',
    name: 'Light Hammer',
    type: 'simple',
    category: 'melee',
    damage: '1d4',
    properties: ['light', 'thrown'],
    weight: 2,
    cost: '2 gp',
  },
  {
    id: 'mace',
    name: 'Mace',
    type: 'simple',
    category: 'melee',
    damage: '1d6',
    properties: [],
    weight: 4,
    cost: '5 gp',
  },
  {
    id: 'quarterstaff',
    name: 'Quarterstaff',
    type: 'simple',
    category: 'melee',
    damage: '1d6',
    properties: ['versatile'],
    weight: 4,
    cost: '2 sp',
  },
  {
    id: 'sickle',
    name: 'Sickle',
    type: 'simple',
    category: 'melee',
    damage: '1d4',
    properties: ['light'],
    weight: 2,
    cost: '1 gp',
  },
  {
    id: 'spear',
    name: 'Spear',
    type: 'simple',
    category: 'melee',
    damage: '1d6',
    properties: ['thrown', 'versatile'],
    weight: 3,
    cost: '1 gp',
  },

  // Simple Ranged Weapons
  {
    id: 'crossbow-light',
    name: 'Crossbow, Light',
    type: 'simple',
    category: 'ranged',
    damage: '1d8',
    properties: ['ammunition', 'loading', 'two-handed'],
    weight: 5,
    cost: '25 gp',
  },
  {
    id: 'dart',
    name: 'Dart',
    type: 'simple',
    category: 'ranged',
    damage: '1d4',
    properties: ['finesse', 'thrown'],
    weight: 0.25,
    cost: '5 cp',
  },
  {
    id: 'shortbow',
    name: 'Shortbow',
    type: 'simple',
    category: 'ranged',
    damage: '1d6',
    properties: ['ammunition', 'two-handed'],
    weight: 2,
    cost: '25 gp',
  },
  {
    id: 'sling',
    name: 'Sling',
    type: 'simple',
    category: 'ranged',
    damage: '1d4',
    properties: ['ammunition'],
    weight: 0,
    cost: '1 sp',
  },

  // Martial Melee Weapons
  {
    id: 'battleaxe',
    name: 'Battleaxe',
    type: 'martial',
    category: 'melee',
    damage: '1d8',
    properties: ['versatile'],
    weight: 4,
    cost: '10 gp',
  },
  {
    id: 'flail',
    name: 'Flail',
    type: 'martial',
    category: 'melee',
    damage: '1d8',
    properties: [],
    weight: 2,
    cost: '10 gp',
  },
  {
    id: 'glaive',
    name: 'Glaive',
    type: 'martial',
    category: 'melee',
    damage: '1d10',
    properties: ['heavy', 'reach', 'two-handed'],
    weight: 6,
    cost: '20 gp',
  },
  {
    id: 'greataxe',
    name: 'Greataxe',
    type: 'martial',
    category: 'melee',
    damage: '1d12',
    properties: ['heavy', 'two-handed'],
    weight: 7,
    cost: '30 gp',
  },
  {
    id: 'greatsword',
    name: 'Greatsword',
    type: 'martial',
    category: 'melee',
    damage: '2d6',
    properties: ['heavy', 'two-handed'],
    weight: 6,
    cost: '50 gp',
  },
  {
    id: 'halberd',
    name: 'Halberd',
    type: 'martial',
    category: 'melee',
    damage: '1d10',
    properties: ['heavy', 'reach', 'two-handed'],
    weight: 6,
    cost: '20 gp',
  },
  {
    id: 'lance',
    name: 'Lance',
    type: 'martial',
    category: 'melee',
    damage: '1d12',
    properties: ['reach', 'special'],
    weight: 6,
    cost: '10 gp',
  },
  {
    id: 'longsword',
    name: 'Longsword',
    type: 'martial',
    category: 'melee',
    damage: '1d8',
    properties: ['versatile'],
    weight: 3,
    cost: '15 gp',
  },
  {
    id: 'maul',
    name: 'Maul',
    type: 'martial',
    category: 'melee',
    damage: '2d6',
    properties: ['heavy', 'two-handed'],
    weight: 10,
    cost: '10 gp',
  },
  {
    id: 'morningstar',
    name: 'Morningstar',
    type: 'martial',
    category: 'melee',
    damage: '1d8',
    properties: [],
    weight: 4,
    cost: '15 gp',
  },
  {
    id: 'pike',
    name: 'Pike',
    type: 'martial',
    category: 'melee',
    damage: '1d10',
    properties: ['heavy', 'reach', 'two-handed'],
    weight: 18,
    cost: '5 gp',
  },
  {
    id: 'rapier',
    name: 'Rapier',
    type: 'martial',
    category: 'melee',
    damage: '1d8',
    properties: ['finesse'],
    weight: 2,
    cost: '25 gp',
  },
  {
    id: 'scimitar',
    name: 'Scimitar',
    type: 'martial',
    category: 'melee',
    damage: '1d6',
    properties: ['finesse', 'light'],
    weight: 3,
    cost: '25 gp',
  },
  {
    id: 'shortsword',
    name: 'Shortsword',
    type: 'martial',
    category: 'melee',
    damage: '1d6',
    properties: ['finesse', 'light'],
    weight: 2,
    cost: '10 gp',
  },
  {
    id: 'trident',
    name: 'Trident',
    type: 'martial',
    category: 'melee',
    damage: '1d6',
    properties: ['thrown', 'versatile'],
    weight: 4,
    cost: '5 gp',
  },
  {
    id: 'war-pick',
    name: 'War Pick',
    type: 'martial',
    category: 'melee',
    damage: '1d8',
    properties: [],
    weight: 2,
    cost: '5 gp',
  },
  {
    id: 'warhammer',
    name: 'Warhammer',
    type: 'martial',
    category: 'melee',
    damage: '1d8',
    properties: ['versatile'],
    weight: 2,
    cost: '15 gp',
  },
  {
    id: 'whip',
    name: 'Whip',
    type: 'martial',
    category: 'melee',
    damage: '1d4',
    properties: ['finesse', 'reach'],
    weight: 3,
    cost: '2 gp',
  },

  // Martial Ranged Weapons
  {
    id: 'blowgun',
    name: 'Blowgun',
    type: 'martial',
    category: 'ranged',
    damage: '1',
    properties: ['ammunition', 'loading'],
    weight: 1,
    cost: '10 gp',
  },
  {
    id: 'crossbow-hand',
    name: 'Crossbow, Hand',
    type: 'martial',
    category: 'ranged',
    damage: '1d6',
    properties: ['ammunition', 'light', 'loading'],
    weight: 3,
    cost: '75 gp',
  },
  {
    id: 'crossbow-heavy',
    name: 'Crossbow, Heavy',
    type: 'martial',
    category: 'ranged',
    damage: '1d10',
    properties: ['ammunition', 'heavy', 'loading', 'two-handed'],
    weight: 18,
    cost: '50 gp',
  },
  {
    id: 'longbow',
    name: 'Longbow',
    type: 'martial',
    category: 'ranged',
    damage: '1d8',
    properties: ['ammunition', 'heavy', 'two-handed'],
    weight: 2,
    cost: '50 gp',
  },
  {
    id: 'net',
    name: 'Net',
    type: 'martial',
    category: 'ranged',
    damage: '0',
    properties: ['special', 'thrown'],
    weight: 3,
    cost: '1 gp',
  },
];

const PLACEHOLDER_ARMOR: Armor[] = [
  // Light Armor
  {
    id: 'padded',
    name: 'Padded',
    type: 'light',
    ac: 11,
    stealthDisadvantage: true,
    weight: 8,
    cost: '5 gp',
  },
  {
    id: 'leather',
    name: 'Leather',
    type: 'light',
    ac: 11,
    weight: 10,
    cost: '10 gp',
  },
  {
    id: 'studded-leather',
    name: 'Studded Leather',
    type: 'light',
    ac: 12,
    weight: 13,
    cost: '45 gp',
  },

  // Medium Armor
  {
    id: 'hide',
    name: 'Hide',
    type: 'medium',
    ac: 12,
    weight: 12,
    cost: '10 gp',
  },
  {
    id: 'chain-shirt',
    name: 'Chain Shirt',
    type: 'medium',
    ac: 13,
    weight: 20,
    cost: '50 gp',
  },
  {
    id: 'scale-mail',
    name: 'Scale Mail',
    type: 'medium',
    ac: 14,
    stealthDisadvantage: true,
    weight: 45,
    cost: '50 gp',
  },
  {
    id: 'breastplate',
    name: 'Breastplate',
    type: 'medium',
    ac: 14,
    weight: 20,
    cost: '400 gp',
  },
  {
    id: 'half-plate',
    name: 'Half Plate',
    type: 'medium',
    ac: 15,
    stealthDisadvantage: true,
    weight: 40,
    cost: '750 gp',
  },

  // Heavy Armor
  {
    id: 'ring-mail',
    name: 'Ring Mail',
    type: 'heavy',
    ac: 14,
    stealthDisadvantage: true,
    weight: 40,
    cost: '30 gp',
  },
  {
    id: 'chain-mail',
    name: 'Chain Mail',
    type: 'heavy',
    ac: 16,
    strengthRequirement: 13,
    stealthDisadvantage: true,
    weight: 55,
    cost: '75 gp',
  },
  {
    id: 'splint',
    name: 'Splint',
    type: 'heavy',
    ac: 17,
    strengthRequirement: 15,
    stealthDisadvantage: true,
    weight: 60,
    cost: '200 gp',
  },
  {
    id: 'plate',
    name: 'Plate',
    type: 'heavy',
    ac: 18,
    strengthRequirement: 15,
    stealthDisadvantage: true,
    weight: 65,
    cost: '1500 gp',
  },

  // Shields
  {
    id: 'shield',
    name: 'Shield',
    type: 'shield',
    ac: 2,
    weight: 6,
    cost: '10 gp',
  },
];

const PLACEHOLDER_TOOLS: Tool[] = [
  // Artisan's Tools
  {
    id: 'alchemists-supplies',
    name: "Alchemist's Supplies",
    category: 'artisan',
    cost: '50 gp',
  },
  {
    id: 'brewers-supplies',
    name: "Brewer's Supplies",
    category: 'artisan',
    cost: '20 gp',
  },
  {
    id: 'calligraphers-supplies',
    name: "Calligrapher's Supplies",
    category: 'artisan',
    cost: '10 gp',
  },
  {
    id: 'carpenters-tools',
    name: "Carpenter's Tools",
    category: 'artisan',
    cost: '8 gp',
  },
  {
    id: 'cartographers-tools',
    name: "Cartographer's Tools",
    category: 'artisan',
    cost: '15 gp',
  },
  {
    id: 'cobblers-tools',
    name: "Cobbler's Tools",
    category: 'artisan',
    cost: '5 gp',
  },
  {
    id: 'cooks-utensils',
    name: "Cook's Utensils",
    category: 'artisan',
    cost: '1 gp',
  },
  {
    id: 'glassblowers-tools',
    name: "Glassblower's Tools",
    category: 'artisan',
    cost: '30 gp',
  },
  {
    id: 'jewelers-tools',
    name: "Jeweler's Tools",
    category: 'artisan',
    cost: '25 gp',
  },
  {
    id: 'leatherworkers-tools',
    name: "Leatherworker's Tools",
    category: 'artisan',
    cost: '5 gp',
  },
  {
    id: 'masons-tools',
    name: "Mason's Tools",
    category: 'artisan',
    cost: '10 gp',
  },
  {
    id: 'painters-supplies',
    name: "Painter's Supplies",
    category: 'artisan',
    cost: '10 gp',
  },
  {
    id: 'potters-tools',
    name: "Potter's Tools",
    category: 'artisan',
    cost: '10 gp',
  },
  {
    id: 'smiths-tools',
    name: "Smith's Tools",
    category: 'artisan',
    cost: '20 gp',
  },
  {
    id: 'tinkers-tools',
    name: "Tinker's Tools",
    category: 'artisan',
    cost: '50 gp',
  },
  {
    id: 'weavers-tools',
    name: "Weaver's Tools",
    category: 'artisan',
    cost: '1 gp',
  },
  {
    id: 'woodcarvers-tools',
    name: "Woodcarver's Tools",
    category: 'artisan',
    cost: '1 gp',
  },

  // Gaming Sets
  { id: 'dice-set', name: 'Dice Set', category: 'gaming', cost: '1 sp' },
  {
    id: 'dragonchess-set',
    name: 'Dragonchess Set',
    category: 'gaming',
    cost: '1 gp',
  },
  {
    id: 'playing-card-set',
    name: 'Playing Card Set',
    category: 'gaming',
    cost: '5 sp',
  },
  {
    id: 'three-dragon-ante-set',
    name: 'Three-Dragon Ante Set',
    category: 'gaming',
    cost: '1 gp',
  },

  // Musical Instruments
  { id: 'bagpipes', name: 'Bagpipes', category: 'musical', cost: '30 gp' },
  { id: 'drum', name: 'Drum', category: 'musical', cost: '6 gp' },
  { id: 'dulcimer', name: 'Dulcimer', category: 'musical', cost: '25 gp' },
  { id: 'flute', name: 'Flute', category: 'musical', cost: '2 gp' },
  { id: 'lute', name: 'Lute', category: 'musical', cost: '35 gp' },
  { id: 'lyre', name: 'Lyre', category: 'musical', cost: '30 gp' },
  { id: 'horn', name: 'Horn', category: 'musical', cost: '3 gp' },
  { id: 'pan-flute', name: 'Pan Flute', category: 'musical', cost: '12 gp' },
  { id: 'shawm', name: 'Shawm', category: 'musical', cost: '2 gp' },
  { id: 'viol', name: 'Viol', category: 'musical', cost: '30 gp' },

  // Other Tools
  {
    id: 'disguise-kit',
    name: 'Disguise Kit',
    category: 'other',
    cost: '25 gp',
  },
  { id: 'forgery-kit', name: 'Forgery Kit', category: 'other', cost: '15 gp' },
  {
    id: 'herbalism-kit',
    name: 'Herbalism Kit',
    category: 'other',
    cost: '5 gp',
  },
  {
    id: 'navigators-tools',
    name: "Navigator's Tools",
    category: 'other',
    cost: '25 gp',
  },
  {
    id: 'poisoners-kit',
    name: "Poisoner's Kit",
    category: 'other',
    cost: '50 gp',
  },
  {
    id: 'thieves-tools',
    name: "Thieves' Tools",
    category: 'other',
    cost: '25 gp',
  },
];
const PLACEHOLDER_SPELLS: Spell[] = [
  // Cantrips
  {
    id: 'acid-splash',
    name: 'Acid Splash',
    level: 0,
    school: 'Conjuration',
    castingTime: '1 action',
    range: '60 feet',
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description:
      'You hurl a bubble of acid. Choose one creature within range, or choose two creatures within range that are within 5 feet of each other. A target must succeed on a Dexterity saving throw or take 1d6 acid damage.',
    components: { verbal: true, somatic: true, material: false },
  },
  {
    id: 'druidcraft',
    name: 'Druidcraft',
    level: 0,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '30 feet',
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description:
      'Whispering to the spirits of nature, you create one of the following effects within range: create a tiny, harmless sensory effect, light or snuff out a small flame, create an instantaneous, harmless sensory effect, or make a small object move.',
    components: { verbal: true, somatic: true, material: false },
  },
  {
    id: 'fire-bolt',
    name: 'Fire Bolt',
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: '120 feet',
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description:
      'You hurl a mote of fire at a creature or object within range. Make a ranged spell attack. On a hit, the target takes 1d10 fire damage.',
    components: { verbal: true, somatic: true, material: false },
  },
  {
    id: 'light',
    name: 'Light',
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Touch',
    duration: '1 hour',
    concentration: false,
    ritual: false,
    description:
      'You touch one object that is no larger than 10 feet in any dimension. Until the spell ends, the object sheds bright light in a 20-foot radius and dim light for an additional 20 feet.',
    components: {
      verbal: true,
      somatic: false,
      material: true,
      materialComponent: 'a firefly or phosphorescent moss',
    },
  },
  {
    id: 'mage-hand',
    name: 'Mage Hand',
    level: 0,
    school: 'Conjuration',
    castingTime: '1 action',
    range: '30 feet',
    duration: '1 minute',
    concentration: false,
    ritual: false,
    description:
      'A spectral, floating hand appears at a point you choose within range. You can use the hand to manipulate an object, open an unlocked door or container, stow or retrieve an item from an open container, or pour the contents out of a vial.',
    components: { verbal: true, somatic: true, material: false },
  },
  {
    id: 'minor-illusion',
    name: 'Minor Illusion',
    level: 0,
    school: 'Illusion',
    castingTime: '1 action',
    range: '30 feet',
    duration: '1 minute',
    concentration: false,
    ritual: false,
    description:
      'You create a sound or an image of an object within range that lasts for the duration. The illusion also ends if you dismiss it as an action or cast this spell again.',
    components: {
      verbal: false,
      somatic: true,
      material: true,
      materialComponent: 'a bit of fleece',
    },
  },
  {
    id: 'prestidigitation',
    name: 'Prestidigitation',
    level: 0,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '10 feet',
    duration: 'Up to 1 hour',
    concentration: false,
    ritual: false,
    description:
      'This spell is a minor magical trick that novice spellcasters use for practice. You create one of the following magical effects within range: create an instantaneous, harmless sensory effect, light or snuff out a small flame, clean or soil an object, chill, warm, or flavor 1 cubic foot of nonliving material, make a small mark or symbol appear, or create a tiny, nonmagical trinket or illusion.',
    components: { verbal: true, somatic: true, material: false },
  },
  {
    id: 'ray-of-frost',
    name: 'Ray of Frost',
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: '60 feet',
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description:
      'A frigid beam of blue-white light streaks toward a creature within range. Make a ranged spell attack. On a hit, it takes 1d8 cold damage, and its speed is reduced by 10 feet until the start of your next turn.',
    components: { verbal: true, somatic: true, material: false },
  },
  {
    id: 'shocking-grasp',
    name: 'Shocking Grasp',
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Touch',
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description:
      "Lightning springs from your hand to deliver a shock to a creature you try to touch. Make a melee spell attack against the target. You have advantage on the attack roll if the target is wearing armor made of metal. On a hit, the target takes 1d8 lightning damage, and it can't take reactions until the start of its next turn.",
    components: { verbal: true, somatic: true, material: false },
  },
  {
    id: 'true-strike',
    name: 'True Strike',
    level: 0,
    school: 'Divination',
    castingTime: '1 action',
    range: '30 feet',
    duration: 'Concentration, up to 1 round',
    concentration: true,
    ritual: false,
    description:
      "You extend your hand and point a finger at a target in range. Your magic grants you a brief insight into the target's defenses. On your next turn, you gain advantage on your first attack roll against the target, provided that this spell hasn't ended.",
    components: { verbal: false, somatic: true, material: false },
  },

  // 1st Level Spells
  {
    id: 'burning-hands',
    name: 'Burning Hands',
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Self (15-foot cone)',
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description:
      'As you hold your hands with thumbs touching and fingers spread, a thin sheet of flames shoots forth from your outstretched fingertips. Each creature in a 15-foot cone makes a Dexterity saving throw. A creature takes 3d6 fire damage on a failed save, or half as much damage on a successful one.',
    components: { verbal: true, somatic: true, material: false },
  },
  {
    id: 'charm-person',
    name: 'Charm Person',
    level: 1,
    school: 'Enchantment',
    castingTime: '1 action',
    range: '30 feet',
    duration: '1 hour',
    concentration: false,
    ritual: false,
    description:
      'You attempt to charm a humanoid you can see within range. It must make a Wisdom saving throw, and does so with advantage if you or your companions are fighting it. If it fails the saving throw, it is charmed by you until the spell ends or until you or your companions do anything harmful to it.',
    components: { verbal: true, somatic: true, material: false },
  },
  {
    id: 'cure-wounds',
    name: 'Cure Wounds',
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Touch',
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description:
      'A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier. This spell has no effect on undead or constructs.',
    components: { verbal: true, somatic: true, material: false },
  },
  {
    id: 'detect-magic',
    name: 'Detect Magic',
    level: 1,
    school: 'Divination',
    castingTime: '1 action',
    range: 'Self',
    duration: 'Concentration, up to 10 minutes',
    concentration: true,
    ritual: true,
    description:
      'For the duration, you sense the presence of magic within 30 feet of you. If you sense magic in this way, you can use your action to see a faint aura around any visible creature or object in the area that bears magic, and you learn its school of magic, if any.',
    components: { verbal: true, somatic: true, material: false },
  },
  {
    id: 'identify',
    name: 'Identify',
    level: 1,
    school: 'Divination',
    castingTime: '1 minute',
    range: 'Touch',
    duration: 'Instantaneous',
    concentration: false,
    ritual: true,
    description:
      'You choose one object that you must touch throughout the casting of the spell. If it is a magic item or some other magic-imbued object, you learn its properties and how to use them, whether it requires attunement to use, and how many charges it has, if any.',
    components: {
      verbal: true,
      somatic: true,
      material: true,
      materialComponent: 'a pearl worth at least 100 gp and an owl feather',
    },
  },
  {
    id: 'magic-missile',
    name: 'Magic Missile',
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    range: '120 feet',
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description:
      'You create three glowing darts of magical force. Each dart hits a creature of your choice that you can see within range. A dart deals 1d4 + 1 force damage to its target. The darts all strike simultaneously and you can direct them to hit one creature or several.',
    components: { verbal: true, somatic: true, material: false },
  },
  {
    id: 'shield',
    name: 'Shield',
    level: 1,
    school: 'Abjuration',
    castingTime: '1 reaction',
    range: 'Self',
    duration: '1 round',
    concentration: false,
    ritual: false,
    description:
      'An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack, and you take no damage from magic missile.',
    components: { verbal: true, somatic: true, material: false },
  },
  {
    id: 'sleep',
    name: 'Sleep',
    level: 1,
    school: 'Enchantment',
    castingTime: '1 action',
    range: '90 feet',
    duration: '1 minute',
    concentration: false,
    ritual: false,
    description:
      'This spell sends creatures into a magical slumber. Roll 5d8; the total is how many hit points of creatures this spell can affect. Creatures within 20 feet of a point you choose within range are affected in ascending order of their current hit points.',
    components: {
      verbal: true,
      somatic: true,
      material: true,
      materialComponent: 'a pinch of fine sand, rose petals, or a cricket',
    },
  },

  // 2nd Level Spells
  {
    id: 'blindness-deafness',
    name: 'Blindness/Deafness',
    level: 2,
    school: 'Necromancy',
    castingTime: '1 action',
    range: '30 feet',
    duration: '1 minute',
    concentration: false,
    ritual: false,
    description:
      'You can blind or deafen a foe. Choose one creature that you can see within range to make a Constitution saving throw. If it fails, the target is either blinded or deafened (your choice) for the duration.',
    components: { verbal: true, somatic: false, material: false },
  },
  {
    id: 'hold-person',
    name: 'Hold Person',
    level: 2,
    school: 'Enchantment',
    castingTime: '1 action',
    range: '60 feet',
    duration: 'Concentration, up to 1 minute',
    concentration: true,
    ritual: false,
    description:
      'Choose a humanoid that you can see within range. The target must succeed on a Wisdom saving throw or be paralyzed for the duration. At the end of each of its turns, the target can make another Wisdom saving throw. On a success, the spell ends on the target.',
    components: {
      verbal: true,
      somatic: true,
      material: true,
      materialComponent: 'a small, straight piece of iron',
    },
  },
  {
    id: 'invisibility',
    name: 'Invisibility',
    level: 2,
    school: 'Illusion',
    castingTime: '1 action',
    range: 'Touch',
    duration: 'Concentration, up to 1 hour',
    concentration: true,
    ritual: false,
    description:
      "A creature you touch becomes invisible until the spell ends. Anything the target is wearing or carrying is invisible as long as it is on the target's person. The spell ends for a target that attacks or casts a spell.",
    components: { verbal: true, somatic: true, material: false },
  },
  {
    id: 'misty-step',
    name: 'Misty Step',
    level: 2,
    school: 'Conjuration',
    castingTime: '1 bonus action',
    range: 'Self',
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description:
      'Briefly surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space that you can see.',
    components: { verbal: true, somatic: false, material: false },
  },
  {
    id: 'web',
    name: 'Web',
    level: 2,
    school: 'Conjuration',
    castingTime: '1 action',
    range: '60 feet',
    duration: 'Concentration, up to 1 hour',
    concentration: true,
    ritual: false,
    description:
      'You conjure a mass of thick, sticky webbing at a point of your choice within range. The webs fill a 20-foot cube from that point for the duration.',
    components: {
      verbal: true,
      somatic: true,
      material: true,
      materialComponent: 'a bit of spiderweb',
    },
  },

  // 3rd Level Spells
  {
    id: 'counterspell',
    name: 'Counterspell',
    level: 3,
    school: 'Abjuration',
    castingTime: '1 reaction',
    range: '60 feet',
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description:
      'You attempt to interrupt a creature in the process of casting a spell. If the creature is casting a spell of 3rd level or lower, its spell fails and has no effect. If it is casting a spell of 4th level or higher, make an ability check using your spellcasting ability.',
    components: { verbal: false, somatic: true, material: false },
  },
  {
    id: 'fly',
    name: 'Fly',
    level: 3,
    school: 'Transmutation',
    castingTime: '1 action',
    range: 'Touch',
    duration: 'Concentration, up to 10 minutes',
    concentration: true,
    ritual: false,
    description:
      'You touch a willing creature. The target gains a flying speed of 60 feet for the duration. When the spell ends, the target falls if it is still aloft, unless it can stop the fall.',
    components: {
      verbal: true,
      somatic: true,
      material: true,
      materialComponent: 'a wing feather from any bird',
    },
  },
  {
    id: 'lightning-lure',
    name: 'Lightning Lure',
    level: 3,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Self (15-foot radius)',
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description:
      'You create a lash of lightning energy that strikes at one creature of your choice that you can see within 15 feet of you. The target must succeed on a Strength saving throw or be pulled up to 10 feet in a straight line toward you and then take 4d6 lightning damage if it is within 5 feet of you.',
    components: { verbal: true, somatic: false, material: false },
  },
];
const PLACEHOLDER_EQUIPMENT: Equipment[] = [
  // Adventuring Gear
  {
    id: 'backpack',
    name: 'Backpack',
    type: 'other',
    quantity: 1,
    weight: 5,
    cost: { amount: 2, currency: 'gp' },
  },
  {
    id: 'candle',
    name: 'Candle',
    type: 'other',
    quantity: 1,
    weight: 0,
    cost: { amount: 1, currency: 'cp' },
  },
  {
    id: 'crowbar',
    name: 'Crowbar',
    type: 'other',
    quantity: 1,
    weight: 5,
    cost: { amount: 2, currency: 'gp' },
  },
  {
    id: 'hammer',
    name: 'Hammer',
    type: 'other',
    quantity: 1,
    weight: 3,
    cost: { amount: 1, currency: 'gp' },
  },
  {
    id: 'lantern-hooded',
    name: 'Lantern, Hooded',
    type: 'other',
    quantity: 1,
    weight: 2,
    cost: { amount: 5, currency: 'gp' },
  },
  {
    id: 'lock',
    name: 'Lock',
    type: 'other',
    quantity: 1,
    weight: 1,
    cost: { amount: 10, currency: 'gp' },
  },
  {
    id: 'manacles',
    name: 'Manacles',
    type: 'other',
    quantity: 1,
    weight: 6,
    cost: { amount: 2, currency: 'gp' },
  },
  {
    id: 'mirror-steel',
    name: 'Mirror, Steel',
    type: 'other',
    quantity: 1,
    weight: 0.5,
    cost: { amount: 5, currency: 'gp' },
  },
  {
    id: 'piton',
    name: 'Piton',
    type: 'other',
    quantity: 1,
    weight: 0.25,
    cost: { amount: 5, currency: 'cp' },
  },
  {
    id: 'rations-1-day',
    name: 'Rations (1 day)',
    type: 'consumable',
    quantity: 1,
    weight: 2,
    cost: { amount: 5, currency: 'sp' },
  },
  {
    id: 'rope-hempen-50',
    name: 'Rope, Hempen (50 feet)',
    type: 'other',
    quantity: 1,
    weight: 10,
    cost: { amount: 1, currency: 'gp' },
  },
  {
    id: 'tinderbox',
    name: 'Tinderbox',
    type: 'other',
    quantity: 1,
    weight: 1,
    cost: { amount: 5, currency: 'sp' },
  },
  {
    id: 'torch',
    name: 'Torch',
    type: 'other',
    quantity: 1,
    weight: 1,
    cost: { amount: 1, currency: 'cp' },
  },
  {
    id: 'waterskin',
    name: 'Waterskin',
    type: 'other',
    quantity: 1,
    weight: 5,
    cost: { amount: 2, currency: 'sp' },
  },

  // Clothing
  {
    id: 'common-clothes',
    name: 'Common Clothes',
    type: 'other',
    quantity: 1,
    weight: 3,
    cost: { amount: 5, currency: 'sp' },
  },
  {
    id: 'costume-clothes',
    name: 'Costume Clothes',
    type: 'other',
    quantity: 1,
    weight: 4,
    cost: { amount: 5, currency: 'gp' },
  },
  {
    id: 'fine-clothes',
    name: 'Fine Clothes',
    type: 'other',
    quantity: 1,
    weight: 6,
    cost: { amount: 15, currency: 'gp' },
  },
  {
    id: 'travelers-clothes',
    name: "Traveler's Clothes",
    type: 'other',
    quantity: 1,
    weight: 4,
    cost: { amount: 2, currency: 'gp' },
  },

  // Containers
  {
    id: 'chest',
    name: 'Chest',
    type: 'other',
    quantity: 1,
    weight: 25,
    cost: { amount: 5, currency: 'gp' },
  },
  {
    id: 'pouch',
    name: 'Pouch',
    type: 'other',
    quantity: 1,
    weight: 1,
    cost: { amount: 5, currency: 'sp' },
  },
  {
    id: 'sack',
    name: 'Sack',
    type: 'other',
    quantity: 1,
    weight: 0.5,
    cost: { amount: 1, currency: 'cp' },
  },
  {
    id: 'vial',
    name: 'Vial',
    type: 'other',
    quantity: 1,
    weight: 0,
    cost: { amount: 1, currency: 'gp' },
  },

  // Mounts and Vehicles
  {
    id: 'donkey',
    name: 'Donkey',
    type: 'other',
    quantity: 1,
    weight: 0,
    cost: { amount: 8, currency: 'gp' },
  },
  {
    id: 'horse-draft',
    name: 'Horse, Draft',
    type: 'other',
    quantity: 1,
    weight: 0,
    cost: { amount: 50, currency: 'gp' },
  },
  {
    id: 'horse-riding',
    name: 'Horse, Riding',
    type: 'other',
    quantity: 1,
    weight: 0,
    cost: { amount: 75, currency: 'gp' },
  },
  {
    id: 'wagon',
    name: 'Wagon',
    type: 'other',
    quantity: 1,
    weight: 0,
    cost: { amount: 35, currency: 'gp' },
  },

  // Trade Goods
  {
    id: 'barrel',
    name: 'Barrel',
    type: 'other',
    quantity: 1,
    weight: 70,
    cost: { amount: 2, currency: 'gp' },
  },
  {
    id: 'block-and-tackle',
    name: 'Block and Tackle',
    type: 'other',
    quantity: 1,
    weight: 5,
    cost: { amount: 1, currency: 'gp' },
  },
  {
    id: 'iron-pot',
    name: 'Iron Pot',
    type: 'other',
    quantity: 1,
    weight: 10,
    cost: { amount: 2, currency: 'gp' },
  },
  {
    id: 'mess-kit',
    name: 'Mess Kit',
    type: 'other',
    quantity: 1,
    weight: 1,
    cost: { amount: 2, currency: 'sp' },
  },
  {
    id: 'miners-pick',
    name: "Miner's Pick",
    type: 'other',
    quantity: 1,
    weight: 10,
    cost: { amount: 2, currency: 'gp' },
  },
  {
    id: 'shovel',
    name: 'Shovel',
    type: 'other',
    quantity: 1,
    weight: 5,
    cost: { amount: 2, currency: 'gp' },
  },

  // Holy Symbols and Spellcasting
  {
    id: 'holy-symbol-wooden',
    name: 'Holy Symbol (Wooden)',
    type: 'other',
    quantity: 1,
    weight: 0,
    cost: { amount: 1, currency: 'gp' },
  },
  {
    id: 'holy-symbol-silver',
    name: 'Holy Symbol (Silver)',
    type: 'other',
    quantity: 1,
    weight: 1,
    cost: { amount: 25, currency: 'gp' },
  },
  {
    id: 'spellbook',
    name: 'Spellbook',
    type: 'other',
    quantity: 1,
    weight: 3,
    cost: { amount: 50, currency: 'gp' },
  },
  {
    id: 'component-pouch',
    name: 'Component Pouch',
    type: 'other',
    quantity: 1,
    weight: 2,
    cost: { amount: 25, currency: 'gp' },
  },
  {
    id: 'arcane-focus-wand',
    name: 'Arcane Focus (Wand)',
    type: 'other',
    quantity: 1,
    weight: 1,
    cost: { amount: 10, currency: 'gp' },
  },
  {
    id: 'druidic-focus-mistletoe',
    name: 'Druidic Focus (Mistletoe)',
    type: 'other',
    quantity: 1,
    weight: 0,
    cost: { amount: 1, currency: 'gp' },
  },
];
const PLACEHOLDER_FEATURES: Feature[] = [
  // Fighter Features
  {
    id: 'fighting-style-archery',
    name: 'Fighting Style: Archery',
    description:
      'You gain a +2 bonus to attack rolls you make with ranged weapons.',
    source: 'Fighter',
  },
  {
    id: 'fighting-style-defense',
    name: 'Fighting Style: Defense',
    description: 'While you are wearing armor, you gain a +1 bonus to AC.',
    source: 'Fighter',
  },
  {
    id: 'second-wind',
    name: 'Second Wind',
    description:
      'You have a limited well of stamina that you can draw on to protect yourself from harm. On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level.',
    source: 'Fighter',
    uses: { total: 1, used: 0, resetOn: 'short-rest' },
  },
  {
    id: 'action-surge',
    name: 'Action Surge',
    description:
      'You can push yourself beyond your normal limits for a moment. On your turn, you can take one additional action on top of your regular action and a possible bonus action.',
    source: 'Fighter',
    uses: { total: 1, used: 0, resetOn: 'short-rest' },
  },

  // Wizard Features
  {
    id: 'spellcasting-wizard',
    name: 'Spellcasting',
    description:
      'You have learned to unravel and reshape the fabric of reality in accordance with your wishes. You have a spellbook containing six 1st-level wizard spells of your choice.',
    source: 'Wizard',
  },
  {
    id: 'arcane-recovery',
    name: 'Arcane Recovery',
    description:
      'You have learned to regain some of your magical energy by studying your spellbook. Once per day when you finish a short rest, you can choose expended spell slots to recover.',
    source: 'Wizard',
    uses: { total: 1, used: 0, resetOn: 'long-rest' },
  },

  // Rogue Features
  {
    id: 'sneak-attack',
    name: 'Sneak Attack',
    description:
      "Once per turn, you can deal an extra 1d6 damage to one creature you hit with an attack if you have advantage on the attack roll. You don't need advantage on the attack roll if another enemy of the target is within 5 feet of it.",
    source: 'Rogue',
  },
  {
    id: 'thieves-cant',
    name: "Thieves' Cant",
    description:
      "During your rogue training you learned thieves' cant, a secret mix of dialect, jargon, and code that allows you to hide messages in seemingly normal conversation.",
    source: 'Rogue',
  },

  // Cleric Features
  {
    id: 'spellcasting-cleric',
    name: 'Spellcasting',
    description: 'As a conduit for divine power, you can cast cleric spells.',
    source: 'Cleric',
  },
  {
    id: 'divine-domain',
    name: 'Divine Domain',
    description:
      'Choose one domain related to your deity: Knowledge, Life, Light, Nature, Tempest, Trickery, or War.',
    source: 'Cleric',
  },

  // Racial Traits - Elf
  {
    id: 'darkvision-elf',
    name: 'Darkvision',
    description:
      'Accustomed to twilit forests and the night sky, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
    source: 'Elf',
  },
  {
    id: 'fey-ancestry',
    name: 'Fey Ancestry',
    description:
      "You have advantage on saving throws against being charmed, and magic can't put you to sleep.",
    source: 'Elf',
  },
  {
    id: 'trance',
    name: 'Trance',
    description:
      "Elves don't need to sleep. Instead, they meditate deeply, remaining semiconscious, for 4 hours a day.",
    source: 'Elf',
  },

  // Racial Traits - Dwarf
  {
    id: 'darkvision-dwarf',
    name: 'Darkvision',
    description:
      'Accustomed to life underground, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
    source: 'Dwarf',
  },
  {
    id: 'dwarven-resilience',
    name: 'Dwarven Resilience',
    description:
      'You have advantage on saving throws against poison, and you have resistance against poison damage.',
    source: 'Dwarf',
  },
  {
    id: 'stonecunning',
    name: 'Stonecunning',
    description:
      'Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient in the History skill and add double your proficiency bonus to the check.',
    source: 'Dwarf',
  },

  // Racial Traits - Human
  {
    id: 'versatile-human',
    name: 'Versatile',
    description:
      'You gain one skill proficiency of your choice, one feat of your choice, and you gain proficiency with one tool of your choice.',
    source: 'Human',
  },

  // Background Features
  {
    id: 'lucky',
    name: 'Lucky',
    description:
      'When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.',
    source: 'Background',
    uses: { total: 3, used: 0, resetOn: 'long-rest' },
  },
  {
    id: 'brave',
    name: 'Brave',
    description:
      'You have advantage on saving throws against being frightened.',
    source: 'Background',
  },
  {
    id: 'nimble-fingers',
    name: 'Nimble Fingers',
    description: 'You can perform sleight of hand as a bonus action.',
    source: 'Background',
  },
];
const PLACEHOLDER_PERSONALITY: PersonalityData = {
  traits: [
    'I idolize a particular hero of my faith, and constantly refer to their deeds and example.',
    'I can find common ground between the fiercest enemies, empathizing with them and always working toward peace.',
    'I see omens in death and decay, and I pity those who ignore them.',
    'I am suspicious of strangers and expect the worst of them.',
    'I am always polite and respectful, even to those who are rude to me.',
    'I love a good insult, even one directed at me.',
    'I get bored easily, and I need constant stimulation or challenge.',
    'I have a strong sense of fair play and always try to find the most equitable solution to arguments.',
    'I am confident in my own abilities and do what I can to instill confidence in others.',
    "I start fights when others don't, and I finish fights when others can't.",
    'I am fascinated by the beauty and wonder of the natural world.',
    'I am always picking things up, absently fiddling with them, and sometimes accidentally breaking them.',
    "I have a strong work ethic, and I don't believe in shortcuts.",
    'I am incredibly slow to trust, and I have a hard time opening up to others.',
    'I am always calm, no matter what the situation. I never raise my voice or let my emotions control me.',
    'I am incredibly shy, and I have trouble making myself heard in social situations.',
    'I am obsessed with acquiring wealth and material possessions.',
    'I am always trying to improve myself, physically, mentally, or spiritually.',
    'I am incredibly generous, and I give freely to those in need.',
    'I am always trying to help others, sometimes at my own expense.',
    'I am incredibly curious, and I ask a lot of questions.',
    'I am always planning for the future, and I hate being unprepared.',
    'I am incredibly loyal to my friends and allies.',
    'I am always trying to prove myself, and I take on challenges to demonstrate my worth.',
    'I am incredibly patient, and I can wait for hours or days without complaint.',
  ],
  ideals: [
    'Change: We must help bring about the changes the gods are constantly working in the world. (Chaotic)',
    'Creativity: The world is in need of new ideas and bold action. (Chaotic)',
    'Greed: I will do whatever it takes to become wealthy. (Evil)',
    "People: I help the people who help me—that's what keeps us alive. (Neutral)",
    'Aspiration: I am determined to make something of myself. (Any)',
    'Discovery: I want to learn everything I can about the world. (Any)',
    'Greater Good: My gifts are meant to be shared with all, not used for my own benefit. (Good)',
    "Honor: I don't steal from others in the trade. (Lawful)",
    'Independence: I am a free spirit—no one tells me what to do. (Chaotic)',
    'Fairness: No one should get preferential treatment before the law, and no one is above the law. (Lawful)',
    'Charity: I always try to help those in need, no matter what the personal cost. (Good)',
    'Order: The world is a dangerous place, and I must impose order on it. (Lawful)',
    'Live and Let Live: Meddling in the affairs of others only causes trouble. (Neutral)',
    'Might: The strongest are meant to rule. (Evil)',
    'Nobility: I must respect the authority of those above me, and show proper courtesy to those below me. (Lawful)',
    'Responsibility: It is my duty to respect the authority of those in charge. (Lawful)',
    'Innocence: I believe that all people are inherently good. (Good)',
    'Redemption: There is good in everyone, and I strive to bring it out. (Good)',
    'Beauty: What is beautiful points us beyond itself toward what is true. (Good)',
    'Freedom: Chains are meant to be broken, as are those who would forge them. (Chaotic)',
    "Power: I want to get ahead in life, and I'll do what it takes to achieve my goals. (Evil)",
    "Self-Knowledge: If you know yourself, there's nothing left to know. (Neutral)",
    'Tradition: The ancient ways of our faith must be preserved. (Lawful)',
    'Logic: Emotions must not cloud our logical thinking. (Lawful)',
    'Self-Sacrifice: I am willing to give my life to protect others. (Good)',
  ],
  bonds: [
    'I owe my guild a great debt for forging me into the person I am today.',
    'I will face any challenge to win the approval of my family.',
    'My honor is my life.',
    'I will become the greatest thief that ever lived.',
    'I am in love with the heir of a family that my family despises.',
    "My town or city is my home, and I'll fight to defend it.",
    "I owe everything to my mentor—a horrible person who's probably rotting in jail somewhere.",
    'It is my duty to provide children to sustain my tribe.',
    'I am the last of my tribe, and it is up to me to ensure their names enter legend.',
    "My family's allegiance to a deity led to their destruction.",
    'I will someday get revenge on the corrupt temple that branded me a heretic.',
    'I owe my survival to another urchin who taught me to live on the streets.',
    'I would still lay down my life for the people I served with.',
    'Someone saved my life on the battlefield. To this day, I will never leave a friend behind.',
    'My liege was repugnant, but I stood by them out of loyalty.',
    'The workshop where I learned my trade is the most important place in the world to me.',
    'I created an elite unit, a ragtag band of ordinary people who became extraordinary.',
    'My family was killed by a monster, and I will not rest until I have slain it.',
    "I have a child somewhere who doesn't know me. I'm making the world better for him or her.",
    "I come from a noble family, and one day I'll reclaim my lands and title from those who stole them.",
    'A proud noble once gave me a horrible beating, and I will take my revenge on any bully I encounter.',
    'My tools are symbols of my past life, and I carry them so that I will never forget my roots.',
    'I protect those who cannot protect themselves.',
    'I wish my childhood sweetheart had come with me to pursue my destiny.',
    'The ship is most important—crewmates and captains come and go.',
  ],
  flaws: [
    'I am suspicious of strangers and expect the worst of them.',
    'I am greedy. I am loath to part with my money.',
    'I am prone to rage, and I have a hard time controlling my temper.',
    "I am a liar, and I don't feel bad about it.",
    'I am cowardly, and I will flee from danger rather than face it.',
    "I am selfish, and I don't care about others.",
    'I am arrogant, and I believe I am better than everyone else.',
    'I am lazy, and I avoid work whenever possible.',
    "I am jealous of others' success.",
    'I am paranoid, and I believe everyone is out to get me.',
    'I am reckless, and I take unnecessary risks.',
    'I am vengeful, and I hold grudges.',
    'I am gluttonous, and I overindulge in food and drink.',
    'I am lustful, and I have trouble controlling my desires.',
    "I am proud, and I refuse to admit when I'm wrong.",
    'I am envious, and I covet what others have.',
    'I am wrathful, and I have a quick temper.',
    'I am slothful, and I procrastinate.',
    'I am deceitful, and I manipulate others.',
    'I am despairing, and I give up easily.',
    'I am cruel, and I enjoy causing pain.',
    'I am wasteful, and I squander resources.',
    'I am dishonest, and I cheat others.',
    'I am disloyal, and I betray my friends.',
    'I am intolerant, and I discriminate against others.',
  ],
};
const PLACEHOLDER_CLASSES: CharacterClass[] = [
  {
    name: 'Barbarian',
    level: 1,
    hitDie: 'd12',
    proficienciesByLevel: {
      1: {
        weaponProficiencies: ['simple weapons', 'martial weapons'],
        armorProficiencies: ['light armor', 'medium armor', 'shields'],
        toolProficiencies: [],
        skillProficiencies: [
          'Choose 2 from: Animal Handling, Athletics, Intimidation, Nature, Perception, Survival',
        ],
      },
    },
    featuresByLevel: {
      1: [
        {
          id: 'rage',
          name: 'Rage',
          description:
            'In battle, you fight with primal ferocity. On your turn, you can enter a rage as a bonus action.',
          source: 'Barbarian',
        },
        {
          id: 'unarmored-defense-barbarian',
          name: 'Unarmored Defense',
          description:
            'While you are not wearing any armor, your Armor Class equals 10 + your Dexterity modifier + your Constitution modifier.',
          source: 'Barbarian',
        },
      ],
    },
    spellcasting: { type: 'none' },
  },
  {
    name: 'Bard',
    level: 1,
    hitDie: 'd8',
    proficienciesByLevel: {
      1: {
        weaponProficiencies: [
          'simple weapons',
          'hand crossbows',
          'longswords',
          'rapiers',
          'shortswords',
        ],
        armorProficiencies: ['light armor'],
        toolProficiencies: ['Three musical instruments of your choice'],
        skillProficiencies: ['Choose any 3'],
      },
    },
    featuresByLevel: {
      1: [
        {
          id: 'bardic-inspiration',
          name: 'Bardic Inspiration',
          description:
            'You can inspire others through stirring words or music. To do so, you use a bonus action on your turn to choose one creature other than yourself within 60 feet of you who can hear you.',
          source: 'Bard',
        },
        {
          id: 'spellcasting-bard',
          name: 'Spellcasting',
          description:
            'You have learned to untangle and reshape the fabric of reality in harmony with your wishes and music. Your spells are part of your vast repertoire, magic that you can tune to different situations.',
          source: 'Bard',
        },
      ],
    },
    spellcasting: { type: 'full', ability: 'CHA' },
  },
  {
    name: 'Cleric',
    level: 1,
    hitDie: 'd8',
    proficienciesByLevel: {
      1: {
        weaponProficiencies: ['simple weapons'],
        armorProficiencies: ['light armor', 'medium armor', 'shields'],
        toolProficiencies: [],
        skillProficiencies: [
          'Choose 2 from: History, Insight, Medicine, Persuasion, Religion',
        ],
      },
    },
    featuresByLevel: {
      1: [
        {
          id: 'spellcasting-cleric',
          name: 'Spellcasting',
          description:
            'As a conduit for divine power, you can cast cleric spells.',
          source: 'Cleric',
        },
        {
          id: 'divine-domain',
          name: 'Divine Domain',
          description: 'Choose one domain related to your deity.',
          source: 'Cleric',
        },
      ],
    },
    spellcasting: { type: 'full', ability: 'WIS' },
  },
  {
    name: 'Druid',
    level: 1,
    hitDie: 'd8',
    proficienciesByLevel: {
      1: {
        weaponProficiencies: [
          'clubs',
          'daggers',
          'darts',
          'javelins',
          'maces',
          'quarterstaffs',
          'scimitars',
          'sickles',
          'slings',
          'spears',
        ],
        armorProficiencies: ['light armor', 'medium armor', 'shields'],
        toolProficiencies: ['Herbalism kit'],
        skillProficiencies: [
          'Choose 2 from: Arcana, Animal Handling, Insight, Medicine, Nature, Perception, Religion, Survival',
        ],
      },
    },
    featuresByLevel: {
      1: [
        {
          id: 'druidcraft',
          name: 'Druidcraft',
          description: 'You know the Druidcraft cantrip.',
          source: 'Druid',
        },
        {
          id: 'spellcasting-druid',
          name: 'Spellcasting',
          description:
            'Drawing on the divine essence of nature itself, you can cast spells to shape that essence to your will.',
          source: 'Druid',
        },
      ],
    },
    spellcasting: { type: 'full', ability: 'WIS' },
  },
  {
    name: 'Fighter',
    level: 1,
    hitDie: 'd10',
    proficienciesByLevel: {
      1: {
        weaponProficiencies: ['simple weapons', 'martial weapons'],
        armorProficiencies: ['all armor', 'shields'],
        toolProficiencies: [],
        skillProficiencies: [
          'Choose 2 from: Acrobatics, Animal Handling, Athletics, History, Insight, Intimidation, Perception, Survival',
        ],
      },
    },
    featuresByLevel: {
      1: [
        {
          id: 'fighting-style',
          name: 'Fighting Style',
          description:
            'You adopt a particular style of fighting as your specialty.',
          source: 'Fighter',
        },
        {
          id: 'second-wind',
          name: 'Second Wind',
          description:
            'You have a limited well of stamina that you can draw on to protect yourself from harm.',
          source: 'Fighter',
        },
      ],
    },
    spellcasting: { type: 'none' },
  },
  {
    name: 'Monk',
    level: 1,
    hitDie: 'd8',
    proficienciesByLevel: {
      1: {
        weaponProficiencies: ['simple weapons', 'shortswords'],
        armorProficiencies: [],
        toolProficiencies: [
          "Choose one type of artisan's tools or musical instrument",
        ],
        skillProficiencies: [
          'Choose 2 from: Acrobatics, Athletics, History, Insight, Religion, Stealth',
        ],
      },
    },
    featuresByLevel: {
      1: [
        {
          id: 'unarmored-defense-monk',
          name: 'Unarmored Defense',
          description:
            'Beginning at 1st level, while you are wearing no armor and not wielding a shield, your AC equals 10 + your Dexterity modifier + your Wisdom modifier.',
          source: 'Monk',
        },
        {
          id: 'martial-arts',
          name: 'Martial Arts',
          description:
            'Your practice of martial arts gives you mastery of combat styles that use unarmed strikes and monk weapons.',
          source: 'Monk',
        },
      ],
    },
    spellcasting: { type: 'none' },
  },
  {
    name: 'Paladin',
    level: 1,
    hitDie: 'd10',
    proficienciesByLevel: {
      1: {
        weaponProficiencies: ['simple weapons', 'martial weapons'],
        armorProficiencies: ['all armor', 'shields'],
        toolProficiencies: [],
        skillProficiencies: [
          'Choose 2 from: Athletics, Insight, Intimidation, Medicine, Persuasion, Religion',
        ],
      },
    },
    featuresByLevel: {
      1: [
        {
          id: 'divine-sense',
          name: 'Divine Sense',
          description:
            'The presence of strong evil registers on your senses like a noxious odor, and powerful good rings like heavenly music in your ears.',
          source: 'Paladin',
        },
        {
          id: 'lay-on-hands',
          name: 'Lay on Hands',
          description:
            'Your blessed touch can heal wounds. You have a pool of healing power that replenishes when you take a long rest.',
          source: 'Paladin',
        },
      ],
    },
    spellcasting: { type: 'half', ability: 'CHA' },
  },
  {
    name: 'Ranger',
    level: 1,
    hitDie: 'd10',
    proficienciesByLevel: {
      1: {
        weaponProficiencies: ['simple weapons', 'martial weapons'],
        armorProficiencies: ['light armor', 'medium armor', 'shields'],
        toolProficiencies: [],
        skillProficiencies: [
          'Choose 3 from: Animal Handling, Athletics, Insight, Investigation, Nature, Perception, Stealth, Survival',
        ],
      },
    },
    featuresByLevel: {
      1: [
        {
          id: 'favored-enemy',
          name: 'Favored Enemy',
          description:
            'You have significant experience studying, tracking, hunting, and even talking to a certain type of enemy.',
          source: 'Ranger',
        },
        {
          id: 'natural-explorer',
          name: 'Natural Explorer',
          description:
            'You are particularly familiar with one type of natural environment and are adept at traveling and surviving in such regions.',
          source: 'Ranger',
        },
      ],
    },
    spellcasting: { type: 'half', ability: 'WIS' },
  },
  {
    name: 'Rogue',
    level: 1,
    hitDie: 'd8',
    proficienciesByLevel: {
      1: {
        weaponProficiencies: [
          'simple weapons',
          'hand crossbows',
          'longswords',
          'rapiers',
          'shortswords',
        ],
        armorProficiencies: ['light armor'],
        toolProficiencies: ["Thieves' tools"],
        skillProficiencies: [
          'Choose 4 from: Acrobatics, Athletics, Deception, Insight, Intimidation, Investigation, Perception, Performance, Persuasion, Sleight of Hand, Stealth',
        ],
      },
    },
    featuresByLevel: {
      1: [
        {
          id: 'expertise',
          name: 'Expertise',
          description:
            "Choose two of your skill proficiencies, or one of your skill proficiencies and your proficiency with thieves' tools. Your proficiency bonus is doubled for any ability check you make that uses either of the chosen proficiencies.",
          source: 'Rogue',
        },
        {
          id: 'sneak-attack',
          name: 'Sneak Attack',
          description:
            'Once per turn, you can deal an extra 1d6 damage to one creature you hit with an attack if you have advantage on the attack roll.',
          source: 'Rogue',
        },
        {
          id: 'thieves-cant',
          name: "Thieves' Cant",
          description:
            "During your rogue training you learned thieves' cant, a secret mix of dialect, jargon, and code that allows you to hide messages in seemingly normal conversation.",
          source: 'Rogue',
        },
      ],
    },
    spellcasting: { type: 'none' },
  },
  {
    name: 'Sorcerer',
    level: 1,
    hitDie: 'd6',
    proficienciesByLevel: {
      1: {
        weaponProficiencies: [
          'daggers',
          'darts',
          'slings',
          'quarterstaffs',
          'light crossbows',
        ],
        armorProficiencies: [],
        toolProficiencies: [],
        skillProficiencies: [
          'Choose 2 from: Arcana, Deception, Insight, Intimidation, Persuasion, Religion',
        ],
      },
    },
    featuresByLevel: {
      1: [
        {
          id: 'spellcasting-sorcerer',
          name: 'Spellcasting',
          description:
            'An event in your past, or in the life of a parent or ancestor, left an indelible mark on you, infusing you with arcane magic.',
          source: 'Sorcerer',
        },
        {
          id: 'sorcerous-origin',
          name: 'Sorcerous Origin',
          description:
            'Choose a sorcerous origin, which describes the source of your innate magical power.',
          source: 'Sorcerer',
        },
      ],
    },
    spellcasting: { type: 'full', ability: 'CHA' },
  },
  {
    name: 'Warlock',
    level: 1,
    hitDie: 'd8',
    proficienciesByLevel: {
      1: {
        weaponProficiencies: ['simple weapons'],
        armorProficiencies: ['light armor'],
        toolProficiencies: [],
        skillProficiencies: [
          'Choose 2 from: Arcana, Deception, History, Intimidation, Investigation, Nature, Religion',
        ],
      },
    },
    featuresByLevel: {
      1: [
        {
          id: 'otherworldly-patron',
          name: 'Otherworldly Patron',
          description:
            'You have struck a bargain with an otherworldly being of your choice.',
          source: 'Warlock',
        },
        {
          id: 'pact-magic',
          name: 'Pact Magic',
          description:
            'Your arcane research and the magic bestowed on you by your patron have given you facility with spells.',
          source: 'Warlock',
        },
      ],
    },
    spellcasting: { type: 'pact', ability: 'CHA' },
  },
  {
    name: 'Wizard',
    level: 1,
    hitDie: 'd6',
    proficienciesByLevel: {
      1: {
        weaponProficiencies: [
          'daggers',
          'darts',
          'slings',
          'quarterstaffs',
          'light crossbows',
        ],
        armorProficiencies: [],
        toolProficiencies: [],
        skillProficiencies: [
          'Choose 2 from: Arcana, History, Insight, Investigation, Medicine, Religion',
        ],
      },
    },
    featuresByLevel: {
      1: [
        {
          id: 'spellcasting-wizard',
          name: 'Spellcasting',
          description:
            'You have learned to untangle and reshape the fabric of reality in accordance with your wishes.',
          source: 'Wizard',
        },
        {
          id: 'arcane-recovery',
          name: 'Arcane Recovery',
          description:
            'You have learned to regain some of your magical energy by studying your spellbook.',
          source: 'Wizard',
        },
      ],
    },
    spellcasting: { type: 'full', ability: 'INT' },
  },
];
const PLACEHOLDER_RACES: CharacterRace[] = [
  // Core Races
  {
    name: 'Human',
    traits: ['Versatile'],
    abilityScoreIncrease: {
      STR: 1,
      DEX: 1,
      CON: 1,
      INT: 1,
      WIS: 1,
      CHA: 1,
    },
    languages: ['Common', 'One extra language of your choice'],
    proficiencies: [],
    size: 'medium',
    speed: 30,
  },
  {
    name: 'Elf',
    subrace: 'High Elf',
    traits: [
      'Darkvision',
      'Fey Ancestry',
      'Trance',
      'Cantrip',
      'Extra Language',
    ],
    abilityScoreIncrease: { DEX: 2, INT: 1 },
    languages: ['Common', 'Elvish', 'One extra language of your choice'],
    proficiencies: [],
    size: 'medium',
    speed: 30,
  },
  {
    name: 'Elf',
    subrace: 'Wood Elf',
    traits: ['Darkvision', 'Fey Ancestry', 'Trance', 'Mask of the Wild'],
    abilityScoreIncrease: { DEX: 2, WIS: 1 },
    languages: ['Common', 'Elvish'],
    proficiencies: [],
    size: 'medium',
    speed: 35,
  },
  {
    name: 'Elf',
    subrace: 'Dark Elf (Drow)',
    traits: [
      'Darkvision',
      'Fey Ancestry',
      'Trance',
      'Sunlight Sensitivity',
      'Drow Magic',
    ],
    abilityScoreIncrease: { DEX: 2, CHA: 1 },
    languages: ['Common', 'Elvish'],
    proficiencies: ['Rapier', 'Shortsword', 'Hand Crossbow'],
    size: 'medium',
    speed: 30,
  },
  {
    name: 'Dwarf',
    subrace: 'Hill Dwarf',
    traits: [
      'Darkvision',
      'Dwarven Resilience',
      'Stonecunning',
      'Dwarven Toughness',
    ],
    abilityScoreIncrease: { CON: 2, WIS: 1 },
    languages: ['Common', 'Dwarvish'],
    proficiencies: ['Battleaxe', 'Handaxe', 'Light Hammer', 'Warhammer'],
    size: 'medium',
    speed: 25,
  },
  {
    name: 'Dwarf',
    subrace: 'Mountain Dwarf',
    traits: [
      'Darkvision',
      'Dwarven Resilience',
      'Stonecunning',
      'Armor Training',
    ],
    abilityScoreIncrease: { CON: 2, STR: 2 },
    languages: ['Common', 'Dwarvish'],
    proficiencies: [
      'Battleaxe',
      'Handaxe',
      'Light Hammer',
      'Warhammer',
      'Light Armor',
      'Medium Armor',
    ],
    size: 'medium',
    speed: 25,
  },
  {
    name: 'Halfling',
    subrace: 'Lightfoot',
    traits: ['Lucky', 'Brave', 'Halfling Nimbleness', 'Naturally Stealthy'],
    abilityScoreIncrease: { DEX: 2, CHA: 1 },
    languages: ['Common', 'Halfling'],
    proficiencies: [],
    size: 'small',
    speed: 25,
  },
  {
    name: 'Halfling',
    subrace: 'Stout',
    traits: ['Lucky', 'Brave', 'Halfling Nimbleness', 'Stout Resilience'],
    abilityScoreIncrease: { DEX: 2, CON: 1 },
    languages: ['Common', 'Halfling'],
    proficiencies: [],
    size: 'small',
    speed: 25,
  },
  {
    name: 'Dragonborn',
    traits: ['Draconic Ancestry', 'Breath Weapon', 'Damage Resistance'],
    abilityScoreIncrease: { STR: 2, CHA: 1 },
    languages: ['Common', 'Draconic'],
    proficiencies: [],
    size: 'medium',
    speed: 30,
  },
  {
    name: 'Gnome',
    subrace: 'Forest Gnome',
    traits: [
      'Darkvision',
      'Gnome Cunning',
      'Natural Illusionist',
      'Speak with Small Beasts',
    ],
    abilityScoreIncrease: { INT: 2, DEX: 1 },
    languages: ['Common', 'Gnomish'],
    proficiencies: [],
    size: 'small',
    speed: 25,
  },
  {
    name: 'Gnome',
    subrace: 'Rock Gnome',
    traits: [
      'Darkvision',
      'Gnome Cunning',
      "Artificer's Lore",
      "Tinker's Tools",
    ],
    abilityScoreIncrease: { INT: 2, CON: 1 },
    languages: ['Common', 'Gnomish'],
    proficiencies: ["Artificer's Tools"],
    size: 'small',
    speed: 25,
  },
  {
    name: 'Half-Elf',
    traits: ['Darkvision', 'Fey Ancestry', 'Skill Versatility'],
    abilityScoreIncrease: { CHA: 2 },
    languages: ['Common', 'Elvish', 'One extra language of your choice'],
    proficiencies: [],
    size: 'medium',
    speed: 30,
  },
  {
    name: 'Half-Orc',
    traits: [
      'Darkvision',
      'Menacing',
      'Relentless Endurance',
      'Savage Attacks',
    ],
    abilityScoreIncrease: { STR: 2, CON: 1 },
    languages: ['Common', 'Orc'],
    proficiencies: ['Intimidation'],
    size: 'medium',
    speed: 30,
  },
  {
    name: 'Tiefling',
    traits: ['Darkvision', 'Hellish Resistance', 'Infernal Legacy'],
    abilityScoreIncrease: { INT: 1, CHA: 2 },
    languages: ['Common', 'Infernal'],
    proficiencies: [],
    size: 'medium',
    speed: 30,
  },
];
const PLACEHOLDER_BACKGROUNDS: CharacterBackground[] = [
  {
    name: 'Acolyte',
    skillProficiencies: ['Insight', 'Religion'],
    languages: ['Two of your choice'],
    equipment: [
      'Holy Symbol',
      'Prayer Book',
      '5 Candles',
      'Tinderbox',
      'Alms Box',
      '2 Blocks of Incense',
      'Censer',
      'Vestments',
      '2 Rations',
      'Waterskin',
    ],
    feature: 'Shelter of the Faithful',
    description:
      'You have spent your life in the service of a temple to a specific god or pantheon of gods. You act as an intermediary between the realm of the holy and the mortal world.',
    toolProficiencies: [],
    equipmentPack: "Priest's Pack",
  },
  {
    name: 'Criminal',
    skillProficiencies: ['Deception', 'Stealth'],
    languages: ['None'],
    equipment: ['Crowbar', 'Dark Common Clothes with Hood', '15 gp'],
    feature: 'Criminal Contact',
    description:
      'You are an experienced criminal with a history of breaking the law. You have a reliable contact who acts as your liaison to a network of other criminals.',
    toolProficiencies: ["Thieves' Tools", 'One gaming set of your choice'],
    equipmentPack: "Burglar's Pack",
  },
  {
    name: 'Entertainer',
    skillProficiencies: ['Acrobatics', 'Performance'],
    languages: ['None'],
    equipment: [
      'Musical Instrument of your choice',
      'Costume Clothes',
      '15 gp',
    ],
    feature: 'By Popular Demand',
    description:
      'You thrive in front of an audience. You know how to entrance them, entertain them, and even inspire them.',
    toolProficiencies: [
      'Disguise Kit',
      'One musical instrument of your choice',
    ],
    equipmentPack: "Entertainer's Pack",
  },
  {
    name: 'Folk Hero',
    skillProficiencies: ['Animal Handling', 'Survival'],
    languages: ['None'],
    equipment: [
      "Artisan's Tools of your choice",
      'Shovel',
      'Iron Pot',
      'Common Clothes',
      '10 gp',
    ],
    feature: 'Rustic Hospitality',
    description:
      'You come from a humble social rank, but you are destined for so much more. Already the people of your home village regard you as their champion.',
    toolProficiencies: ["One type of artisan's tools", 'Vehicles (land)'],
    equipmentPack: "Explorer's Pack",
  },
  {
    name: 'Guild Artisan',
    skillProficiencies: ['Insight', 'Persuasion'],
    languages: ['One of your choice'],
    equipment: [
      "Artisan's Tools of your choice",
      'Letter of Introduction from Guild',
      "Traveler's Clothes",
      '15 gp',
    ],
    feature: 'Guild Membership',
    description:
      "You are a member of an artisan's guild, skilled in a particular field and closely associated with other artisans.",
    toolProficiencies: ["One type of artisan's tools"],
    equipmentPack: "Burglar's Pack",
  },
  {
    name: 'Hermit',
    skillProficiencies: ['Medicine', 'Religion'],
    languages: ['One of your choice'],
    equipment: [
      'Scroll Case of Notes from Studies',
      'Winter Blanket',
      'Common Clothes',
      'Herbalism Kit',
      '5 gp',
    ],
    feature: 'Discovery',
    description:
      'You lived in seclusion—either in a sheltered community such as a monastery, or entirely alone—for a formative part of your life.',
    toolProficiencies: ['Herbalism Kit'],
    equipmentPack: "Scholar's Pack",
  },
  {
    name: 'Noble',
    skillProficiencies: ['History', 'Persuasion'],
    languages: ['One of your choice'],
    equipment: ['Fine Clothes', 'Signet Ring', 'Scroll of Pedigree', '25 gp'],
    feature: 'Position of Privilege',
    description:
      'You understand wealth, power, and privilege. You carry a noble title, and your family owns land, collects taxes, and wields significant political influence.',
    toolProficiencies: ['One gaming set of your choice'],
    equipmentPack: "Burglar's Pack",
  },
  {
    name: 'Outlander',
    skillProficiencies: ['Athletics', 'Survival'],
    languages: ['One of your choice'],
    equipment: [
      'Staff',
      'Hunting Trap',
      'Trophy from Animal you Killed',
      "Traveler's Clothes",
      '10 gp',
    ],
    feature: 'Wanderer',
    description:
      "You grew up in the wilds, far from civilization and the comforts of town and technology. You've witnessed the migration of herds larger than forests.",
    toolProficiencies: ['One musical instrument of your choice'],
    equipmentPack: "Explorer's Pack",
  },
  {
    name: 'Sage',
    skillProficiencies: ['Arcana', 'History'],
    languages: ['Two of your choice'],
    equipment: [
      'Bottle of Ink',
      'Quill',
      'Small Knife',
      'Letter from Colleague',
      'Common Clothes',
      '10 gp',
    ],
    feature: 'Researcher',
    description:
      'You spent years learning the lore of the multiverse. You scoured manuscripts, studied scrolls, and listened to the greatest experts on the subjects that interest you.',
    toolProficiencies: [],
    equipmentPack: "Scholar's Pack",
  },
  {
    name: 'Sailor',
    skillProficiencies: ['Athletics', 'Perception'],
    languages: ['None'],
    equipment: [
      'Belaying Pin (Club)',
      '50 feet of Silk Rope',
      'Lucky Charm',
      'Common Clothes',
      '10 gp',
    ],
    feature: 'Bad Reputation',
    description:
      'You sailed on a seagoing vessel for years. In that time, you faced down mighty storms, monsters of the deep, and those who wanted to sink your craft to the bottomless depths.',
    toolProficiencies: ["Navigator's Tools", 'Vehicles (water)'],
    equipmentPack: "Explorer's Pack",
  },
  {
    name: 'Soldier',
    skillProficiencies: ['Athletics', 'Intimidation'],
    languages: ['None'],
    equipment: [
      'Insignia of Rank',
      'Trophy from Fallen Enemy',
      'Bone Dice or Deck of Cards',
      'Common Clothes',
      '10 gp',
    ],
    feature: 'Military Rank',
    description:
      'War has been your life for as long as you care to remember. You trained as a youth, studied the use of weapons and armor, learned basic survival techniques.',
    toolProficiencies: ['One gaming set of your choice', 'Vehicles (land)'],
    equipmentPack: "Explorer's Pack",
  },
  {
    name: 'Urchin',
    skillProficiencies: ['Sleight of Hand', 'Stealth'],
    languages: ['None'],
    equipment: [
      'Small Knife',
      'Map of your Home City',
      'Pet Mouse',
      'Token to Remember Parents',
      'Common Clothes',
      '10 gp',
    ],
    feature: 'City Secrets',
    description:
      'You grew up on the streets alone, orphaned, and poor. You had no one to watch over you or to provide for you, so you learned to provide for yourself.',
    toolProficiencies: ['Disguise Kit', "Thieves' Tools"],
    equipmentPack: "Burglar's Pack",
  },
  {
    name: 'Charlatan',
    skillProficiencies: ['Deception', 'Sleight of Hand'],
    languages: ['None'],
    equipment: [
      'Fine Clothes',
      'Disguise Kit',
      'Con Tools (Ten Stoppered Bottles, Weighted Dice, Marked Cards, Fake Signet Ring)',
      '15 gp',
    ],
    feature: 'False Identity',
    description:
      'You have always had a way with people. You know what makes them tick, you can tease secrets out of them, and you know how to tell them just what they want to hear.',
    toolProficiencies: ['Disguise Kit', 'Forgery Kit'],
    equipmentPack: "Burglar's Pack",
  },
];

class DataManagerImpl implements DataManager {
  private weapons: Weapon[] = [...PLACEHOLDER_WEAPONS];
  private armor: Armor[] = [...PLACEHOLDER_ARMOR];
  private tools: Tool[] = [...PLACEHOLDER_TOOLS];
  private spells: Spell[] = [...PLACEHOLDER_SPELLS];
  private equipment: Equipment[] = [...PLACEHOLDER_EQUIPMENT];
  private features: Feature[] = [...PLACEHOLDER_FEATURES];
  private personality: PersonalityData = { ...PLACEHOLDER_PERSONALITY };
  private classes: CharacterClass[] = [...PLACEHOLDER_CLASSES];
  private races: CharacterRace[] = [...PLACEHOLDER_RACES];
  private backgrounds: CharacterBackground[] = [...PLACEHOLDER_BACKGROUNDS];

  // Core data access
  getWeapons(): Weapon[] {
    return [...this.weapons];
  }
  getArmor(): Armor[] {
    return [...this.armor];
  }
  getTools(): Tool[] {
    return [...this.tools];
  }
  getSpells(): Spell[] {
    return [...this.spells];
  }
  getEquipment(): Equipment[] {
    return [...this.equipment];
  }
  getFeatures(): Feature[] {
    return [...this.features];
  }
  getPersonalityData(): PersonalityData {
    return { ...this.personality };
  }
  getClasses(): CharacterClass[] {
    return [...this.classes];
  }
  getRaces(): CharacterRace[] {
    return [...this.races];
  }
  getBackgrounds(): CharacterBackground[] {
    return [...this.backgrounds];
  }

  // Weapon CRUD
  addWeapon(weapon: Omit<Weapon, 'id'>): Weapon {
    const newWeapon: Weapon = {
      ...weapon,
      id: crypto.randomUUID(),
    };
    this.weapons.push(newWeapon);
    return newWeapon;
  }

  updateWeapon(id: string, updates: Partial<Weapon>): Weapon {
    const index = this.weapons.findIndex((w) => w.id === id);
    if (index === -1) throw new Error('Weapon not found');

    this.weapons[index] = { ...this.weapons[index], ...updates };
    return this.weapons[index];
  }

  deleteWeapon(id: string): void {
    this.weapons = this.weapons.filter((w) => w.id !== id);
  }

  // Armor CRUD
  addArmor(armor: Omit<Armor, 'id'>): Armor {
    const newArmor: Armor = {
      ...armor,
      id: crypto.randomUUID(),
    };
    this.armor.push(newArmor);
    return newArmor;
  }

  updateArmor(id: string, updates: Partial<Armor>): Armor {
    const index = this.armor.findIndex((a) => a.id === id);
    if (index === -1) throw new Error('Armor not found');

    this.armor[index] = { ...this.armor[index], ...updates };
    return this.armor[index];
  }

  deleteArmor(id: string): void {
    this.armor = this.armor.filter((a) => a.id !== id);
  }

  // Tool CRUD
  addTool(tool: Omit<Tool, 'id'>): Tool {
    const newTool: Tool = {
      ...tool,
      id: crypto.randomUUID(),
    };
    this.tools.push(newTool);
    return newTool;
  }

  updateTool(id: string, updates: Partial<Tool>): Tool {
    const index = this.tools.findIndex((t) => t.id === id);
    if (index === -1) throw new Error('Tool not found');

    this.tools[index] = { ...this.tools[index], ...updates };
    return this.tools[index];
  }

  deleteTool(id: string): void {
    this.tools = this.tools.filter((t) => t.id !== id);
  }

  // Bulk operations
  importData(jsonData: string): ValidationResult {
    try {
      const data: Partial<AllData> = JSON.parse(jsonData);
      const errors: string[] = [];

      // Validate and import each data type
      if (data.weapons) {
        const weaponErrors = data.weapons
          .map((w) => this.validateWeapon(w))
          .filter((r) => !r.isValid);
        if (weaponErrors.length > 0) {
          errors.push(`${weaponErrors.length} invalid weapons`);
        } else {
          this.weapons = data.weapons;
        }
      }

      if (data.armor) {
        const armorErrors = data.armor
          .map((a) => this.validateArmor(a))
          .filter((r) => !r.isValid);
        if (armorErrors.length > 0) {
          errors.push(`${armorErrors.length} invalid armor items`);
        } else {
          this.armor = data.armor;
        }
      }

      // Add validation for other data types...

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch {
      return {
        isValid: false,
        errors: ['Invalid JSON format'],
      };
    }
  }

  exportData(): string {
    const allData: AllData = {
      weapons: this.weapons,
      armor: this.armor,
      tools: this.tools,
      spells: this.spells,
      equipment: this.equipment,
      features: this.features,
      personality: this.personality,
      classes: this.classes,
      races: this.races,
      backgrounds: this.backgrounds,
    };

    return JSON.stringify(allData, null, 2);
  }

  // Persistence - Phase 3 implementation
  async saveToCode(): Promise<{
    success: boolean;
    message: string;
    files: string[];
  }> {
    try {
      const codeGenerator = getCodeGenerator();
      const fileSystem = getFileSystemManager();
      const savedFiles: string[] = [];

      // Generate and save each data type
      if (this.weapons.length > 0) {
        const code = codeGenerator.generateWeaponsCode(this.weapons);
        const result = await fileSystem.saveFile(
          code,
          getDataFilename('weapons'),
        );
        if (result.success) savedFiles.push(getDataFilename('weapons'));
        else
          return {
            success: false,
            message: `Failed to save weapons: ${result.message}`,
            files: savedFiles,
          };
      }

      if (this.armor.length > 0) {
        const code = codeGenerator.generateArmorCode(this.armor);
        const result = await fileSystem.saveFile(
          code,
          getDataFilename('armor'),
        );
        if (result.success) savedFiles.push(getDataFilename('armor'));
        else
          return {
            success: false,
            message: `Failed to save armor: ${result.message}`,
            files: savedFiles,
          };
      }

      if (this.tools.length > 0) {
        const code = codeGenerator.generateToolsCode(this.tools);
        const result = await fileSystem.saveFile(
          code,
          getDataFilename('tools'),
        );
        if (result.success) savedFiles.push(getDataFilename('tools'));
        else
          return {
            success: false,
            message: `Failed to save tools: ${result.message}`,
            files: savedFiles,
          };
      }

      if (this.spells.length > 0) {
        const code = codeGenerator.generateSpellsCode(this.spells);
        const result = await fileSystem.saveFile(
          code,
          getDataFilename('spells'),
        );
        if (result.success) savedFiles.push(getDataFilename('spells'));
        else
          return {
            success: false,
            message: `Failed to save spells: ${result.message}`,
            files: savedFiles,
          };
      }

      if (this.equipment.length > 0) {
        const code = codeGenerator.generateEquipmentCode(this.equipment);
        const result = await fileSystem.saveFile(
          code,
          getDataFilename('equipment'),
        );
        if (result.success) savedFiles.push(getDataFilename('equipment'));
        else
          return {
            success: false,
            message: `Failed to save equipment: ${result.message}`,
            files: savedFiles,
          };
      }

      if (this.features.length > 0) {
        const code = codeGenerator.generateFeaturesCode(this.features);
        const result = await fileSystem.saveFile(
          code,
          getDataFilename('features'),
        );
        if (result.success) savedFiles.push(getDataFilename('features'));
        else
          return {
            success: false,
            message: `Failed to save features: ${result.message}`,
            files: savedFiles,
          };
      }

      if (this.classes.length > 0) {
        const code = codeGenerator.generateClassesCode(this.classes);
        const result = await fileSystem.saveFile(
          code,
          getDataFilename('classes'),
        );
        if (result.success) savedFiles.push(getDataFilename('classes'));
        else
          return {
            success: false,
            message: `Failed to save classes: ${result.message}`,
            files: savedFiles,
          };
      }

      if (this.races.length > 0) {
        const code = codeGenerator.generateRacesCode(this.races);
        const result = await fileSystem.saveFile(
          code,
          getDataFilename('races'),
        );
        if (result.success) savedFiles.push(getDataFilename('races'));
        else
          return {
            success: false,
            message: `Failed to save races: ${result.message}`,
            files: savedFiles,
          };
      }

      if (this.backgrounds.length > 0) {
        const code = codeGenerator.generateBackgroundsCode(this.backgrounds);
        const result = await fileSystem.saveFile(
          code,
          getDataFilename('backgrounds'),
        );
        if (result.success) savedFiles.push(getDataFilename('backgrounds'));
        else
          return {
            success: false,
            message: `Failed to save backgrounds: ${result.message}`,
            files: savedFiles,
          };
      }

      // Save personality data separately
      const personalityCode = codeGenerator.generatePersonalityCode(
        this.personality,
      );
      const personalityFilename = getDataFilename('personality');
      const personalityResult = await fileSystem.saveFile(
        personalityCode,
        personalityFilename,
      );

      if (personalityResult.success) {
        savedFiles.push(personalityFilename);
      }

      // Clean up old backups
      fileSystem.clearOldBackups(20);

      return {
        success: true,
        message: `Successfully saved ${savedFiles.length} data files`,
        files: savedFiles,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to save code: ${error}`,
        files: [],
      };
    }
  }

  async loadFromCode(): Promise<{ success: boolean; message: string }> {
    // Note: Loading from code files is complex in browser environment
    // This would typically require a build process or backend API
    return {
      success: false,
      message:
        'Loading from code files requires a build process. Please restart the application to load updated data.',
    };
  }

  exportDataFile(): string {
    const codeGenerator = getCodeGenerator();
    const allData = {
      weapons: this.weapons,
      armor: this.armor,
      tools: this.tools,
      spells: this.spells,
      equipment: this.equipment,
      features: this.features,
      personality: this.personality,
      classes: this.classes,
      races: this.races,
      backgrounds: this.backgrounds,
    };

    return codeGenerator.generateCompleteDataFile(allData);
  }

  // Validation
  validateWeapon(weapon: Weapon): ValidationResult {
    const errors: string[] = [];

    if (!weapon.name?.trim()) errors.push('Name is required');
    if (!weapon.type) errors.push('Type is required');
    if (!weapon.damage) errors.push('Damage is required');

    // Validate damage format (e.g., "1d8", "2d6+2")
    const damagePattern = /^\d+d\d+(\+\d+)?$/;
    if (weapon.damage && !damagePattern.test(weapon.damage)) {
      errors.push('Damage must be in format like "1d8" or "2d6+2"');
    }

    return { isValid: errors.length === 0, errors };
  }

  validateArmor(armor: Armor): ValidationResult {
    const errors: string[] = [];

    if (!armor.name?.trim()) errors.push('Name is required');
    if (!armor.type) errors.push('Type is required');
    if (armor.ac === undefined || armor.ac < 10)
      errors.push('AC must be 10 or higher');

    return { isValid: errors.length === 0, errors };
  }

  validateAllData(): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Validate all weapons
    this.weapons.forEach((weapon) => {
      results.push(this.validateWeapon(weapon));
    });

    // Validate all armor
    this.armor.forEach((armor) => {
      results.push(this.validateArmor(armor));
    });

    // TODO: Add validation for other data types

    return results;
  }
}

// Singleton instance
let dataManagerInstance: DataManager | null = null;

export function getDataManager(): DataManager {
  if (!dataManagerInstance) {
    dataManagerInstance = new DataManagerImpl();
  }
  return dataManagerInstance;
}

export function resetDataManager(): void {
  dataManagerInstance = null;
}
