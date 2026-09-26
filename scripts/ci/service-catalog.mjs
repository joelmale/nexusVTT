#!/usr/bin/env node

import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
export const ROOT_DIRECTORY = resolve(SCRIPT_DIRECTORY, '../..');
export const DEFAULT_CATALOG_PATH = resolve(
  ROOT_DIRECTORY,
  '.github/ci/affected-targets.json',
);

const CI_GROUPS = new Set([
  'vtt',
  'forge',
  'control-api',
  'codex',
  'docs',
  'gateway',
]);
const LANES = new Set(['pr', 'delivery', 'nightly']);
const LANGUAGES = new Set(['typescript', 'python']);
const TEST_POLICIES = new Set(['none', 'unit', 'unit-and-integration']);
const VALIDATION_PROFILES = new Set(['doc-api', 'node', 'python']);

function assertObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertString(value, label, { allowEmpty = false } = {}) {
  if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
    throw new Error(
      `${label} must be ${allowEmpty ? 'a string' : 'a non-empty string'}`,
    );
  }
}

function assertStringArray(value, label) {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string' || entry.length === 0)
  ) {
    throw new Error(`${label} must be an array of non-empty strings`);
  }
}

function validateReleaseImage(image, targetId, imageNames, repositories) {
  assertObject(image, `target ${targetId}.releaseImage`);
  for (const field of [
    'name',
    'context',
    'file',
    'target',
    'repository',
    'platforms',
  ]) {
    assertString(image[field], `target ${targetId}.releaseImage.${field}`, {
      allowEmpty: field === 'target',
    });
  }
  if (typeof image.securityScan !== 'boolean') {
    throw new Error(
      `target ${targetId}.releaseImage.securityScan must be boolean`,
    );
  }
  if (imageNames.has(image.name)) {
    throw new Error(`duplicate release image name: ${image.name}`);
  }
  if (repositories.has(image.repository)) {
    throw new Error(`duplicate release image repository: ${image.repository}`);
  }
  imageNames.add(image.name);
  repositories.add(image.repository);
}

function validateService(service, targetId, serviceNames, directories) {
  assertObject(service, `target ${targetId}.service`);
  for (const field of ['name', 'directory', 'language', 'testPolicy']) {
    assertString(service[field], `target ${targetId}.service.${field}`);
  }
  if (!LANGUAGES.has(service.language)) {
    throw new Error(
      `target ${targetId}.service.language is unsupported: ${service.language}`,
    );
  }
  if (!TEST_POLICIES.has(service.testPolicy)) {
    throw new Error(
      `target ${targetId}.service.testPolicy is unsupported: ${service.testPolicy}`,
    );
  }
  if (serviceNames.has(service.name)) {
    throw new Error(`duplicate service name: ${service.name}`);
  }
  if (directories.has(service.directory)) {
    throw new Error(`duplicate service directory: ${service.directory}`);
  }
  serviceNames.add(service.name);
  directories.add(service.directory);

  assertObject(service.validation, `target ${targetId}.service.validation`);
  if (!VALIDATION_PROFILES.has(service.validation.profile)) {
    throw new Error(
      `target ${targetId}.service.validation.profile is unsupported: ${service.validation.profile}`,
    );
  }
  for (const field of ['prisma', 'test', 'lint', 'build']) {
    if (typeof service.validation[field] !== 'boolean') {
      throw new Error(
        `target ${targetId}.service.validation.${field} must be boolean`,
      );
    }
  }
  if (
    (service.language === 'python') !==
    (service.validation.profile === 'python')
  ) {
    throw new Error(
      `target ${targetId} must use the python validation profile exactly when its language is python`,
    );
  }
}

export function validateServiceCatalog(catalog) {
  assertObject(catalog, 'service catalog');
  if (catalog.version !== 2) {
    throw new Error(`unsupported service catalog version: ${catalog.version}`);
  }
  assertObject(catalog.targets, 'targets');

  const targetIds = Object.keys(catalog.targets);
  if (targetIds.length === 0) {
    throw new Error('at least one target must be configured');
  }

  const imageNames = new Set();
  const repositories = new Set();
  const serviceNames = new Set();
  const serviceDirectories = new Set();

  for (const [targetId, target] of Object.entries(catalog.targets)) {
    if (!/^[a-z][a-z0-9-]*$/.test(targetId)) {
      throw new Error(`invalid target id: ${targetId}`);
    }
    assertObject(target, `target ${targetId}`);
    assertString(target.description, `target ${targetId}.description`);
    assertString(target.ciGroup, `target ${targetId}.ciGroup`);
    if (!CI_GROUPS.has(target.ciGroup)) {
      throw new Error(
        `target ${targetId} has unknown CI group ${target.ciGroup}`,
      );
    }
    assertStringArray(target.lanes, `target ${targetId}.lanes`);
    for (const lane of target.lanes) {
      if (!LANES.has(lane)) {
        throw new Error(`target ${targetId} has unknown lane ${lane}`);
      }
    }
    assertStringArray(target.paths, `target ${targetId}.paths`);
    assertStringArray(target.dependsOn, `target ${targetId}.dependsOn`);
    for (const dependency of target.dependsOn) {
      if (!Object.hasOwn(catalog.targets, dependency)) {
        throw new Error(
          `target ${targetId} has unknown dependency ${dependency}`,
        );
      }
      if (dependency === targetId) {
        throw new Error(`target ${targetId} cannot depend on itself`);
      }
    }
    if (target.service !== undefined) {
      validateService(
        target.service,
        targetId,
        serviceNames,
        serviceDirectories,
      );
    }
    if (target.releaseImage !== undefined) {
      validateReleaseImage(
        target.releaseImage,
        targetId,
        imageNames,
        repositories,
      );
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const visit = (targetId) => {
    if (visiting.has(targetId)) {
      throw new Error(`target dependency cycle includes ${targetId}`);
    }
    if (visited.has(targetId)) {
      return;
    }
    visiting.add(targetId);
    for (const dependency of catalog.targets[targetId].dependsOn) {
      visit(dependency);
    }
    visiting.delete(targetId);
    visited.add(targetId);
  };
  targetIds.forEach(visit);

  if (!Array.isArray(catalog.fanoutRules)) {
    throw new Error('fanoutRules must be an array');
  }
  const ruleNames = new Set();
  for (const rule of catalog.fanoutRules) {
    assertObject(rule, 'each fanout rule');
    assertString(rule.name, 'each fanout rule name');
    if (ruleNames.has(rule.name)) {
      throw new Error(`duplicate fanout rule: ${rule.name}`);
    }
    ruleNames.add(rule.name);
    assertStringArray(rule.paths, `fanout rule ${rule.name}.paths`);
    if (rule.targets !== 'all') {
      assertStringArray(rule.targets, `fanout rule ${rule.name}.targets`);
      for (const targetId of rule.targets) {
        if (!Object.hasOwn(catalog.targets, targetId)) {
          throw new Error(
            `fanout rule ${rule.name} has unknown target ${targetId}`,
          );
        }
      }
    }
  }

  return catalog;
}

export function loadServiceCatalog(catalogPath = DEFAULT_CATALOG_PATH) {
  return validateServiceCatalog(JSON.parse(readFileSync(catalogPath, 'utf8')));
}

export function validateCatalogRepository(
  catalog,
  rootDirectory = ROOT_DIRECTORY,
) {
  validateServiceCatalog(catalog);
  const failures = [];
  const services = [];
  const images = [];

  for (const [targetId, target] of Object.entries(catalog.targets)) {
    if (target.service !== undefined) {
      const serviceDirectory = resolve(rootDirectory, target.service.directory);
      services.push({ targetId, ...target.service });
      if (!existsSync(serviceDirectory)) {
        failures.push(
          `target ${targetId} service directory does not exist: ${target.service.directory}`,
        );
      }
      const manifest =
        target.service.language === 'python'
          ? join(serviceDirectory, 'requirements.txt')
          : join(serviceDirectory, 'package.json');
      if (!existsSync(manifest)) {
        failures.push(
          `target ${targetId} service manifest does not exist: ${relative(rootDirectory, manifest)}`,
        );
      }
    }
    if (target.releaseImage !== undefined) {
      images.push({ targetId, ...target.releaseImage });
      for (const [field, value] of [
        ['context', target.releaseImage.context],
        ['file', target.releaseImage.file],
      ]) {
        const path = resolve(rootDirectory, value.replace(/^\.\//, ''));
        if (!existsSync(path)) {
          failures.push(
            `target ${targetId} release image ${field} does not exist: ${value}`,
          );
        }
      }
    }
  }

  const codexServicesDirectory = resolve(rootDirectory, 'apps/codex/services');
  if (existsSync(codexServicesDirectory)) {
    const discovered = readdirSync(codexServicesDirectory, {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const declared = services.map((service) => service.name).sort();
    if (JSON.stringify(discovered) !== JSON.stringify(declared)) {
      failures.push(
        `Codex service inventory changed. Found [${discovered.join(', ')}], ` +
          `catalog declares [${declared.join(', ')}].`,
      );
    }
  }

  return { failures, images, services };
}

function imageEntry(image) {
  return {
    name: image.name,
    context: image.context,
    file: image.file,
    target: image.target,
    repository: image.repository,
    platforms: image.platforms,
    securityScan: image.securityScan,
  };
}

export function catalogMatrices(catalog, affectedTargetIds) {
  validateServiceCatalog(catalog);
  const selected = new Set(affectedTargetIds ?? Object.keys(catalog.targets));
  const allReleaseImages = [];
  const releaseImages = [];
  const codexNodeServices = [];
  const codexPythonServices = [];
  let codexDocApi = false;

  for (const [targetId, target] of Object.entries(catalog.targets)) {
    if (target.releaseImage !== undefined) {
      const image = imageEntry(target.releaseImage);
      allReleaseImages.push(image);
      if (selected.has(targetId)) {
        releaseImages.push(image);
      }
    }
    if (!selected.has(targetId) || target.service === undefined) {
      continue;
    }
    const validation = target.service.validation;
    const entry = {
      target: targetId,
      service: target.service.name,
      directory: target.service.directory,
      prisma: validation.prisma,
      test: validation.test,
      lint: validation.lint,
      build: validation.build,
    };
    if (validation.profile === 'doc-api') {
      codexDocApi = true;
    } else if (validation.profile === 'python') {
      codexPythonServices.push(entry);
    } else {
      codexNodeServices.push(entry);
    }
  }

  return {
    allReleaseImages,
    releaseImages,
    securityImages: releaseImages.filter((image) => image.securityScan),
    codexDocApi,
    codexNodeServices,
    codexPythonServices,
  };
}

export function appendCatalogGithubOutputs(outputPath, matrices) {
  const lines = [
    `all_release_images=${JSON.stringify(matrices.allReleaseImages)}`,
    `release_images=${JSON.stringify(matrices.releaseImages)}`,
    `security_images=${JSON.stringify(matrices.securityImages)}`,
    `has_release_images=${matrices.releaseImages.length > 0}`,
    `codex_node_matrix=${JSON.stringify({ include: matrices.codexNodeServices })}`,
    `codex_python_matrix=${JSON.stringify({ include: matrices.codexPythonServices })}`,
    `has_codex_node=${matrices.codexNodeServices.length > 0}`,
    `has_codex_python=${matrices.codexPythonServices.length > 0}`,
  ];
  appendFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
}

export function checkCatalog(catalogPath = DEFAULT_CATALOG_PATH) {
  const catalog = loadServiceCatalog(catalogPath);
  const result = validateCatalogRepository(catalog);
  if (result.failures.length > 0) {
    throw new Error(result.failures.join('\n'));
  }
  return {
    images: result.images.length,
    services: result.services.length,
    targets: Object.keys(catalog.targets).length,
  };
}

if (
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    const summary = checkCatalog(process.argv[2] ?? DEFAULT_CATALOG_PATH);
    process.stdout.write(
      `Validated service catalog: ${summary.targets} targets, ` +
        `${summary.services} Codex services, ${summary.images} release images.\n`,
    );
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
