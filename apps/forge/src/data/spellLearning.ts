import { SpellLearningRules } from '../types/dnd';

// Spell Learning Rules by Class
export const SPELL_LEARNING_RULES: Record<string, SpellLearningRules> = {
  wizard: {
    type: 'spellbook',
    spellbookCapacity: [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44],
  },
  cleric: {
    type: 'prepared',
    spellsPrepared: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    domainSpells: [], // Populated by domain selection
  },
  druid: {
    type: 'prepared',
    spellsPrepared: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    circleSpells: [], // Populated by circle selection
  },
  paladin: {
    type: 'prepared',
    spellsPrepared: [0, 2, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  },
  ranger: {
    type: 'known',
    spellsKnown: [0, 2, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  },
  artificer: {
    type: 'prepared',
    spellsPrepared: [0, 2, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  },
  sorcerer: {
    type: 'known',
    spellsKnown: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
  },
  bard: {
    type: 'known',
    spellsKnown: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
    magicalSecrets: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 4, 4, 4, 4, 6, 6],
  },
  warlock: {
    type: 'known',
    spellsKnown: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
    invocationsKnown: [0, 2, 2, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8],
  },
  barbarian: {
    type: 'none',
  },
  fighter: {
    type: 'none',
  },
  monk: {
    type: 'none',
  },
  rogue: {
    type: 'none',
  },
};