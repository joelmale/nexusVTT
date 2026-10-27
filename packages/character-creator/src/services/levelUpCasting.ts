import { calculatePreparationLimit } from '@nexus/rules-5e';
import type { Character } from '../types/dnd';
import {
  CANTRIPS_KNOWN_BY_CLASS,
  loadSpells,
  loadClasses,
} from './dataService';
import { SPELL_LEARNING_RULES } from '../data/spellLearning';
import { classSpellSlots } from '../utils/classSpellSlots';
import { getSpellcastingType } from '../utils/spellUtils';
import { ARTIFICER_LEGACY_CANTRIPS } from '../data/progressions/artificer2014';

export function levelUpCasting(character: Character) {
  const classSlug = character.classSlug || character.class.toLowerCase();
  const level = character.level + 1;
  const type = getSpellcastingType(classSlug, character.edition);
  const configured = loadClasses(character.edition).find(
    (entry) => entry.slug === classSlug,
  )?.spellcasting;
  const slots = classSpellSlots(classSlug, character.edition, level);
  const maxLevel = Math.max(
    0,
    ...slots.flatMap((count, index) => (index > 0 && count > 0 ? [index] : [])),
  );
  const casting: Character['spellcasting'] =
    character.spellcasting ??
    (configured && type && maxLevel > 0
      ? ({
          ability: configured.ability,
          cantripsKnown: [],
          spellcastingType: type,
          cantripChoicesByLevel: {},
          spellSaveDC: 0,
          spellAttackBonus: 0,
          spellSlots: slots,
          usedSpellSlots: slots.map(() => 0),
        } satisfies NonNullable<Character['spellcasting']>)
      : undefined);
  if (!casting) return { type, cantrips: 0, spells: 0, maxLevel, eligible: [] };
  const extra =
    character.edition === '2024' &&
    ((classSlug === 'cleric' && character.divineOrder === 'thaumaturge') ||
      (classSlug === 'druid' && character.primalOrder === 'magician'))
      ? 1
      : 0;
  const cantripMax =
    classSlug === 'artificer' && character.edition === '2014'
      ? ARTIFICER_LEGACY_CANTRIPS[level - 1]
      : ((CANTRIPS_KNOWN_BY_CLASS as Record<string, Record<number, number>>)[
          classSlug
        ]?.[level] ?? 0);
  const cantrips = Math.max(
    0,
    cantripMax + extra - casting.cantripsKnown.length,
  );
  // SRD 5.1 Ranger class table (level one has no Spellcasting).
  const rangerKnown = [
    0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11,
  ];
  const spells =
    type === 'wizard'
      ? 2
      : type === 'prepared'
        ? Math.max(
            0,
            calculatePreparationLimit(
              classSlug,
              level,
              character.abilities[casting.ability]?.modifier ?? 0,
              character.edition,
            ) - (casting.preparedSpells?.length ?? 0),
          )
        : type === 'known'
          ? Math.max(
              0,
              ((classSlug === 'ranger'
                ? rangerKnown
                : SPELL_LEARNING_RULES[classSlug]?.spellsKnown)?.[level - 1] ??
                0) - (casting.spellsKnown?.length ?? 0),
            )
          : 0;
  const prior = new Set([
    ...casting.cantripsKnown,
    ...(type === 'wizard'
      ? (casting.spellbook ?? [])
      : type === 'known'
        ? (casting.spellsKnown ?? [])
        : (casting.preparedSpells ?? [])),
  ]);
  const eligible = loadSpells(character.edition).filter(
    (spell) =>
      spell.classes.some((entry) => entry.toLowerCase() === classSlug) &&
      spell.level <= maxLevel &&
      !prior.has(spell.slug),
  );
  return { type, cantrips, spells, maxLevel, eligible };
}

export function levelUpCastingErrors(
  character: Character,
  selections: string[] = [],
): string[] {
  const { cantrips, spells, eligible } = levelUpCasting(character);
  const selected = selections.map((slug) =>
    eligible.find((spell) => spell.slug === slug),
  );
  if (
    new Set(selections).size !== selections.length ||
    selected.some((spell) => !spell) ||
    selected.filter((spell) => spell?.level === 0).length !== cantrips ||
    selected.filter((spell) => spell && spell.level > 0).length !== spells
  )
    return [
      `Choose ${cantrips} new class cantrips and ${spells} eligible class spells before advancing.`,
    ];
  return [];
}
