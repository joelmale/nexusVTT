#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(SCRIPT_DIR, '../..');
const MIGRATIONS_DIR = resolve(ROOT_DIR, 'apps/vtt/server/migrations');
const REGISTRY_PATH = resolve(ROOT_DIR, 'apps/vtt/server/startupMigrations.ts');

export function extractMigrationFileNames(content, arrayName) {
  const arrayStart = content.indexOf(`const ${arrayName}`);
  if (arrayStart === -1) {
    throw new Error(`Could not find ${arrayName} declaration in ${REGISTRY_PATH}`);
  }
  const arrayEnd = content.indexOf('];', arrayStart);
  if (arrayEnd === -1) {
    throw new Error(`Could not find end of ${arrayName} array in ${REGISTRY_PATH}`);
  }
  const slice = content.slice(arrayStart, arrayEnd);
  const matches = [...slice.matchAll(/fileName:\s*['"]([^'"]+)['"]/g)];
  return matches.map((m) => m[1]);
}

export function validateStartupMigrations() {
  if (!existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found at: ${MIGRATIONS_DIR}`);
  }
  if (!existsSync(REGISTRY_PATH)) {
    throw new Error(`Startup migration registry not found at: ${REGISTRY_PATH}`);
  }

  const registryContent = readFileSync(REGISTRY_PATH, 'utf8');
  const startupFiles = extractMigrationFileNames(
    registryContent,
    'STARTUP_MIGRATIONS',
  );
  const nonStartupFiles = extractMigrationFileNames(
    registryContent,
    'KNOWN_NON_STARTUP_MIGRATIONS',
  );

  const diskFiles = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  // 1. Verify all files in STARTUP_MIGRATIONS exist and are non-empty
  for (const file of startupFiles) {
    const fullPath = resolve(MIGRATIONS_DIR, file);
    if (!existsSync(fullPath)) {
      throw new Error(
        `STARTUP_MIGRATIONS references non-existent file on disk: ${file}`,
      );
    }
    const stat = statSync(fullPath);
    if (stat.size === 0) {
      throw new Error(`Startup migration file is empty: ${file}`);
    }
  }

  // 2. Verify all files in KNOWN_NON_STARTUP_MIGRATIONS exist and are non-empty
  for (const file of nonStartupFiles) {
    const fullPath = resolve(MIGRATIONS_DIR, file);
    if (!existsSync(fullPath)) {
      throw new Error(
        `KNOWN_NON_STARTUP_MIGRATIONS references non-existent file on disk: ${file}`,
      );
    }
    const stat = statSync(fullPath);
    if (stat.size === 0) {
      throw new Error(`Known non-startup migration file is empty: ${file}`);
    }
  }

  // 3. Verify no overlap between startup and non-startup migrations
  const startupSet = new Set(startupFiles);
  for (const file of nonStartupFiles) {
    if (startupSet.has(file)) {
      throw new Error(
        `Migration file '${file}' is listed in both STARTUP_MIGRATIONS and KNOWN_NON_STARTUP_MIGRATIONS`,
      );
    }
  }

  // 4. Verify STARTUP_MIGRATIONS preserves chronological/alphabetical ordering
  const sortedStartupFiles = [...startupFiles].sort();
  for (let i = 0; i < startupFiles.length; i++) {
    if (startupFiles[i] !== sortedStartupFiles[i]) {
      throw new Error(
        `STARTUP_MIGRATIONS ordering violated: expected '${sortedStartupFiles[i]}' at position ${i}, got '${startupFiles[i]}'`,
      );
    }
  }

  // 5. Verify every disk migration is accounted for (drift prevention)
  const combinedSet = new Set([...startupFiles, ...nonStartupFiles]);
  const unaccountedFiles = diskFiles.filter((file) => !combinedSet.has(file));

  if (unaccountedFiles.length > 0) {
    throw new Error(
      `Migration drift detected! The following SQL migration(s) exist in apps/vtt/server/migrations but are neither registered in STARTUP_MIGRATIONS nor classified in KNOWN_NON_STARTUP_MIGRATIONS:\n` +
        unaccountedFiles.map((f) => `  - ${f}`).join('\n') +
        `\nTo fix this: Register each required production startup migration in apps/vtt/server/startupMigrations.ts with an idempotency predicate, or add it to KNOWN_NON_STARTUP_MIGRATIONS with a documented rationale.`,
    );
  }

  return {
    diskCount: diskFiles.length,
    nonStartupCount: nonStartupFiles.length,
    startupCount: startupFiles.length,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const stats = validateStartupMigrations();
    process.stdout.write(
      `✅ Startup migration registry is in sync (${stats.startupCount} startup migrations, ${stats.nonStartupCount} non-startup migrations, ${stats.diskCount} total on disk).\n`,
    );
  } catch (error) {
    process.stderr.write(`❌ Migration drift check failed: ${error.message}\n`);
    process.exit(1);
  }
}
