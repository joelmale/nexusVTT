import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const applicationRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const repositoryRoot = path.resolve(applicationRoot, '..', '..');
const packageRoot = [
  path.join(repositoryRoot, 'node_modules', '@3d-dice', 'dice-box-threejs'),
  path.join(applicationRoot, 'node_modules', '@3d-dice', 'dice-box-threejs'),
].find((candidate) => existsSync(candidate));

if (!packageRoot) {
  throw new Error(
    'Could not find the @3d-dice/dice-box-threejs package directory.',
  );
}

const sourceRoot = path.join(packageRoot, 'public');
const targetRoot = path.join(
  applicationRoot,
  'public',
  'assets',
  'dice-box-threejs',
);
const checkOnly = process.argv.includes('--check');

function hash(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function filesEquivalent(sourcePath, targetPath) {
  const source = await readFile(sourcePath);
  let target;
  try {
    target = await readFile(targetPath);
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT')
      return false;
    throw error;
  }
  return hash(source) === hash(target);
}

async function syncDirectory(sourceDirectory, targetDirectory, staleFiles) {
  const entries = await readdir(sourceDirectory, { withFileTypes: true });
  await mkdir(targetDirectory, { recursive: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDirectory, entry.name);
    const targetPath = path.join(targetDirectory, entry.name);
    if (entry.isDirectory()) {
      await syncDirectory(sourcePath, targetPath, staleFiles);
      continue;
    }
    if (!entry.isFile() || (await filesEquivalent(sourcePath, targetPath)))
      continue;

    staleFiles.push(path.relative(repositoryRoot, targetPath));
    if (!checkOnly) await copyFile(sourcePath, targetPath);
  }
}

const staleFiles = [];
await syncDirectory(sourceRoot, targetRoot, staleFiles);

if (checkOnly && staleFiles.length > 0) {
  console.error(
    `Dice assets are stale:\n${staleFiles.map((file) => `- ${file}`).join('\n')}`,
  );
  process.exitCode = 1;
} else if (staleFiles.length > 0) {
  console.log(`Synchronized ${staleFiles.length} dice asset file(s).`);
} else {
  console.log('Dice assets are current.');
}
