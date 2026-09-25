import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { loadWorkspaceGraph } from '../build-workspace-dependencies.mjs';
import { validateDockerfile } from './validate-docker-build-contracts.mjs';

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value)}\n`, 'utf8');
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'nexus-docker-contract-'));
  mkdirSync(join(root, 'apps', 'api'), { recursive: true });
  mkdirSync(join(root, 'packages', 'contracts'), { recursive: true });
  writeJson(join(root, 'package.json'), {
    workspaces: ['apps/api', 'packages/*'],
  });
  writeJson(join(root, 'apps', 'api', 'package.json'), {
    name: 'api',
    dependencies: { '@test/contracts': '*' },
  });
  writeJson(join(root, 'packages', 'contracts', 'package.json'), {
    name: '@test/contracts',
    scripts: { build: 'tsc' },
  });
  return root;
}

describe('Docker workspace build contracts', () => {
  test('reports a transitive workspace omitted from npm ci', () => {
    const root = fixture();
    const dockerfile = join(root, 'Dockerfile');
    writeFileSync(
      dockerfile,
      `FROM node:alpine\nCOPY apps/api/package.json ./apps/api/\nRUN npm ci --workspace=api\n`,
    );
    expect(validateDockerfile(dockerfile, loadWorkspaceGraph(root))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('omits internal dependency @test/contracts'),
      ]),
    );
  });

  test('accepts dependency-driven builds with complete install inputs', () => {
    const root = fixture();
    const dockerfile = join(root, 'Dockerfile');
    writeFileSync(
      dockerfile,
      `FROM node:alpine\nCOPY apps/api/package.json ./apps/api/\nCOPY packages/contracts/package.json ./packages/contracts/\nRUN npm ci --workspace=api --workspace=@test/contracts\nCOPY scripts/build-workspace-dependencies.mjs ./scripts/build-workspace-dependencies.mjs\nRUN node scripts/build-workspace-dependencies.mjs --workspace api && npm run build --workspace=api\n`,
    );
    expect(validateDockerfile(dockerfile, loadWorkspaceGraph(root))).toEqual(
      [],
    );
  });
});
