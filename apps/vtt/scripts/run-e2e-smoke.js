#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

// Docker Compose files and test paths are relative to the VTT workspace, which
// is where npm runs this script from. It is NOT the repository root -- npm owns
// one lockfile above it, and dependencies hoist up there.
const workspaceRoot = process.cwd();
const composeFile = path.join('docker', 'docker-compose.smoke.yml');
const projectName = process.env.E2E_PROJECT_NAME ?? 'nexus-vtt-e2e';
const frontendPort = process.env.E2E_FRONTEND_PORT ?? '4173';
const backendPort = process.env.E2E_BACKEND_PORT ?? '15001';
const backendPeerPort = process.env.E2E_BACKEND_PEER_PORT ?? '15002';
const assetPort = process.env.E2E_ASSET_PORT ?? '15003';
// @playwright/test hoists to the repository-root node_modules, so it cannot be
// located by joining onto the workspace directory. Resolve it instead, and take
// the CLI entry point from the package's own bin field -- "./cli.js" is not in
// its exports map, so it cannot be resolved as a subpath directly.
const require = createRequire(import.meta.url);

function resolvePlaywrightCli() {
  try {
    const manifestPath = require.resolve('@playwright/test/package.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const binary =
      typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.playwright;
    return path.join(path.dirname(manifestPath), binary ?? 'cli.js');
  } catch {
    return null;
  }
}

const playwrightCli = resolvePlaywrightCli();
// This script owns the managed Docker stack, so it runs the stack-backed
// `chromium` project only. The `ui` project drives a plain Vite dev server that
// playwright.config.ts starts itself, and that webServer is disabled once
// E2E_BASE_URL is set below -- so without this filter the UI specs would run
// here against a server that was never started. Honour an explicit --project
// from the caller.
const passthroughArgs = process.argv.slice(2);
const hasProjectFilter = passthroughArgs.some(
  (argument) => argument === '--project' || argument.startsWith('--project='),
);
const playwrightArgs = hasProjectFilter
  ? passthroughArgs
  : ['--project=chromium', ...passthroughArgs];
const keepStack = process.env.E2E_KEEP_STACK === '1';

let activeChild = null;
let interrupted = false;

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: workspaceRoot,
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
  if (!playwrightCli || !fs.existsSync(playwrightCli)) {
    throw new Error(
      'Playwright is not installed. Run npm install and npm run test:e2e:install.',
    );
  }

  let composeAttempted = false;
  let exitCode = 1;

  try {
    composeAttempted = true;
    const buildFlag =
      process.env.E2E_NO_BUILD === '1' || process.env.E2E_PREBUILT === '1'
        ? '--no-build'
        : '--build';
    exitCode = await runCommand(
      'docker',
      composeArgs(
        'up',
        buildFlag,
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
