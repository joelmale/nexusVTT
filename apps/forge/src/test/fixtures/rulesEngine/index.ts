/**
 * Snapshot test fixtures for rules engine testing
 * These represent diverse character configurations to test against
 */

import type { Character } from '../../../types/dnd';

import level1Fighter2014 from './level1Fighter2014.json';
import level3Wizard2014 from './level3Wizard2014.json';
import level5Cleric2024 from './level5Cleric2024.json';
import level8Rogue2014 from './level8Rogue2014.json';
import level12BardFighter2024 from './level12BardFighter2024.json';
import level20Paladin2014 from './level20Paladin2014.json';

/**
 * Snapshot character fixtures
 */
export const snapshotCharacters: Character[] = [
  level1Fighter2014 as Character,
  level3Wizard2014 as Character,
  level5Cleric2024 as Character,
  level8Rogue2014 as Character,
  level12BardFighter2024 as Character,
  level20Paladin2014 as Character,
];

/**
 * Individual character exports for targeted testing
 */
export {
  level1Fighter2014,
  level3Wizard2014,
  level5Cleric2024,
  level8Rogue2014,
  level12BardFighter2024,
  level20Paladin2014,
};

/**
 * Character descriptions for test output
 */
export const snapshotDescriptions: Record<string, string> = {
  'test-fighter-1': 'Level 1 Fighter (2014) - Human, basic equipment',
  'test-wizard-3': 'Level 3 Wizard (2014) - Gnome, spell slots, spellbook',
  'test-cleric-5': 'Level 5 Cleric (2024) - Divine Order Thaumaturge, Life Domain',
  'test-rogue-8': 'Level 8 Rogue (2014) - Expertise, Sneak Attack, ASI',
  'test-bard-12': 'Level 12 Bard/Fighter (2024) - Known spells, multiclass',
  'test-paladin-20': 'Level 20 Paladin (2014) - Full progression, all features',
};
