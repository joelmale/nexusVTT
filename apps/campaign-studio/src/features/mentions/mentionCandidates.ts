import type { EntityRef } from '@/demo/fixture-registry';

const MAX_RESULTS = 6;

/** Candidates for `@query`: title prefix matches first, then substring. */
export function mentionCandidates(
  entities: readonly EntityRef[],
  query: string,
): EntityRef[] {
  const needle = query.trim().toLowerCase();
  const ranked = entities
    .map((entity) => {
      const label = entity.label.toLowerCase();
      const rank = !needle || label.startsWith(needle) ? 0 : label.includes(needle) ? 1 : -1;
      return { entity, rank };
    })
    .filter((item) => item.rank >= 0)
    .sort(
      (a, b) =>
        a.rank - b.rank || a.entity.label.localeCompare(b.entity.label),
    );
  return ranked.slice(0, MAX_RESULTS).map((item) => item.entity);
}
