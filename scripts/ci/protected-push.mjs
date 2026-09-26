#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ZERO_SHA = /^0{40}$/;
export const PROTECTED_REFS = new Set(['refs/heads/main']);

export function parsePushUpdates(input) {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const fields = line.split(/\s+/);
      if (fields.length !== 4) {
        throw new Error(`invalid pre-push update: ${line}`);
      }
      const [localRef, localSha, remoteRef, remoteSha] = fields;
      return { localRef, localSha, remoteRef, remoteSha };
    });
}

export function blockedProtectedUpdates(updates) {
  return updates.filter(
    (update) =>
      PROTECTED_REFS.has(update.remoteRef) && !ZERO_SHA.test(update.localSha),
  );
}

export function runProtectedPushCheck(input, environment = process.env) {
  const blocked = blockedProtectedUpdates(parsePushUpdates(input));
  if (blocked.length === 0) {
    return 0;
  }
  if (environment.ALLOW_PROTECTED_BRANCH_PUSH === '1') {
    process.stderr.write(
      'Emergency protected-branch override accepted; repository rules still apply.\n',
    );
    return 0;
  }
  process.stderr.write(
    `Direct pushes to ${blocked.map((update) => update.remoteRef).join(', ')} are blocked. ` +
      'Push a feature branch and merge it through a pull request.\n',
  );
  return 1;
}

if (
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    process.exitCode = runProtectedPushCheck(readFileSync(0, 'utf8'));
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
