import type { CharacterCreationData } from '../types/dnd';

export interface InvocationDefinition {
  id: string;
  name: string;
  level: number;
  spell?: string;
  requires?: string;
  choice?:
    'damage-cantrip' | 'ranged-cantrip' | 'attack-cantrip' | 'origin-feat';
}

/** SRD 5.2.1 pp71–74. Counts are Warlock class levels, not total levels. */
const COUNTS_2024 = [
  1, 3, 3, 3, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10,
];

export function invocationCount(level: number): number {
  return Number.isInteger(level) && level >= 1 && level <= 20
    ? COUNTS_2024[level - 1]
    : 0;
}

/** Repeatable invocations store their distinct targets in the existing durable choice map. */
export function invocationTargets(
  data: Pick<CharacterCreationData, 'featChoices'>,
  id: string,
): string[] {
  const targets = data.featChoices?.[`invocation:${id}`]?.targets;
  return Array.isArray(targets) ? targets : [];
}

export function invocationFeatGrants(data: CharacterCreationData): string[] {
  return data.edition === '2024' &&
    data.classSlug === 'warlock' &&
    data.eldritchInvocations?.includes('lessons-of-the-first-ones')
    ? invocationTargets(data, 'lessons-of-the-first-ones')
    : [];
}

/** Stable per-instance keys retain separate choices for repeatable Skilled grants. */
export const isSkilledLesson = (id: string): boolean =>
  /^skilled:lesson-(?:[1-9]|10)$/.test(id);
export const lessonFeatSlug = (id: string): string =>
  isSkilledLesson(id) ? 'skilled' : id;

export function selectedInvocationCount(data: CharacterCreationData): number {
  return (data.eldritchInvocations ?? []).reduce((count, id) => {
    const invocation = INVOCATIONS_2024.find((entry) => entry.id === id);
    return (
      count +
      (invocation?.choice ? Math.max(1, invocationTargets(data, id).length) : 1)
    );
  }, 0);
}

/** The complete SRD catalog; legacy selections remain in the 2014 path. */
export const INVOCATIONS_2024: readonly InvocationDefinition[] = [
  {
    id: 'agonizing-blast',
    name: 'Agonizing Blast',
    level: 2,
    choice: 'damage-cantrip',
  },
  {
    id: 'armor-of-shadows',
    name: 'Armor of Shadows',
    level: 1,
    spell: 'mage-armor',
  },
  { id: 'eldritch-mind', name: 'Eldritch Mind', level: 1 },
  { id: 'ascendant-step', name: 'Ascendant Step', level: 5, spell: 'levitate' },
  { id: 'devils-sight', name: 'Devil’s Sight', level: 2 },
  {
    id: 'devouring-blade',
    name: 'Devouring Blade',
    level: 12,
    requires: 'thirsting-blade',
  },
  {
    id: 'eldritch-smite',
    name: 'Eldritch Smite',
    level: 5,
    requires: 'pact-of-the-blade',
  },
  {
    id: 'eldritch-spear',
    name: 'Eldritch Spear',
    level: 2,
    choice: 'ranged-cantrip',
  },
  { id: 'gaze-of-two-minds', name: 'Gaze of Two Minds', level: 5 },
  { id: 'gift-of-the-depths', name: 'Gift of the Depths', level: 5 },
  {
    id: 'gift-of-the-protectors',
    name: 'Gift of the Protectors',
    level: 9,
    requires: 'pact-of-the-tome',
  },
  {
    id: 'investment-of-the-chain-master',
    name: 'Investment of the Chain Master',
    level: 5,
    requires: 'pact-of-the-chain',
  },
  {
    id: 'lessons-of-the-first-ones',
    name: 'Lessons of the First Ones',
    level: 2,
    choice: 'origin-feat',
  },
  {
    id: 'lifedrinker',
    name: 'Lifedrinker',
    level: 9,
    requires: 'pact-of-the-blade',
  },
  {
    id: 'master-of-myriad-forms',
    name: 'Master of Myriad Forms',
    level: 5,
    spell: 'alter-self',
  },
  { id: 'one-with-shadows', name: 'One with Shadows', level: 5 },
  {
    id: 'otherworldly-leap',
    name: 'Otherworldly Leap',
    level: 2,
    spell: 'jump',
  },
  {
    id: 'repelling-blast',
    name: 'Repelling Blast',
    level: 2,
    choice: 'attack-cantrip',
  },
  {
    id: 'thirsting-blade',
    name: 'Thirsting Blade',
    level: 5,
    requires: 'pact-of-the-blade',
  },
  {
    id: 'visions-of-distant-realms',
    name: 'Visions of Distant Realms',
    level: 9,
    spell: 'arcane-eye',
  },
  {
    id: 'whispers-of-the-grave',
    name: 'Whispers of the Grave',
    level: 7,
    spell: 'speak-with-dead',
  },
  { id: 'witch-sight', name: 'Witch Sight', level: 15 },
  { id: 'pact-of-the-blade', name: 'Pact of the Blade', level: 1 },
  {
    id: 'pact-of-the-chain',
    name: 'Pact of the Chain',
    level: 1,
    spell: 'find-familiar',
  },
  { id: 'pact-of-the-tome', name: 'Pact of the Tome', level: 1 },
  {
    id: 'fiendish-vigor',
    name: 'Fiendish Vigor',
    level: 2,
    spell: 'false-life',
  },
  {
    id: 'misty-visions',
    name: 'Misty Visions',
    level: 2,
    spell: 'silent-image',
  },
  {
    id: 'mask-of-many-faces',
    name: 'Mask of Many Faces',
    level: 2,
    spell: 'disguise-self',
  },
];
