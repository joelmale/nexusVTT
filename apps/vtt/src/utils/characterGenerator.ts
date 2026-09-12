/**
 * D&D 5e Character Generator Utility
 *
 * Provides randomization functions for creating D&D 5e characters
 * with standard rules and balanced gameplay mechanics.
 */

import type {
  Character,
  AbilityScores,
  CharacterRace,
  CharacterClass,
  CharacterBackground,
  Equipment,
} from '@/types/character';
import { CHARACTER_CLASSES, CHARACTER_RACES } from '@/types/character';

// =============================================================================
// CORE DICE ROLLING UTILITIES
// =============================================================================

/**
 * Roll a die with specified number of sides
 */
export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * Roll multiple dice and return the sum
 */
export function rollDice(count: number, sides: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += rollDie(sides);
  }
  return total;
}

/**
 * Roll 4d6, drop the lowest die (standard D&D ability score generation)
 */
export function roll4d6DropLowest(): number {
  const rolls = [rollDie(6), rollDie(6), rollDie(6), rollDie(6)];
  rolls.sort((a, b) => b - a); // Sort descending
  return rolls[0] + rolls[1] + rolls[2]; // Sum the highest 3
}

/**
 * Get a random element from an array
 */
export function getRandomElement<T>(array: readonly T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// =============================================================================
// ABILITY SCORE GENERATION
// =============================================================================

/**
 * Generate a full set of ability scores using 4d6 drop lowest method
 */
export function generateAbilityScores(): AbilityScores {
  const calculateModifier = (score: number) => Math.floor((score - 10) / 2);

  const strength = roll4d6DropLowest();
  const dexterity = roll4d6DropLowest();
  const constitution = roll4d6DropLowest();
  const intelligence = roll4d6DropLowest();
  const wisdom = roll4d6DropLowest();
  const charisma = roll4d6DropLowest();

  return {
    STR: { score: strength, modifier: calculateModifier(strength) },
    DEX: { score: dexterity, modifier: calculateModifier(dexterity) },
    CON: { score: constitution, modifier: calculateModifier(constitution) },
    INT: { score: intelligence, modifier: calculateModifier(intelligence) },
    WIS: { score: wisdom, modifier: calculateModifier(wisdom) },
    CHA: { score: charisma, modifier: calculateModifier(charisma) },
  };
}

/**
 * Generate ability scores using point buy system (alternative method)
 */
export function generatePointBuyAbilities(): AbilityScores {
  // Simplified point buy - distribute 27 points across abilities (base 8 each)
  const pointsToDistribute = 27;
  const baseScore = 8;
  const abilities = [
    'STR',
    'DEX',
    'CON',
    'INT',
    'WIS',
    'CHA',
  ] as const;

  const scores: Record<string, number> = {};
  abilities.forEach((ability) => (scores[ability] = baseScore));

  let remainingPoints = pointsToDistribute;

  // Randomly distribute points
  while (remainingPoints > 0) {
    const ability = getRandomElement(abilities);
    const currentScore = scores[ability];

    // Point buy costs: 8-13 = 1 point each, 14-15 = 2 points each
    const cost = currentScore >= 13 ? 2 : 1;

    if (remainingPoints >= cost && currentScore < 15) {
      scores[ability] += 1;
      remainingPoints -= cost;
    } else if (remainingPoints === 1 && currentScore < 13) {
      scores[ability] += 1;
      remainingPoints -= 1;
    } else {
      // Try a different ability
      continue;
    }
  }

  const calculateModifier = (score: number) => Math.floor((score - 10) / 2);

  return {
    STR: { score: scores.STR, modifier: calculateModifier(scores.STR) },
    DEX: { score: scores.DEX, modifier: calculateModifier(scores.DEX) },
    CON: { score: scores.CON, modifier: calculateModifier(scores.CON) },
    INT: { score: scores.INT, modifier: calculateModifier(scores.INT) },
    WIS: { score: scores.WIS, modifier: calculateModifier(scores.WIS) },
    CHA: { score: scores.CHA, modifier: calculateModifier(scores.CHA) },
  };
}

// =============================================================================
// RACE GENERATION
// =============================================================================

/**
 * Get a random race with subrace
 */
export function getRandomRace(): CharacterRace {
  const race = getRandomElement(CHARACTER_RACES);
  const subrace =
    race.subraces.length > 0 ? getRandomElement(race.subraces) : undefined;

  // Basic race data - in a full implementation, this would include racial traits
  return {
    name: race.name,
    subrace,
    traits: [], // Would be populated based on race selection
    abilityScoreIncrease: {}, // Would be populated based on race selection
    languages: ['Common'], // Base language, others would be added based on race
    proficiencies: [], // Would be populated based on race selection
  };
}

// =============================================================================
// CLASS GENERATION
// =============================================================================

/**
 * Get a random character class
 */
export function getRandomClass(): CharacterClass {
  const characterClass = getRandomElement(CHARACTER_CLASSES);

  return {
    name: characterClass.name,
    level: 1,
    hitDie: characterClass.hitDie,
    subclass: undefined, // Subclasses typically chosen at level 2-3
  };
}

// =============================================================================
// BACKGROUND GENERATION
// =============================================================================

const BACKGROUNDS = [
  'Acolyte',
  'Criminal',
  'Folk Hero',
  'Noble',
  'Sage',
  'Soldier',
  'Charlatan',
  'Entertainer',
  'Guild Artisan',
  'Hermit',
  'Outlander',
  'Sailor',
];

/**
 * Get a random background
 */
export function getRandomBackground(): CharacterBackground {
  const backgroundName = getRandomElement(BACKGROUNDS);

  // Basic background - in full implementation, this would include background-specific features
  return {
    name: backgroundName,
    skillProficiencies: [], // Would be populated based on background
    languages: [], // Would be populated based on background
    equipment: [], // Would be populated based on background
    feature: '', // Would be populated based on background
    description: '',
  };
}

// =============================================================================
// ALIGNMENT GENERATION
// =============================================================================

const ALIGNMENTS = [
  'Lawful Good',
  'Neutral Good',
  'Chaotic Good',
  'Lawful Neutral',
  'True Neutral',
  'Chaotic Neutral',
  'Lawful Evil',
  'Neutral Evil',
  'Chaotic Evil',
];

/**
 * Get a random alignment
 */
export function getRandomAlignment(): string {
  return getRandomElement(ALIGNMENTS);
}

// =============================================================================
// NAME GENERATION
// =============================================================================

const NAME_SETS = {
  Human: {
    first: [
      'Aeliana',
      'Beiro',
      'Cara',
      'Drannor',
      'Enna',
      'Galinndan',
      'Heian',
      'Halimath',
      'Helanda',
      'Halgrim',
      'Kasimir',
      'Mindartis',
      'Naal',
      'Nutae',
      'Paelynn',
      'Pieron',
      'Riardon',
      'Rolen',
      'Silvyr',
      'Suhnne',
      'Thallan',
      'Theriatis',
      'Thervan',
      'Uthemar',
      'Vanuath',
      'Varis',
    ],
    surnames: [
      'Amakir',
      'Amakur',
      'Aramoor',
      'Berris',
      'Beshere',
      'Daergel',
      'Dardragon',
      'Helder',
      'Hornraven',
      'Lackman',
      'Stormwind',
      'Windrivver',
    ],
  },
  Elf: {
    first: [
      'Adrie',
      'Ahmvir',
      'Aramil',
      'Aranea',
      'Berrian',
      'Caelynn',
      'Carric',
      'Dayereth',
      'Enna',
      'Galinndan',
      'Hadarai',
      'Halimath',
      'Heian',
      'Himo',
      'Immeral',
      'Ivellios',
      'Korfel',
      'Lamlis',
      'Laucian',
      'Mindartis',
      'Naal',
      'Nutae',
      'Paelynn',
      'Pieron',
      'Quarion',
      'Riardon',
      'Rolen',
      'Silvyr',
      'Suhnne',
      'Thallan',
      'Theriatis',
      'Therivan',
      'Thervan',
      'Uthemar',
      'Vanuath',
      'Varis',
    ],
    surnames: [
      'Amakir',
      'Amakur',
      'Aramoor',
      'Berris',
      'Beshere',
      'Daergel',
      'Dardragon',
      'Helder',
      'Hornraven',
      'Lackman',
      'Stormwind',
      'Windrivver',
    ],
  },
  Dwarf: {
    first: [
      'Adrik',
      'Alberich',
      'Baern',
      'Barreck',
      'Brottor',
      'Bruenor',
      'Dain',
      'Darrak',
      'Delg',
      'Eberk',
      'Einkil',
      'Fargrim',
      'Flint',
      'Gardain',
      'Harbek',
      'Kildrak',
      'Morgran',
      'Orsik',
      'Oskar',
      'Rangrim',
      'Rurik',
      'Taklinn',
      'Thoradin',
      'Thorek',
      'Tordek',
      'Traubon',
      'Travok',
      'Ulfgar',
      'Veit',
      'Vondal',
    ],
    surnames: [
      'Battlehammer',
      'Brawnanvil',
      'Dankil',
      'Fireforge',
      'Frostbeard',
      'Gorunn',
      'Holderhek',
      'Ironfist',
      'Loderr',
      'Lutgehr',
      'Rumnaheim',
      'Strakeln',
      'Torunn',
      'Ungart',
    ],
  },
  Halfling: {
    first: [
      'Alton',
      'Ander',
      'Cade',
      'Corrin',
      'Eldon',
      'Errich',
      'Finnan',
      'Garret',
      'Lindal',
      'Lyle',
      'Merric',
      'Milo',
      'Osborn',
      'Perrin',
      'Reed',
      'Roscoe',
      'Wellby',
    ],
    surnames: [
      'Brushgather',
      'Goodbarrel',
      'Greenbottle',
      'High-hill',
      'Hilltopple',
      'Leagallow',
      'Tealeaf',
      'Thorngage',
      'Tosscobble',
      'Underbough',
    ],
  },
  Dragonborn: {
    first: [
      'Arjhan',
      'Balasar',
      'Bharash',
      'Donaar',
      'Ghesh',
      'Heskan',
      'Kriv',
      'Medrash',
      'Mehen',
      'Nadarr',
      'Pandjed',
      'Patrin',
      'Rhogar',
      'Shamash',
      'Shedinn',
      'Tarhun',
      'Torinn',
    ],
    surnames: [
      'Clethtinthiallor',
      'Daardendrian',
      'Delmirev',
      'Drachedandion',
      'Fenkenkabradon',
      'Kepeshkmolik',
      'Kerrhylon',
      'Kimbatuul',
      'Linxakasendalor',
      'Myastan',
      'Nemmonis',
      'Norixius',
      'Ophinshtalajiir',
      'Prexijandilin',
      'Shestendeliath',
      'Turnuroth',
      'Verthisathurgiesh',
      'Yarjerit',
    ],
  },
};

/**
 * Generate a random name based on race
 */
export function generateName(raceName: string = 'Human'): string {
  const nameSet =
    NAME_SETS[raceName as keyof typeof NAME_SETS] || NAME_SETS.Human;
  const firstName = getRandomElement(nameSet.first);
  const lastName = getRandomElement(nameSet.surnames);

  return `${firstName} ${lastName}`;
}

// =============================================================================
// COMPLETE CHARACTER GENERATION
// =============================================================================

/**
 * Generate a completely random character with all fields populated
 */
export function generateRandomCharacter(playerId: string): Partial<Character> {
  const race = getRandomRace();
  const characterClass = getRandomClass();
  const background = getRandomBackground();
  const abilities = generateAbilityScores();
  const alignment = getRandomAlignment();
  const name = generateName(race.name);

  // Calculate derived stats
  const proficiencyBonus = 2; // Level 1 proficiency bonus
  const hitPointMaximum =
    Math.max(
      1,
      characterClass.hitDie === 'd6'
        ? 6
        : characterClass.hitDie === 'd8'
          ? 8
          : characterClass.hitDie === 'd10'
            ? 10
            : 12,
    ) + abilities.CON.modifier;

  // Generate additional languages (1-2 extra beyond racial)
  const additionalLanguages = generateAdditionalLanguages(race.languages);

  // Generate basic equipment
  const equipment = generateStartingEquipment(
    characterClass.name,
    background.name,
  );

  return {
    id: crypto.randomUUID(),
    playerId,
    name,
    race: race.name,
    species: race.name,
    class: characterClass.name,
    background: background.name,
    alignment,
    level: 1,
    abilities,
    hitPoints: hitPointMaximum,
    maxHitPoints: hitPointMaximum,
    temporaryHitPoints: 0,
    hitDice: {
      current: 1,
      max: 1,
      dieType: parseInt(characterClass.hitDie.replace('d', ''), 10) || 8,
    },
    armorClass: 10 + abilities.DEX.modifier,
    initiative: abilities.DEX.modifier,
    speed: 30,
    proficiencyBonus,
    skills: {},
    languages: [...race.languages, ...additionalLanguages],
    inventory: equipment.map((item) => ({
      equipmentSlug: item.name.toLowerCase().replace(/\s+/g, '-'),
      equipped: item.equipped,
      quantity: item.quantity,
    })),
    currency: { cp: 0, sp: 0, gp: 0, pp: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Generate additional languages beyond racial languages
 */
function generateAdditionalLanguages(existingLanguages: string[]): string[] {
  const allLanguages = [
    'Elvish',
    'Dwarvish',
    'Halfling',
    'Draconic',
    'Gnomish',
    'Orc',
    'Infernal',
    'Celestial',
    'Abyssal',
    'Primordial',
    'Sylvan',
    'Undercommon',
    'Giant',
    'Goblin',
  ];

  // Filter out languages already known
  const availableLanguages = allLanguages.filter(
    (lang) => !existingLanguages.includes(lang),
  );

  // Choose 0-2 additional languages
  const numAdditional = Math.floor(Math.random() * 3); // 0, 1, or 2
  const additionalLanguages: string[] = [];

  for (let i = 0; i < numAdditional && availableLanguages.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * availableLanguages.length);
    additionalLanguages.push(availableLanguages.splice(randomIndex, 1)[0]);
  }

  return additionalLanguages;
}

/**
 * Generate starting equipment based on class and background
 */
function generateStartingEquipment(
  className: string,
  _backgroundName: string,
): Equipment[] {
  // Simplified equipment generation - in a full implementation this would be more comprehensive
  const equipment: Equipment[] = [];

  // Add some basic equipment
  equipment.push({
    id: 'backpack',
    name: 'Backpack',
    quantity: 1,
    type: 'other',
    weight: 5,
  });
  equipment.push({
    id: 'waterskin',
    name: 'Waterskin',
    quantity: 1,
    type: 'other',
    weight: 5,
  });
  equipment.push({
    id: 'rations',
    name: 'Rations (10 days)',
    quantity: 10,
    type: 'consumable',
    weight: 20,
  });

  // Add class-specific equipment
  switch (className) {
    case 'Fighter':
      equipment.push({
        id: 'chain-mail',
        name: 'Chain Mail',
        quantity: 1,
        type: 'armor',
        weight: 55,
      });
      equipment.push({
        id: 'longsword',
        name: 'Longsword',
        quantity: 1,
        type: 'weapon',
        weight: 3,
      });
      break;
    case 'Wizard':
      equipment.push({
        id: 'spellbook',
        name: 'Spellbook',
        quantity: 1,
        weight: 3,
        type: 'other',
      });
      equipment.push({
        id: 'dagger',
        name: 'Dagger',
        quantity: 1,
        type: 'weapon',
        weight: 1,
      });
      break;
    case 'Rogue':
      equipment.push({
        id: 'leather-armor',
        name: 'Leather Armor',
        quantity: 1,
        type: 'armor',
        weight: 10,
      });
      equipment.push({
        id: 'rapier',
        name: 'Rapier',
        quantity: 1,
        type: 'weapon',
        weight: 2,
      });
      break;
    default:
      equipment.push({
        id: 'common-clothes',
        name: 'Common Clothes',
        quantity: 1,
        type: 'other',
        weight: 3,
      });
  }

  return equipment;
}

// =============================================================================
// INDIVIDUAL FIELD RANDOMIZERS
// =============================================================================

/**
 * Randomize just the name field
 */
export function randomizeName(currentRace?: string): string {
  return generateName(currentRace);
}

/**
 * Randomize just the race field
 */
export function randomizeRace(): string {
  return getRandomRace().name;
}

/**
 * Randomize just the class field
 */
export function randomizeClass(): string {
  return getRandomClass().name;
}

/**
 * Randomize just the background field
 */
export function randomizeBackground(): string {
  return getRandomBackground().name;
}

/**
 * Randomize just the alignment field
 */
export function randomizeAlignment(): string {
  return getRandomAlignment();
}

/**
 * Randomize just the ability scores
 */
export function randomizeAbilityScores(): AbilityScores {
  return generateAbilityScores();
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get list of available races for UI dropdowns
 */
export function getAvailableRaces(): string[] {
  return CHARACTER_RACES.map((race) => race.name);
}

/**
 * Get list of available classes for UI dropdowns
 */
export function getAvailableClasses(): string[] {
  return CHARACTER_CLASSES.map((cls) => cls.name);
}

/**
 * Get list of available backgrounds for UI dropdowns
 */
export function getAvailableBackgrounds(): string[] {
  return BACKGROUNDS;
}

/**
 * Get list of available alignments for UI dropdowns
 */
export function getAvailableAlignments(): string[] {
  return ALIGNMENTS;
}
