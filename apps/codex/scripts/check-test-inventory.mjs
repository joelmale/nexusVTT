import { readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadServiceCatalog } from '../../../scripts/ci/service-catalog.mjs';

const codexDirectory = join(dirname(fileURLToPath(import.meta.url)), '..');
const servicesDirectory = join(codexDirectory, 'services');
const catalog = loadServiceCatalog();
const serviceConfigs = Object.fromEntries(
  Object.values(catalog.targets)
    .filter((target) => target.service !== undefined)
    .map((target) => [target.service.name, target.service]),
);

const directoryEntries = await readdir(servicesDirectory, {
  withFileTypes: true,
});
const serviceNames = directoryEntries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const declaredServiceNames = Object.keys(serviceConfigs).sort();

if (JSON.stringify(serviceNames) !== JSON.stringify(declaredServiceNames)) {
  throw new Error(
    `Codex service inventory changed. Found [${serviceNames.join(', ')}], ` +
      `catalog declares [${declaredServiceNames.join(', ')}]. Update .github/ci/affected-targets.json.`,
  );
}

const SUPPORTED_LANGUAGES = new Set(['typescript', 'python']);
const isSourceFile = (path, language) =>
  language === 'python'
    ? path.endsWith('.py')
    : /\.(?:ts|tsx)$/.test(path) && !path.endsWith('.d.ts');
const isTestFile = (path, language) =>
  language === 'python'
    ? /(?:^|[\\/])(?:test_[^\\/]+|[^\\/]+_test)\.py$/.test(path)
    : /\.(?:test|spec)\.(?:ts|tsx)$/.test(path);
const isIntegrationTest = (path, language) =>
  language === 'python'
    ? /(?:^|[\\/])(?:test_[^\\/]*integration[^\\/]*|[^\\/]*integration[^\\/]*_test)\.py$/.test(
        path,
      )
    : /\.integration\.test\.(?:ts|tsx)$/.test(path);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (
      entry.name === 'dist' ||
      entry.name === 'node_modules' ||
      entry.name === 'coverage' ||
      entry.name === '__pycache__' ||
      entry.name === '.pytest_cache' ||
      entry.name === '.venv'
    ) {
      continue;
    }

    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }

  return files;
}

let failed = false;

for (const serviceName of serviceNames) {
  const serviceDirectory = join(servicesDirectory, serviceName);
  const serviceConfig = serviceConfigs[serviceName];
  const language = serviceConfig.language;
  if (!SUPPORTED_LANGUAGES.has(language)) {
    console.error(`${serviceName} has unknown source language: ${language}`);
    failed = true;
    continue;
  }
  const files = await collectFiles(serviceDirectory);
  const testFiles = files.filter((path) => isTestFile(path, language));
  const integrationTests = testFiles.filter((path) =>
    isIntegrationTest(path, language),
  );
  const unitTests = testFiles.filter(
    (path) => !isIntegrationTest(path, language),
  );
  const sourceRoot = join(serviceDirectory, 'src');
  const sourceFiles = files.filter(
    (path) =>
      path.startsWith(sourceRoot) &&
      isSourceFile(path, language) &&
      !isTestFile(path, language),
  );
  const policy = serviceConfig.testPolicy;

  console.log(
    `${serviceName}: ${sourceFiles.length} ${language} source files, ` +
      `${unitTests.length} unit test files, ${integrationTests.length} integration test files (${policy})`,
  );

  if (policy === 'none' && testFiles.length > 0) {
    console.error(
      `${serviceName} is marked as having no tests, but these tests now exist:\n` +
        testFiles
          .map((path) => `  - ${relative(codexDirectory, path)}`)
          .join('\n') +
        '\nUpdate the service catalog and CI so the new tests execute.',
    );
    failed = true;
  } else if (policy === 'unit' && unitTests.length === 0) {
    console.error(
      `${serviceName} requires unit tests, but none were discovered.`,
    );
    failed = true;
  } else if (
    policy === 'unit-and-integration' &&
    (unitTests.length === 0 || integrationTests.length === 0)
  ) {
    console.error(
      `${serviceName} requires both unit and integration tests, but discovered ` +
        `${unitTests.length} unit and ${integrationTests.length} integration test files.`,
    );
    failed = true;
  } else if (!['none', 'unit', 'unit-and-integration'].includes(policy)) {
    console.error(`${serviceName} has unknown test policy: ${policy}`);
    failed = true;
  }
}

if (failed) {
  process.exitCode = 1;
}
