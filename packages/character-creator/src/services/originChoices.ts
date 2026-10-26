import type { CharacterCreationData } from '../types/dnd';
import { ALL_SKILLS, BACKGROUNDS, FEAT_DATABASE } from './dataService';

export const choiceId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
export const skillId = (value: string) => choiceId(value).replace(/-/g, '');

/** Compatibility aliases represent one Human grant, never additional feats. */
export function humanOriginFeat(
  data: CharacterCreationData,
): string | undefined {
  return data.humanOriginFeat === 'versatile'
    ? data.humanVersatileFeat
    : (data.humanOriginFeat ??
        data.humanVersatileFeat ??
        (data.speciesFeat !== 'versatile' ? data.speciesFeat : undefined));
}

export function originChoiceErrors(data: CharacterCreationData): string[] {
  if (data.edition !== '2024') {
    if (
      data.speciesSlug !== 'human' ||
      (data.selectedSpeciesVariant ?? data.variantSlug) !== 'variant'
    )
      return [];
    const values = Object.values(data.variantAbilityBonuses ?? {}).filter(
      Boolean,
    );
    const bonusKeys = Object.entries(data.variantAbilityBonuses ?? {})
      .filter(([, value]) => Boolean(value))
      .map(([key]) => key);
    const background = BACKGROUNDS.find(
      (entry) => entry.edition === '2014' && (entry.slug === data.background || entry.slug === `${data.background}-2014` || entry.name.toLowerCase() === data.background.toLowerCase()),
    );
    const existingSkills = [
      ...data.selectedSkills,
      ...(background?.skill_proficiencies ?? []),
    ].map(skillId);
    const skill = data.variantSkillProficiency;
    return [
      ...(values.length !== 2 ||
      values.some((value) => value !== 1) ||
      bonusKeys.some(
        (key) => !['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].includes(key),
      )
        ? ['Variant Human requires +1 to two different abilities.']
        : []),
      ...(!skill ||
      !ALL_SKILLS.some((entry) => skillId(entry) === skillId(skill)) ||
      existingSkills.includes(skillId(skill))
        ? ['Choose the Variant Human skill proficiency.']
        : []),
      ...(!data.variantFeat ? ['Choose the Variant Human feat.'] : []),
    ];
  }
  const errors: string[] = [];
  const background = BACKGROUNDS.find(
    (entry) =>
      entry.edition === data.edition &&
      (entry.slug === data.background ||
        entry.slug === `${data.background}-2024`),
  );
  const proficient = [
    ...data.selectedSkills,
    ...(background?.skill_proficiencies ?? []),
  ].map(skillId);
  if (
    data.originFeat &&
    background?.originFeat &&
    data.originFeat !== background.originFeat &&
    !(
      background.originFeat === 'magic-initiate' &&
      data.originFeat.startsWith('magic-initiate-')
    )
  )
    errors.push(
      'Use the Origin feat granted by your background; keep the Human feat separate.',
    );
  if (['human-2024', 'elf-2024'].includes(data.speciesSlug)) {
    const skill = data.speciesSkillProficiency;
    const pool =
      data.speciesSlug === 'elf-2024'
        ? ['Insight', 'Perception', 'Survival']
        : ALL_SKILLS;
    if (!skill || !pool.some((entry) => skillId(entry) === skillId(skill)))
      errors.push('Choose the skill proficiency granted by your species.');
    else if (proficient.includes(skillId(skill)))
      errors.push(
        'Choose a species skill that is not already granted by your class or background.',
      );
  }
  if (
    data.speciesSlug === 'elf-2024' &&
    !['wood-elf', 'high-elf', 'drow'].includes(
      choiceId(data.selectedLineage ?? ''),
    )
  )
    errors.push('Choose a High Elf, Wood Elf or Drow lineage.');
  if (data.speciesSlug === 'human-2024') {
    const feat = humanOriginFeat(data);
    if (
      !feat ||
      !FEAT_DATABASE.some(
        (entry) => entry.slug === feat && entry.category === 'origin',
      )
    )
      errors.push('Choose the Origin feat granted by Human Versatile.');
    if (feat && feat === background?.originFeat && feat !== 'skilled')
      errors.push(
        'Choose a Human Origin feat different from your background feat.',
      );
    const aliases = [
      data.humanOriginFeat,
      data.humanVersatileFeat,
      data.speciesFeat,
    ].filter((value): value is string =>
      Boolean(value && value !== 'versatile'),
    );
    if (new Set(aliases).size > 1)
      errors.push(
        'Resolve conflicting Human feat choices; Versatile grants one Origin feat.',
      );
  }
  return errors;
}
