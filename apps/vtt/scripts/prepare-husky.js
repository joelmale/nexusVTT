import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const applicationRoot = resolve(scriptDirectory, '..');
const repositoryRoot = resolve(applicationRoot, '..', '..');

if (!existsSync(join(repositoryRoot, '.git'))) {
  console.log('Skipping Husky installation outside a Git checkout.');
  process.exit(0);
}

const huskyBin = join(applicationRoot, 'node_modules', 'husky', 'bin.js');
const result = spawnSync(process.execPath, [huskyBin], {
  cwd: repositoryRoot,
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
