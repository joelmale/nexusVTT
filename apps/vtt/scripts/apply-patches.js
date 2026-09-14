import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path, { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

/**
 * Applies this workspace's patch-package patches against the hoisted tree.
 *
 * npm owns one lockfile at the repository root, so a patched dependency such
 * as parseurl installs into the ROOT node_modules, not apps/vtt/node_modules.
 * patch-package resolves packages relative to its working directory, and a
 * workspace postinstall runs with cwd set to the workspace -- so calling it
 * directly here fails with "Patch file found for package X which is not
 * present at node_modules/X".
 *
 * Running it from the repository root, with --patch-dir pointed back at this
 * workspace, resolves the hoisted copy. A dependency that did not hoist is
 * still found, because patch-package also walks workspace trees.
 */
const workspaceDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const patchDirectory = path.join(workspaceDirectory, 'patches');

if (!existsSync(patchDirectory) || readdirSync(patchDirectory).length === 0) {
  console.log('No patches to apply.');
  process.exit(0);
}

/** The repository root is the nearest ancestor holding the single lockfile. */
function findRepositoryRoot(startDirectory) {
  let directory = startDirectory;
  for (;;) {
    if (existsSync(path.join(directory, 'package-lock.json'))) return directory;
    const parent = dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

const repositoryRoot = findRepositoryRoot(workspaceDirectory);

if (!repositoryRoot) {
  console.error('Could not locate the repository root (no package-lock.json found).');
  process.exit(1);
}

const require = createRequire(import.meta.url);
const relativePatchDirectory = path
  .relative(repositoryRoot, patchDirectory)
  .split(path.sep)
  .join('/');

execFileSync(
  process.execPath,
  [require.resolve('patch-package/index.js'), '--patch-dir', relativePatchDirectory],
  { cwd: repositoryRoot, stdio: 'inherit' },
);
