import type { Character } from '../types/dnd';
import { classExpertiseCount } from './expertiseChoices';
import { skillId } from './originChoices';

export function levelUpExpertise(character: Character) {
  const data = {
    classSlug: character.classSlug || character.class.toLowerCase(),
    edition: character.edition,
    level: character.level,
    selectedFeats: character.selectedFeats,
  };
  const count =
    classExpertiseCount({ ...data, level: character.level + 1 }) -
    classExpertiseCount(data);
  const prior = new Set((character.expertiseSkills ?? []).map(skillId));
  const options = Object.entries(character.skills ?? {})
    .filter(
      ([name, skill]) =>
        skill.proficient &&
        !skill.expertise &&
        !prior.has(skillId(name)) &&
        (data.classSlug !== 'wizard' ||
          [
            'Arcana',
            'History',
            'Investigation',
            'Medicine',
            'Nature',
            'Religion',
          ].includes(name)),
    )
    .map(([name]) => name);
  if (
    data.classSlug === 'rogue' &&
    character.edition === '2014' &&
    !prior.has(skillId("Thieves' Tools")) &&
    character.proficiencies?.tools?.some(
      (tool) => skillId(tool) === skillId("Thieves' Tools"),
    )
  )
    options.push("Thieves' Tools");
  return { count, options };
}

export function levelUpExpertiseErrors(
  character: Character,
  selected: string[] = [],
): string[] {
  const { count, options } = levelUpExpertise(character);
  const normalized = selected.map(skillId);
  return selected.length !== count ||
    new Set(normalized).size !== selected.length ||
    normalized.some((id) => !options.some((option) => skillId(option) === id))
    ? [`Choose ${count} new eligible Expertise proficiencies before advancing.`]
    : [];
}
