import { CampaignRecord, CharacterRecord } from '../repositories/base.js';

// ─── D&D Thematic Data Tables ────────────────────────────────────────────────

const CAMPAIGN_NAMES = [
  "Curse of Strahd",
  "Tomb of Annihilation",
  "Lost Mine of Phandelver",
  "Out of the Abyss",
  "Storm King's Thunder",
  "Waterdeep: Dragon Heist",
  "Descent into Avernus",
  "Phandelver and Below: The Shattered Obelisk",
  "Keep on the Borderlands",
  "Tomb of Horrors",
  "Shadow of the Dragon Queen",
  "Rime of the Frostmaiden"
];

const CAMPAIGN_DESCRIPTIONS = [
  "A dark fantasy adventure set in the mist-shrouded lands of Barovia, where players face the ancient vampire Strahd von Zarovich.",
  "A race against time to stop a death curse, taking players deep into the trap-filled jungles of Chult.",
  "A classic high-fantasy starter campaign involving lost mines, goblins, and ancient treasures.",
  "Escape from the underdark, navigating subterranean caverns infested with demons and madness.",
  "An epic journey across the Savage Frontier to restore balance to the hierarchy of giants.",
  "An urban treasure hunt in the crown jewel of the Sword Coast, filled with intrigue and faction warfare."
];

const RACES = [
  "Human",
  "Elf",
  "Dwarf",
  "Halfling",
  "Dragonborn",
  "Gnome",
  "Half-Elf",
  "Half-Orc",
  "Tiefling"
];

const CLASSES = [
  { name: 'Barbarian', hitDie: 12, ability: 'STR' },
  { name: 'Bard', hitDie: 8, ability: 'CHA' },
  { name: 'Cleric', hitDie: 8, ability: 'WIS' },
  { name: 'Druid', hitDie: 8, ability: 'WIS' },
  { name: 'Fighter', hitDie: 10, ability: 'STR' },
  { name: 'Monk', hitDie: 8, ability: 'DEX' },
  { name: 'Paladin', hitDie: 10, ability: 'STR' },
  { name: 'Ranger', hitDie: 10, ability: 'DEX' },
  { name: 'Rogue', hitDie: 8, ability: 'DEX' },
  { name: 'Sorcerer', hitDie: 6, ability: 'CHA' },
  { name: 'Warlock', hitDie: 8, ability: 'CHA' },
  { name: 'Wizard', hitDie: 6, ability: 'INT' }
];

const CHARACTER_NAMES = [
  "Gimli", "Legolas", "Gondor", "Aragorn", "Boromir", "Faramir", "Elrond", "Galadriel",
  "Morgath", "Daelin", "Kaelen", "Vaelen", "Sylas", "Lyra", "Elysia", "Theron", "Kael",
  "Bree", "Tessa", "Milo", "Kellan", "Jarett", "Valerie", "Dorian", "Cassius", "Orion",
  "Keth", "Krusk", "Mialee", "Regdar", "Soveliss", "Tordek", "Lidda", "Eberk", "Kildrak"
];

const ALIGNMENTS = [
  "Lawful Good", "Neutral Good", "Chaotic Good",
  "Lawful Neutral", "True Neutral", "Chaotic Neutral",
  "Lawful Evil", "Neutral Evil", "Chaotic Evil"
];

const BACKGROUNDS = ["Acolyte", "Criminal", "Folk Hero", "Noble", "Sage", "Soldier", "Urchin", "Outlander"];

const LANGUAGES = ["Common", "Elvish", "Dwarvish", "Halfling", "Draconic", "Orc", "Undercommon", "Celestial", "Abyssal"];

const STANDARD_SKILLS = [
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
  { name: 'Survival', ability: 'WIS' }
];

// Helper to get random array element
function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Helper to generate a number in range [min, max]
function getRandomRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Generators ──────────────────────────────────────────────────────────────

export function generateRandomCampaign(dmId: string): Omit<CampaignRecord, 'id' | 'createdAt' | 'updatedAt'> {
  const name = getRandomElement(CAMPAIGN_NAMES);
  const description = getRandomElement(CAMPAIGN_DESCRIPTIONS);
  
  return {
    name,
    description,
    dmId,
    scenes: [],
    lastRoomCode: null,
    lastRoomCodeUpdatedAt: null
  };
}

export function generateRandomCharacter(ownerId: string): Omit<CharacterRecord, 'id' | 'createdAt' | 'updatedAt'> {
  const name = getRandomElement(CHARACTER_NAMES);
  const race = getRandomElement(RACES);
  const charClass = getRandomElement(CLASSES);
  const level = getRandomRange(1, 5);
  const alignment = getRandomElement(ALIGNMENTS);
  const background = getRandomElement(BACKGROUNDS);
  
  // Base ability scores (standard array + random increases)
  const abilitiesList: Array<'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'> = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  const scores = [15, 14, 13, 12, 10, 8];
  
  // Shuffle array scores to assign semi-randomly
  const shuffledScores = [...scores].sort(() => Math.random() - 0.5);
  
  const abilities: Record<string, { score: number; modifier: number }> = {};
  abilitiesList.forEach((ab, idx) => {
    const score = shuffledScores[idx];
    const modifier = Math.floor((score - 10) / 2);
    abilities[ab] = { score, modifier };
  });

  // Calculate proficiency bonus
  const proficiencyBonus = Math.ceil(level / 4) + 1;
  
  // Calculate skills map
  const skills: Record<string, { proficient: boolean; value: number }> = {};
  STANDARD_SKILLS.forEach((skill) => {
    const abMod = abilities[skill.ability]?.modifier ?? 0;
    const proficient = Math.random() > 0.7; // 30% chance of proficiency
    skills[skill.name] = {
      proficient,
      value: proficient ? abMod + proficiencyBonus : abMod
    };
  });

  // Calculate hit points
  const conMod = abilities['CON']?.modifier ?? 0;
  const initialHP = charClass.hitDie + conMod;
  const hpPerLevel = Math.floor(charClass.hitDie / 2) + 1 + conMod;
  const maxHitPoints = initialHP + (hpPerLevel * (level - 1));

  // Saving throws
  const savingThrowProficiencies: Record<string, boolean> = {};
  abilitiesList.forEach((ab) => {
    // Primary class ability has higher chance of proficiency
    savingThrowProficiencies[ab] = ab === charClass.ability || Math.random() > 0.8;
  });

  // Selected languages
  const numLanguages = getRandomRange(1, 3);
  const selectedLanguages = ['Common'];
  while (selectedLanguages.length < numLanguages) {
    const lang = getRandomElement(LANGUAGES);
    if (!selectedLanguages.includes(lang)) {
      selectedLanguages.push(lang);
    }
  }

  const characterData = {
    race,
    class: charClass.name,
    level,
    alignment,
    background,
    inspiration: false,
    proficiencyBonus,
    armorClass: 10 + (abilities['DEX']?.modifier ?? 0),
    hitPoints: maxHitPoints,
    maxHitPoints,
    temporaryHitPoints: 0,
    hitDice: {
      current: level,
      max: level,
      dieType: charClass.hitDie
    },
    speed: race === 'Dwarf' ? 25 : (race === 'Elf' ? 35 : 30),
    initiative: abilities['DEX']?.modifier ?? 0,
    abilities,
    skills,
    savingThrowProficiencies,
    languages: selectedLanguages,
    featuresAndTraits: {
      personality: `A typical ${background} background story.`,
      ideals: "Balance, honor, and adventure.",
      bonds: "Protects their allies at all costs.",
      flaws: "Cannot resist a challenge.",
      classFeatures: [`Standard ${charClass.name} Level ${level} subclass features.`]
    }
  };

  return {
    name,
    ownerId,
    data: characterData
  };
}
