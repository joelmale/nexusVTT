#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const IMAGE_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const TRANSPORTS = new Set(['local-daemon', 'registry']);

function requireString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

export function createImageProvenance(input) {
  const sourceSha = requireString(input.sourceSha, 'sourceSha');
  if (!SHA_PATTERN.test(sourceSha)) {
    throw new Error('sourceSha must be a full lowercase 40-character Git SHA');
  }
  if (input.revision !== sourceSha) {
    throw new Error(
      `image revision ${input.revision || '<missing>'} does not match ${sourceSha}`,
    );
  }

  const digest = requireString(input.digest, 'digest');
  if (!DIGEST_PATTERN.test(digest)) {
    throw new Error('digest must be a lowercase sha256 digest');
  }

  const imageName = requireString(input.imageName, 'imageName');
  if (!IMAGE_NAME_PATTERN.test(imageName)) {
    throw new Error('imageName must be a lowercase kebab-case identifier');
  }
  if (imageName === 'frontend' && input.deltaSync !== 'false') {
    throw new Error(
      `release frontend delta-sync label must be false, got ${input.deltaSync || '<missing>'}`,
    );
  }

  const transport = requireString(input.transport, 'transport');
  if (!TRANSPORTS.has(transport)) {
    throw new Error('transport must be local-daemon or registry');
  }

  const runId = requireString(input.runId, 'runId');
  const runAttempt = requireString(input.runAttempt, 'runAttempt');
  if (!POSITIVE_INTEGER_PATTERN.test(runId)) {
    throw new Error('runId must be a positive integer');
  }
  if (!POSITIVE_INTEGER_PATTERN.test(runAttempt)) {
    throw new Error('runAttempt must be a positive integer');
  }

  const provenance = {
    schemaVersion: 1,
    sourceSha,
    imageName,
    imageRef: requireString(input.imageRef, 'imageRef'),
    repository: requireString(input.repository, 'repository'),
    digest,
    platforms: requireString(input.platforms, 'platforms'),
    transport,
    buildArgs: {
      VERSION: requireString(input.version, 'version'),
      COMMIT_SHA: sourceSha,
    },
    runId,
    runAttempt,
  };

  if (imageName === 'frontend') {
    provenance.variant = { deltaSync: false };
  }

  return provenance;
}

export function parseArguments(argv) {
  const [command, ...tokens] = argv;
  const options = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith('--')) {
      throw new Error(`unexpected argument: ${token}`);
    }
    const value = tokens[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`missing value for ${token}`);
    }
    options[token.slice(2)] = value;
    index += 1;
  }
  return { command, options };
}

export function run(argv = process.argv.slice(2), environment = process.env) {
  const { command, options } = parseArguments(argv);
  if (command !== 'create') {
    throw new Error('expected command: create');
  }

  const outputPath = path.resolve(requireString(options.output, 'output'));
  const provenance = createImageProvenance({
    sourceSha: options['source-sha'],
    revision: options.revision,
    imageName: options['image-name'],
    imageRef: options['image-ref'],
    repository: options.repository,
    digest: options.digest,
    platforms: options.platforms,
    transport: options.transport,
    version: options.version,
    deltaSync: options['delta-sync'],
    runId: environment.GITHUB_RUN_ID,
    runAttempt: environment.GITHUB_RUN_ATTEMPT,
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(provenance, null, 2)}\n`);
  process.stdout.write(`${outputPath}\n`);
  return provenance;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : '';
if (import.meta.url === invokedPath) {
  try {
    run();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
