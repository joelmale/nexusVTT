/** SRD 5.2.1 subclass headings. Supplemental/legacy subclasses retain their own
 * provenance; these entries never inherit legacy mechanics from matching names. */
import revised from './srd/2024/5e-SRD-Subclasses.json';

export const CORE_SUBCLASSES_2024 = revised.map((entry) => ({
  slug: entry.index,
  name: entry.name,
  class: entry.class.index,
  features: entry.featureLevels,
}));

export function revisedSubclassFeatures(
  classSlug: string,
  subclass: string | undefined,
  level: number,
): string[] {
  const entry = CORE_SUBCLASSES_2024.find(
    (candidate) => candidate.class === classSlug && candidate.slug === subclass,
  );
  return entry
    ? Object.entries(entry.features)
        .filter(([at]) => Number(at) <= level)
        .flatMap(([, names]) => names.split('|'))
    : [];
}
