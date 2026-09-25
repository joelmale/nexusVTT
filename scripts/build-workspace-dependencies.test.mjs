import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import {
  internalDependencies,
  loadWorkspaceGraph,
  npmInvocation,
  resolveBuildOrder,
} from './build-workspace-dependencies.mjs';

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value)}\n`, 'utf8');
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'nexus-workspaces-'));
  mkdirSync(join(root, 'apps', 'web'), { recursive: true });
  mkdirSync(join(root, 'packages', 'core'), { recursive: true });
  mkdirSync(join(root, 'packages', 'types'), { recursive: true });
  writeJson(join(root, 'package.json'), {
    private: true,
    workspaces: ['apps/web', 'packages/*'],
  });
  writeJson(join(root, 'apps', 'web', 'package.json'), {
    name: 'web',
    dependencies: { '@test/core': '*' },
  });
  writeJson(join(root, 'packages', 'core', 'package.json'), {
    name: '@test/core',
    scripts: { build: 'tsc' },
    dependencies: { '@test/types': '*' },
  });
  writeJson(join(root, 'packages', 'types', 'package.json'), {
    name: '@test/types',
    scripts: { build: 'tsc' },
  });
  return root;
}

describe('workspace dependency builds', () => {
  test('discovers workspaces and builds transitive dependencies first', () => {
    const workspaces = loadWorkspaceGraph(fixture());
    expect(resolveBuildOrder('web', workspaces)).toEqual([
      '@test/types',
      '@test/core',
    ]);
  });

  test('includes internal dependencies from every package dependency section', () => {
    const workspaces = loadWorkspaceGraph(fixture());
    const web = workspaces.get('web');
    web.manifest.devDependencies = { '@test/types': '*' };
    expect(internalDependencies(web, workspaces)).toEqual([
      '@test/core',
      '@test/types',
    ]);
  });

  test('rejects cycles instead of producing a partial build order', () => {
    const workspaces = loadWorkspaceGraph(fixture());
    workspaces.get('@test/types').manifest.dependencies = {
      '@test/core': '*',
    };
    expect(() => resolveBuildOrder('web', workspaces)).toThrow(
      'workspace dependency cycle',
    );
  });

  test('uses npm JavaScript entrypoint when npm provides it', () => {
    expect(
      npmInvocation({ npm_execpath: '/tools/npm-cli.js' }, 'win32'),
    ).toEqual({
      command: process.execPath,
      argumentsPrefix: ['/tools/npm-cli.js'],
      shell: false,
    });
  });

  test('uses a shell only for the direct Windows fallback', () => {
    expect(npmInvocation({}, 'win32')).toEqual({
      command: 'npm',
      argumentsPrefix: [],
      shell: true,
    });
    expect(npmInvocation({}, 'linux').shell).toBe(false);
  });
});
