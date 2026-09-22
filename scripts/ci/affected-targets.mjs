#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CONFIG_PATH = resolve(
  SCRIPT_DIRECTORY,
  '../../.github/ci/affected-targets.json',
);

export const FALLBACK_TARGET_IDS = [
  'assets',
  'postgres',
  'vtt',
  'forge',
  'codex-doc-api',
  'codex-doc-processor',
  'codex-doc-websocket',
  'codex-admin-ui',
  'codex-dm-ui',
  'docs',
  'gateway',
];

const SUPPORTED_CHANGE_STATUSES = new Set(['A', 'C', 'D', 'M', 'R', 'T', 'U']);
const FULL_SUITE_EVENTS = new Set([
  'merge_group',
  'release',
  'schedule',
  'workflow_dispatch',
]);

function assertStringArray(value, label) {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string' || entry.length === 0)
  ) {
    throw new Error(`${label} must be an array of non-empty strings`);
  }
}

export function validateConfig(config) {
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('affected-target configuration must be an object');
  }
  if (config.version !== 1) {
    throw new Error(
      `unsupported affected-target configuration version: ${config.version}`,
    );
  }
  if (
    config.targets === null ||
    typeof config.targets !== 'object' ||
    Array.isArray(config.targets)
  ) {
    throw new Error('targets must be an object');
  }

  const targetIds = Object.keys(config.targets);
  if (targetIds.length === 0) {
    throw new Error('at least one target must be configured');
  }

  for (const [targetId, target] of Object.entries(config.targets)) {
    if (!/^[a-z][a-z0-9-]*$/.test(targetId)) {
      throw new Error(`invalid target id: ${targetId}`);
    }
    if (
      target === null ||
      typeof target !== 'object' ||
      Array.isArray(target)
    ) {
      throw new Error(`target ${targetId} must be an object`);
    }
    assertStringArray(target.paths, `target ${targetId}.paths`);
    assertStringArray(target.dependsOn, `target ${targetId}.dependsOn`);
    for (const dependency of target.dependsOn) {
      if (!Object.hasOwn(config.targets, dependency)) {
        throw new Error(
          `target ${targetId} has unknown dependency ${dependency}`,
        );
      }
      if (dependency === targetId) {
        throw new Error(`target ${targetId} cannot depend on itself`);
      }
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
    for (const dependency of config.targets[targetId].dependsOn) {
      visit(dependency);
    }
    visiting.delete(targetId);
    visited.add(targetId);
  };
  targetIds.forEach(visit);

  if (!Array.isArray(config.fanoutRules)) {
    throw new Error('fanoutRules must be an array');
  }
  const ruleNames = new Set();
  for (const rule of config.fanoutRules) {
    if (rule === null || typeof rule !== 'object' || Array.isArray(rule)) {
      throw new Error('each fanout rule must be an object');
    }
    if (typeof rule.name !== 'string' || rule.name.length === 0) {
      throw new Error('each fanout rule must have a name');
    }
    if (ruleNames.has(rule.name)) {
      throw new Error(`duplicate fanout rule: ${rule.name}`);
    }
    ruleNames.add(rule.name);
    assertStringArray(rule.paths, `fanout rule ${rule.name}.paths`);
    if (rule.targets !== 'all') {
      assertStringArray(rule.targets, `fanout rule ${rule.name}.targets`);
      for (const targetId of rule.targets) {
        if (!Object.hasOwn(config.targets, targetId)) {
          throw new Error(
            `fanout rule ${rule.name} has unknown target ${targetId}`,
          );
        }
      }
    }
  }

  return config;
}

export function loadConfig(configPath = DEFAULT_CONFIG_PATH) {
  return validateConfig(JSON.parse(readFileSync(configPath, 'utf8')));
}

function globToRegExp(glob) {
  let expression = '^';
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index];
    if (character === '*') {
      if (glob[index + 1] === '*') {
        index += 1;
        if (glob[index + 1] === '/') {
          index += 1;
          expression += '(?:.*/)?';
        } else {
          expression += '.*';
        }
      } else {
        expression += '[^/]*';
      }
    } else if (character === '?') {
      expression += '[^/]';
    } else {
      expression += character.replace(/[\\^$.[\]{}()+|]/g, '\\$&');
    }
  }
  return new RegExp(`${expression}$`);
}

const patternCache = new Map();

export function matchesPattern(filePath, pattern) {
  let matcher = patternCache.get(pattern);
  if (matcher === undefined) {
    matcher = globToRegExp(pattern);
    patternCache.set(pattern, matcher);
  }
  return matcher.test(filePath);
}

function normalizePath(filePath) {
  if (
    typeof filePath !== 'string' ||
    filePath.length === 0 ||
    filePath.includes('\0')
  ) {
    return null;
  }
  const normalized = filePath.replaceAll('\\', '/').replace(/^\.\//, '');
  if (
    normalized.startsWith('/') ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.split('/').includes('..')
  ) {
    return null;
  }
  return normalized;
}

function allTargetDecision(targetIds, reason, details = {}) {
  const decisions = Object.fromEntries(
    targetIds.map((targetId) => [
      targetId,
      {
        affected: true,
        direct: false,
        causes: [reason],
      },
    ]),
  );
  return {
    schemaVersion: 1,
    mode: 'full',
    reason,
    detectionStatus: details.detectionStatus ?? 'conservative',
    changedFiles: details.changedFiles ?? [],
    changeCount: details.changeCount ?? 0,
    unknownPaths: details.unknownPaths ?? [],
    directTargets: [],
    affectedTargets: [...targetIds],
    decisions,
  };
}

export function evaluateAffectedTargets({
  changes = [],
  config,
  detectionStatus = 'ok',
  fullSuiteReason,
  truncated = false,
  maxChanges = 3000,
}) {
  validateConfig(config);
  const targetIds = Object.keys(config.targets);

  if (fullSuiteReason !== undefined) {
    return allTargetDecision(targetIds, fullSuiteReason, {
      detectionStatus: 'full-suite',
    });
  }
  if (detectionStatus !== 'ok') {
    return allTargetDecision(targetIds, `change-detection-${detectionStatus}`, {
      detectionStatus,
    });
  }
  if (!Array.isArray(changes)) {
    return allTargetDecision(targetIds, 'invalid-change-list', {
      detectionStatus: 'invalid',
    });
  }
  if (truncated || changes.length > maxChanges) {
    return allTargetDecision(targetIds, 'change-list-truncated', {
      detectionStatus: 'truncated',
      changeCount: changes.length,
    });
  }

  const paths = [];
  for (const change of changes) {
    if (
      change === null ||
      typeof change !== 'object' ||
      Array.isArray(change)
    ) {
      return allTargetDecision(targetIds, 'invalid-change-record', {
        detectionStatus: 'invalid',
        changeCount: changes.length,
      });
    }
    const rawStatus = change.status ?? 'M';
    if (typeof rawStatus !== 'string') {
      return allTargetDecision(targetIds, 'invalid-change-status', {
        detectionStatus: 'invalid',
        changeCount: changes.length,
      });
    }
    const status = rawStatus.replace(/[0-9]/g, '');
    if (!SUPPORTED_CHANGE_STATUSES.has(status)) {
      return allTargetDecision(
        targetIds,
        `unsupported-change-status:${status}`,
        {
          detectionStatus: 'invalid',
          changeCount: changes.length,
        },
      );
    }
    if (!Array.isArray(change.paths) || change.paths.length === 0) {
      return allTargetDecision(targetIds, 'invalid-change-record', {
        detectionStatus: 'invalid',
        changeCount: changes.length,
      });
    }
    for (const originalPath of change.paths) {
      const normalizedPath = normalizePath(originalPath);
      if (normalizedPath === null) {
        return allTargetDecision(targetIds, 'invalid-change-path', {
          detectionStatus: 'invalid',
          changeCount: changes.length,
        });
      }
      paths.push(normalizedPath);
    }
  }

  const causes = new Map(targetIds.map((targetId) => [targetId, new Set()]));
  const directTargets = new Set();
  const classifiedPaths = new Set();

  for (const filePath of paths) {
    for (const rule of config.fanoutRules) {
      if (rule.paths.some((pattern) => matchesPattern(filePath, pattern))) {
        classifiedPaths.add(filePath);
        const ruleTargets = rule.targets === 'all' ? targetIds : rule.targets;
        for (const targetId of ruleTargets) {
          directTargets.add(targetId);
          causes.get(targetId).add(`fanout:${rule.name}:${filePath}`);
        }
      }
    }
    for (const [targetId, target] of Object.entries(config.targets)) {
      if (target.paths.some((pattern) => matchesPattern(filePath, pattern))) {
        classifiedPaths.add(filePath);
        directTargets.add(targetId);
        causes.get(targetId).add(`path:${filePath}`);
      }
    }
  }

  const unknownPaths = [
    ...new Set(paths.filter((path) => !classifiedPaths.has(path))),
  ];
  if (unknownPaths.length > 0) {
    return allTargetDecision(targetIds, 'unknown-paths', {
      detectionStatus: 'conservative',
      changedFiles: [...new Set(paths)],
      changeCount: changes.length,
      unknownPaths,
    });
  }

  const affectedTargets = new Set(directTargets);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [targetId, target] of Object.entries(config.targets)) {
      for (const dependency of target.dependsOn) {
        if (affectedTargets.has(dependency) && !affectedTargets.has(targetId)) {
          affectedTargets.add(targetId);
          causes.get(targetId).add(`dependency:${dependency}`);
          changed = true;
        } else if (
          affectedTargets.has(dependency) &&
          affectedTargets.has(targetId)
        ) {
          causes.get(targetId).add(`dependency:${dependency}`);
        }
      }
    }
  }

  const decisions = Object.fromEntries(
    targetIds.map((targetId) => [
      targetId,
      {
        affected: affectedTargets.has(targetId),
        direct: directTargets.has(targetId),
        causes: [...causes.get(targetId)].sort(),
      },
    ]),
  );

  return {
    schemaVersion: 1,
    mode: 'targeted',
    reason: 'classified-paths',
    detectionStatus: 'ok',
    changedFiles: [...new Set(paths)],
    changeCount: changes.length,
    unknownPaths: [],
    directTargets: targetIds.filter((targetId) => directTargets.has(targetId)),
    affectedTargets: targetIds.filter((targetId) =>
      affectedTargets.has(targetId),
    ),
    decisions,
  };
}

export function parseNameStatusZ(output) {
  const tokens = output.split('\0');
  if (tokens.at(-1) === '') {
    tokens.pop();
  }
  const changes = [];
  for (let index = 0; index < tokens.length;) {
    const rawStatus = tokens[index];
    index += 1;
    const status = rawStatus.replace(/[0-9]/g, '');
    const pathCount = status === 'R' || status === 'C' ? 2 : 1;
    if (index + pathCount > tokens.length) {
      throw new Error(`incomplete git diff record for status ${rawStatus}`);
    }
    changes.push({
      status: rawStatus,
      paths: tokens.slice(index, index + pathCount),
    });
    index += pathCount;
  }
  return changes;
}

export function detectGitChanges({ base, head = 'HEAD', cwd = process.cwd() }) {
  if (typeof base !== 'string' || base.length === 0) {
    throw new Error('a comparison base is required');
  }
  const mergeBase = execFileSync('git', ['merge-base', base, head], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  if (!/^[0-9a-f]{40}$/i.test(mergeBase)) {
    throw new Error(`git merge-base returned an invalid SHA: ${mergeBase}`);
  }
  const output = execFileSync(
    'git',
    ['diff', '--name-status', '-z', '--find-renames', `${mergeBase}..${head}`],
    {
      cwd,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  return parseNameStatusZ(output);
}

export function fullSuiteReasonFor({ event, ref, forceFull }) {
  if (forceFull) {
    return 'explicit-full-suite';
  }
  if (typeof ref === 'string' && ref.startsWith('refs/tags/')) {
    return 'tag-full-suite';
  }
  if (FULL_SUITE_EVENTS.has(event)) {
    return `${event}-full-suite`;
  }
  return undefined;
}

export function formatSummary(decision) {
  const lines = [
    'Affected-target shadow decision',
    `Mode: ${decision.mode}`,
    `Reason: ${decision.reason}`,
    `Detection: ${decision.detectionStatus}`,
    `Affected: ${decision.affectedTargets.length > 0 ? decision.affectedTargets.join(', ') : '(none)'}`,
    `Unclassified: ${decision.unknownPaths.length > 0 ? decision.unknownPaths.join(', ') : '(none)'}`,
  ];
  return lines.join('\n');
}

function parseArguments(argv) {
  const options = {
    format: 'both',
    head: 'HEAD',
    maxChanges: 3000,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--full') {
      options.forceFull = true;
    } else if (argument === '--truncated') {
      options.truncated = true;
    } else if (argument === '--help') {
      options.help = true;
    } else if (argument.startsWith('--')) {
      const key = argument
        .slice(2)
        .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`${argument} requires a value`);
      }
      options[key] = key === 'maxChanges' ? Number.parseInt(value, 10) : value;
      index += 1;
    } else {
      throw new Error(`unexpected argument: ${argument}`);
    }
  }
  if (!['both', 'json', 'summary'].includes(options.format)) {
    throw new Error('--format must be both, json, or summary');
  }
  if (!Number.isSafeInteger(options.maxChanges) || options.maxChanges < 1) {
    throw new Error('--max-changes must be a positive integer');
  }
  return options;
}

function helpText() {
  return `Usage: node scripts/ci/affected-targets.mjs --base <git-ref> [options]

Options:
  --head <git-ref>          Comparison head (default: HEAD)
  --event <event>           GitHub event name; manual, schedule, release, and merge queue run fully
  --ref <ref>               GitHub ref; tags run the full suite
  --full                    Force the full suite
  --truncated               Mark an upstream change list as truncated and run fully
  --max-changes <count>     Maximum targeted change count (default: 3000)
  --config <path>           Alternate target configuration
  --format <format>         both, json, or summary (default: both)
  --json-file <path>        Write the complete decision as JSON
  --github-output <path>    Append workflow outputs for every target and the JSON decision
  --help                    Show this help

If comparison or configuration loading fails, the command emits a conservative
all-target decision instead of silently skipping work.`;
}

function appendGithubOutputs(outputPath, decision) {
  const lines = [
    `full_validation=${decision.mode === 'full'}`,
    `detection_status=${decision.detectionStatus}`,
    `affected_targets=${JSON.stringify(decision.affectedTargets)}`,
    `decision=${JSON.stringify(decision)}`,
  ];
  for (const [targetId, targetDecision] of Object.entries(decision.decisions)) {
    lines.push(`${targetId.replaceAll('-', '_')}=${targetDecision.affected}`);
  }
  appendFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
}

export function runCli(argv) {
  const options = parseArguments(argv);
  if (options.help) {
    process.stdout.write(`${helpText()}\n`);
    return 0;
  }

  let config;
  try {
    config = loadConfig(options.config ?? DEFAULT_CONFIG_PATH);
  } catch (error) {
    const decision = allTargetDecision(
      FALLBACK_TARGET_IDS,
      `configuration-error:${error instanceof Error ? error.message : String(error)}`,
      { detectionStatus: 'failed' },
    );
    emitDecision(decision, options);
    return 0;
  }

  const fullSuiteReason = fullSuiteReasonFor({
    event: options.event,
    ref: options.ref,
    forceFull: options.forceFull,
  });
  let decision;
  if (fullSuiteReason !== undefined) {
    decision = evaluateAffectedTargets({ config, fullSuiteReason });
  } else {
    try {
      const changes = detectGitChanges({
        base: options.base,
        head: options.head,
      });
      decision = evaluateAffectedTargets({
        changes,
        config,
        maxChanges: options.maxChanges,
        truncated: options.truncated,
      });
    } catch (error) {
      decision = evaluateAffectedTargets({
        config,
        detectionStatus: 'failed',
      });
      decision.reason = `change-detection-failed:${error instanceof Error ? error.message : String(error)}`;
    }
  }
  emitDecision(decision, options);
  return 0;
}

function emitDecision(decision, options) {
  if (options.format === 'summary' || options.format === 'both') {
    process.stdout.write(`${formatSummary(decision)}\n`);
  }
  if (options.format === 'json' || options.format === 'both') {
    process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
  }
  if (options.jsonFile !== undefined) {
    writeFileSync(
      options.jsonFile,
      `${JSON.stringify(decision, null, 2)}\n`,
      'utf8',
    );
  }
  if (options.githubOutput !== undefined) {
    appendGithubOutputs(options.githubOutput, decision);
  }
}

if (
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  process.exitCode = runCli(process.argv.slice(2));
}
