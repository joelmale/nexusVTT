import { Character, SpellLearningRules } from '../types/dnd';
import { SPELL_SLOT_TABLES } from '../data/spellSlots';
import { SPELL_LEARNING_RULES } from '../data/spellLearning';
import { getCantripsByClass, getLeveledSpellsByClass, AppSpell } from '../services/dataService';
import { calculateSpellSaveDC, calculateSpellAttackBonus } from './spellUtils';

function getSpellcastingAbility(classSlug: string): 'INT' | 'WIS' | 'CHA' {
  const abilityMap: Record<string, 'INT' | 'WIS' | 'CHA'> = {
    wizard: 'INT',
    sorcerer: 'CHA',
    bard: 'CHA',
    warlock: 'CHA',
    cleric: 'WIS',
    druid: 'WIS',
    paladin: 'CHA',
    ranger: 'WIS',
    artificer: 'INT',
  };
  return abilityMap[classSlug] || 'INT';
}

export function initializeSpellcasting(
  characterClass: string,
  level: number,
  abilities: Record<string, number>
): Character['spellcasting'] | undefined {

  const slotRules = SPELL_SLOT_TABLES[characterClass];
  if (!slotRules || slotRules.type === 'none') return undefined;

  const learningRules = SPELL_LEARNING_RULES[characterClass];

  // Get correct spell slots for level
  const spellSlots = slotRules.byLevel?.[level] || [0];

  // Initialize based on learning type
  switch (learningRules.type) {
    case 'prepared':
      return createPreparedCaster(characterClass, level, spellSlots, abilities);
    case 'known':
      return createKnownCaster(characterClass, level, spellSlots, abilities, learningRules);
    case 'spellbook':
      return createSpellbookCaster(characterClass, level, spellSlots, abilities);
    default:
      return undefined;
  }
}

function createPreparedCaster(
  classSlug: string,
  level: number,
  spellSlots: number[],
  abilities: Record<string, number>
): Character['spellcasting'] {

  const cantrips = getCantripsByClass(classSlug).map((s: AppSpell) => s.slug);
  const availableSpells = getLeveledSpellsByClass(classSlug, level).map((s: AppSpell) => s.slug);
  const ability = getSpellcastingAbility(classSlug);

  return {
    ability,
    spellcastingType: 'prepared',
    cantripsKnown: cantrips,
    spellsKnown: availableSpells,
    preparedSpells: [],
    spellSlots,
    usedSpellSlots: new Array(spellSlots.length).fill(0),
    spellSaveDC: calculateSpellSaveDC(abilities, ability),
    spellAttackBonus: calculateSpellAttackBonus(abilities, ability),
    cantripChoicesByLevel: {},
  };
}

function createKnownCaster(
  classSlug: string,
  level: number,
  spellSlots: number[],
  abilities: Record<string, number>,
  learningRules: SpellLearningRules
): Character['spellcasting'] {

  const cantrips = getCantripsByClass(classSlug).map((s: AppSpell) => s.slug);
  const spellsKnownLimit = learningRules.spellsKnown?.[level - 1] || 0;
  const availableSpells = getLeveledSpellsByClass(classSlug, level).slice(0, spellsKnownLimit).map((s: AppSpell) => s.slug);
  const ability = getSpellcastingAbility(classSlug);

  return {
    ability,
    spellcastingType: 'known',
    cantripsKnown: cantrips,
    spellsKnown: availableSpells,
    spellSlots,
    usedSpellSlots: new Array(spellSlots.length).fill(0),
    spellSaveDC: calculateSpellSaveDC(abilities, ability),
    spellAttackBonus: calculateSpellAttackBonus(abilities, ability),
    cantripChoicesByLevel: {},
  };
}

function createSpellbookCaster(
  classSlug: string,
  _level: number,
  spellSlots: number[],
  abilities: Record<string, number>
): Character['spellcasting'] {

  const cantrips = getCantripsByClass(classSlug).map((s: AppSpell) => s.slug);
  const ability = getSpellcastingAbility(classSlug);

  return {
    ability,
    spellcastingType: 'wizard',
    cantripsKnown: cantrips,
    spellbook: [],
    preparedSpells: [],
    spellSlots,
    usedSpellSlots: new Array(spellSlots.length).fill(0),
    spellSaveDC: calculateSpellSaveDC(abilities, ability),
    spellAttackBonus: calculateSpellAttackBonus(abilities, ability),
    cantripChoicesByLevel: {},
  };
}

export function updateSpellcastingOnLevelUp(
  character: Character,
  newLevel: number
): Character['spellcasting'] | undefined {

  if (!character.spellcasting) return undefined;

  const classSlug = character.class.toLowerCase();
  const slotRules = SPELL_SLOT_TABLES[classSlug];
  const learningRules = SPELL_LEARNING_RULES[classSlug];

  // Update spell slots
  const newSpellSlots = slotRules.byLevel?.[newLevel] || character.spellcasting.spellSlots;

  // Update cantrips known
  const newCantrips = getCantripsByClass(classSlug).map((s: AppSpell) => s.slug);

  // Update spell access based on type
  let spellUpdates = {};
  switch (learningRules.type) {
    case 'prepared': {
      const availableSpells = getLeveledSpellsByClass(classSlug, newLevel).map((s: AppSpell) => s.slug);
      spellUpdates = { spellsKnown: availableSpells };
      break;
    }
    case 'known': {
      const spellsKnownLimit = learningRules.spellsKnown?.[newLevel - 1] || character.spellcasting.spellsKnown?.length || 0;
      const knownSpells = getLeveledSpellsByClass(classSlug, newLevel).slice(0, spellsKnownLimit).map((s: AppSpell) => s.slug);
      spellUpdates = { spellsKnown: knownSpells };
      break;
    }
    case 'spellbook':
      // Spellbook casters keep their existing spells
      break;
  }

  return {
    ...character.spellcasting,
    spellSlots: newSpellSlots,
    cantripsKnown: newCantrips,
    usedSpellSlots: new Array(newSpellSlots.length).fill(0),
    ...spellUpdates,
  };
}