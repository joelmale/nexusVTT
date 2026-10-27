import type { CharacterCreationData } from '../types/dnd';
import { FEAT_DATABASE, loadSpells } from './dataService';
import { invocationTargets, type InvocationDefinition } from './invocations';

// SRD 5.2.1 cantrip descriptions. Use explicit mechanics, not prose matching.
const ATTACK_CANTRIPS = new Set([
  'chill-touch',
  'eldritch-blast',
  'fire-bolt',
  'poison-spray',
  'ray-of-frost',
  'shocking-grasp',
  'starry-wisp',
  'thorn-whip',
  'true-strike',
  'produce-flame',
  'sorcerous-burst',
]);
const DAMAGE_CANTRIPS = new Set([
  ...ATTACK_CANTRIPS,
  'acid-splash',
  'sacred-flame',
  'thunderclap',
  'toll-the-dead',
  'vicious-mockery',
]);

export function invocationTargetOptions(
  data: CharacterCreationData,
  invocation: InvocationDefinition,
): Array<{ id: string; name: string }> {
  const lessonTargets = invocationTargets(data, 'lessons-of-the-first-ones');
  const skilledInstances = Array.from({ length: 10 }, (_, index) => ({
    id: `skilled:lesson-${index + 1}`,
    name: `Skilled (lesson grant ${index + 1})`,
  }));
  const nextSkilled = skilledInstances.find(
    (entry) => !lessonTargets.includes(entry.id),
  )?.id;
  if (invocation.choice === 'origin-feat')
    return FEAT_DATABASE.filter((feat) => feat.category === 'origin').flatMap(
      (feat) =>
        feat.slug === 'skilled'
          ? [
              ...skilledInstances.filter(
                (entry) =>
                  lessonTargets.includes(entry.id) || entry.id === nextSkilled,
              ),
              ...(lessonTargets.includes('skilled')
                ? [{ id: 'skilled', name: 'Skilled (existing grant)' }]
                : []),
            ]
          : feat.slug === 'magic-initiate'
            ? ['cleric', 'druid', 'wizard'].map((list) => ({
                id: `magic-initiate-${list}`,
                name: `Magic Initiate (${list})`,
              }))
            : [{ id: feat.slug, name: feat.name }],
    );
  const known = new Set([
    ...(data.spellSelection?.selectedCantrips ?? []),
    ...(data.eldritchInvocations?.includes('pact-of-the-tome')
      ? (data.additionalCastingSources?.find(
          (source) => source.id === 'class:warlock:pact-of-the-tome',
        )?.cantrips ?? [])
      : []),
  ]);
  return loadSpells(data.edition)
    .filter(
      (spell) =>
        spell.level === 0 &&
        known.has(spell.slug) &&
        (spell.classes.includes('warlock') ||
          data.additionalCastingSources?.some(
            (source) =>
              source.id === 'class:warlock:pact-of-the-tome' &&
              source.cantrips.includes(spell.slug),
          )) &&
        DAMAGE_CANTRIPS.has(spell.slug) &&
        (invocation.choice !== 'attack-cantrip' ||
          ATTACK_CANTRIPS.has(spell.slug)) &&
        (invocation.choice !== 'ranged-cantrip' ||
          Number.parseInt(spell.range, 10) >= 10),
    )
    .map((spell) => ({ id: spell.slug, name: spell.name }));
}
