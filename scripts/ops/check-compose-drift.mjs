#!/usr/bin/env node

// Compares the compose file deployed on HomePod (Dockhand's stored copy of the
// nexus-vtt2 stack) with deploy/homelab/compose.yaml, service by service, and
// reports where they differ. The two had drifted unnoticed: the live copy kept
// `restart: on-failure` and lacked the doc-processor metrics settings, so the
// codex services stayed down after a host stop.
//
// CI cannot reach Dockhand, so this runs where the live copy is available:
//   1. save the stack's compose (Dockhand UI, or the get_stack_compose MCP tool)
//   2. node scripts/ops/check-compose-drift.mjs path/to/live-compose.yaml
// Only structure that changes behaviour is compared: image, restart, stop grace
// period, memory limit, healthcheck, depends_on conditions, networks and the
// *names* of environment variables. Values are not compared (they hold secrets
// and legitimately differ per host).

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const DEFAULT_REPO_COMPOSE = resolve(ROOT_DIR, 'deploy/homelab/compose.yaml');

const toKeys = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((entry) => String(entry).split('=')[0]).sort();
  return Object.keys(value).sort();
};

const dependsOn = (value) => {
  if (!value) return {};
  if (Array.isArray(value)) return Object.fromEntries(value.map((name) => [name, 'service_started']));
  return Object.fromEntries(Object.entries(value).map(([name, spec]) => [name, spec?.condition ?? 'service_started']));
};

/** The behaviour-relevant facts about one service. */
export function summarizeService(service = {}) {
  return {
    image: service.image ?? null,
    restart: service.restart ?? null,
    stop_grace_period: service.stop_grace_period ?? null,
    mem_limit: service.mem_limit ?? null,
    healthcheck: service.healthcheck ? 'defined' : null,
    depends_on: dependsOn(service.depends_on),
    networks: toKeys(service.networks),
    environment: toKeys(service.environment),
  };
}

const sameSet = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Image tags are compared without a ${VAR:-default} wrapper so overrides do not count as drift. */
const normalizeImage = (image) => image?.replace(/^\$\{[^:}]+:-(.*)\}$/, '$1') ?? null;

/** Human-readable drift lines; empty when the two files agree on everything compared. */
export function compareComposes(live, repo) {
  const drift = [];
  const liveServices = live?.services ?? {};
  const repoServices = repo?.services ?? {};

  for (const name of Object.keys(repoServices)) {
    if (!(name in liveServices)) drift.push(`${name}: in the repo compose but not deployed`);
  }
  for (const name of Object.keys(liveServices)) {
    if (!(name in repoServices)) drift.push(`${name}: deployed but not in the repo compose`);
  }

  for (const name of Object.keys(repoServices).filter((service) => service in liveServices)) {
    const a = summarizeService(liveServices[name]);
    const b = summarizeService(repoServices[name]);
    for (const field of ['restart', 'stop_grace_period', 'mem_limit', 'healthcheck']) {
      if (a[field] !== b[field]) drift.push(`${name}.${field}: deployed ${a[field] ?? 'unset'}, repo ${b[field] ?? 'unset'}`);
    }
    if (normalizeImage(a.image) !== normalizeImage(b.image)) {
      drift.push(`${name}.image: deployed ${a.image ?? 'unset'}, repo ${b.image ?? 'unset'}`);
    }
    for (const dependency of new Set([...Object.keys(a.depends_on), ...Object.keys(b.depends_on)])) {
      if (a.depends_on[dependency] !== b.depends_on[dependency]) {
        drift.push(`${name}.depends_on.${dependency}: deployed ${a.depends_on[dependency] ?? 'none'}, repo ${b.depends_on[dependency] ?? 'none'}`);
      }
    }
    if (!sameSet(a.networks, b.networks)) {
      drift.push(`${name}.networks: deployed [${a.networks}], repo [${b.networks}]`);
    }
    const missing = b.environment.filter((key) => !a.environment.includes(key));
    const extra = a.environment.filter((key) => !b.environment.includes(key));
    if (missing.length) drift.push(`${name}.environment: missing from deployed: ${missing.join(', ')}`);
    if (extra.length) drift.push(`${name}.environment: only in deployed: ${extra.join(', ')}`);
  }
  return drift;
}

export function loadCompose(path) {
  return yaml.load(readFileSync(path, 'utf8'));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [livePath, repoPath = DEFAULT_REPO_COMPOSE] = process.argv.slice(2);
  if (!livePath) {
    console.error('usage: check-compose-drift.mjs <live-compose.yaml> [repo-compose.yaml]');
    process.exit(2);
  }
  const drift = compareComposes(loadCompose(livePath), loadCompose(repoPath));
  if (drift.length === 0) {
    console.log('No drift: the deployed compose matches the repo on every compared field.');
  } else {
    console.error(`${drift.length} difference(s) between the deployed compose and ${repoPath}:\n- ${drift.join('\n- ')}`);
    process.exit(1);
  }
}
