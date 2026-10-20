#!/usr/bin/env node

// Fails when package-lock.json resolves more than one version of a package that
// must exist once per process. pdfjs-dist keeps its worker on a global, so a
// second copy (it arrived nested under pdf-parse) makes whichever version runs
// second fail with "The API version X does not match the Worker version Y",
// depending on what the process did earlier. See doc-processor pdf.service.ts.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export const SINGLETON_PACKAGES = ['pdfjs-dist'];

/** Map of package name -> Map(version -> [lockfile paths]) for the given names. */
export function collectVersions(lock, names = SINGLETON_PACKAGES) {
  const found = new Map(names.map((name) => [name, new Map()]));
  for (const [path, entry] of Object.entries(lock.packages ?? {})) {
    const marker = 'node_modules/';
    const index = path.lastIndexOf(marker);
    if (index === -1) continue;
    const name = path.slice(index + marker.length);
    const versions = found.get(name);
    if (!versions || !entry?.version) continue;
    versions.set(entry.version, [...(versions.get(entry.version) ?? []), path]);
  }
  return found;
}

/** Human-readable failures, empty when every singleton resolves to one version. */
export function findDuplicateVersions(lock, names = SINGLETON_PACKAGES) {
  const failures = [];
  for (const [name, versions] of collectVersions(lock, names)) {
    if (versions.size <= 1) continue;
    const detail = [...versions]
      .map(([version, paths]) => `  ${version}: ${paths.join(', ')}`)
      .join('\n');
    failures.push(`${name} resolves to ${versions.size} versions; it must be single-version:\n${detail}`);
  }
  return failures;
}

export function checkSingletonDeps(lockPath = resolve(ROOT_DIR, 'package-lock.json')) {
  return findDuplicateVersions(JSON.parse(readFileSync(lockPath, 'utf8')));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const failures = checkSingletonDeps();
  if (failures.length > 0) {
    console.error(failures.join('\n\n'));
    process.exit(1);
  }
  console.log(`Singleton dependencies OK (${SINGLETON_PACKAGES.join(', ')}).`);
}
