import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const composeFile = path.join('docker', 'docker-compose.smoke.yml');

export function hasManagedSmokeStack(): boolean {
  return process.env.E2E_MANAGED_STACK === '1';
}

async function runCompose(args: string[]): Promise<void> {
  if (!hasManagedSmokeStack()) {
    throw new Error(
      'This resilience scenario requires the managed Docker smoke stack.',
    );
  }

  const projectName = process.env.E2E_PROJECT_NAME ?? 'nexus-vtt-e2e';
  try {
    await execFileAsync(
      'docker',
      ['compose', '-p', projectName, '-f', composeFile, ...args],
      {
        cwd: process.cwd(),
        timeout: 180_000,
        windowsHide: true,
      },
    );
  } catch (error) {
    throw new Error(`Docker Compose command failed: ${args.join(' ')}`, {
      cause: error,
    });
  }
}

export async function stopSmokeService(service: string): Promise<void> {
  await runCompose(['stop', service]);
}

/** Abruptly kills a container so crash tests cannot rely on shutdown hooks. */
export async function killSmokeService(service: string): Promise<void> {
  await runCompose(['kill', '--signal', 'SIGKILL', service]);
}

export async function startSmokeService(service: string): Promise<void> {
  await runCompose([
    'up',
    '--detach',
    '--wait',
    '--wait-timeout',
    '120',
    service,
  ]);
}
