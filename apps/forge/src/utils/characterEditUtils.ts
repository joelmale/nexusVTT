import {
  ABILITY_KEYS,
  STANDARD_SKILLS,
  calculateAbilityModifier,
} from '@nexus/character-contracts';
import { normalizeSkillKey } from '@nexus/character-creator/adapters/nexusCharacter';
import { SPELL_SLOTS_BY_CLASS } from '@nexus/character-creator/data/spellSlots';

import { getModifier } from '../services/dataService';
import type { AbilityName, Character, SkillName } from '../types/dnd';
import { recalculateAC } from './armorClass';
import { getSpellcastingType } from './spellUtils';

interface ExistingCharacterEdit {
  abilities: Character['abilities'];
  armorClass: number;
  hasCustomArmorClass: boolean;
  initiative: number;
  skills: Character['skills'];
  skillPreview: Map<
    string,
    { proficient: boolean; expertise: boolean; modifier: number }
  >;
  expertiseSkills: Character['expertiseSkills'];
  spellcasting: Character['spellcasting'];
}

function forgeSkillKey(name: string): SkillName {
  return (
    name === 'Sleight of Hand' ? 'SleightOfHand' : name.replace(/ /g, '')
  ) as SkillName;
}

interface ManualCharacterStats {
  abilities: Character['abilities'];
  skills: Character['skills'];
  skillPreview: ExistingCharacterEdit['skillPreview'];
  armorClass: number;
  initiative: number;
}

export function deriveManualCharacterStats(
  scores: Record<AbilityName, number>,
  proficiencyBonus: number,
  skillProficiencies: Partial<Record<string, boolean>> = {},
): ManualCharacterStats {
  const abilities = Object.fromEntries(
    ABILITY_KEYS.map((ability) => [
      ability,
      {
        score: scores[ability],
        modifier: calculateAbilityModifier(scores[ability]),
      },
    ]),
  ) as Character['abilities'];
  const skillPreview = new Map(
    STANDARD_SKILLS.map(({ name, ability }) => {
      const proficient = skillProficiencies[name] ?? false;
      const modifier =
        abilities[ability].modifier + (proficient ? proficiencyBonus : 0);
      return [name, { proficient, expertise: false, modifier }] as const;
    }),
  );
  const skills = Object.fromEntries(
    Array.from(skillPreview, ([name, { proficient, modifier }]) => [
      forgeSkillKey(name),
      { proficient, value: modifier },
    ]),
  ) as Character['skills'];

  return {
    abilities,
    skills,
    skillPreview,
    armorClass: 10 + abilities.DEX.modifier,
    initiative: abilities.DEX.modifier,
  };
}

export function deriveExistingCharacterEdit(
  character: Character,
  scores: Record<AbilityName, number>,
  skillProficiencies: Partial<Record<string, boolean>> = {},
  useEquipmentArmorClass = false,
): ExistingCharacterEdit {
  const abilities = { ...character.abilities };
  for (const ability of ABILITY_KEYS) {
    const previous = character.abilities[ability];
    const score = scores[ability];
    if (score === previous.score) continue;
    abilities[ability] = {
      ...previous,
      score,
      modifier:
        previous.modifier +
        calculateAbilityModifier(score) -
        calculateAbilityModifier(previous.score),
    };
  }

  const delta = (ability: AbilityName) =>
    abilities[ability].modifier - character.abilities[ability].modifier;
  const savedSkills = new Map(
    Object.entries(character.skills ?? {}).map(
      ([key, skill]) => [normalizeSkillKey(key), { key, skill }] as const,
    ),
  );
  const expertiseNames = new Set(
    character.expertiseSkills?.map(normalizeSkillKey),
  );
  const removedExpertise = new Set<string>();
  const skills = { ...character.skills };
  const skillPreview = new Map(
    STANDARD_SKILLS.map(({ name, ability }) => {
      const saved = savedSkills.get(name);
      const hadExpertise = Boolean(
        saved?.skill.expertise || expertiseNames.has(name),
      );
      const wasProficient = hadExpertise || Boolean(saved?.skill.proficient);
      const proficient = skillProficiencies[name] ?? wasProficient;
      const expertise = proficient && hadExpertise;
      const abilityDelta = delta(ability);
      const previousRank = hadExpertise ? 2 : Number(wasProficient);
      const nextRank = expertise ? 2 : Number(proficient);
      const previousValue =
        saved?.skill.value ??
        character.abilities[ability].modifier +
          previousRank * character.proficiencyBonus;
      const modifier =
        previousValue +
        abilityDelta +
        (nextRank - previousRank) * character.proficiencyBonus;

      if (hadExpertise && !expertise) removedExpertise.add(name);
      if (abilityDelta !== 0 || proficient !== wasProficient) {
        const key =
          (saved?.key as SkillName | undefined) ?? forgeSkillKey(name);
        skills[key] = {
          ...saved?.skill,
          value: modifier,
          proficient,
          expertise,
        };
      }
      return [name, { proficient, expertise, modifier }] as const;
    }),
  );

  const equipmentArmorClass = recalculateAC(character);
  const hasCustomArmorClass = character.armorClass !== equipmentArmorClass;
  const dexterityDelta = delta('DEX');
  const armorClass =
    useEquipmentArmorClass || (!hasCustomArmorClass && dexterityDelta !== 0)
      ? recalculateAC({ ...character, abilities })
      : character.armorClass;
  const spellcasting = character.spellcasting;
  const castingDelta = spellcasting ? delta(spellcasting.ability) : 0;

  return {
    abilities,
    armorClass,
    hasCustomArmorClass,
    initiative: (character.initiative ?? 0) + dexterityDelta,
    skills,
    skillPreview,
    expertiseSkills: removedExpertise.size
      ? character.expertiseSkills?.filter(
          (name) => !removedExpertise.has(normalizeSkillKey(name)),
        )
      : character.expertiseSkills,
    spellcasting:
      spellcasting && castingDelta !== 0
        ? {
            ...spellcasting,
            spellAttackBonus: spellcasting.spellAttackBonus + castingDelta,
            spellSaveDC: spellcasting.spellSaveDC + castingDelta,
          }
        : spellcasting,
  };
}

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