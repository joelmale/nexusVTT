import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const sourceRoot = path.join(
  repositoryRoot,
  'node_modules',
  '@3d-dice',
  'dice-box',
  'dist',
  'assets',
);
const targetRoot = path.join(repositoryRoot, 'public', 'assets', 'dice-box');
const checkOnly = process.argv.includes('--check');

function hash(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function jsonEquivalent(source, target) {
  try {
    return (
      JSON.stringify(JSON.parse(source)) === JSON.stringify(JSON.parse(target))
    );
  } catch {
    return false;
  }
}

function assertValid(condition, message) {
  if (!condition) throw new Error(`Invalid dice theme: ${message}`);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function readJson(filePath) {
  const source = await readFile(filePath, 'utf8');
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(
      `Could not parse ${path.relative(repositoryRoot, filePath)}`,
      {
        cause: error,
      },
    );
  }
}

async function validateReferencedFile(themeDirectory, reference, label) {
  assertValid(
    typeof reference === 'string' && reference.length > 0,
    `${label} is required`,
  );
  const resolved = path.resolve(themeDirectory, reference);
  const themePrefix = `${path.resolve(themeDirectory)}${path.sep}`;
  assertValid(
    resolved.startsWith(themePrefix),
    `${label} must stay inside its theme directory`,
  );
  await access(resolved);
  return resolved;
}

async function validateTheme(themeDirectory) {
  const configPath = path.join(themeDirectory, 'theme.config.json');
  const config = await readJson(configPath);
  assertValid(isRecord(config), `${configPath} must contain an object`);
  assertValid(
    typeof config.name === 'string' && config.name.length > 0,
    'name is required',
  );
  assertValid(
    typeof config.systemName === 'string' &&
      /^[A-Za-z0-9-]+$/.test(config.systemName),
    'systemName may contain only letters, numbers, and hyphens',
  );
  assertValid(
    typeof config.author === 'string' && config.author.length > 0,
    'author is required',
  );
  assertValid(
    (typeof config.version === 'number' && Number.isFinite(config.version)) ||
      (typeof config.version === 'string' && config.version.length > 0),
    'version must be a finite number or non-empty string',
  );
  assertValid(isRecord(config.material), 'material is required');
  assertValid(
    config.material.type === 'color' || config.material.type === 'standard',
    'material.type must be color or standard',
  );
  assertValid(
    Array.isArray(config.diceAvailable),
    'diceAvailable must be an array',
  );

  const diceAvailable = config.diceAvailable;
  const uniqueDice = new Set(diceAvailable);
  assertValid(
    uniqueDice.size === diceAvailable.length,
    'diceAvailable must not contain duplicates',
  );
  const supportedDice = new Set([
    'd2',
    'd4',
    'd6',
    'd8',
    'd10',
    'd12',
    'd20',
    'd100',
    'pip',
    'fate',
    'boost',
    'setback',
    'ability',
    'difficulty',
    'challenge',
    'proficiency',
  ]);
  for (const die of diceAvailable) {
    assertValid(
      typeof die === 'string' && supportedDice.has(die),
      `unsupported die identifier ${String(die)}`,
    );
  }

  const textureReferences = [
    validateReferencedFile(
      themeDirectory,
      config.material.bumpTexture,
      'material.bumpTexture',
    ),
  ];
  if (typeof config.material.diffuseTexture === 'string') {
    textureReferences.push(
      validateReferencedFile(
        themeDirectory,
        config.material.diffuseTexture,
        'material.diffuseTexture',
      ),
    );
  } else {
    assertValid(
      isRecord(config.material.diffuseTexture),
      'material.diffuseTexture is required',
    );
    textureReferences.push(
      validateReferencedFile(
        themeDirectory,
        config.material.diffuseTexture.light,
        'material.diffuseTexture.light',
      ),
      validateReferencedFile(
        themeDirectory,
        config.material.diffuseTexture.dark,
        'material.diffuseTexture.dark',
      ),
    );
  }
  if (config.material.specularTexture !== undefined) {
    textureReferences.push(
      validateReferencedFile(
        themeDirectory,
        config.material.specularTexture,
        'material.specularTexture',
      ),
    );
  }
  await Promise.all(textureReferences);

  // Texture-only themes intentionally inherit the default mesh.
  if (config.meshFile === undefined) return;
  const meshPath = await validateReferencedFile(
    themeDirectory,
    config.meshFile,
    'meshFile',
  );

  const mesh = await readJson(meshPath);
  assertValid(isRecord(mesh), 'mesh file must contain an object');
  assertValid(
    Array.isArray(mesh.meshes) && mesh.meshes.length > 0,
    'mesh file has no meshes',
  );
  assertValid(
    isRecord(mesh.colliderFaceMap),
    'mesh file has no colliderFaceMap',
  );
  const meshNames = new Set(
    mesh.meshes
      .filter((entry) => isRecord(entry) && typeof entry.name === 'string')
      .map((entry) => entry.name),
  );
  for (const die of diceAvailable) {
    // Percentile dice may intentionally reuse a d10 mesh and face map.
    const meshDie = die === 'd100' && !meshNames.has('d100') ? 'd10' : die;
    assertValid(meshNames.has(meshDie), `mesh ${meshDie} is missing`);
    assertValid(
      meshNames.has(`${meshDie}_collider`),
      `collider mesh ${meshDie}_collider is missing`,
    );
    assertValid(
      isRecord(mesh.colliderFaceMap[meshDie]),
      `colliderFaceMap.${meshDie} is missing`,
    );
  }
}

async function validateThemes(diceAssetRoot) {
  const themesRoot = path.join(diceAssetRoot, 'themes');
  const entries = await readdir(themesRoot, { withFileTypes: true });
  const themeDirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(themesRoot, entry.name));
  assertValid(themeDirectories.length > 0, 'at least one theme is required');
  await Promise.all(themeDirectories.map(validateTheme));
  return themeDirectories.length;
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

  if (path.extname(sourcePath) === '.json') {
    return jsonEquivalent(source.toString('utf8'), target.toString('utf8'));
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
const validatedThemeCount = await validateThemes(targetRoot);

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
console.log(`Validated ${validatedThemeCount} dice theme(s).`);
