/**
 * One-shot cleanup for the monorepo migration.
 *
 * The pre-migration Dependabot config opened one PR per workspace directory.
 * The consolidated root config (.github/dependabot.yml) resolves every
 * workspace from the single root lockfile instead, so those per-directory
 * version PRs can never merge cleanly and will be regenerated in grouped form
 * on the next scheduled run.
 *
 * Only `dependabot/npm_and_yarn/apps/**` version updates are closed. Anything
 * security-driven is held back deliberately: closing a Dependabot security PR
 * reads as a dismissal, and Dependabot will not recreate it for the same
 * alert. Triage those by hand against the repository's Dependabot alerts.
 *
 * Run AFTER the consolidated config has landed on the default branch --
 * closing earlier just lets the old config reopen everything.
 *
 * Usage:
 *   node scripts/close-superseded-dependabot-prs.mjs            # dry run
 *   node scripts/close-superseded-dependabot-prs.mjs --apply    # close + delete branches
 *
 * This script can be deleted once the cleanup has run.
 */
import { execFileSync } from 'node:child_process';

const argumentsByName = new Map();
for (const argument of process.argv.slice(2)) {
  const [name, value = true] = argument.split('=', 2);
  const values = argumentsByName.get(name) ?? [];
  values.push(value);
  argumentsByName.set(name, values);
}

const apply = argumentsByName.has('--apply');
const limit = Number(argumentsByName.get('--limit')?.at(-1) ?? 200);

const gh = (args) =>
  execFileSync('gh', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

/** Branch prefix written by the retired per-directory npm config. */
const SUPERSEDED_PREFIX = 'dependabot/npm_and_yarn/apps/';

/** Dependabot names grouped *security* PRs after the ecosystem, not a package. */
const GROUPED_SECURITY_TITLE = /bump the npm_and_yarn group/i;

const pullRequests = JSON.parse(
  gh([
    'pr',
    'list',
    '--author',
    'app/dependabot',
    '--state',
    'open',
    '--limit',
    String(limit),
    '--json',
    'number,title,headRefName,labels',
  ]),
);

const isSecurityLabelled = (pullRequest) =>
  (pullRequest.labels ?? []).some((label) => /security/i.test(label.name));

const superseded = [];
const held = [];

for (const pullRequest of pullRequests) {
  const supersededByRootConfig =
    pullRequest.headRefName.startsWith(SUPERSEDED_PREFIX) &&
    !GROUPED_SECURITY_TITLE.test(pullRequest.title) &&
    !isSecurityLabelled(pullRequest);

  (supersededByRootConfig ? superseded : held).push(pullRequest);
}

const describe = (pullRequest) =>
  `#${pullRequest.number}  ${pullRequest.headRefName}`;

console.log(`Open Dependabot PRs: ${pullRequests.length}`);
console.log(`  superseded (will close): ${superseded.length}`);
console.log(`  held for manual triage:  ${held.length}\n`);

console.log('HELD -- review these against the Dependabot alerts:');
for (const pullRequest of held) console.log(`  ${describe(pullRequest)}`);

console.log(`\n${apply ? 'CLOSING' : 'WOULD CLOSE'}:`);
for (const pullRequest of superseded) console.log(`  ${describe(pullRequest)}`);

if (!apply) {
  console.log('\nDry run. Re-run with --apply to close and delete branches.');
  process.exit(0);
}

let closed = 0;
let failed = 0;

for (const pullRequest of superseded) {
  try {
    gh([
      'pr',
      'close',
      String(pullRequest.number),
      '--delete-branch',
      '--comment',
      'Superseded by the consolidated root Dependabot configuration: npm now ' +
        'resolves every workspace from the single root lockfile, so this ' +
        'per-directory update can no longer apply. An equivalent grouped ' +
        'update will be opened from the repository root.',
    ]);
    closed += 1;
    console.log(`  closed ${describe(pullRequest)}`);
  } catch (error) {
    failed += 1;
    console.error(`  FAILED ${describe(pullRequest)}: ${error.message}`);
  }
}

console.log(`\nClosed ${closed}, failed ${failed}, held ${held.length}.`);
process.exit(failed > 0 ? 1 : 0);
