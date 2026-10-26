import { writeFileSync } from 'node:fs';
import { draftToCreationData } from '../src/adapters/draftAdapter';
import { loadClasses } from '../src/services/dataService';
import { getRecommendation } from '../src/services/recommendationService';

// Capture INPUTS only. Never generate expected rules results from the evaluator.
// Review source/choices before treating these candidates as independent references.
const inputs = Object.fromEntries(
  (['2014', '2024'] as const).flatMap((edition) =>
    loadClasses(edition).map((entry) => {
      const draft = getRecommendation({ classSlug: entry.slug, edition }).draft;
      const data = draftToCreationData(draft);
      return [`${entry.slug}-${edition}`, data];
    }),
  ),
);
writeFileSync(
  new URL('../src/tests/fixtures/classValidationInputs.json', import.meta.url),
  `${JSON.stringify(inputs, null, 2)}\n`,
);
