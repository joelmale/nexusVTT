import type { CharacterCreationData } from '../types/dnd';
import { BACKGROUNDS, loadClasses, loadEquipment } from './dataService';
import { choiceId, humanOriginFeat } from './originChoices';
import {
  INVOCATIONS_2024,
  invocationCount,
  invocationTargets,
  selectedInvocationCount,
} from './invocations';
import { invocationTargetOptions } from './invocationChoices';
import { legacyInvocationErrors } from './legacyInvocations';

export const masteryCount = (
  data: Pick<CharacterCreationData, 'edition' | 'classSlug'> & {
    level?: number;
  },
) =>
  data.edition !== '2024'
    ? 0
    : data.classSlug === 'fighter'
      ? (data.level ?? 1) >= 16
        ? 6
        : (data.level ?? 1) >= 10
          ? 5
          : (data.level ?? 1) >= 4
            ? 4
            : 3
      : data.classSlug === 'barbarian'
        ? (data.level ?? 1) >= 10
          ? 4
          : (data.level ?? 1) >= 4
            ? 3
            : 2
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
  if (data.edition !== '2024') return legacyInvocationErrors(data);
  const errors: string[] = [];
  if (data.classSlug === 'warlock') {
    const choices = data.eldritchInvocations ?? [];
    const count = invocationCount(data.level);
    if (!count || selectedInvocationCount(data) !== count)
      errors.push(
        `Choose ${count} Eldritch Invocation${count === 1 ? '' : 's'} at Warlock level ${data.level}.`,
      );
    if (new Set(choices).size !== choices.length)
      errors.push('Choose different Eldritch Invocations.');
    for (const id of choices) {
      const invocation = INVOCATIONS_2024.find((entry) => entry.id === id);
      if (!invocation || (invocation && data.level < invocation.level))
        errors.push(`Invocation '${id}' is not available at this level.`);
      if (invocation?.requires && !choices.includes(invocation.requires))
        errors.push(`${invocation.name} requires ${invocation.requires}.`);
      if (invocation?.choice) {
        const targets = invocationTargets(data, id);
        const options = invocationTargetOptions(data, invocation);
        if (
          !targets.length ||
          new Set(targets).size !== targets.length ||
          targets.some(
            (target) => !options.some((option) => option.id === target),
          )
        )
          errors.push(
            `Choose different eligible targets for ${invocation.name}.`,
          );
        if (invocation.choice === 'origin-feat') {
          const background = BACKGROUNDS.find(
            (entry) =>
              entry.edition === data.edition &&
              [data.background, `${data.background}-${data.edition}`].includes(
                entry.slug,
              ),
          );
          const otherFeats = [
            background?.originFeat,
            data.originFeat,
            data.speciesSlug === 'human-2024'
              ? humanOriginFeat(data)
              : data.speciesFeat,
            ...(data.selectedFeats ?? []),
            ...(data.cumulativeASI ?? []).flatMap((choice) =>
              choice.featSlug ? [choice.featSlug] : [],
            ),
          ];
          const backgroundMagicList =
            background?.originFeat === 'magic-initiate'
              ? background.slug.startsWith('acolyte')
                ? 'cleric'
                : 'wizard'
              : undefined;
          const otherMagicLists = [
            backgroundMagicList,
            ...otherFeats
              .filter((feat) => feat?.startsWith('magic-initiate'))
              .map(
                (feat) =>
                  feat?.match(/^magic-initiate-(cleric|druid|wizard)$/)?.[1] ??
                  data.featChoices?.['magic-initiate']?.spellList,
              ),
          ];
          if (
            targets.some((target) =>
              target.startsWith('magic-initiate-')
                ? otherMagicLists.includes(
                    target.replace('magic-initiate-', ''),
                  )
                : target === 'skilled' || target.startsWith('skilled:lesson-')
                  ? false
                  : otherFeats.includes(target),
            )
          )
            errors.push(
              'Lessons of the First Ones requires a different Origin feat or a different Magic Initiate spell list.',
            );
        }
      }
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
    (selections.length !== count ||
      new Set(selections.map(choiceId)).size !== selections.length)
  )
    errors.push(
      `Choose ${count} different weapon masteries at level ${data.level}.`,
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
