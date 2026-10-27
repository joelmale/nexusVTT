import type { Character, CharacterCreationData } from '../types/dnd';
import { FEAT_DATABASE } from './dataService';
import { humanOriginFeat } from './originChoices';
import { featProficiencyErrors } from './featProficiencies';
import { invocationFeatGrants, lessonFeatSlug } from './invocations';
import { isPermittedContentSource } from '../data/contentProvenance';
import {
  calculateFeatAvailability,
  getFeatAvailability,
} from '../utils/featUtils';

/** Validate the selected entitlement; never replace an unavailable feat. */
export function featEntitlementErrors(
  data: CharacterCreationData,
  character: Character,
  allowedSources?: string[],
): string[] {
  const selected = [
    ...invocationFeatGrants(data),
    ...(data.selectedFeats ?? []),
    ...(data.cumulativeASI ?? []).flatMap((choice) =>
      choice.featSlug ? [choice.featSlug] : [],
    ),
    ...(data.variantFeat ? [data.variantFeat] : []),
    ...(data.edition === '2024' &&
    data.speciesSlug === 'human-2024' &&
    humanOriginFeat(data)
      ? [humanOriginFeat(data)!]
      : []),
  ];
  const errors: string[] = featProficiencyErrors(data);
  const origin =
    data.edition === '2024' && data.speciesSlug === 'human-2024'
      ? humanOriginFeat(data)
      : undefined;
  const discretionary = new Set(
    [
      ...(data.selectedFeats ?? []),
      ...(data.cumulativeASI ?? []).flatMap((choice) =>
        choice.type === 'feat' && choice.featSlug ? [choice.featSlug] : [],
      ),
    ].filter((slug) => slug !== origin && slug !== data.variantFeat),
  );
  const available =
    calculateFeatAvailability(data) -
    (data.edition === '2024' && data.speciesSlug === 'human-2024' ? 1 : 0);
  if (discretionary.size > available)
    errors.push(
      `This class and level grant ${available} feats through Ability Score Improvement choices. Keep background, species and Variant Human grants separate.`,
    );
  for (const slug of new Set(selected)) {
    const canonicalSlug = lessonFeatSlug(slug).replace(
      /^magic-initiate-(cleric|druid|wizard)$/,
      'magic-initiate',
    );
    const feat = FEAT_DATABASE.find((entry) => entry.slug === canonicalSlug);
    if (!feat) {
      errors.push(`Feat '${slug}' is unavailable. Choose a catalog feat.`);
      continue;
    }
    const increase = feat.abilityScoreIncrease;
    if (
      increase &&
      increase.options.length > 1 &&
      !increase.options.includes(
        data.featChoices?.[slug]?.abilityChoice as keyof Character['abilities'],
      )
    )
      errors.push(`Choose the ability increase granted by ${feat.name}.`);
    const minimum =
      data.edition === '2024'
        ? (feat.prerequisites?.level ?? (feat.category === 'general' ? 4 : 1))
        : 1;
    if (data.level < minimum)
      errors.push(`${feat.name} requires level ${minimum}.`);
    const availability = getFeatAvailability(
      data.edition === '2014'
        ? {
            ...feat,
            prerequisites: { ...feat.prerequisites, level: undefined },
          }
        : feat,
      {
        ...data,
        abilities: Object.fromEntries(
          Object.entries(character.abilities).map(([key, value]) => [
            key,
            value.score,
          ]),
        ) as CharacterCreationData['abilities'],
      },
    );
    if (
      !availability.isAvailable &&
      !(
        availability.reason === 'Requires spellcasting ability' &&
        character.castingSources?.length
      )
    )
      errors.push(
        `${feat.name}: ${availability.reason ?? 'Prerequisites are not met.'}`,
      );
    for (const [ability, minimumScore] of Object.entries(
      feat.prerequisites?.stats ?? {},
    )) {
      if (
        character.abilities[ability as keyof Character['abilities']].score <
        minimumScore
      )
        errors.push(`${feat.name} requires ${ability} ${minimumScore}.`);
    }
    if (
      feat.prerequisites?.spellcasting &&
      !character.spellcasting &&
      !character.castingSources?.length
    )
      errors.push(`${feat.name} requires spellcasting.`);
    const source = `${feat.source} ${data.edition === '2024' && feat.category === 'origin' ? '2024' : feat.year}`;
    if (
      allowedSources &&
      !isPermittedContentSource(
        'feat',
        feat.slug,
        data.edition,
        source,
        allowedSources,
      )
    )
      errors.push(
        `Your game does not permit ${feat.name}'s source (${source}).`,
      );
  }
  return errors;
}
