import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const source = new URL(
  '../../apps/docs/platform/integrations/character-creation-review.md',
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
const register = {
  schemaVersion: 1,
  baselineCommit: '38ba98566372f3d229ad572e10236bb9a16f7a50',
  requirementsFile:
    'apps/docs/platform/integrations/character-creation-review.md',
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
        'https://www.dndbeyond.com/posts/908-artificer-101-alchemist-from-tashas-cauldron-of',
        'https://www.dndbeyond.com/posts/2106-whats-new-with-the-artificer-in-eberron-forge-of',
      ],
      verification:
        'Foundations selected by Codex under user authorization. Full class, subclass, item-plan and spell tables still require source verification and independent DM acceptance.',
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
