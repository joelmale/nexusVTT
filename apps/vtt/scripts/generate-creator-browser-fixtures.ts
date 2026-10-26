import { mkdirSync, writeFileSync } from 'node:fs';
import { creationDataToDraft } from '../../../packages/character-creator/src/adapters/draftAdapter';
import { evaluateDraft } from '../../../packages/character-creator/src/services/draftEvaluator';
import { toNexusCharacter } from '../../../packages/character-creator/src/adapters/nexusCharacter';
import { REFERENCE_BUILDS } from '../../../packages/character-creator/src/tests/fixtures/referenceBuilds';

// Generate via the production adapter. Keep expected values from the independent
// reference fixtures; never use the evaluator to generate expected assertions.
const records = Object.fromEntries(
  Object.entries(REFERENCE_BUILDS).map(([id, oracle]) => {
    const draft = creationDataToDraft({
      ...oracle.creationData,
      personality: 'Calm and observant.',
      ideals: 'Protect others.',
      bonds: 'The party.',
      flaws: 'Too curious.',
    });
    const evaluation = evaluateDraft(draft);
    if (!evaluation.isValid)
      throw new Error(
        `${id}: ${evaluation.issues.map((issue) => issue.message).join(' ')}`,
      );
    return [
      id,
      {
        draft: { ...draft, draftId: id, characterId: id, attemptId: id },
        oracle,
        character: toNexusCharacter(evaluation.calculatedCharacter!),
      },
    ];
  }),
);
const output = new URL('../tests/e2e/fixtures/', import.meta.url);
mkdirSync(output, { recursive: true });
writeFileSync(
  new URL('creator-reference-drafts.json', output),
  JSON.stringify(records, null, 2) + '\n',
);
