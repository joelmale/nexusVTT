import type { CharacterCreationData } from '../types/dnd';
import { loadClasses, loadEquipment } from './dataService';
import { choiceId } from './originChoices';
import { INVOCATIONS_2024 } from './invocations';

export const masteryCount = (
  data: Pick<CharacterCreationData, 'edition' | 'classSlug'>,
) =>
  data.edition !== '2024'
    ? 0
    : data.classSlug === 'fighter'
      ? 3
      : ['barbarian', 'paladin', 'ranger', 'rogue'].includes(data.classSlug)
        ? 2
        : 0;

export function masteryOptions(
  data: Pick<CharacterCreationData, 'edition' | 'classSlug'>,
) {
  const proficiencies =
    loadClasses(data.edition).find((entry) => entry.slug === data.classSlug)
      ?.proficiencies?.weapons ?? [];
  return loadEquipment().filter(
    (weapon) =>
      weapon.weapon_category &&
      choiceId(weapon.name) !== 'net' &&
      (data.classSlug !== 'barbarian' || weapon.weapon_range === 'Melee') &&
      (data.classSlug !== 'rogue' ||
        weapon.weapon_category === 'Simple' ||
        weapon.properties?.some((property) =>
          ['finesse', 'light'].includes(choiceId(property.name)),
        )) &&
      proficiencies.some(
        (entry) =>
          choiceId(entry).includes(choiceId(weapon.name)) ||
          choiceId(entry).includes(choiceId(weapon.weapon_category!)),
      ),
  );
}

export function classGrantErrors(data: CharacterCreationData): string[] {
  if (data.edition !== '2024') return [];
  const errors: string[] = [];
  if (data.classSlug === 'warlock') {
    const choices = data.eldritchInvocations ?? [];
    if (data.level === 1 && choices.length !== 1)
      errors.push('Choose one Eldritch Invocation at level 1.');
    if (new Set(choices).size !== choices.length)
      errors.push('Choose different Eldritch Invocations.');
    for (const id of choices) {
      const invocation = INVOCATIONS_2024.find((entry) => entry.id === id);
      if (
        (!invocation && data.level === 1) ||
        (invocation && data.level < invocation.level)
      )
        errors.push(`Invocation '${id}' is not available at this level.`);
    }
  }
  if (
    data.classSlug === 'cleric' &&
    !['protector', 'thaumaturge'].includes(data.divineOrder ?? '')
  )
    errors.push('Choose a Divine Order: Protector or Thaumaturge.');
  if (
    data.classSlug === 'druid' &&
    !['warden', 'magician'].includes(data.primalOrder ?? '')
  )
    errors.push('Choose a Primal Order: Warden or Magician.');
  const count = masteryCount(data);
  const selections = data.weaponMastery ?? [];
  if (
    count &&
    (selections.length < count ||
      (data.level === 1 && selections.length !== count) ||
      new Set(selections.map(choiceId)).size !== selections.length)
  )
    errors.push(
      `Choose ${count} different weapon masteries${data.level > 1 ? ' or the number granted by your level' : ''}.`,
    );
  if (
    count &&
    selections.some(
      (selection) =>
        !masteryOptions(data).some(
          (weapon) =>
            choiceId(selection) === choiceId(weapon.name) ||
            choiceId(selection) === weapon.slug,
        ),
    )
  )
    errors.push(
      'Choose masteries only for weapons this class is proficient with.',
    );
  return errors;
}
