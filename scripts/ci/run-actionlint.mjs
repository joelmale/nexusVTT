#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIRECTORY = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const ACTIONLINT_IMAGE = 'rhysd/actionlint:1.7.12';

function run(command, arguments_, options = {}) {
  return spawnSync(command, arguments_, {
    cwd: ROOT_DIRECTORY,
    encoding: 'utf8',
    stdio: 'inherit',
    ...options,
  });
}

function available(command, arguments_) {
  const result = spawnSync(command, arguments_, {
    cwd: ROOT_DIRECTORY,
    encoding: 'utf8',
    stdio: 'ignore',
  });
  return result.status === 0;
}

const configuredBinary = process.env.ACTIONLINT_BIN;
let result;

if (configuredBinary) {
  result = run(configuredBinary, []);
} else if (available('actionlint', ['-version'])) {
  result = run('actionlint', []);
} else if (available('docker', ['version'])) {
  result = run('docker', [
    'run',
    '--rm',
    '-v',
    `${ROOT_DIRECTORY}:/repo`,
    '-w',
    '/repo',
    ACTIONLINT_IMAGE,
  ]);
} else {
  process.stderr.write(
    'actionlint is unavailable. Install actionlint, set ACTIONLINT_BIN, or start Docker.\n',
  );
  process.exitCode = 1;
}

if (result !== undefined) {
  if (result.error) {
    process.stderr.write(
      `actionlint failed to start: ${result.error.message}\n`,
    );
    process.exitCode = 1;
  } else {
    process.exitCode = result.status ?? 1;
  }
}
