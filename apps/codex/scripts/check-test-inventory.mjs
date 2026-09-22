import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const codexDirectory = join(dirname(fileURLToPath(import.meta.url)), '..');
const servicesDirectory = join(codexDirectory, 'services');
const manifestPath = join(codexDirectory, 'test-inventory.json');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (manifest.schemaVersion !== 1 || typeof manifest.services !== 'object') {
  throw new Error('Unsupported or malformed Codex test inventory manifest');
}

const directoryEntries = await readdir(servicesDirectory, { withFileTypes: true });
const serviceNames = directoryEntries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const declaredServiceNames = Object.keys(manifest.services).sort();

if (JSON.stringify(serviceNames) !== JSON.stringify(declaredServiceNames)) {
  throw new Error(
    `Codex service inventory changed. Found [${serviceNames.join(', ')}], ` +
      `manifest declares [${declaredServiceNames.join(', ')}]. Update test-inventory.json and CI explicitly.`,
  );
}

const isTypeScriptSource = (path) => /\.(?:ts|tsx)$/.test(path) && !path.endsWith('.d.ts');
const isTestFile = (path) => /\.(?:test|spec)\.(?:ts|tsx)$/.test(path);
const isIntegrationTest = (path) => /\.integration\.test\.(?:ts|tsx)$/.test(path);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === 'dist' || entry.name === 'node_modules') {
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
  const files = await collectFiles(join(serviceDirectory, 'src'));
  const testFiles = files.filter(isTestFile);
  const integrationTests = testFiles.filter(isIntegrationTest);
  const unitTests = testFiles.filter((path) => !isIntegrationTest(path));
  const sourceFiles = files.filter((path) => isTypeScriptSource(path) && !isTestFile(path));
  const policy = manifest.services[serviceName].testPolicy;

  console.log(
    `${serviceName}: ${sourceFiles.length} source files, ${unitTests.length} unit test files, ` +
      `${integrationTests.length} integration test files (${policy})`,
  );

  if (policy === 'none' && testFiles.length > 0) {
    console.error(
      `${serviceName} is marked as having no tests, but these tests now exist:\n` +
        testFiles.map((path) => `  - ${relative(codexDirectory, path)}`).join('\n') +
        '\nUpdate test-inventory.json and CI so the new tests execute.',
    );
    failed = true;
  } else if (policy === 'unit' && unitTests.length === 0) {
    console.error(`${serviceName} requires unit tests, but none were discovered.`);
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
