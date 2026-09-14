import { AbilityName } from '../types/dnd';

// Ability score descriptions and mechanics
export const ABILITY_DESCRIPTIONS: Record<AbilityName, {
  description: string;
  howItWorks: string;
  example: string;
}> = {
  STR: {
    description: "Strength measures physical power, such as lifting, carrying, and melee combat. It determines how much you can lift, how hard you can hit, and how well you can push, pull, or break things.",
    howItWorks: "Each ability score has a modifier that ranges from -5 to +10. Your Strength modifier is added to melee attack rolls and damage rolls. It's also used for Athletics checks and determines your carrying capacity. A score of 10 gives a +0 modifier, 14 gives +2, and 18 gives +4.",
    example: "A fighter with 16 Strength (+3 modifier) attacks an orc. They roll a d20 + 3 for the attack, and if they hit, they add +3 to their weapon's damage dice. Later, they try to break down a wooden door - they roll a Strength (Athletics) check with +3."
  },
  DEX: {
    description: "Dexterity covers agility, speed, reflexes, and stealth. It represents how nimble and quick you are, affecting your ability to dodge attacks and move gracefully.",
    howItWorks: "Your Dexterity modifier applies to ranged attack rolls, initiative rolls, and Armor Class (AC) if you're wearing light or no armor. It's used for Acrobatics, Sleight of Hand, and Stealth checks. Higher Dexterity makes you harder to hit and better at positioning yourself in combat.",
    example: "A rogue with 16 Dexterity (+3 modifier) hides in shadows. They roll a Dexterity (Stealth) check with +3. In combat, their AC is 14 + 3 = 17, making them harder to hit. When initiative is rolled, they add +3 to determine who acts first."
  },
  CON: {
    description: "Constitution governs your health, endurance, and ability to resist poison and disease. It represents your physical toughness and overall vitality.",
    howItWorks: "Your Constitution modifier is added to your hit points at each level (except 1st) and affects your Fortitude saving throws. It determines how well you resist poison, disease, and exhaustion. A higher Constitution means you have more hit points and are more resistant to harmful effects.",
    example: "A barbarian with 16 Constitution (+3 modifier) has more hit points than average. When poisoned by a trap, they roll a Constitution saving throw with +3 to resist the effect. They can also hold their breath longer and resist fatigue better during long adventures."
  },
  INT: {
    description: "Intelligence represents reasoning, knowledge, memory, and analytical thinking. It measures how well you learn, reason, and solve problems.",
    howItWorks: "Your Intelligence modifier applies to Intelligence saving throws and checks for Arcana, History, Investigation, Nature, and Religion. It affects how many languages you can learn and how well you recall information. Higher Intelligence means you're better at solving puzzles and remembering details.",
    example: "A wizard with 16 Intelligence (+3 modifier) tries to identify a magical rune. They roll an Intelligence (Arcana) check with +3. When researching ancient lore, they recall more details. They can also learn additional languages more easily."
  },
  WIS: {
    description: "Wisdom covers perception, intuition, insight, and common sense. It represents awareness of your surroundings and your ability to notice details others miss.",
    howItWorks: "Your Wisdom modifier is used for Wisdom saving throws and checks for Animal Handling, Insight, Medicine, Perception, and Survival. It affects your passive perception and ability to detect lies or hidden threats. Higher Wisdom means you're more aware and intuitive.",
    example: "A ranger with 16 Wisdom (+3 modifier) notices hidden tracks. They roll a Wisdom (Survival) check with +3 to track prey. In social situations, they roll Wisdom (Insight) with +3 to detect when someone is lying. Their passive Perception is 13 (10 + 3), helping them notice hidden doors."
  },
  CHA: {
    description: "Charisma defines your force of personality, including your ability to influence, persuade, and lead others. It represents confidence, eloquence, and social grace.",
    howItWorks: "Your Charisma modifier applies to Charisma saving throws and checks for Deception, Intimidation, Performance, and Persuasion. It affects how many followers you can attract and how well you can charm or intimidate others. Higher Charisma makes you more influential and charismatic.",
    example: "A bard with 16 Charisma (+3 modifier) tries to convince a guard to let them pass. They roll a Charisma (Persuasion) check with +3. When performing, they roll Charisma (Performance) with +3 to entertain a crowd. They can also cast more spells if Charisma is their spellcasting ability."
  }
};

// Function to get ability info for modals
export function getAbilityInfo(abilityName: AbilityName) {
  const info = ABILITY_DESCRIPTIONS[abilityName];
  return {
    name: abilityName,
    description: info.description,
    howItWorks: info.howItWorks,
    example: info.example
  };
}