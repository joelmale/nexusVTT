import features from '../data/srd/2014/5e-SRD-Features.json';
import type { CharacterCreationData } from '../types/dnd';

/** SRD 5.1 Warlock table and Eldritch Invocations, printed pp46–49. */
const COUNTS = [0, 2, 2, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8];
export function legacyInvocationCount(level: number): number {
  return Number.isInteger(level) && level >= 1 && level <= 20
    ? COUNTS[level - 1]
    : 0;
}
export const legacyInvocationId = (id: string) =>
  id.replace(/^eldritch-invocation-/, '');
export const LEGACY_INVOCATIONS = features
  .filter((feature) => feature.index.startsWith('eldritch-invocation-'))
  .map((feature) => {
    const prerequisites =
      'prerequisites' in feature ? feature.prerequisites : [];
    const requiredSpell = prerequisites.find((entry) => entry.type === 'spell');
    const requiredFeature = prerequisites.find(
      (entry) => entry.type === 'feature',
    );
    return {
      id: legacyInvocationId(feature.index),
      name: feature.name.replace(/^Eldritch Invocation: /, ''),
      level: feature.level,
      requiredSpell:
        requiredSpell &&
        'spell' in requiredSpell &&
        typeof requiredSpell.spell === 'string'
          ? requiredSpell.spell.split('/').pop()
          : undefined,
      requiredPact:
        requiredFeature &&
        'feature' in requiredFeature &&
        typeof requiredFeature.feature === 'string'
          ? requiredFeature.feature
              .split('/')
              .pop()
              ?.replace('pact-of-the-', '')
          : undefined,
    };
  });

type InvocationOwner = Pick<
  CharacterCreationData,
  | 'classSlug'
  | 'edition'
  | 'level'
  | 'eldritchInvocations'
  | 'pactBoon'
  | 'spellSelection'
  | 'additionalCastingSources'
>;
export function legacyInvocationUnavailable(
  data: InvocationOwner,
  id: string,
): string | undefined {
  const entry = LEGACY_INVOCATIONS.find(
    (candidate) => candidate.id === legacyInvocationId(id),
  );
  if (!entry) return 'Unknown legacy invocation.';
  if (data.level < entry.level) return `Requires Warlock level ${entry.level}.`;
  if (
    entry.requiredPact &&
    (data.level < 3 || data.pactBoon !== entry.requiredPact)
  )
    return `Requires Pact of the ${entry.requiredPact}.`;
  const cantrips = [
    ...data.spellSelection.selectedCantrips,
    ...(data.additionalCastingSources ?? []).flatMap(
      (source) => source.cantrips,
    ),
  ];
  if (entry.requiredSpell && !cantrips.includes(entry.requiredSpell))
    return `Requires ${entry.requiredSpell}.`;
  return undefined;
}
export function legacyInvocationErrors(data: InvocationOwner): string[] {
  if (data.edition !== '2014' || data.classSlug !== 'warlock') return [];
  if (!Number.isInteger(data.level) || data.level < 1 || data.level > 20)
    return ['Legacy Warlock level must be between 1 and 20.'];
  const errors: string[] = [];
  const selected = data.eldritchInvocations ?? [];
  const count = legacyInvocationCount(data.level);
  if (
    selected.length !== count ||
    new Set(selected.map(legacyInvocationId)).size !== selected.length
  )
    errors.push(
      `Choose ${count} different legacy Eldritch Invocations at Warlock level ${data.level}.`,
    );
  if (
    data.level >= 3 &&
    !['blade', 'chain', 'tome'].includes(data.pactBoon ?? '')
  )
    errors.push('Choose a legacy Pact Boon at Warlock level 3 or higher.');
  if (data.level < 3 && data.pactBoon)
    errors.push('Legacy Pact Boon requires Warlock level 3.');
  for (const id of selected) {
    const reason = legacyInvocationUnavailable(data, id);
    if (reason) errors.push(`${id}: ${reason}`);
  }
  return errors;
}
