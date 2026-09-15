/**
 * Subclass Feature Effects (2014/2020)
 * Generates grantFeature entries from subclassFeaturesByLevel.json.
 */

import subclassFeaturesByLevel from '../../../data/subclassFeaturesByLevel.json';
import type { SourcedEffect } from '../../types/effects';

interface SubclassFeatureData {
  level: number;
  name: string;
  description: string;
}

interface SubclassData {
  name: string;
  description: string;
  features: SubclassFeatureData[];
}

type SubclassFeaturesByClass = Record<string, Record<string, SubclassData>>;

const excludedClasses = new Set(['rogue']);
const extraAttackNames = new Set(['Extra Attack']);

const toKebab = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const buildSubclassEffects = (): Record<string, SourcedEffect[]> => {
  const data = subclassFeaturesByLevel as SubclassFeaturesByClass;
  const result: Record<string, SourcedEffect[]> = {};

  Object.entries(data).forEach(([classSlug, subclasses]) => {
    if (excludedClasses.has(classSlug)) {
      return;
    }

    const classEffects: SourcedEffect[] = [];

    Object.entries(subclasses).forEach(([subclassSlug, subclassData]) => {
      const effects = subclassData.features.map((feature) => {
        const baseEffect = {
          kind: 'grantFeature' as const,
          featureId: `${subclassSlug}-${toKebab(feature.name)}`,
          name: feature.name,
          description: feature.description,
          predicate: [
            { type: 'hasTag' as const, tag: `subclass:${subclassSlug}` },
            { type: 'classLevelAtLeast' as const, classSlug, level: feature.level },
          ],
        };

        if (!extraAttackNames.has(feature.name)) {
          return [baseEffect];
        }

        return [
          baseEffect,
          {
            kind: 'tag' as const,
            tags: ['extra-attack'],
            predicate: [
              { type: 'hasTag' as const, tag: `subclass:${subclassSlug}` },
              { type: 'classLevelAtLeast' as const, classSlug, level: feature.level },
            ],
          },
        ];
      });

      classEffects.push({
        sourceId: `subclass:${subclassSlug}`,
        effectId: `${subclassSlug}-features`,
        name: `${subclassData.name} Features`,
        description: subclassData.description,
        effects: effects.flat(),
      });
    });

    result[classSlug] = classEffects;
  });

  return result;
};

export const subclassEffectsByClass = buildSubclassEffects();
