#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIRECTORY = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const npmExecutable = process.env.npm_execpath
  ? process.execPath
  : process.platform === 'win32'
    ? 'npm.cmd'
    : 'npm';
const npmArguments = process.env.npm_execpath ? [process.env.npm_execpath] : [];
const steps = [
  ['workspace lock', 'check:workspace-lock'],
  ['service catalog', 'check:service-catalog'],
  ['Docker build contracts', 'check:docker-build-contracts'],
  ['CI contract tests', 'test:ci-contracts'],
  ['GitHub Actions workflows', 'check:workflows'],
];

for (const [label, script] of steps) {
  process.stdout.write(`\n== ${label} ==\n`);
  const result = spawnSync(npmExecutable, [...npmArguments, 'run', script], {
    cwd: ROOT_DIRECTORY,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.error) {
    process.stderr.write(`${label} failed to start: ${result.error.message}\n`);
    process.exitCode = 1;
    break;
  }
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}

if (!process.exitCode) {
  process.stdout.write('\nCI preflight passed.\n');
}
