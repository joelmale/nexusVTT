import { useMemo } from 'react';

import type { CampaignFixtureBundle } from '@/demo/fixture-registry';

import {
  buildMonsterCatalog,
  editionOfBundle,
  partyLevelsOf,
  rateComposition,
  type EncounterComponent,
} from './monsterCatalog';

type Draft = Record<string, unknown>;

export function compositionOf(draft: Draft): EncounterComponent[] {
  return Array.isArray(draft.composition)
    ? (draft.composition as EncounterComponent[])
    : [];
}

/** Live difficulty from the draft composition against the current party. */
export function useDraftRating(bundle: CampaignFixtureBundle, draft: Draft) {
  const catalog = useMemo(
    () => buildMonsterCatalog(bundle.homebrewMonsters),
    [bundle.homebrewMonsters],
  );
  const party = partyLevelsOf(bundle);
  const edition = editionOfBundle(bundle);
  const rating = rateComposition(compositionOf(draft), catalog, party, edition);
  return { catalog, rating, party, edition };
}
