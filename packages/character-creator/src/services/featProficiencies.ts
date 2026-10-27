import equipment from '../data/equipment.json';
import type { CharacterCreationData } from '../types/dnd';
import { ALL_SKILLS, BACKGROUNDS, loadClasses } from './dataService';
import { humanOriginFeat, skillId } from './originChoices';
import { invocationFeatGrants, isSkilledLesson } from './invocations';

const CHOICE_FEATS = ['skilled', 'crafter', 'musician'] as const;
export function featProficiencyGrants(data: CharacterCreationData) {
  const background = BACKGROUNDS.find(
    (entry) =>
      entry.edition === data.edition &&
      [data.background, `${data.background}-${data.edition}`].includes(
        entry.slug,
      ),
  );
  const origin = data.edition === '2024' ? background?.originFeat : undefined;
  const human =
    data.edition === '2024' && data.speciesSlug === 'human-2024'
      ? humanOriginFeat(data)
      : undefined;
  const feats = [
    origin,
    human,
    data.variantFeat,
    ...invocationFeatGrants(data).filter((id) => !isSkilledLesson(id)),
    ...new Set(
      [
        ...(data.selectedFeats ?? []),
        ...(data.cumulativeASI ?? []).flatMap((choice) =>
          choice.type === 'feat' ? [choice.featSlug] : [],
        ),
      ].filter(
        (feat) =>
          feat !== origin && feat !== human && feat !== data.variantFeat,
      ),
    ),
  ];
  const alreadyKnown = [
    ...(loadClasses(data.edition).find((entry) => entry.slug === data.classSlug)
      ?.proficiencies?.tools ?? []),
    ...(data.selectedMusicalInstruments ?? []),
    ...(data.backgroundTools ?? []),
    ...data.selectedSkills,
    ...(background?.skill_proficiencies ?? []),
    ...(background?.tool_proficiencies ?? []),
    data.speciesSkillProficiency ?? '',
    data.variantSkillProficiency ?? '',
  ].map(skillId);
  const grants = [
    ...CHOICE_FEATS.map((feat) => ({
      feat,
      choiceKey: feat as string,
      count: feats.filter((entry) => entry === feat).length * 3,
    })),
    ...invocationFeatGrants(data)
      .filter(isSkilledLesson)
      .map((choiceKey) => ({ feat: 'skilled' as const, choiceKey, count: 3 })),
  ];
  return grants.flatMap(({ feat, choiceKey, count }) => {
    if (!count) return [];
    const tools = equipment
      .filter((entry) =>
        entry.equipment_categories?.some((category) => {
          const index =
            'index' in category && typeof category.index === 'string'
              ? category.index
              : '';
          return feat === 'crafter'
            ? index === 'artisans-tools'
            : feat === 'musician'
              ? index === 'musical-instruments'
              : ['tools', 'other-tools'].includes(index);
        }),
      )
      .map((entry) => entry.name);
    const options = [
      ...(feat === 'skilled' ? ALL_SKILLS : []),
      ...tools,
    ].filter((name) => !alreadyKnown.includes(skillId(name)));
    const raw = data.featChoices?.[choiceKey]?.proficiencies;
    const selected = Array.isArray(raw) ? raw : [];
    return [{ feat, choiceKey, count, options, selected }];
  });
}

export function featProficiencyErrors(data: CharacterCreationData): string[] {
  const seen = new Set<string>();
  return featProficiencyGrants(data).flatMap((grant) => {
    let invalid = grant.selected.length !== grant.count;
    for (const name of grant.selected) {
      if (!grant.options.includes(name) || seen.has(skillId(name)))
        invalid = true;
      seen.add(skillId(name));
    }
    return invalid
      ? [
          `Choose ${grant.count} different available proficiencies for ${grant.feat}.`,
        ]
      : [];
  });
}

export function grantedFeatProficiencies(data: CharacterCreationData) {
  return featProficiencyGrants(data).flatMap((grant) =>
    grant.selected.filter((name) => grant.options.includes(name)),
  );
}

export function recommendedFeatProficiencies(data: CharacterCreationData) {
  const featChoices = { ...data.featChoices };
  const seen = new Set<string>();
  for (const grant of featProficiencyGrants(data)) {
    const choices = grant.selected.length
      ? grant.selected
      : grant.options.filter((name) => !seen.has(name)).slice(0, grant.count);
    choices.forEach((name) => seen.add(name));
    featChoices[grant.choiceKey] = {
      ...featChoices[grant.choiceKey],
      proficiencies: choices,
    };
  }
  return featChoices;
}
