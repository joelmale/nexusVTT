import { execFileSync, spawnSync } from 'node:child_process';

const argumentsByName = new Map();
for (const argument of process.argv.slice(2)) {
  const [name, value = true] = argument.split('=', 2);
  const values = argumentsByName.get(name) ?? [];
  values.push(value);
  argumentsByName.set(name, values);
}

const remote = argumentsByName.get('--remote')?.at(-1) ?? 'origin';
const base = argumentsByName.get('--base')?.at(-1) ?? `${remote}/master`;
const apply = argumentsByName.has('--apply');
const allowlist = new Set(
  (argumentsByName.get('--allow') ?? [])
    .flatMap((value) => String(value).split(','))
    .filter(Boolean),
);

const git = (args, options = {}) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  }).trim();

const succeeds = (args) =>
  spawnSync('git', args, { stdio: 'ignore' }).status === 0;

git(['rev-parse', '--show-toplevel']);
git(['rev-parse', '--verify', `${base}^{commit}`]);

const baseTrees = new Map(
  git(['log', '--format=%H%x09%T', base])
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [commit, tree] = line.split('\t');
      return [tree, commit];
    }),
);

const prefix = `refs/remotes/${remote}/`;
const branches = git([
  'for-each-ref',
  '--format=%(refname)%09%(objectname:short)%09%(committerdate:short)',
  prefix,
])
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [ref, commit, date] = line.split('\t');
    return { branch: ref.slice(prefix.length), commit, date, ref };
  })
  .filter(({ branch }) => branch !== 'HEAD' && `${remote}/${branch}` !== base);

const results = branches.map((entry) => {
  const ancestor = succeeds(['merge-base', '--is-ancestor', entry.ref, base]);
  const tree = git(['show', '-s', '--format=%T', entry.ref]);
  const equivalentCommit = baseTrees.get(tree);
  const classification = ancestor
    ? 'merged'
    : equivalentCommit
      ? `tree-equivalent:${equivalentCommit.slice(0, 12)}`
      : 'unique';

  return {
    ...entry,
    classification,
    safe: ancestor || Boolean(equivalentCommit),
  };
});

console.log('branch\tcommit\tdate\tclassification');
for (const result of results) {
  console.log(
    `${result.branch}\t${result.commit}\t${result.date}\t${result.classification}`,
  );
}

if (!apply) {
  console.log(
    '\nDry run only. Pass --apply with one or more --allow=<branch> values.',
  );
  process.exit(0);
}

if (allowlist.size === 0) {
  throw new Error('--apply requires an explicit --allow=<branch> allowlist');
}

const selected = results.filter(({ branch }) => allowlist.has(branch));
const unknown = [...allowlist].filter(
  (branch) => !results.some((result) => result.branch === branch),
);
const unsafe = selected.filter(({ safe }) => !safe);

if (unknown.length > 0 || unsafe.length > 0) {
  const problems = [
    ...unknown.map((branch) => `${branch}: not found`),
    ...unsafe.map(({ branch }) => `${branch}: contains unique work`),
  ];
  throw new Error(`Deletion preflight failed:\n${problems.join('\n')}`);
}

for (const { branch } of selected) {
  git(['push', remote, '--delete', branch], { stdio: 'inherit' });
}
