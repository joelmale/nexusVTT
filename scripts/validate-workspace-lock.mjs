import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const rootDirectory = process.cwd();
const dependencySections = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];

const readJson = async (filePath) =>
  JSON.parse(await readFile(filePath, 'utf8'));

const normalize = (value = {}) =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(value).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  );

const expandWorkspace = async (workspace) => {
  if (!workspace.endsWith('/*')) {
    return [workspace];
  }

  const parent = workspace.slice(0, -2);
  const entries = await readdir(path.join(rootDirectory, parent), {
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.posix.join(parent, entry.name));
};

const rootManifest = await readJson(path.join(rootDirectory, 'package.json'));
const lockfile = await readJson(path.join(rootDirectory, 'package-lock.json'));
const workspacePaths = (
  await Promise.all(rootManifest.workspaces.map(expandWorkspace))
).flat();
const failures = [];

for (const workspacePath of ['', ...workspacePaths]) {
  const manifestPath = workspacePath
    ? path.join(rootDirectory, workspacePath, 'package.json')
    : path.join(rootDirectory, 'package.json');
  const manifest = await readJson(manifestPath);
  const lockEntry = lockfile.packages?.[workspacePath];

  if (!lockEntry) {
    failures.push(`${workspacePath || '<root>'}: missing package-lock entry`);
    continue;
  }

  for (const section of dependencySections) {
    if (normalize(manifest[section]) !== normalize(lockEntry[section])) {
      failures.push(
        `${workspacePath || '<root>'}: ${section} differs from package-lock.json`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error('Workspace lockfile validation failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Validated package-lock.json against ${workspacePaths.length} workspaces.`,
);
