import { Character } from '../types/dnd';
import { getModifier } from '../services/dataService';
import { getSpellcastingType } from '../utils/spellUtils';
import { SPELL_SLOTS_BY_CLASS } from '../data/spellSlots';

// Define the simplified spellcasting type from the form
interface FormSpellcasting {
  ability: 'INT' | 'WIS' | 'CHA';
  cantripsKnown: string[];
  spellsKnown: string[];
}

// Define simplified character data for form processing
interface FormCharacterData {
  class: string;
  level: number;
  abilities: { STR: number; DEX: number; CON: number; INT: number; WIS: number; CHA: number };
  proficiencyBonus: number;
}

/**
 * Builds complete spellcasting data from simplified form data
 * Used when saving character edits to ensure all required Character properties are present
 */
export function buildCompleteSpellcasting(
  formSpellcasting: FormSpellcasting | undefined,
  characterData: FormCharacterData
): Character['spellcasting'] | undefined {
  if (!formSpellcasting || !characterData.class || !characterData.level) {
    return undefined;
  }

  const spellcastingType = getSpellcastingType(characterData.class);
  if (!spellcastingType) {
    return undefined;
  }

  // Get ability score for spellcasting calculations
  const abilityScore = characterData.abilities[formSpellcasting.ability];

  const abilityModifier = getModifier(abilityScore);
  const proficiencyBonus = characterData.proficiencyBonus || 2; // Default to level 1

  // Calculate spell slots based on class and level
  const classSpellSlots = SPELL_SLOTS_BY_CLASS[characterData.class]?.[characterData.level] || [0];
  const spellSlots = [...classSpellSlots]; // Copy the array
  const usedSpellSlots = new Array(spellSlots.length).fill(0);

  // Build the complete spellcasting object
  const completeSpellcasting: Character['spellcasting'] = {
    ability: formSpellcasting.ability,
    spellSaveDC: 8 + proficiencyBonus + abilityModifier,
    spellAttackBonus: proficiencyBonus + abilityModifier,
    cantripsKnown: formSpellcasting.cantripsKnown || [],
    spellSlots,
    usedSpellSlots,
    spellcastingType,
    cantripChoicesByLevel: {},
  };

  // Add type-specific properties
  if (spellcastingType === 'known') {
    completeSpellcasting.spellsKnown = formSpellcasting.spellsKnown || [];
  } else if (spellcastingType === 'prepared') {
    completeSpellcasting.preparedSpells = formSpellcasting.spellsKnown || [];
  } else if (spellcastingType === 'wizard') {
    completeSpellcasting.spellbook = formSpellcasting.spellsKnown || [];
  }

  return completeSpellcasting;
}