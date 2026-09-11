// Random Character Detail Generator
// Generates random names, personality traits, ideals, bonds, and flaws

import { Edition } from '../types/dnd';

const FIRST_NAMES = {
  Human: ['Aric', 'Elara', 'Gareth', 'Lyra', 'Marcus', 'Nora', 'Roland', 'Selena', 'Theron', 'Vera'],
  Elf: ['Aelith', 'Caelynn', 'Erevan', 'Faelyn', 'Isilme', 'Laucian', 'Nailo', 'Sariel', 'Theren', 'Valanthe'],
  Dwarf: ['Baern', 'Darrak', 'Eberk', 'Gimgen', 'Harbek', 'Kildrak', 'Morgran', 'Orsik', 'Tordek', 'Vondal'],
  Halfling: ['Alton', 'Bree', 'Cade', 'Eldon', 'Finn', 'Garret', 'Lindal', 'Merric', 'Nedda', 'Seraphina'],
  Dragonborn: ['Arjhan', 'Balasar', 'Bharash', 'Donaar', 'Ghesh', 'Heskan', 'Kriv', 'Medrash', 'Nadarr', 'Patrin'],
  Gnome: ['Alston', 'Alvyn', 'Boddynock', 'Brocc', 'Burgell', 'Dimble', 'Eldon', 'Fonkin', 'Orryn', 'Wrenn'],
  'Half-Elf': ['Amakir', 'Berrian', 'Caelynn', 'Enna', 'Heian', 'Immeral', 'Laucian', 'Quarion', 'Riardon', 'Soveliss'],
  'Half-Orc': ['Dench', 'Feng', 'Gell', 'Henk', 'Holg', 'Imsh', 'Keth', 'Mhurren', 'Ront', 'Shump'],
  Tiefling: ['Akmenios', 'Amnon', 'Barakas', 'Damakos', 'Ekemon', 'Iados', 'Kairon', 'Leucis', 'Melech', 'Mordai'],
  default: ['Adrian', 'Blake', 'Casey', 'Drew', 'Ellis', 'Finley', 'Grey', 'Harper', 'Jordan', 'Kai']
};

const LAST_NAMES = {
  Human: ['Blackwood', 'Brightblade', 'Duskwalker', 'Ironforge', 'Moonwhisper', 'Nightshade', 'Stormwind', 'Thornheart', 'Wintermere', 'Ashenfell'],
  Elf: ['Amastacia', 'Galanodel', 'Holimion', 'Ilphelkiir', 'Liadon', 'Meliamne', 'Naïlo', 'Siannodel', 'Xiloscient', 'Moonbow'],
  Dwarf: ['Balderk', 'Battlehammer', 'Brawnanvil', 'Dankil', 'Fireforge', 'Frostbeard', 'Gorunn', 'Holderhek', 'Ironfoot', 'Strakeln'],
  Halfling: ['Brushgather', 'Goodbarrel', 'Greenbottle', 'High-hill', 'Hilltopple', 'Leagallow', 'Tealeaf', 'Thorngage', 'Tosscobble', 'Underbough'],
  Dragonborn: ['Clethtinthiallor', 'Daardendrian', 'Delmirev', 'Drachedandion', 'Fenkenkabradon', 'Kepeshkmolik', 'Kerrhylon', 'Kimbatuul', 'Linxakasendalor', 'Myastan'],
  Gnome: ['Beren', 'Daergel', 'Folkor', 'Garrick', 'Nackle', 'Murnig', 'Ningel', 'Raulnor', 'Scheppen', 'Timbers'],
  'Half-Elf': ['Amakir', 'Berrian', 'Brightwood', 'Galanodel', 'Moonwhisper', 'Nightbreeze', 'Shadowstep', 'Stargazer', 'Windwalker', 'Ravenshadow'],
  'Half-Orc': ['', '', '', '', '', '', '', '', '', ''], // Half-orcs often use single names or human surnames
  Tiefling: ['', '', '', '', '', '', '', '', '', ''], // Tieflings often use virtue names or single names
  default: ['Sterling', 'Hawthorne', 'Rivers', 'Stone', 'Vale', 'Woods', 'Chase', 'Cross', 'Fox', 'Wolf']
};

const PERSONALITY_TRAITS = [
  'I am always polite and respectful, even to those who deserve neither.',
  'I am haunted by memories of war that I cannot forget.',
  'I idolize a particular hero and constantly refer to their deeds.',
  'I can find common ground between the fiercest enemies.',
  'I have a crude sense of humor that often offends others.',
  'I face problems head-on with simple, direct solutions.',
  'I am incredibly slow to trust, suspecting hidden motives in everyone.',
  'I use polysyllabic words to convey the impression of great erudition.',
  'I misquote sacred texts and proverbs in almost every situation.',
  'I am tolerant of other faiths and respect the worship of other gods.',
  'I enjoy good food, drink, and high society among my peers.',
  'I judge others harshly and myself even more severely.',
  'I quote poetry, songs, and sayings at length.',
  'I am easily distracted by the promise of information or treasure.',
  'I have a strong sense of fair play and always try to find compromise.',
  'I am suspicious of strangers and expect the worst of them.',
  'I work hard and play little, always focused on my goals.',
  'I never pass up a friendly wager or game of chance.',
  'My eloquent flattery makes everyone I talk to feel wonderful.',
  'I love a good insult, even one directed at me.'
];

const IDEALS = [
  'Respect. People deserve to be treated with dignity. (Good)',
  'Fairness. No one should get preferential treatment before the law. (Lawful)',
  'Freedom. Tyrants must not be allowed to oppress the people. (Chaotic)',
  'Might. The strongest are meant to rule. (Evil)',
  'Sincerity. There\'s no good pretending to be something I\'m not. (Neutral)',
  'Destiny. Nothing can sway me from my higher calling. (Any)',
  'Community. It is the duty of civilized people to protect the outcasts. (Good)',
  'Redemption. There\'s a spark of good in everyone. (Good)',
  'Power. Knowledge is the path to power and domination. (Evil)',
  'Beauty. What is beautiful points us beyond ourselves. (Good)',
  'Logic. Emotions must not cloud our sense of what is right. (Lawful)',
  'Greater Good. My gifts are meant to be shared with all. (Good)',
  'Greed. I will do whatever it takes to become wealthy. (Evil)',
  'Independence. I am a free spirit—no one tells me what to do. (Chaotic)',
  'Honor. I don\'t steal from others in the trade. (Lawful)',
  'Change. Life is like the seasons, in constant flux. (Chaotic)',
  'Charity. I always try to help those in need. (Good)',
  'Creativity. I never run the same con twice. (Chaotic)',
  'Tradition. The stories and legends of the past must be preserved. (Lawful)',
  'Aspiration. I seek to prove myself worthy of my god\'s favor. (Any)'
];

const BONDS = [
  'I would die to recover an ancient artifact that was stolen from me.',
  'I will face any challenge to win the approval of my family.',
  'My town or city is my home, and I\'ll fight to defend it.',
  'I protect those who cannot protect themselves.',
  'I owe my life to someone who took me in when I had nowhere else to go.',
  'Someone I loved died because of a mistake I made. I will never let that happen again.',
  'I will do anything to prove myself superior to my hated rival.',
  'My loyalty to my sovereign is unwavering.',
  'The workshop where I learned my trade is the most important place in the world to me.',
  'I created a great work for someone, and then found them unworthy. I\'m searching for someone worthy.',
  'I entered seclusion because I loved someone I could not have.',
  'Should my discovery come to light, it could bring ruin to the world.',
  'I have an ancient text that holds terrible secrets that must not fall into the wrong hands.',
  'I work to preserve a library, university, or monastery.',
  'I sold my soul for knowledge. I hope to do great deeds and win it back.',
  'I would kill to acquire a noble title.',
  'I\'m guilty of a terrible crime. I hope I can redeem myself for it.',
  'Someone I love has been enslaved. I will free them or die trying.',
  'Everything I do is for the common people.',
  'Nothing is more important than the other members of my family.'
];

const FLAWS = [
  'I can\'t resist a pretty face.',
  'I\'m always in debt. I spend my gold on decadent luxuries faster than I earn it.',
  'I\'m convinced that no one could ever fool me the way I fool others.',
  'I\'m too greedy for my own good. I can\'t resist taking a risk if money is involved.',
  'I can\'t keep a secret to save my life, or anyone else\'s.',
  'I turn tail and run when things look bad.',
  'An innocent person is in prison for a crime I committed. I\'m okay with that.',
  'I have a weakness for the new intoxicants and other pleasures of this land.',
  'I am dogmatic in my thoughts and philosophy.',
  'I let my need to win arguments overshadow friendships and harmony.',
  'I\'d risk too much to uncover a lost bit of knowledge.',
  'I speak without really thinking, invariably insulting others.',
  'I can\'t resist swindling people who are more powerful than me.',
  'I have trouble keeping my true feelings hidden. My sharp tongue lands me in trouble.',
  'Once someone questions my courage, I never back down.',
  'Once I pick a goal, I become obsessed with it to the detriment of everything else.',
  'I have a tell that reveals when I\'m lying.',
  'The tyrant who rules my land will stop at nothing to see me killed.',
  'I\'m convinced of the significance of my destiny, and blind to my shortcomings.',
  'I overlook obvious solutions in favor of complicated ones.'
];

// Helper function to get random item from array
function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// Helper function to extract base species name (remove parenthetical variants)
function getBaseSpecies(speciesSlug: string, edition: Edition): string {
  const baseName = speciesSlug.split('-')[0]; // Get "human" from "human-2024" or "human"

  if (edition === '2024') {
    switch (baseName) {
      case 'human': return 'Human';
      case 'dwarf': return 'Dwarf';
      case 'elf': return 'Elf';
      case 'halfling': return 'Halfling';
      case 'gnome': return 'Gnome';
      case 'dragonborn': return 'Dragonborn';
      case 'tiefling': return 'Tiefling';
      case 'orc': return 'Half-Orc'; // For name generation, 2024 Orcs can use Half-Orc names
      default: return 'Human'; // Fallback for 2024 new species
    }
  } else {
    // 2014 logic (original mapping)
    const parenIndex = speciesSlug.indexOf(' (');
    const nameWithoutVariant = parenIndex > 0 ? speciesSlug.substring(0, parenIndex) : speciesSlug;

    if (nameWithoutVariant.includes('Elf')) return 'Elf';
    if (nameWithoutVariant === 'Hobgoblin' || nameWithoutVariant === 'Goblin') return 'Half-Orc';
    if (nameWithoutVariant === 'Aasimar' || nameWithoutVariant === 'Genasi') return 'Tiefling';

    return nameWithoutVariant;
  }
}

export function generateRandomName(speciesSlug: string, edition: Edition): string {
  const baseSpecies = getBaseSpecies(speciesSlug, edition);
  const firstNames = FIRST_NAMES[baseSpecies as keyof typeof FIRST_NAMES] || FIRST_NAMES.default;
  const lastNames = LAST_NAMES[baseSpecies as keyof typeof LAST_NAMES] || LAST_NAMES.default;

  const firstName = randomItem(firstNames);
  const lastName = randomItem(lastNames);

  // Some species don't use last names
  if (baseSpecies === 'Tiefling' || baseSpecies === 'Half-Orc') {
    return firstName;
  }

  return lastName ? `${firstName} ${lastName}` : firstName;
}

export function generateRandomPersonality(): string {
  return randomItem(PERSONALITY_TRAITS);
}

export function generateRandomIdeal(): string {
  return randomItem(IDEALS);
}

export function generateRandomBond(): string {
  return randomItem(BONDS);
}

export function generateRandomFlaw(): string {
  return randomItem(FLAWS);
}

// Generate all character details at once
export function generateAllCharacterDetails(speciesSlug: string, edition: Edition) {
  return {
    name: generateRandomName(speciesSlug, edition),
    personality: generateRandomPersonality(),
    ideals: generateRandomIdeal(),
    bonds: generateRandomBond(),
    flaws: generateRandomFlaw()
  };
}
