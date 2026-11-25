import { describe, expect, it } from 'vitest';
import {
  CERTIFIED_SUPPORT_MANIFEST,
  getClassSupportScopes,
} from '../data/supportManifest';
import { loadClasses } from '../services/dataService';
import { getRecommendation } from '../services/recommendationService';
import {
  creationDataToDraft,
  draftToCreationData,
} from '../adapters/draftAdapter';
import { createdCharacterToNexus } from '../adapters/nexusCharacter';
import candidates from './fixtures/classValidationInputs.json';
import type { CharacterCreationData } from '../types/dnd';
import { evaluateDraft } from '../services/draftEvaluator';

// Inventory and production-path invariants; these are NOT independent build oracles.
const CLASSES = [
  'artificer',
  'barbarian',
  'bard',
  'cleric',
  'druid',
  'fighter',
  'monk',
  'paladin',
  'ranger',
  'rogue',
  'sorcerer',
  'warlock',
  'wizard',
];

describe('advertised creator support inventory', () => {
  it('reports unblocked but uncertified Artificer creation independently of preservation and certification', () => {
    const scopes = getClassSupportScopes();
    expect(scopes).toHaveLength(26);
    for (const scope of scopes.filter(
      (entry) => entry.classSlug === 'artificer',
    ))
      expect(scope).toMatchObject({
        sourceStatus: 'unverified-supplemental',
        creation: 'implemented-awaiting-acceptance',
        laterLevelCreation: 'implemented-awaiting-acceptance',
        levelUp: 'implemented-awaiting-acceptance',
        importedPreservation: 'awaiting-acceptance',
        certified: false,
      });
  });
  it.each(['2014', '2024'] as const)(
    'inventories every selectable %s class without claiming certification',
    (edition) => {
      expect(
        loadClasses(edition)
          .map((entry) => entry.slug)
          .sort(),
      ).toEqual(CLASSES);
      expect(
        CERTIFIED_SUPPORT_MANIFEST.filter((entry) =>
          entry.editions.includes(edition),
        )
          .map((entry) => entry.classSlug)
          .sort(),
      ).toEqual(CLASSES);
      expect(
        CERTIFIED_SUPPORT_MANIFEST.every((entry) => !entry.level1Certified),
      ).toBe(true);
      expect(
        loadClasses(edition).find((entry) => entry.slug === 'artificer')
          ?.source,
      ).toBe(
        edition === '2024'
          ? 'Eberron: Forge of the Artificer'
          : "Tasha's Cauldron of Everything",
      );
    },
  );
  for (const edition of ['2014', '2024'] as const) {
    it.each(CLASSES)(
      `%s ${edition} produces a valid recommended draft and lossless saved selections`,
      (classSlug) => {
        const recommendation = getRecommendation({ classSlug, edition });
        expect(
          recommendation.evaluation.issues.filter(
            (issue) => issue.severity === 'error',
          ),
        ).toEqual([]);
        expect(recommendation.evaluation.isValid).toBe(true);
        const data = draftToCreationData(recommendation.draft);
        const roundTrip = draftToCreationData(creationDataToDraft(data));
        expect(roundTrip.classSlug).toBe(classSlug);
        expect(roundTrip.spellSelection).toEqual(data.spellSelection);
        expect(roundTrip.featChoices).toEqual(data.featChoices);
        const saved = JSON.parse(
          JSON.stringify(
            createdCharacterToNexus(
              recommendation.evaluation.calculatedCharacter!,
            ),
          ),
        );
        expect(saved.classSlug).toBe(classSlug);
        expect(saved.edition).toBe(edition);
        expect(saved.selectedFeats).toEqual(
          recommendation.evaluation.calculatedCharacter!.selectedFeats,
        );
        expect(saved.castingSources).toEqual(
          recommendation.evaluation.calculatedCharacter!.castingSources,
        );
        const frozen = (
          candidates as unknown as Record<string, CharacterCreationData>
        )[`${classSlug}-${edition}`];
        if (classSlug === 'artificer') {
          const restricted = creationDataToDraft(frozen);
          restricted.allowedSources = [`SRD ${edition}`];
          expect(
            evaluateDraft(restricted).issues.some(
              (issue) => issue.id === 'DISALLOWED_CLASS_SOURCE',
            ),
          ).toBe(true);
        }
        expect(
          evaluateDraft(creationDataToDraft(frozen)).issues.filter(
            (issue) => issue.severity === 'error',
          ),
        ).toEqual([]);
      },
    );
  }
});
