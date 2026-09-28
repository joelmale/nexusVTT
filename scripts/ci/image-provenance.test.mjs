import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

import {
  createImageProvenance,
  parseArguments,
  run,
} from './image-provenance.mjs';

const sourceSha = 'a'.repeat(40);
const digest = `sha256:${'b'.repeat(64)}`;
const temporaryDirectories = [];

function validInput(overrides = {}) {
  return {
    sourceSha,
    revision: sourceSha,
    imageName: 'backend',
    imageRef: 'ghcr.io/example/backend:sha-source',
    repository: 'ghcr.io/example/backend',
    digest,
    platforms: 'linux/amd64',
    transport: 'registry',
    version: `sha-${sourceSha}`,
    runId: '1234',
    runAttempt: '2',
    ...overrides,
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('image provenance', () => {
  test('records exact source, digest, build arguments, and run identity', () => {
    expect(createImageProvenance(validInput())).toEqual({
      schemaVersion: 1,
      sourceSha,
      imageName: 'backend',
      imageRef: 'ghcr.io/example/backend:sha-source',
      repository: 'ghcr.io/example/backend',
      digest,
      platforms: 'linux/amd64',
      transport: 'registry',
      buildArgs: { VERSION: `sha-${sourceSha}`, COMMIT_SHA: sourceSha },
      runId: '1234',
      runAttempt: '2',
    });
  });

  test('records and enforces the release frontend variant', () => {
    expect(
      createImageProvenance(
        validInput({ imageName: 'frontend', deltaSync: 'false' }),
      ).variant,
    ).toEqual({ deltaSync: false });
    expect(() =>
      createImageProvenance(
        validInput({ imageName: 'frontend', deltaSync: 'true' }),
      ),
    ).toThrow('delta-sync label must be false');
  });

  test.each([
    [{ sourceSha: 'short', revision: 'short' }, 'sourceSha'],
    [{ revision: 'c'.repeat(40) }, 'does not match'],
    [{ digest: 'sha256:not-a-digest' }, 'digest'],
    [{ transport: 'remote-cache' }, 'transport'],
    [{ runId: '0' }, 'runId'],
    [{ runAttempt: 'one' }, 'runAttempt'],
    [{ imageName: '../backend' }, 'imageName'],
  ])('rejects invalid identity input %#', (override, message) => {
    expect(() => createImageProvenance(validInput(override))).toThrow(message);
  });

  test('writes a validated manifest through the CLI adapter', () => {
    const directory = mkdtempSync(join(tmpdir(), 'nexus-image-provenance-'));
    temporaryDirectories.push(directory);
    const output = join(directory, 'backend.json');
    run(
      [
        'create',
        '--source-sha',
        sourceSha,
        '--revision',
        sourceSha,
        '--image-name',
        'backend',
        '--image-ref',
        'ghcr.io/example/backend:sha-source',
        '--repository',
        'ghcr.io/example/backend',
        '--digest',
        digest,
        '--platforms',
        'linux/amd64',
        '--transport',
        'registry',
        '--version',
        `sha-${sourceSha}`,
        '--output',
        output,
      ],
      { GITHUB_RUN_ID: '42', GITHUB_RUN_ATTEMPT: '1' },
    );
    expect(JSON.parse(readFileSync(output, 'utf8'))).toMatchObject({
      sourceSha,
      digest,
      runId: '42',
      runAttempt: '1',
    });
  });

  test('rejects missing option values', () => {
    expect(() => parseArguments(['create', '--source-sha'])).toThrow(
      'missing value',
    );
  });
});
