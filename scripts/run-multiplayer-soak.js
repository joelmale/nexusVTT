#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repositoryRoot = process.cwd();
const smokeComposeFile = path.join('docker', 'docker-compose.smoke.yml');
const soakComposeFile = path.join('docker', 'docker-compose.soak.yml');
const projectName = process.env.SOAK_PROJECT_NAME ?? 'nexus-vtt-soak';
const frontendPort = process.env.E2E_FRONTEND_PORT ?? '4173';
const backendPort = process.env.E2E_BACKEND_PORT ?? '15001';
const backendPeerPort = process.env.E2E_BACKEND_PEER_PORT ?? '15002';
const toxiproxyPort = process.env.SOAK_TOXIPROXY_PORT ?? '18474';
const keepStack = process.env.SOAK_KEEP_STACK === '1';
const chaosEnabled = process.argv.includes('--chaos');
const userArguments = process.argv
  .slice(2)
  .filter((value) => value !== '--chaos');
const readyFile = path.resolve('test-results', 'multiplayer-soak.ready');
const children = new Set();
let interrupted = false;
let soakComplete = false;

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repositoryRoot,
      env: options.env ?? process.env,
      stdio: options.stdio ?? 'inherit',
      windowsHide: true,
    });
    children.add(child);
    child.once('error', reject);
    child.once('close', (code, signal) => {
      children.delete(child);
      resolve(code ?? (signal ? 130 : 1));
    });
  });
}

function composeArgs(...args) {
  return [
    'compose',
    '-p',
    projectName,
    '-f',
    smokeComposeFile,
    '-f',
    soakComposeFile,
    ...args,
  ];
}

async function requireSuccess(command, args, message) {
  const exitCode = await runCommand(command, args);
  if (exitCode !== 0) throw new Error(`${message} (exit ${exitCode})`);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForReadyFile() {
  const deadline = Date.now() + 10 * 60_000;
  while (!fs.existsSync(readyFile)) {
    if (soakComplete || interrupted) return false;
    if (Date.now() >= deadline) {
      throw new Error('Soak clients did not become ready within ten minutes.');
    }
    await delay(1_000);
  }
  return true;
}

async function configurePostgresProxy() {
  const response = await fetch(`http://127.0.0.1:${toxiproxyPort}/populate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify([
      {
        name: 'postgres',
        listen: '0.0.0.0:15432',
        upstream: 'postgres:5432',
        enabled: true,
      },
    ]),
  });
  if (!response.ok) {
    throw new Error(`Toxiproxy population failed (${response.status})`);
  }
}

async function setPostgresLatency(enabled) {
  const url = `http://127.0.0.1:${toxiproxyPort}/proxies/postgres/toxics/soak-latency`;
  if (!enabled) {
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) {
      throw new Error(
        `Could not remove PostgreSQL latency (${response.status})`,
      );
    }
    return;
  }
  const response = await fetch(
    `http://127.0.0.1:${toxiproxyPort}/proxies/postgres/toxics`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'soak-latency',
        type: 'latency',
        stream: 'downstream',
        toxicity: 1,
        attributes: {
          latency: Number(process.env.SOAK_POSTGRES_LATENCY_MS ?? 250),
          jitter: 50,
        },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Could not inject PostgreSQL latency (${response.status})`);
  }
}

async function restartBackend(service) {
  console.log(`Chaos: abruptly restarting ${service}`);
  await requireSuccess(
    'docker',
    composeArgs('kill', '--signal', 'SIGKILL', service),
    `${service} kill failed`,
  );
  await requireSuccess(
    'docker',
    composeArgs('up', '--detach', '--wait', '--wait-timeout', '180', service),
    `${service} recovery failed`,
  );
}

async function runChaos() {
  if (!chaosEnabled || !(await waitForReadyFile())) return 0;
  const warmupMs = Number(process.env.SOAK_CHAOS_WARMUP_MS ?? 10_000);
  const outageMs = Number(process.env.SOAK_CHAOS_OUTAGE_MS ?? 10_000);
  const latencyMs = Number(
    process.env.SOAK_CHAOS_LATENCY_DURATION_MS ?? 20_000,
  );
  await delay(warmupMs);
  if (soakComplete || interrupted) return 0;

  await restartBackend('backend');
  await delay(5_000);
  if (soakComplete || interrupted) return 0;
  await restartBackend('backend-peer');

  await delay(5_000);
  if (soakComplete || interrupted) return 0;
  console.log('Chaos: interrupting Redis coordination');
  await requireSuccess(
    'docker',
    composeArgs('stop', 'redis'),
    'Redis stop failed',
  );
  await delay(outageMs);
  await requireSuccess(
    'docker',
    composeArgs('up', '--detach', '--wait', '--wait-timeout', '120', 'redis'),
    'Redis recovery failed',
  );

  await delay(5_000);
  if (soakComplete || interrupted) return 0;
  console.log('Chaos: adding PostgreSQL response latency');
  await setPostgresLatency(true);
  try {
    await delay(latencyMs);
  } finally {
    await setPostgresLatency(false);
  }
  return 0;
}

function handleSignal(signal) {
  interrupted = true;
  for (const child of children) child.kill(signal);
}

process.once('SIGINT', () => handleSignal('SIGINT'));
process.once('SIGTERM', () => handleSignal('SIGTERM'));

async function main() {
  const tsxCli = path.join(
    repositoryRoot,
    'node_modules',
    'tsx',
    'dist',
    'cli.mjs',
  );
  if (!fs.existsSync(tsxCli)) {
    throw new Error('tsx is not installed. Run npm install first.');
  }
  if (fs.existsSync(readyFile)) fs.rmSync(readyFile);
  let exitCode = 1;
  let composeAttempted = false;

  try {
    composeAttempted = true;
    await requireSuccess(
      'docker',
      composeArgs(
        'up',
        '--build',
        '--detach',
        '--wait',
        '--wait-timeout',
        '240',
        'postgres',
        'redis',
        'asset-service',
        'toxiproxy',
      ),
      'Soak infrastructure startup failed',
    );
    await configurePostgresProxy();
    await requireSuccess(
      'docker',
      composeArgs(
        'up',
        '--build',
        '--detach',
        '--wait',
        '--wait-timeout',
        '240',
        'backend',
        'backend-peer',
        'frontend',
      ),
      'Soak application startup failed',
    );

    const argumentsForHarness = [
      tsxCli,
      'scripts/multiplayer-soak.ts',
      '--base-url',
      `http://127.0.0.1:${frontendPort}`,
      '--websocket-urls',
      `http://127.0.0.1:${backendPort},http://127.0.0.1:${backendPeerPort}`,
      '--ready-file',
      readyFile,
      ...userArguments,
    ];
    const soakPromise = runCommand(process.execPath, argumentsForHarness).then(
      (code) => {
        soakComplete = true;
        return code;
      },
    );
    const [soakExitCode, chaosExitCode] = await Promise.all([
      soakPromise,
      runChaos(),
    ]);
    exitCode = soakExitCode || chaosExitCode;
  } finally {
    try {
      await setPostgresLatency(false);
    } catch {
      // The proxy may already be gone during cleanup.
    }
    if (composeAttempted && !keepStack) {
      const cleanupCode = await runCommand(
        'docker',
        composeArgs('down', '--volumes', '--remove-orphans'),
      );
      if (cleanupCode !== 0 && exitCode === 0) exitCode = cleanupCode;
    } else if (keepStack) {
      console.log(`Soak stack retained as Docker project ${projectName}.`);
    }
    if (fs.existsSync(readyFile)) fs.rmSync(readyFile);
  }

  process.exitCode = interrupted ? 130 : exitCode;
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await runCommand(
    'docker',
    composeArgs('logs', '--no-color', '--tail', '200'),
  );
  process.exitCode = 1;
});
