#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ROOT_DIRECTORY = resolve(SCRIPT_DIRECTORY, '..');
const DEPENDENCY_SECTIONS = [
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
  'devDependencies',
];

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function expandWorkspacePattern(rootDirectory, pattern) {
  if (!pattern.endsWith('/*')) {
    return [pattern];
  }
  const parent = pattern.slice(0, -2);
  const absoluteParent = resolve(rootDirectory, parent);
  if (!existsSync(absoluteParent)) {
    return [];
  }
  return readdirSync(absoluteParent, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(parent, entry.name));
}

export function loadWorkspaceGraph(rootDirectory = DEFAULT_ROOT_DIRECTORY) {
  const rootPackage = readJson(join(rootDirectory, 'package.json'));
  const patterns = Array.isArray(rootPackage.workspaces)
    ? rootPackage.workspaces
    : rootPackage.workspaces?.packages;
  if (!Array.isArray(patterns)) {
    throw new Error('root package.json must define npm workspaces');
  }

  const workspaces = new Map();
  for (const pattern of patterns) {
    for (const relativePath of expandWorkspacePattern(rootDirectory, pattern)) {
      const manifestPath = resolve(rootDirectory, relativePath, 'package.json');
      if (!existsSync(manifestPath)) {
        continue;
      }
      const manifest = readJson(manifestPath);
      if (typeof manifest.name !== 'string' || manifest.name.length === 0) {
        throw new Error(`${relativePath}/package.json has no package name`);
      }
      if (workspaces.has(manifest.name)) {
        throw new Error(`duplicate workspace name: ${manifest.name}`);
      }
      workspaces.set(manifest.name, {
        manifest,
        manifestPath,
        relativePath: relativePath.replaceAll('\\', '/'),
      });
    }
  }
  return workspaces;
}

export function internalDependencies(workspace, workspaces) {
  const names = new Set();
  for (const section of DEPENDENCY_SECTIONS) {
    for (const name of Object.keys(workspace.manifest[section] ?? {})) {
      if (workspaces.has(name)) {
        names.add(name);
      }
    }
  }
  return [...names].sort();
}

export function resolveBuildOrder(workspaceName, workspaces) {
  if (!workspaces.has(workspaceName)) {
    throw new Error(`unknown workspace: ${workspaceName}`);
  }
  const order = [];
  const visiting = new Set();
  const visited = new Set();

  const visit = (name) => {
    if (visiting.has(name)) {
      throw new Error(`workspace dependency cycle includes ${name}`);
    }
    if (visited.has(name)) {
      return;
    }
    visiting.add(name);
    const workspace = workspaces.get(name);
    for (const dependency of internalDependencies(workspace, workspaces)) {
      visit(dependency);
    }
    visiting.delete(name);
    visited.add(name);
    if (
      name !== workspaceName &&
      typeof workspace.manifest.scripts?.build === 'string'
    ) {
      order.push(name);
    }
  };

  visit(workspaceName);
  return order;
}

export function npmInvocation(
  environment = process.env,
  platform = process.platform,
) {
  if (environment.npm_execpath) {
    return {
      command: process.execPath,
      argumentsPrefix: [environment.npm_execpath],
      shell: false,
    };
  }
  return {
    command: 'npm',
    argumentsPrefix: [],
    shell: platform === 'win32',
  };
}

function parseArguments(argv) {
  const options = { root: DEFAULT_ROOT_DIRECTORY };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (argument === '--workspace' || argument === '--root') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${argument} requires a value`);
      }
      options[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new Error(`unexpected argument: ${argument}`);
  }
  if (!options.workspace) {
    throw new Error('--workspace is required');
  }
  return options;
}

export function runCli(argv) {
  const options = parseArguments(argv);
  const rootDirectory = resolve(options.root);
  const workspaces = loadWorkspaceGraph(rootDirectory);
  const order = resolveBuildOrder(options.workspace, workspaces);
  if (options.dryRun) {
    process.stdout.write(`${JSON.stringify(order)}\n`);
    return 0;
  }
  const npm = npmInvocation();
  for (const workspaceName of order) {
    execFileSync(
      npm.command,
      [...npm.argumentsPrefix, 'run', 'build', `--workspace=${workspaceName}`],
      {
        cwd: rootDirectory,
        shell: npm.shell,
        stdio: 'inherit',
      },
    );
  }
  return 0;
}

if (
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    process.exitCode = runCli(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
