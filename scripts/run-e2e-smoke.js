#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repositoryRoot = process.cwd();
const composeFile = path.join('docker', 'docker-compose.smoke.yml');
const projectName = process.env.E2E_PROJECT_NAME ?? 'nexus-vtt-e2e';
const frontendPort = process.env.E2E_FRONTEND_PORT ?? '4173';
const backendPort = process.env.E2E_BACKEND_PORT ?? '15001';
const backendPeerPort = process.env.E2E_BACKEND_PEER_PORT ?? '15002';
const assetPort = process.env.E2E_ASSET_PORT ?? '15003';
const playwrightCli = path.join(
  repositoryRoot,
  'node_modules',
  '@playwright',
  'test',
  'cli.js',
);
const playwrightArgs = process.argv.slice(2);
const keepStack = process.env.E2E_KEEP_STACK === '1';

let activeChild = null;
let interrupted = false;

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repositoryRoot,
      env: options.env ?? process.env,
      stdio: 'inherit',
      windowsHide: true,
    });
    activeChild = child;

    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (activeChild === child) activeChild = null;
      resolve(code ?? (signal ? 130 : 1));
    });
  });
}

function composeArgs(...args) {
  return ['compose', '-p', projectName, '-f', composeFile, ...args];
}

function handleSignal(signal) {
  interrupted = true;
  activeChild?.kill(signal);
}

process.once('SIGINT', () => handleSignal('SIGINT'));
process.once('SIGTERM', () => handleSignal('SIGTERM'));

async function main() {
  if (!fs.existsSync(playwrightCli)) {
    throw new Error(
      'Playwright is not installed. Run npm install and npm run test:e2e:install.',
    );
  }

  let composeAttempted = false;
  let exitCode = 1;

  try {
    composeAttempted = true;
    exitCode = await runCommand(
      'docker',
      composeArgs(
        'up',
        '--build',
        '--detach',
        '--wait',
        '--wait-timeout',
        '240',
      ),
    );
    if (exitCode !== 0) {
      console.error('Smoke stack startup failed; container logs follow.');
      await runCommand('docker', composeArgs('logs', '--no-color'));
      throw new Error(`Smoke stack failed to start (exit ${exitCode}).`);
    }

    const testEnvironment = {
      ...process.env,
      E2E_BASE_URL:
        process.env.E2E_BASE_URL ?? `http://127.0.0.1:${frontendPort}`,
      E2E_BACKEND_URL:
        process.env.E2E_BACKEND_URL ?? `http://127.0.0.1:${backendPort}`,
      E2E_BACKEND_PEER_URL:
        process.env.E2E_BACKEND_PEER_URL ??
        `http://127.0.0.1:${backendPeerPort}`,
      E2E_ASSET_URL:
        process.env.E2E_ASSET_URL ?? `http://127.0.0.1:${assetPort}`,
      E2E_MANAGED_STACK: '1',
      E2E_PROJECT_NAME: projectName,
    };

    exitCode = await runCommand(
      process.execPath,
      [playwrightCli, 'test', ...playwrightArgs],
      { env: testEnvironment },
    );
  } finally {
    if (composeAttempted && !keepStack) {
      const cleanupCode = await runCommand(
        'docker',
        composeArgs('down', '--volumes', '--remove-orphans'),
      );
      if (cleanupCode !== 0 && exitCode === 0) {
        exitCode = cleanupCode;
      }
    } else if (keepStack) {
      console.log(`Smoke stack retained as Docker project ${projectName}.`);
    }
  }

  process.exitCode = interrupted ? 130 : exitCode;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
