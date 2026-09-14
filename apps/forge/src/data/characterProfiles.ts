export interface CharacterProfile {
  name: string;
  description: string;
  recommendedClasses: Array<{class: string, reason: string}>;
  recommendedRaces: Array<{race: string, reason: string}>;
  recommendedBackgrounds: Array<{background: string, reason: string}>;
  keyStats: string[];
  finalQuestion: string;
}

// Base archetypes
const baseArchetypes: Record<string, Omit<CharacterProfile, 'recommendedClasses' | 'recommendedRaces' | 'recommendedBackgrounds' | 'keyStats' | 'finalQuestion'>> = {
  guardian: {
    name: "The Guardian",
    description: "You are a rock for your allies. You are dependable, brave, and the first to charge into danger. You solve problems with your strength and protect your friends with your life."
  },
  precisionist: {
    name: "The Precisionist",
    description: "You are a shadow. You are clever, quick, and prefer to outsmart your foes rather than meet them with brute force. You strike from where they least expect and see what others miss."
  },
  survivor: {
    name: "The Survivor",
    description: "You are the wilderness incarnate. You are resourceful, adaptable, and have learned to thrive in the harshest conditions. You turn every situation to your advantage through cunning and preparation."
  },
  scholar: {
    name: "The Scholar",
    description: "You are the mind. You believe there is no problem that can't be solved with the right answer—or the right spell. You are prepared, intelligent, and a master of cosmic power."
  },
  prodigy: {
    name: "The Prodigy",
    description: "You are raw power. Magic isn't something you learned; it's something you are. Your force of personality and your inborn gift allow you to shape reality in ways others can only dream of."
  },
  oracle: {
    name: "The Oracle",
    description: "You are the heart of the party. You are a conduit for divine power, protecting your allies, mending their wounds, and standing as a judge against the forces of darkness."
  },
  wildheart: {
    name: "The Wildheart",
    description: "You are the wild. You are a guardian of the natural world, distrusting of cities and their schemes. You can call on nature's fury and even take the shape of its mightiest beasts."
  }
};

// Combat style modifiers
const combatModifiers: Record<string, { classes: string[], stats: string[], question: string }> = {
  frontline: {
    classes: ["Fighter (Champion)", "Paladin (Oath of Devotion)", "Barbarian (Berserker)"],
    stats: ["Strength (for hitting hard)", "Constitution (for staying alive)"],
    question: "Who was the first person you swore to protect?"
  },
  skirmisher: {
    classes: ["Ranger (Hunter)", "Rogue (Swashbuckler)", "Monk (Way of the Open Hand)"],
    stats: ["Dexterity (for speed and precision)", "Constitution (for endurance)"],
    question: "What's the most daring escape you've ever made?"
  },
  overwhelming: {
    classes: ["Barbarian (Totem Warrior)", "Paladin (Oath of Vengeance)", "Fighter (Battlemaster)"],
    stats: ["Strength (for overwhelming power)", "Constitution (for resilience)"],
    question: "What force in your life drives you to such intensity?"
  },
  tactical: {
    classes: ["Fighter (Battle Master)", "Wizard (School of Divination)", "Rogue (Mastermind)"],
    stats: ["Intelligence (for strategy)", "Wisdom (for battlefield awareness)"],
    question: "What's the most brilliant plan you've ever executed?"
  }
};

// Social approach modifiers
const socialModifiers: Record<string, { races: string[], backgrounds: string[] }> = {
  leader: {
    races: ["Human", "Half-Elf", "Dragonborn"],
    backgrounds: ["Noble", "Faction Agent", "Guild Artisan"]
  },
  supporter: {
    races: ["Halfling", "Gnome", "Dwarf"],
    backgrounds: ["Guild Artisan", "Folk Hero", "Entertainer"]
  },
  independent: {
    races: ["Elf", "Tabaxi", "Human (Variant)"],
    backgrounds: ["Hermit", "Outlander", "Urchin"]
  },
  mediator: {
    races: ["Half-Elf", "Human", "Aasimar"],
    backgrounds: ["Guild Artisan", "Noble", "Entertainer"]
  },
  enforcer: {
    races: ["Half-Orc", "Dwarf", "Dragonborn"],
    backgrounds: ["Soldier", "City Watch", "Mercenary Veteran"]
  },
  counselor: {
    races: ["Human", "Elf", "Tiefling"],
    backgrounds: ["Acolyte", "Sage", "Hermit"]
  }
};

// World philosophy modifiers
const worldModifiers: Record<string, { description: string, question: string }> = {
  guardian: {
    description: "You stand as a shield against darkness and chaos, protecting the innocent and vulnerable.",
    question: "Who was the first person you swore to protect?"
  },
  revolutionary: {
    description: "You challenge corrupt systems and fight oppression to create a better world.",
    question: "What injustice burns most brightly in your heart?"
  },
  pragmatist: {
    description: "You deal with the world as it is, focusing on what works and getting things done.",
    question: "What's the most practical solution you've implemented?"
  },
  spiritual: {
    description: "You seek deeper meaning and connection to higher powers beyond the material world.",
    question: "What spiritual truth have you discovered?"
  },
  free_spirit: {
    description: "You embrace spontaneity, adventure, and personal freedom above all else.",
    question: "What's the most liberating experience of your life?"
  },
  justice: {
    description: "You ensure justice prevails, hunting evildoers and maintaining moral balance.",
    question: "What crime can you never forgive?"
  }
};

// Archetype + Combat Style Class Recommendations
// Maps "${archetype}-${combatStyle}" to appropriate class recommendations
const archetypeCombatClasses: Record<string, string[]> = {
  // GUARDIAN (STR/CON martial protector)
  "guardian-frontline": ["Paladin (Oath of Devotion)", "Fighter (Champion)", "Barbarian (Totem Warrior)"],
  "guardian-skirmisher": ["Fighter (Battle Master)", "Paladin (Vengeance)", "Ranger (Hunter)"],
  "guardian-overwhelming": ["Barbarian (Berserker)", "Paladin (Vengeance)", "Fighter (Champion)"],
  "guardian-tactical": ["Fighter (Battle Master)", "Paladin (Devotion)", "Cleric (War Domain)"],

  // PRECISIONIST (DEX tactical/sneaky)
  "precisionist-frontline": ["Fighter (Eldritch Knight)", "Monk (Open Hand)", "Ranger (Hunter)"],
  "precisionist-skirmisher": ["Rogue (Swashbuckler)", "Monk (Way of Shadow)", "Ranger (Gloom Stalker)"],
  "precisionist-overwhelming": ["Rogue (Assassin)", "Ranger (Hunter)", "Monk (Open Hand)"],
  "precisionist-tactical": ["Rogue (Mastermind)", "Ranger (Hunter)", "Fighter (Battle Master)"],

  // SURVIVOR (WIS/CON adaptive/resourceful)
  "survivor-frontline": ["Ranger (Hunter)", "Druid (Circle of the Moon)", "Cleric (Life Domain)"],
  "survivor-skirmisher": ["Ranger (Gloom Stalker)", "Druid (Circle of the Land)", "Monk (Open Hand)"],
  "survivor-overwhelming": ["Druid (Circle of the Moon)", "Ranger (Beast Master)", "Barbarian (Totem Warrior)"],
  "survivor-tactical": ["Ranger (Hunter)", "Druid (Circle of the Land)", "Cleric (Life Domain)"],

  // SCHOLAR (INT studied magic)
  "scholar-frontline": ["Fighter (Eldritch Knight)", "Wizard (Bladesinging)", "Artificer (Armorer)"],
  "scholar-skirmisher": ["Wizard (Bladesinging)", "Artificer (Battle Smith)", "Rogue (Arcane Trickster)"],
  "scholar-overwhelming": ["Wizard (Evocation)", "Artificer (Artillerist)", "Wizard (War Magic)"],
  "scholar-tactical": ["Wizard (School of Divination)", "Artificer (Artillerist)", "Bard (College of Lore)"],

  // PRODIGY (CHA innate magic)
  "prodigy-frontline": ["Paladin (Oath of Devotion)", "Warlock (Hexblade)", "Bard (College of Valor)"],
  "prodigy-skirmisher": ["Bard (College of Swords)", "Warlock (Archfey)", "Rogue (Arcane Trickster)"],
  "prodigy-overwhelming": ["Sorcerer (Draconic Bloodline)", "Warlock (Fiend)", "Paladin (Oath of Vengeance)"],
  "prodigy-tactical": ["Bard (College of Lore)", "Sorcerer (Divine Soul)", "Warlock (Great Old One)"],

  // ORACLE (WIS divine magic)
  "oracle-frontline": ["Cleric (Life Domain)", "Paladin (Oath of Devotion)", "Cleric (War Domain)"],
  "oracle-skirmisher": ["Cleric (Trickery Domain)", "Monk (Open Hand)", "Ranger (Hunter)"],
  "oracle-overwhelming": ["Cleric (Light Domain)", "Paladin (Oath of Vengeance)", "Druid (Circle of the Moon)"],
  "oracle-tactical": ["Cleric (Life Domain)", "Druid (Circle of the Land)", "Paladin (Oath of Devotion)"],

  // WILDHEART (WIS nature magic)
  "wildheart-frontline": ["Druid (Circle of the Moon)", "Barbarian (Totem Warrior)", "Ranger (Beast Master)"],
  "wildheart-skirmisher": ["Ranger (Hunter)", "Druid (Circle of the Moon)", "Monk (Way of the Four Elements)"],
  "wildheart-overwhelming": ["Druid (Circle of the Moon)", "Barbarian (Storm Herald)", "Ranger (Hunter)"],
  "wildheart-tactical": ["Druid (Circle of the Land)", "Ranger (Hunter)", "Druid (Circle of the Shepherd)"]
};

// Generate dynamic profile based on all choices
export function generateCharacterProfile(archetype: string, combat: string, social: string, world: string): CharacterProfile {
  const base = baseArchetypes[archetype];
  const combatMod = combatModifiers[combat];
  const socialMod = socialModifiers[social];
  const worldMod = worldModifiers[world];

  if (!base || !combatMod || !socialMod || !worldMod) {
    return {
      name: 'Unknown Profile',
      description: 'This profile could not be found.',
      recommendedClasses: [],
      recommendedRaces: [],
      recommendedBackgrounds: [],
      keyStats: [],
      finalQuestion: 'What drives you to adventure?'
    };
  }

  // Combine descriptions
  const fullDescription = `${base.description} ${worldMod.description}`;

  // Generate class recommendations based on archetype and combat style
  const combinationKey = `${archetype}-${combat}`;
  const classesForCombination = archetypeCombatClasses[combinationKey] || combatMod.classes;

  return {
    name: base.name,
    description: fullDescription,
    recommendedClasses: classesForCombination.map(className => ({ class: className, reason: `${archetype} ${combat} style` })),
    recommendedRaces: socialMod.races.map(raceName => ({ race: raceName, reason: `${social} personality` })),
    recommendedBackgrounds: socialMod.backgrounds.map(bgName => ({ background: bgName, reason: `${world} background` })),
    keyStats: combatMod.stats,
    finalQuestion: worldMod.question
  };
}

// Legacy profiles for backward compatibility
export const characterProfiles: Record<string, CharacterProfile> = {
  guardian: {
    name: "The Guardian",
    description: "You are a rock for your allies. You are dependable, brave, and the first to charge into danger. You solve problems with your strength and protect your friends with your life. You stand as a shield against darkness and chaos, protecting the innocent and vulnerable.",
    recommendedClasses: [
      { class: "Fighter (Champion)", reason: "Master of weapons and armor, incredibly tough to take down" },
      { class: "Paladin (Oath of Devotion)", reason: "Divine protector with heavy armor and healing" },
      { class: "Barbarian (Berserker)", reason: "Unstoppable force of nature in combat" }
    ],
    recommendedRaces: [
      { race: "Dwarf", reason: "Famously tough and resilient, natural-born defender" },
      { race: "Half-Orc", reason: "Relentless endurance and intimidating presence" },
      { race: "Dragonborn", reason: "Draconic resilience and commanding presence" }
    ],
    recommendedBackgrounds: [
      { background: "Soldier", reason: "Formal training and combat experience" },
      { background: "Folk Hero", reason: "Instinctive protector of the common people" },
      { background: "Mercenary Veteran", reason: "Battle-hardened warrior with tactical knowledge" }
    ],
    keyStats: ["Strength (for hitting hard)", "Constitution (for staying alive)"],
    finalQuestion: "Who was the first person you swore to protect?"
  },

  precisionist: {
    name: "The Precisionist",
    description: "You are a shadow. You are clever, quick, and prefer to outsmart your foes rather than meet them with brute force. You strike from where they least expect and see what others miss.",
    recommendedClasses: [
      { class: "Rogue (Thief)", reason: "Skilled in many areas, deadly with precise strikes, moves silently" },
      { class: "Ranger (Hunter)", reason: "Expert marksman with survival skills and mobility" },
      { class: "Monk (Way of Shadow)", reason: "Precise strikes and ability to move unseen" }
    ],
    recommendedRaces: [
      { race: "Halfling", reason: "Naturally lucky and can easily hide behind larger allies" },
      { race: "Elf (Wood Elf)", reason: "Natural stealth and keen senses" },
      { race: "Tabaxi", reason: "Feline grace and natural climbing abilities" }
    ],
    recommendedBackgrounds: [
      { background: "Urchin", reason: "Learned skills surviving on the streets" },
      { background: "Charlatan", reason: "Conning people requires quick thinking and precision" },
      { background: "Spy", reason: "Trained in stealth and gathering information" }
    ],
    keyStats: ["Dexterity (for sneaking, lockpicking, and attacking)", "Intelligence (for problem-solving)"],
    finalQuestion: "What's the one thing you're trying to steal (or steal back) that money can't buy?"
  },

  survivor: {
    name: "The Survivor",
    description: "You are the wilderness incarnate. You are resourceful, adaptable, and have learned to thrive in the harshest conditions. You turn every situation to your advantage through cunning and preparation.",
    recommendedClasses: [
      { class: "Ranger (Gloom Stalker)", reason: "Ambush predator who strikes from darkness" },
      { class: "Barbarian (Totem Warrior)", reason: "Draws power from animal spirits for resilience" },
      { class: "Fighter (Battlemaster)", reason: "Tactical combatant who controls the battlefield" }
    ],
    recommendedRaces: [
      { race: "Human (Variant)", reason: "Adaptable and skilled in many areas" },
      { race: "Half-Elf", reason: "Natural adaptability and social flexibility" },
      { race: "Tiefling", reason: "Often forced to survive through wits and resilience" }
    ],
    recommendedBackgrounds: [
      { background: "Outlander", reason: "Survived in the wilderness through resourcefulness" },
      { background: "Hermit", reason: "Self-reliant and accustomed to harsh conditions" },
      { background: "Sailor", reason: "Adapted to changing conditions and emergencies" }
    ],
    keyStats: ["Constitution (for enduring hardship)", "Wisdom (for perception and survival)"],
    finalQuestion: "What was the most dangerous situation you've survived, and how did you escape?"
  },

  scholar: {
    name: "The Scholar",
    description: "You are the mind. You believe there is no problem that can't be solved with the right answer—or the right spell. You are prepared, intelligent, and a master of cosmic power.",
    recommendedClasses: [
      { class: "Wizard (School of Divination)", reason: "Seeks knowledge and answers through magical means" },
      { class: "Artificer (Artillerist)", reason: "Combines magical invention with scholarly precision" },
      { class: "Bard (College of Lore)", reason: "Masters of knowledge and magical performance" }
    ],
    recommendedRaces: [
      { race: "High Elf", reason: "Long-lived scholars with natural magical affinity" },
      { race: "Gnome (Forest Gnome)", reason: "Natural inventors and scholars of the arcane" },
      { race: "Human", reason: "Flexible and capable of mastering any field of study" }
    ],
    recommendedBackgrounds: [
      { background: "Sage", reason: "Spent life in pursuit of knowledge and arcane secrets" },
      { background: "Researcher", reason: "Dedicated to uncovering hidden truths" },
      { background: "Cloistered Scholar", reason: "Trained in academic and magical disciplines" }
    ],
    keyStats: ["Intelligence (to make spells powerful)", "Constitution (to survive while studying)"],
    finalQuestion: "What one secret of the universe are you obsessed with finding?"
  },

  prodigy: {
    name: "The Prodigy",
    description: "You are raw power. Magic isn't something you learned; it's something you are. Your force of personality and your inborn gift allow you to shape reality in ways others can only dream of.",
    recommendedClasses: [
      { class: "Sorcerer (Draconic Bloodline)", reason: "Innate magical power enhanced by draconic heritage" },
      { class: "Bard (College of Valor)", reason: "Natural charisma combined with magical talent" },
      { class: "Blood Hunter", reason: "Hemocraft magic tied to personal power" }
    ],
    recommendedRaces: [
      { race: "Dragonborn", reason: "Clear descendants of powerful magical lineages" },
      { race: "Tiefling", reason: "Often born with innate magical abilities" },
      { race: "Genasi", reason: "Born of elemental power and magical heritage" }
    ],
    recommendedBackgrounds: [
      { background: "Noble", reason: "Raised in a family with special magical heritage" },
      { background: "Haunted One", reason: "A life-changing event awakened your innate power" },
      { background: "Inheritor", reason: "Inherited magical power from a powerful ancestor" }
    ],
    keyStats: ["Charisma (the force of your personality is your magic)", "Constitution (for magical resilience)"],
    finalQuestion: "How do you really feel about the powerful, chaotic magic inside you?"
  },

  oracle: {
    name: "The Oracle",
    description: "You are the heart of the party. You are a conduit for divine power, protecting your allies, mending their wounds, and standing as a judge against the forces of darkness.",
    recommendedClasses: [
      { class: "Cleric (Life Domain)", reason: "Ultimate healer with heavy armor and best healing magic" },
      { class: "Paladin (Oath of Devotion)", reason: "Divine warrior protecting the faithful" },
      { class: "Druid (Circle of the Shepherd)", reason: "Spiritual guide and protector of communities" }
    ],
    recommendedRaces: [
      { race: "Human", reason: "Shining example of faith's potential and flexibility" },
      { race: "Dwarf", reason: "Strong moral code and connection to ancestral traditions" },
      { race: "Aasimar", reason: "Celestial heritage and natural divine connection" }
    ],
    recommendedBackgrounds: [
      { background: "Acolyte", reason: "Grew up in the church and are a true servant of faith" },
      { background: "Temple Priest", reason: "Dedicated servant of a religious institution" },
      { background: "Hermit", reason: "Found divine calling through solitary contemplation" }
    ],
    keyStats: ["Wisdom (your connection to your god)", "Constitution (to stay on your feet)"],
    finalQuestion: "Which of your allies needs your guidance the most (and why)?"
  },

  wildheart: {
    name: "The Wildheart",
    description: "You are the wild. You are a guardian of the natural world, distrusting of cities and their schemes. You can call on nature's fury and even take the shape of its mightiest beasts.",
    recommendedClasses: [
      { class: "Druid (Circle of the Moon)", reason: "Master of Wild Shape, able to transform into powerful beasts" },
      { class: "Ranger (Drakewarden)", reason: "Bonded with draconic allies and wilderness mastery" },
      { class: "Barbarian (Storm Herald)", reason: "Channels the raw power of natural storms" }
    ],
    recommendedRaces: [
      { race: "Wood Elf", reason: "Natural part of the forest, moving unseen in wilderness" },
      { race: "Centaur", reason: "One with the natural world and its creatures" },
      { race: "Shifter", reason: "Ability to partially transform reflects wild nature" }
    ],
    recommendedBackgrounds: [
      { background: "Hermit", reason: "Spent most life in seclusion, far from civilization" },
      { background: "Outlander", reason: "Learned secrets of the wild away from society" },
      { background: "Folk Hero", reason: "Protected wilderness communities from external threats" }
    ],
    keyStats: ["Wisdom (your connection to nature)", "Constitution (for when you're not a bear)"],
    finalQuestion: "What force (a person, a city, an evil) threatens the natural place you are sworn to protect?"
  }
};