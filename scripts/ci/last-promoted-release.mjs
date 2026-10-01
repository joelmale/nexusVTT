#!/usr/bin/env node

// Finds the source SHA that the `latest` image tags were last promoted from,
// so delivery can compute affected images against what is actually released.
//
// Diffing against `github.event.before` loses changes from any push whose
// promotion was skipped as superseded: its images are built under sha-* but
// never promoted, and the next push only promotes the images *it* touched.
//
// The promote job uploads `release-images-<sha>` only for eligible (current
// main) runs and runs under one concurrency group, so the newest such
// artifact is the last promotion. Anything unexpected falls back to a full
// rebuild: over-building is safe, under-building silently drops a release.

import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ARTIFACT_PATTERN = /^release-images-([0-9a-f]{40})$/;
const PER_PAGE = 100;
const MAX_PAGES = 10;

/** Newest unexpired release manifest artifact -> its source SHA, or undefined. */
export function pickLastPromotedSha(artifacts) {
  const releases = artifacts
    .filter((artifact) => !artifact.expired && ARTIFACT_PATTERN.test(artifact.name))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return releases.length > 0 ? ARTIFACT_PATTERN.exec(releases[0].name)[1] : undefined;
}

/**
 * @param fetchPage (page) => Promise<artifact[]>, newest first as the
 *   GitHub API returns them; scanning stops at the first page with a release.
 * @param isAncestor (sha) => boolean, whether sha is reachable from HEAD.
 * @returns {{ sha: string } | { full: true, reason: string }}
 */
export async function findLastPromotedRelease({ fetchPage, isAncestor }) {
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const artifacts = await fetchPage(page);
    const sha = pickLastPromotedSha(artifacts);
    if (sha !== undefined) {
      return isAncestor(sha)
        ? { sha }
        : { full: true, reason: `last promoted release ${sha} is not an ancestor of HEAD` };
    }
    if (artifacts.length < PER_PAGE) break;
  }
  return { full: true, reason: 'no unexpired release-images artifact found' };
}

function githubFetchPage(env) {
  const api = env.GITHUB_API_URL ?? 'https://api.github.com';
  const token = env.GH_TOKEN ?? env.GITHUB_TOKEN;
  if (!env.GITHUB_REPOSITORY || !token) {
    throw new Error('GITHUB_REPOSITORY and GH_TOKEN are required');
  }
  return async (page) => {
    const response = await fetch(
      `${api}/repos/${env.GITHUB_REPOSITORY}/actions/artifacts?per_page=${PER_PAGE}&page=${page}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } },
    );
    if (!response.ok) {
      throw new Error(`artifact listing failed: HTTP ${response.status}`);
    }
    return (await response.json()).artifacts ?? [];
  };
}

function gitIsAncestor(sha) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export async function runCli(env = process.env, deps = {}) {
  if (!env.GITHUB_OUTPUT) {
    throw new Error('GITHUB_OUTPUT is required');
  }
  let result;
  try {
    result = await findLastPromotedRelease({
      fetchPage: deps.fetchPage ?? githubFetchPage(env),
      isAncestor: deps.isAncestor ?? gitIsAncestor,
    });
  } catch (error) {
    result = { full: true, reason: error instanceof Error ? error.message : String(error) };
  }
  const lines = 'sha' in result
    ? [`sha=${result.sha}`, 'full=false']
    : ['sha=', 'full=true'];
  appendFileSync(env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
  process.stdout.write(
    'sha' in result
      ? `Affected images are computed against the last promoted release ${result.sha}.\n`
      : `Rebuilding every image: ${result.reason}.\n`,
  );
  return result;
}

if (
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
