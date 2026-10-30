import type { AbilityName } from '../../../types/dnd';

/**
 * Authored 2024 level-1 "recommended picks", one per class.
 *
 * A kit chooses the origin (species, background and its +2/+1) and explains
 * why. The recommendation service still resolves skills, spells, equipment and
 * masteries; a legality test runs every kit through `evaluateDraft`.
 */
/* Artificer has no kit: the evaluator blocks it until its source is verified. */
export interface StarterKit {
  classSlug: string;
  speciesSlug: string;
  /** Background slug; the +2/+1 must come from its listed abilities. */
  backgroundSlug: string;
  bonuses: Partial<Record<AbilityName, number>>;
  /** One line per pick, shown beside it so the player learns why. */
  why: { origin: string; abilities: string };
}

export const STARTER_KITS_2024: readonly StarterKit[] = [
  {
    classSlug: 'barbarian',
    speciesSlug: 'human-2024',
    backgroundSlug: 'soldier-2024',
    bonuses: { STR: 2, CON: 1 },
    why: {
      origin: 'Soldier training suits a front-line brawler.',
      abilities: 'Strength hits hard; Constitution keeps you standing.',
    },
  },
  {
    classSlug: 'bard',
    speciesSlug: 'human-2024',
    backgroundSlug: 'entertainer-2024',
    bonuses: { CHA: 2, DEX: 1 },
    why: {
      origin: 'Entertainer fits a performer and their stagecraft.',
      abilities: 'Charisma powers spells and Bardic Inspiration; Dexterity helps AC.',
    },
  },
  {
    classSlug: 'cleric',
    speciesSlug: 'human-2024',
    backgroundSlug: 'acolyte-2024',
    bonuses: { WIS: 2, CHA: 1 },
    why: {
      origin: 'Acolyte matches a life of service to a god.',
      abilities: 'Wisdom drives divine spells and saves.',
    },
  },
  {
    classSlug: 'druid',
    speciesSlug: 'human-2024',
    backgroundSlug: 'hermit-2024',
    bonuses: { WIS: 2, CON: 1 },
    why: {
      origin: 'Hermit suits someone raised apart, close to nature.',
      abilities: 'Wisdom drives primal spells; Constitution protects concentration.',
    },
  },
  {
    classSlug: 'fighter',
    speciesSlug: 'human-2024',
    backgroundSlug: 'soldier-2024',
    bonuses: { STR: 2, CON: 1 },
    why: {
      origin: 'Soldier is the classic fit for a trained fighter.',
      abilities: 'Strength for weapon attacks, Constitution for hit points.',
    },
  },
  {
    classSlug: 'monk',
    speciesSlug: 'human-2024',
    backgroundSlug: 'wayfarer-2024',
    bonuses: { DEX: 2, WIS: 1 },
    why: {
      origin: 'Wayfarer fits a traveler who trained on the road.',
      abilities: 'Dexterity and Wisdom raise both attacks and AC.',
    },
  },
  {
    classSlug: 'paladin',
    speciesSlug: 'human-2024',
    backgroundSlug: 'noble-2024',
    bonuses: { STR: 2, CHA: 1 },
    why: {
      origin: 'Noble suits an oath-sworn knight with a name to uphold.',
      abilities: 'Strength for the sword, Charisma for auras and smites.',
    },
  },
  {
    classSlug: 'ranger',
    speciesSlug: 'elf-2024',
    backgroundSlug: 'outlander-2024',
    bonuses: { WIS: 2, CON: 1 },
    why: {
      origin: 'Outlander fits a scout who knows the wilds.',
      abilities: 'Wisdom drives ranger spells and Perception.',
    },
  },
  {
    classSlug: 'rogue',
    speciesSlug: 'human-2024',
    backgroundSlug: 'criminal-2024',
    bonuses: { DEX: 2, CON: 1 },
    why: {
      origin: 'Criminal supports stealth and the shady skills.',
      abilities: 'Dexterity powers attacks, AC and Stealth.',
    },
  },
  {
    classSlug: 'sorcerer',
    speciesSlug: 'human-2024',
    backgroundSlug: 'charlatan-2024',
    bonuses: { CHA: 2, CON: 1 },
    why: {
      origin: 'Charlatan suits a caster who bluffs and charms.',
      abilities: 'Charisma is your spellcasting ability.',
    },
  },
  {
    classSlug: 'warlock',
    speciesSlug: 'human-2024',
    backgroundSlug: 'charlatan-2024',
    bonuses: { CHA: 2, DEX: 1 },
    why: {
      origin: 'Charlatan fits someone who struck a bargain.',
      abilities: 'Charisma drives Eldritch Blast; Dexterity helps AC.',
    },
  },
  {
    classSlug: 'wizard',
    speciesSlug: 'human-2024',
    backgroundSlug: 'sage-2024',
    bonuses: { INT: 2, CON: 1 },
    why: {
      origin: 'Sage matches a scholar of the arcane.',
      abilities: 'Intelligence powers spells; Constitution keeps you alive.',
    },
  },
];

export function starterKitFor(classSlug: string): StarterKit | undefined {
  return STARTER_KITS_2024.find((kit) => kit.classSlug === classSlug);
}
