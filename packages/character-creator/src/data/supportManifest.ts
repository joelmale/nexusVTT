/**
 * CC-304: Support Manifest & Certification Matrix
 *
 * Explicitly records and certifies the supported classes, editions,
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

export const CERTIFIED_SUPPORT_MANIFEST: ClassSupportCertification[] = [
  {
    classSlug: 'fighter',
    name: 'Fighter',
    editions: ['2014', '2024'],
    level1Certified: true,
    spellcaster: false,
    recommendationSupported: true,
    subclassLevels: [3],
    notes: 'Certified for Defense/Archery styles, Second Wind tracking, and 2024 weapon masteries.',
  },
  {
    classSlug: 'rogue',
    name: 'Rogue',
    editions: ['2014', '2024'],
    level1Certified: true,
    spellcaster: false,
    recommendationSupported: true,
    subclassLevels: [3],
    notes: 'Certified for Sneak Attack, Thieves Cant, and dual Expertise allocations.',
  },
  {
    classSlug: 'wizard',
    name: 'Wizard',
    editions: ['2014', '2024'],
    level1Certified: true,
    spellcaster: true,
    recommendationSupported: true,
    subclassLevels: [2, 3], // 2014 subclass at level 2, 2024 at level 3
    notes: 'Certified for spellbook initialization (6 spells) and level 1 preparation.',
  },
  {
    classSlug: 'cleric',
    name: 'Cleric',
    editions: ['2014', '2024'],
    level1Certified: true,
    spellcaster: true,
    recommendationSupported: true,
    subclassLevels: [1, 3], // 2014 domain at level 1, 2024 at level 3
    notes: 'Certified for prepared divine list, holy symbol focus, and channel divinity scaling.',
  },
  {
    classSlug: 'paladin',
    name: 'Paladin',
    editions: ['2014', '2024'],
    level1Certified: true,
    spellcaster: false, // spellcasting begins at level 2 in 2014, level 1 in 2024
    recommendationSupported: true,
    subclassLevels: [3],
    notes: 'Certified for Lay on Hands pool and armor/weapon proficiencies.',
  },
  {
    classSlug: 'ranger',
    name: 'Ranger',
    editions: ['2014', '2024'],
    level1Certified: true,
    spellcaster: false, // spellcasting begins at level 2
    recommendationSupported: true,
    subclassLevels: [3],
    notes: 'Certified for wilderness proficiencies and ranged combat packages.',
  },
  {
    classSlug: 'barbarian',
    name: 'Barbarian',
    editions: ['2014', '2024'],
    level1Certified: true,
    spellcaster: false,
    recommendationSupported: true,
    subclassLevels: [3],
    notes: 'Certified for Unarmored Defense (10 + DEX + CON) and Rage tracking.',
  },
  {
    classSlug: 'bard',
    name: 'Bard',
    editions: ['2014', '2024'],
    level1Certified: true,
    spellcaster: true,
    recommendationSupported: true,
    subclassLevels: [3],
    notes: 'Certified for Bardic Inspiration (d6) and musical instrument proficiencies.',
  },
  {
    classSlug: 'druid',
    name: 'Druid',
    editions: ['2014', '2024'],
    level1Certified: true,
    spellcaster: true,
    recommendationSupported: true,
    subclassLevels: [2, 3],
    notes: 'Certified for primal preparation, druidic language, and herbalism tools.',
  },
  {
    classSlug: 'monk',
    name: 'Monk',
    editions: ['2014', '2024'],
    level1Certified: true,
    spellcaster: false,
    recommendationSupported: true,
    subclassLevels: [3],
    notes: 'Certified for Unarmored Defense (10 + DEX + WIS) and Martial Arts (d4).',
  },
  {
    classSlug: 'sorcerer',
    name: 'Sorcerer',
    editions: ['2014', '2024'],
    level1Certified: true,
    spellcaster: true,
    recommendationSupported: true,
    subclassLevels: [1, 3],
    notes: 'Certified for known spells ledger (2 spells at L1, 4 cantrips) and arcane focus.',
  },
  {
    classSlug: 'warlock',
    name: 'Warlock',
    editions: ['2014', '2024'],
    level1Certified: true,
    spellcaster: true,
    recommendationSupported: true,
    subclassLevels: [1, 3],
    notes: 'Certified for Pact Magic (1 slot at L1) and Eldritch Blast availability.',
  },
];
