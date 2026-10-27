import type { CharacterCreationData } from '../types/dnd';
import { ALL_SKILLS, BACKGROUNDS } from './dataService';
import { grantedFeatProficiencies } from './featProficiencies';
import { skillId } from './originChoices';

export function classExpertiseCount(
  data: Pick<
    CharacterCreationData,
    'classSlug' | 'edition' | 'level' | 'selectedFeats'
  >,
): number {
  const { classSlug, edition, level } = data;
  const base =
    classSlug === 'rogue'
      ? level >= 6
        ? 4
        : 2
      : classSlug === 'bard'
        ? level >= (edition === '2024' ? 9 : 10)
          ? 4
          : level >= (edition === '2024' ? 2 : 3)
            ? 2
            : 0
        : edition === '2024' && classSlug === 'ranger'
          ? level >= 9
            ? 3
            : level >= 2
              ? 1
              : 0
          : edition === '2024' && classSlug === 'wizard' && level >= 2
            ? 1
            : 0;
  return base + (data.selectedFeats?.includes('skill-expert') ? 1 : 0);
}

export function classExpertiseOptions(data: CharacterCreationData): string[] {
  const background = BACKGROUNDS.find(
    (entry) =>
      entry.edition === data.edition &&
      [data.background, `${data.background}-${data.edition}`].includes(
        entry.slug,
      ),
  );
  const proficient = new Set(
    [
      ...data.selectedSkills,
      ...(background?.skill_proficiencies ?? []),
      data.speciesSkillProficiency ?? '',
      data.variantSkillProficiency ?? '',
      ...(data.edition === '2014' && data.speciesSlug === 'elf'
        ? ['Perception']
        : []),
      ...grantedFeatProficiencies(data),
    ].map(skillId),
  );
  const options = ALL_SKILLS.filter((skill) => proficient.has(skillId(skill)));
  if (data.edition === '2024' && data.classSlug === 'wizard')
    return options.filter((skill) =>
      [
        'Arcana',
        'History',
        'Investigation',
        'Medicine',
        'Nature',
        'Religion',
      ].includes(skill),
    );
  return data.classSlug === 'rogue' && data.edition === '2014'
    ? [...options, "Thieves' Tools"]
    : options;
}

export function classExpertiseErrors(data: CharacterCreationData): string[] {
  const expected = classExpertiseCount(data);
  const choices = data.expertiseSkills ?? [];
  const options = new Set(classExpertiseOptions(data).map(skillId));
  return choices.length !== expected ||
    new Set(choices.map(skillId)).size !== choices.length ||
    choices.some((choice) => !options.has(skillId(choice)))
    ? [
        `Choose ${expected} different eligible Expertise proficiencies at this class level.`,
      ]
    : [];
}
