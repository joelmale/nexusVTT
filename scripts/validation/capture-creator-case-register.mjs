import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const source = new URL(
  '../../apps/docs/platform/integrations/archive/character-creation-review.md',
  import.meta.url,
);
const text = readFileSync(source, 'utf8');
const cases = [];
for (const line of text.split(/\r?\n/)) {
  const ticket = line.match(
    /^\| \*\*((?:CR|H|CS)-\d+) — ([^*]+)\*\*; ([^|]+)\|(.+)\|\s*$/,
  );
  if (!ticket) continue;
  const [work, ...acceptance] = ticket[4].split('|');
  const id = ticket[1];
  cases.push({
    id,
    title: ticket[2].trim(),
    ownerRoles: ticket[3].split(';')[0].trim(),
    ownerAlias: 'Codex',
    status: 'not run',
    evidenceReviewRequired: true,
    requirement: work.trim(),
    acceptance: acceptance.join('|').trim(),
    evidence: [],
    defects: [],
    reviewerAlias: 'DM',
    tranches: id.startsWith('CR-')
      ? ['T-01', 'T-02', 'T-03', 'T-04', 'T-05']
      : id.startsWith('H-')
        ? ['T-06', 'T-08']
        : ['T-06'],
  });
}
cases.push({
  id: 'Q-01',
  title: 'Verify production paths, not reconstructed payloads',
  ownerRoles: 'QA + host/Studio/API maintainers',
  ownerAlias: 'Codex',
  status: 'not run',
  evidenceReviewRequired: true,
  requirement: 'Execute the full Q-01 checklist in the referenced repair plan.',
  acceptance:
    'Every applicable subcriterion has actual server-backed evidence, exact candidate identity and independent review.',
  evidence: [],
  defects: [],
  reviewerAlias: 'DM',
  tranches: ['T-06', 'T-07', 'T-08'],
});
const qSection = text
  .split('### Q-01 — Verify production paths, not reconstructed payloads')[1]
  ?.split('Existing fixtures/mocks')[0];
// Paragraphs wrap across lines; capture until the next numbered criterion.
const qBlocks = (qSection ?? '')
  .split(/\r?\n(?=[1-5]\. \*\*)/)
  .filter((block) => /^[1-5]\. \*\*/.test(block));
if (qBlocks.length !== 5)
  throw new Error(
    'Q-01 checklist must contain five independently tracked criteria.',
  );
for (const block of qBlocks) {
  const heading = block.match(/^([1-5])\. \*\*([^*]+)\*\*/);
  cases.push({
    id: `Q-01.${heading[1]}`,
    parentId: 'Q-01',
    title: heading[2].replace(/:$/, ''),
    ownerRoles: 'QA + independent RULES/HOST/API reviewers',
    ownerAlias: 'Codex',
    reviewerAlias: 'DM',
    status: 'not run',
    evidenceReviewRequired: true,
    requirement: block.replace(/\r?\n\s*/g, ' ').trim(),
    acceptance:
      'Execute the complete criterion against the identified candidate and record independent review.',
    evidence: [],
    defects: [],
    tranches: ['T-01', 'T-06', 'T-07', 'T-08'],
  });
}
if (
  new Set(cases.map((entry) => entry.id)).size !== cases.length ||
  cases.length < 20
)
  throw new Error(
    'Acceptance register extraction is incomplete or contains duplicate tickets.',
  );
const creatorChecks = {
  'CR-01': ['packages/character-creator/src/tests/fixtures/referenceBuilds.ts'],
  'CR-02': ['packages/character-creator/src/adapters/draftAdapter.ts'],
  'CR-03': ['packages/character-creator/src/services/catalogResolver.test.ts'],
  'CR-04': ['packages/character-creator/src/services/loadoutResolver.test.ts'],
  'CR-05': [
    'packages/character-creator/src/services/castingSources.test.ts',
    'packages/character-creator/src/services/classFreeCasting.test.ts',
  ],
  'CR-06': [
    'packages/character-creator/src/services/classResources.test.ts',
    'packages/character-creator/src/services/classMechanics.test.ts',
  ],
  'CR-07': ['packages/character-creator/src/services/draftEvaluator.test.ts'],
  'CR-08': [
    'packages/character-creator/src/services/recommendationService.test.ts',
  ],
  'CR-09': ['packages/character-creator/src/services/guidanceService.ts'],
  'CR-10': ['packages/character-creator/src/tests/supportInventory.test.ts'],
};
const manualInstructions =
  'apps/docs/platform/integrations/archive/character-creation-manual-acceptance.md';
const remainingIssues =
  'apps/docs/platform/integrations/archive/character-creation-tranches-1-3-evidence.md';
for (const entry of cases) {
  const paths =
    creatorChecks[entry.id] ??
    (entry.id.startsWith('CS-') || entry.id === 'Q-01.4'
      ? [
          'apps/vtt/tests/e2e/studio-authoring.smoke.spec.ts',
          'apps/vtt/tests/e2e/studio-deployment.smoke.spec.ts',
        ]
      : entry.id.startsWith('H-') || entry.id.startsWith('Q-')
        ? ['apps/vtt/tests/e2e/creator-host-matrix.smoke.spec.ts']
        : []);
  for (const path of [...paths, manualInstructions, remainingIssues]) {
    if (!existsSync(new URL(`../../${path}`, import.meta.url)))
      throw new Error(`Acceptance reference does not exist: ${path}`);
  }
  entry.criteria = (
    entry.id.startsWith('Q-')
      ? [entry.requirement]
      : entry.acceptance.split(/(?<=[.!?])\s+(?=[A-Z])/u)
  ).map((requirement, index) => ({
    id: `${entry.id}.A${index + 1}`,
    requirement,
    ownerAlias: 'Codex',
    reviewerAlias: 'DM',
    status: 'not run',
    verification: {
      automatedStartingPoints: paths,
      manualInstructions,
      unresolvedImplementationRegister: remainingIssues,
      instructions:
        'Check every clause against the named candidate. Add the specific inputs, independently expected values, exact command or manual steps and report before recording a pass. Starting-point files are not proof that this entire criterion is covered.',
    },
    candidate: null,
    inputs: null,
    expectedResult: requirement,
    evidence: [],
  }));
}
const register = {
  schemaVersion: 2,
  baselineCommit: '38ba98566372f3d229ad572e10236bb9a16f7a50',
  requirementsFile:
    'apps/docs/platform/integrations/archive/character-creation-review.md',
  requirementsSha256: createHash('sha256')
    .update(text.replace(/\r\n/g, '\n'))
    .digest('hex'),
  notes: [
    'Not-run refers to reconciliation against the complete acceptance criterion; prior partial execution remains in the evidence ledger.',
    'DM owns independent rules review, accessibility review and the shared test environment. Assignment does not record approval; the shared candidate URL and review results remain pending.',
  ],
  owners: {
    engineering: 'Codex',
    independentRules: 'DM',
    accessibility: 'DM',
    testEnvironment: 'DM',
  },
  sourceDecisions: {
    artificer: {
      requestedScope:
        'Broad Artificer support using compatible available data; supersedes the earlier Wayfinder-only choice.',
      recommendedFoundations: {
        2014: "Tasha's Cauldron of Everything (2020)",
        2024: 'Eberron: Forge of the Artificer (2025)',
      },
      mergePolicy:
        'Retain source provenance, deduplicate equivalent options, and apply the selected edition foundation when features replace one another. Do not stack Infuse Item with Replicate Magic Item or mix their progression tables.',
      sources: [
        'https://dnd5e.wikidot.com/artificer',
        'https://www.dndbeyond.com/posts/908-artificer-101-alchemist-from-tashas-cauldron-of',
        'https://www.dndbeyond.com/posts/2106-whats-new-with-the-artificer-in-eberron-forge-of',
      ],
      verification:
        'The user supplied the Wikidot legacy Artificer reference on 2026-10-27. Base progression and resource facts were checked against it. It is a community reference for the legacy class, not evidence for the 2025 replacement mechanics. Subclass, infusion/item-plan and full spell-list coverage and independent acceptance remain required.',
    },
  },
  testEnvironment: {
    url: null,
    build: null,
    status: 'blocked',
    reason: 'A reachable isolated candidate environment has not been assigned.',
  },
  devices: [
    { setup: 'Windows / NVDA / Chrome and Firefox', status: 'not run' },
    {
      setup: 'MacBook / VoiceOver / Safari and Edge',
      reportedEdgeVersion: '156.0.4314.42',
      status: 'not run',
    },
    { setup: 'iPhone / VoiceOver / Safari', status: 'not run' },
    { setup: 'iPad / VoiceOver / Safari', status: 'not run' },
    { setup: 'Android / TalkBack / Chrome', status: 'not run' },
  ],
  cases,
};
writeFileSync(
  new URL(
    '../../apps/docs/static/validation/creator-acceptance-register.json',
    import.meta.url,
  ),
  JSON.stringify(register, null, 2) + '\n',
);
console.log(
  `Captured ${cases.length} acceptance tickets; no prior partial result was promoted to a complete pass.`,
);
