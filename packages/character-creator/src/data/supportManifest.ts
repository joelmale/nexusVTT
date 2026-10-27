/**
 * CC-304: Support Manifest & Certification Matrix
 *
 * Tracks the implemented classes, editions,
 * grants, and recommendations. Uncertified features remain explicitly tracked.
 */

import type { Edition } from '../types/dnd';

export interface ClassSupportCertification {
  classSlug: string;
  name: string;
  editions: Edition[];
  level1Certified: boolean;
  spellcaster: boolean;
  recommendationSupported: boolean;
  subclassLevels: number[];
  notes?: string;
}

export interface ClassSupportScope {
  classSlug: string;
  edition: Edition;
  sourceStatus: 'verified-core' | 'unverified-supplemental';
  creation: 'implemented-awaiting-acceptance' | 'blocked-unverified-source';
  laterLevelCreation:
    'implemented-awaiting-acceptance' | 'blocked-unverified-source';
  levelUp: 'implemented-awaiting-acceptance' | 'unverified';
  editing: 'preservation-awaiting-acceptance';
  importedPreservation: 'awaiting-acceptance';
  certified: false;
}

/** Capabilities and certification are deliberately separate dimensions. */
export function getClassSupportScopes(): ClassSupportScope[] {
  return CERTIFIED_SUPPORT_MANIFEST.flatMap((entry) =>
    entry.editions.map((edition) => ({
      classSlug: entry.classSlug,
      edition,
      sourceStatus:
        entry.classSlug === 'artificer'
          ? ('unverified-supplemental' as const)
          : ('verified-core' as const),
      creation:
        entry.classSlug === 'artificer'
          ? ('blocked-unverified-source' as const)
          : ('implemented-awaiting-acceptance' as const),
      laterLevelCreation:
        entry.classSlug === 'artificer'
          ? ('blocked-unverified-source' as const)
          : ('implemented-awaiting-acceptance' as const),
      levelUp:
        entry.classSlug === 'artificer'
          ? ('unverified' as const)
          : ('implemented-awaiting-acceptance' as const),
      editing: 'preservation-awaiting-acceptance' as const,
      importedPreservation: 'awaiting-acceptance' as const,
      certified: false as const,
    })),
  );
}

export const CERTIFIED_SUPPORT_MANIFEST: ClassSupportCertification[] = [
  {
    classSlug: 'artificer',
    name: 'Artificer',
    editions: ['2014', '2024'],
    level1Certified: false,
    spellcaster: true,
    recommendationSupported: false,
    subclassLevels: [3],
    notes:
      "User authorized broad Artificer support. Recommended foundations: Tasha's Cauldron of Everything for legacy, Eberron: Forge of the Artificer for revised. Merge compatible options with source provenance; never stack replacement features or combine progression tables. Existing catalog mechanics await verification against those foundations; imports remain preserved.",
  },
  {
    classSlug: 'fighter',
    name: 'Fighter',
    editions: ['2014', '2024'],
    level1Certified: false,
    spellcaster: false,
    recommendationSupported: true,
    subclassLevels: [3],
    notes:
      'Implemented paths awaiting independent and host verification: Defense/Archery styles, Second Wind tracking, and 2024 weapon masteries.',
  },
  {
    classSlug: 'rogue',
    name: 'Rogue',
    editions: ['2014', '2024'],
    level1Certified: false,
    spellcaster: false,
    recommendationSupported: true,
    subclassLevels: [3],
    notes:
      'Implemented paths awaiting independent and host verification: Sneak Attack, Thieves Cant, and dual Expertise allocations.',
  },
  {
    classSlug: 'wizard',
    name: 'Wizard',
    editions: ['2014', '2024'],
    level1Certified: false,
    spellcaster: true,
    recommendationSupported: true,
    subclassLevels: [2, 3], // 2014 subclass at level 2, 2024 at level 3
    notes:
      'Implemented paths awaiting independent and host verification: spellbook initialization (6 spells) and level 1 preparation.',
  },
  {
    classSlug: 'cleric',
    name: 'Cleric',
    editions: ['2014', '2024'],
    level1Certified: false,
    spellcaster: true,
    recommendationSupported: true,
    subclassLevels: [1, 3], // 2014 domain at level 1, 2024 at level 3
    notes:
      'Implemented paths awaiting independent and host verification: prepared divine list, holy symbol focus, and channel divinity scaling.',
  },
  {
    classSlug: 'paladin',
    name: 'Paladin',
    editions: ['2014', '2024'],
    level1Certified: false,
    spellcaster: true, // Begins at level 2 in 2014, level 1 in 2024.
    recommendationSupported: true,
    subclassLevels: [3],
    notes:
      'Implemented paths awaiting independent and host verification: Lay on Hands pool and armor/weapon proficiencies.',
  },
  {
    classSlug: 'ranger',
    name: 'Ranger',
    editions: ['2014', '2024'],
    level1Certified: false,
    spellcaster: true, // Begins at level 2 in 2014, level 1 in 2024.
    recommendationSupported: true,
    subclassLevels: [3],
    notes:
      'Implemented paths awaiting independent and host verification: wilderness proficiencies and ranged combat packages.',
  },
  {
    classSlug: 'barbarian',
    name: 'Barbarian',
    editions: ['2014', '2024'],
    level1Certified: false,
    spellcaster: false,
    recommendationSupported: true,
    subclassLevels: [3],
    notes:
      'Implemented paths awaiting independent and host verification: Unarmored Defense (10 + DEX + CON) and Rage tracking.',
  },
  {
    classSlug: 'bard',
    name: 'Bard',
    editions: ['2014', '2024'],
    level1Certified: false,
    spellcaster: true,
    recommendationSupported: true,
    subclassLevels: [3],
    notes:
      'Implemented paths awaiting independent and host verification: Bardic Inspiration (d6) and musical instrument proficiencies.',
  },
  {
    classSlug: 'druid',
    name: 'Druid',
    editions: ['2014', '2024'],
    level1Certified: false,
    spellcaster: true,
    recommendationSupported: true,
    subclassLevels: [2, 3],
    notes:
      'Implemented paths awaiting independent and host verification: primal preparation, druidic language, and herbalism tools.',
  },
  {
    classSlug: 'monk',
    name: 'Monk',
    editions: ['2014', '2024'],
    level1Certified: false,
    spellcaster: false,
    recommendationSupported: true,
    subclassLevels: [3],
    notes:
      'Implemented paths awaiting independent and host verification: Unarmored Defense (10 + DEX + WIS) and Martial Arts (d4).',
  },
  {
    classSlug: 'sorcerer',
    name: 'Sorcerer',
    editions: ['2014', '2024'],
    level1Certified: false,
    spellcaster: true,
    recommendationSupported: true,
    subclassLevels: [1, 3],
    notes:
      'Implemented paths awaiting independent and host verification: known spells ledger (2 spells at L1, 4 cantrips) and arcane focus.',
  },
  {
    classSlug: 'warlock',
    name: 'Warlock',
    editions: ['2014', '2024'],
    level1Certified: false,
    spellcaster: true,
    recommendationSupported: true,
    subclassLevels: [1, 3],
    notes:
      'Implemented paths awaiting independent and host verification: Pact Magic (1 slot at L1) and Eldritch Blast availability.',
  },
];

/** Edition-specific subclass entry; certification is tracked separately. */
export function getSubclassLevel(classSlug: string, edition: Edition): number {
  const levels = CERTIFIED_SUPPORT_MANIFEST.find(
    (entry) => entry.classSlug === classSlug,
  )?.subclassLevels;
  return (edition === '2014' ? levels?.[0] : levels?.[levels.length - 1]) ?? 3;
}
