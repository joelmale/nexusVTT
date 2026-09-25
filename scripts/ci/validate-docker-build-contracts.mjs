#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  internalDependencies,
  loadWorkspaceGraph,
  resolveBuildOrder,
} from '../build-workspace-dependencies.mjs';

const ROOT_DIRECTORY = resolve(
  fileURLToPath(new URL('../..', import.meta.url)),
);

function findDockerfiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...findDockerfiles(path));
    } else if (
      entry.name === 'Dockerfile' ||
      entry.name.endsWith('.Dockerfile')
    ) {
      files.push(path);
    }
  }
  return files;
}

function splitStages(source) {
  return source
    .split(/(?=^FROM\s)/gim)
    .filter((stage) => /^FROM\s/im.test(stage));
}

function normalizedCommands(stage) {
  return stage.replace(/\\\r?\n\s*/g, ' ');
}

function workspaceArguments(command) {
  return [...command.matchAll(/--workspace(?:=|\s+)([^\s]+)/g)].map(
    (match) => match[1],
  );
}

function hasManifest(stageBeforeInstall, workspace) {
  const path = workspace.relativePath;
  if (
    stageBeforeInstall.includes(`COPY ${path}/package.json`) ||
    stageBeforeInstall.includes(` ${path}/package.json`)
  ) {
    return true;
  }
  const segments = path.split('/');
  for (let length = segments.length; length > 0; length -= 1) {
    const ancestor = segments.slice(0, length).join('/');
    const copiedDirectory = new RegExp(
      `COPY(?:\\s+--[^\\s]+)*\\s+${ancestor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`,
      'm',
    );
    if (copiedDirectory.test(stageBeforeInstall)) {
      return true;
    }
  }
  return false;
}

function dependencyClosure(name, workspaces, closure = new Set()) {
  for (const dependency of internalDependencies(
    workspaces.get(name),
    workspaces,
  )) {
    if (!closure.has(dependency)) {
      closure.add(dependency);
      dependencyClosure(dependency, workspaces, closure);
    }
  }
  return closure;
}

export function validateDockerfile(filePath, workspaces) {
  const source = readFileSync(filePath, 'utf8');
  const failures = [];
  for (const [stageIndex, stage] of splitStages(source).entries()) {
    const commands = normalizedCommands(stage);
    const installMatch = commands.match(
      /RUN(?:\s+--[^\s]+)*\s+npm ci\s+([^\n]+)/,
    );
    if (!installMatch) {
      continue;
    }
    const selected = new Set(workspaceArguments(installMatch[0]));
    if (selected.size === 0) {
      continue;
    }
    const originalInstall = stage.match(/RUN(?:\s+--[^\s]+)*\s+npm ci/);
    const beforeInstall = stage.slice(
      0,
      originalInstall?.index ?? stage.length,
    );
    for (const name of selected) {
      const workspace = workspaces.get(name);
      if (!workspace) {
        failures.push(`stage ${stageIndex + 1}: unknown workspace ${name}`);
        continue;
      }
      if (!hasManifest(beforeInstall, workspace)) {
        failures.push(
          `stage ${stageIndex + 1}: ${name} manifest is not copied before npm ci`,
        );
      }
      for (const dependency of dependencyClosure(name, workspaces)) {
        if (!selected.has(dependency)) {
          failures.push(
            `stage ${stageIndex + 1}: npm ci for ${name} omits internal dependency ${dependency}`,
          );
        }
      }
    }

    const selectedDependencies = new Set();
    for (const name of selected) {
      if (workspaces.has(name)) {
        for (const dependency of dependencyClosure(name, workspaces)) {
          selectedDependencies.add(dependency);
        }
      }
    }
    const roots = [...selected].filter(
      (name) => !selectedDependencies.has(name),
    );
    for (const root of roots) {
      if (
        !workspaces.has(root) ||
        resolveBuildOrder(root, workspaces).length === 0
      ) {
        continue;
      }
      const escapedRoot = root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const buildsRoot = new RegExp(
        `npm run (?:build|build:[^\\s]+) --workspace(?:=|\\s+)${escapedRoot}(?:\\s|$)`,
      ).test(commands);
      if (
        buildsRoot &&
        !commands.includes(
          `build-workspace-dependencies.mjs --workspace ${root}`,
        )
      ) {
        failures.push(
          `stage ${stageIndex + 1}: ${root} must derive shared builds with build-workspace-dependencies.mjs`,
        );
      }
    }
  }
  return failures;
}

export function validateRepository(rootDirectory = ROOT_DIRECTORY) {
  const workspaces = loadWorkspaceGraph(rootDirectory);
  const dockerfiles = findDockerfiles(join(rootDirectory, 'apps'));
  const failures = [];
  for (const filePath of dockerfiles) {
    for (const failure of validateDockerfile(filePath, workspaces)) {
      failures.push(`${relative(rootDirectory, filePath)}: ${failure}`);
    }
  }
  return { dockerfiles, failures };
}

if (
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const { dockerfiles, failures } = validateRepository();
  if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(
      `Validated workspace build contracts in ${dockerfiles.length} Dockerfiles.`,
    );
  }
}
