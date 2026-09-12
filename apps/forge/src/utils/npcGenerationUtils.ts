import nameData from '../data/nameData.json';
import backgrounds from '../data/backgrounds.json';
import characterTraits from '../data/characterTraits.json';
import alignments from '../data/alignments.json';
import enhancedSpeciesData from '../data/enhancedSpeciesData.json';
import { NPC } from '../types/dnd';

// Utility function to get random item from array
function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// Generate random name based on species
export function generateRandomName(speciesSlug: string): string {
  const speciesData = nameData.species[speciesSlug as keyof typeof nameData.species];
  if (!speciesData || typeof speciesData === 'string' || Array.isArray(speciesData)) {
    // Fallback to generic fantasy names
    const firstParts = ['Aer', 'Bel', 'Cor', 'Dar', 'Eld', 'Fal', 'Gor', 'Hal'];
    const secondParts = ['ic', 'en', 'or', 'in', 'ar', 'us', 'on', 'el'];
    return getRandomItem(firstParts) + getRandomItem(secondParts);
  }

  // Get male or female names randomly
  const useMale = Math.random() > 0.5;
  const firstNames = useMale ? speciesData.male : speciesData.female;
  const firstName = getRandomItem(firstNames);

  // Add surname if available
  const surnames = speciesData.surnames || [];
  const surname = surnames.length > 0 ? ` ${getRandomItem(surnames)}` : '';

  return `${firstName}${surname}`;
}

// Generate random occupation from backgrounds
export function generateRandomOccupation(): string {
  const backgroundNames = Object.keys(backgrounds);
  return getRandomItem(backgroundNames);
}

// Generate random personality traits
export function generateRandomPersonalityTraits(count: number = 2): string[] {
  const allPersonalities = characterTraits.personalities || [];
  const traits: string[] = [];

  for (let i = 0; i < count; i++) {
    let trait: string;
    do {
      trait = getRandomItem(allPersonalities);
    } while (traits.includes(trait)); // Avoid duplicates
    traits.push(trait);
  }

  return traits;
}

// Generate random ability scores (standard array distribution)
export function generateRandomAbilityScores(): Record<string, number> {
  // Standard array: 15, 14, 13, 12, 10, 8
  const scores = [15, 14, 13, 12, 10, 8];
  const abilities = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

  // Shuffle the scores
  for (let i = scores.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [scores[i], scores[j]] = [scores[j], scores[i]];
  }

  // Assign to abilities
  const abilityScores: Record<string, number> = {};
  abilities.forEach((ability, index) => {
    abilityScores[ability] = scores[index];
  });

  return abilityScores;
}

// Generate random alignment
export function generateRandomAlignment(): string {
  const alignmentKeys = Object.keys(alignments);
  return getRandomItem(alignmentKeys);
}

// Generate random species
export function generateRandomSpecies(): string {
  const speciesKeys = Object.keys(enhancedSpeciesData);
  return getRandomItem(speciesKeys);
}

// Generate random relationship status
export function generateRandomRelationshipStatus(): string {
  const statuses = [
    'Single',
    'Married',
    'Widowed',
    'Divorced',
    'In a relationship',
    'Engaged',
    'Recently divorced',
    'Long-term partnership'
  ];
  return getRandomItem(statuses);
}

// Generate random sexual orientation
export function generateRandomSexualOrientation(): string {
  const orientations = [
    'Heterosexual',
    'Homosexual',
    'Bisexual',
    'Asexual',
    'Pansexual',
    'Questioning'
  ];
  return getRandomItem(orientations);
}

// Generate random plot hook
export function generateRandomPlotHook(): string {
  const plotHooks = [
    'Owes a debt to a local crime lord',
    'Is searching for a lost family heirloom',
    'Has a mysterious tattoo that glows under moonlight',
    'Was once a member of a secret society',
    'Dreams of opening their own business',
    'Is being hunted by a rival from their past',
    'Possesses a unique magical ability they keep hidden',
    'Is writing a book about their adventures',
    'Has a collection of rare artifacts',
    'Is training to become a master of their craft',
    'Lost their home in a recent disaster',
    'Is involved in local politics',
    'Has a pet that is unusually intelligent',
    'Is searching for a cure for a family illness',
    'Once saved the life of an important noble'
  ];
  return getRandomItem(plotHooks);
}

// Generate complete random NPC
export function generateCompleteNPC(): Omit<NPC, 'id' | 'createdAt' | 'updatedAt'> {
  const species = generateRandomSpecies();
  const name = generateRandomName(species);
  const occupation = generateRandomOccupation();
  const personalityTraits = generateRandomPersonalityTraits(2);
  const abilityScores = generateRandomAbilityScores();
  const alignment = generateRandomAlignment();
  const relationshipStatus = generateRandomRelationshipStatus();
  const sexualOrientation = generateRandomSexualOrientation();
  const plotHook = generateRandomPlotHook();

  return {
    name,
    species,
    occupation,
    personalityTraits,
    abilityScores,
    alignment,
    relationshipStatus,
    sexualOrientation,
    plotHook,
    notes: '',
  };
}