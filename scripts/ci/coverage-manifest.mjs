#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const SCHEMA_VERSION = 1;
const SHA_PATTERN = /^[0-9a-f]{40}$/;

function fail(message) {
  throw new Error(message);
}

function parseArguments(argv) {
  const [command, ...tokens] = argv;
  const options = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith('--')) fail(`Unexpected argument: ${token}`);
    const value = tokens[index + 1];
    if (!value || value.startsWith('--')) fail(`Missing value for ${token}`);
    options[token.slice(2)] = value;
    index += 1;
  }
  return { command, options };
}

function vitestVersion() {
  const manifestPath = require.resolve('vitest/package.json');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')).version;
}

function sha256(filePath) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(filePath))
    .digest('hex');
}

function requireSourceSha(value) {
  if (!SHA_PATTERN.test(value ?? '')) {
    fail('source SHA must be a full lowercase 40-character Git SHA');
  }
  return value;
}

function writeManifest(options) {
  const kind = options.kind;
  if (kind !== 'unit' && kind !== 'integration') {
    fail('kind must be unit or integration');
  }

  const index = Number.parseInt(options.index ?? '1', 10);
  const count = Number.parseInt(options.count ?? '1', 10);
  if (!Number.isInteger(index) || !Number.isInteger(count) || index < 1 || index > count) {
    fail('index and count must describe a valid one-based shard');
  }

  const blobPath = path.resolve(options.blob ?? '');
  if (!fs.statSync(blobPath, { throwIfNoEntry: false })?.isFile()) {
    fail(`coverage blob does not exist: ${blobPath}`);
  }

  const outputPath = path.resolve(options.output ?? 'coverage-manifest.json');
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    sourceSha: requireSourceSha(options['source-sha']),
    tool: { name: 'vitest', version: vitestVersion() },
    report: {
      kind,
      index,
      count,
      file: path.basename(blobPath),
      bytes: fs.statSync(blobPath).size,
      sha256: sha256(blobPath),
    },
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${outputPath}\n`);
}

function findManifests(directory) {
  const manifests = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.name === 'coverage-manifest.json') manifests.push(entryPath);
    }
  };
  visit(directory);
  return manifests.sort();
}

function validateManifestShape(manifest, manifestPath, sourceSha, version) {
  if (manifest.schemaVersion !== SCHEMA_VERSION) fail(`unsupported manifest schema: ${manifestPath}`);
  if (manifest.sourceSha !== sourceSha) fail(`source SHA mismatch: ${manifestPath}`);
  if (manifest.tool?.name !== 'vitest' || manifest.tool?.version !== version) {
    fail(`Vitest version mismatch: ${manifestPath}`);
  }
  if (!['unit', 'integration'].includes(manifest.report?.kind)) {
    fail(`invalid report kind: ${manifestPath}`);
  }
  if (!Number.isInteger(manifest.report.index) || !Number.isInteger(manifest.report.count)) {
    fail(`invalid shard metadata: ${manifestPath}`);
  }

  const blobPath = path.join(path.dirname(manifestPath), manifest.report.file ?? '');
  const stat = fs.statSync(blobPath, { throwIfNoEntry: false });
  if (!stat?.isFile()) fail(`missing coverage blob for ${manifestPath}`);
  if (stat.size !== manifest.report.bytes || sha256(blobPath) !== manifest.report.sha256) {
    fail(`coverage blob integrity check failed: ${blobPath}`);
  }
  return { manifest, blobPath };
}

function validateAndStage(options) {
  const directory = path.resolve(options.directory ?? '');
  const outputDirectory = path.resolve(options.output ?? '.vitest-reports');
  if (!fs.statSync(directory, { throwIfNoEntry: false })?.isDirectory()) {
    fail(`coverage artifact directory does not exist: ${directory}`);
  }

  const sourceSha = requireSourceSha(options['source-sha']);
  const expectedUnitCount = Number.parseInt(options['unit-count'] ?? '3', 10);
  const version = vitestVersion();
  const entries = findManifests(directory).map((manifestPath) => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return validateManifestShape(manifest, manifestPath, sourceSha, version);
  });

  const expected = new Set([
    ...Array.from({ length: expectedUnitCount }, (_, index) => `unit:${index + 1}:${expectedUnitCount}`),
    'integration:1:1',
  ]);
  const observed = new Set();
  for (const { manifest } of entries) {
    const key = `${manifest.report.kind}:${manifest.report.index}:${manifest.report.count}`;
    if (observed.has(key)) fail(`duplicate coverage report: ${key}`);
    observed.add(key);
  }

  const missing = [...expected].filter((key) => !observed.has(key));
  const unexpected = [...observed].filter((key) => !expected.has(key));
  if (missing.length || unexpected.length) {
    fail(`coverage report set mismatch; missing=[${missing}] unexpected=[${unexpected}]`);
  }

  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.mkdirSync(outputDirectory, { recursive: true });
  for (const { manifest, blobPath } of entries) {
    const destination = path.join(
      outputDirectory,
      `${manifest.report.kind}-${manifest.report.index}-of-${manifest.report.count}.json`,
    );
    fs.copyFileSync(blobPath, destination);
  }

  process.stdout.write(
    `${JSON.stringify({ sourceSha, vitestVersion: version, reports: [...observed].sort() }, null, 2)}\n`,
  );
}

try {
  const { command, options } = parseArguments(process.argv.slice(2));
  if (command === 'create') writeManifest(options);
  else if (command === 'validate') validateAndStage(options);
  else fail('usage: coverage-manifest.mjs <create|validate> [options]');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
