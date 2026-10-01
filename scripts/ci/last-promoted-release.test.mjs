import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  findLastPromotedRelease,
  pickLastPromotedSha,
  runCli,
} from './last-promoted-release.mjs';

const older = 'a'.repeat(40);
const newer = 'b'.repeat(40);
const release = (sha, created_at, extra = {}) => ({
  name: `release-images-${sha}`,
  created_at,
  expired: false,
  ...extra,
});
const temporaryDirectories = [];

afterEach(() => {
  vi.unstubAllGlobals();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('pickLastPromotedSha', () => {
  test('returns the newest release manifest regardless of order', () => {
    expect(
      pickLastPromotedSha([
        release(older, '2026-10-01T10:00:00Z'),
        release(newer, '2026-10-01T12:00:00Z'),
      ]),
    ).toBe(newer);
  });

  test('ignores expired, malformed and unrelated artifacts', () => {
    expect(
      pickLastPromotedSha([
        release(newer, '2026-10-01T12:00:00Z', { expired: true }),
        { name: 'release-images-abc', created_at: '2026-10-01T13:00:00Z', expired: false },
        { name: 'coverage-report', created_at: '2026-10-01T14:00:00Z', expired: false },
        release(older, '2026-10-01T10:00:00Z'),
      ]),
    ).toBe(older);
  });

  test('returns undefined when no release manifest exists', () => {
    expect(pickLastPromotedSha([{ name: 'other', created_at: '2026-10-01T00:00:00Z' }])).toBeUndefined();
  });
});

describe('findLastPromotedRelease', () => {
  test('uses the last promoted SHA when it is an ancestor of HEAD', async () => {
    const result = await findLastPromotedRelease({
      fetchPage: async () => [release(newer, '2026-10-01T12:00:00Z')],
      isAncestor: () => true,
    });
    expect(result).toEqual({ sha: newer });
  });

  test('pages past full pages without a release and stops at the first match', async () => {
    const filler = Array.from({ length: 100 }, (_, i) => ({
      name: `ci-${i}`,
      created_at: '2026-10-01T00:00:00Z',
      expired: false,
    }));
    const fetchPage = vi.fn(async (page) => (page === 1 ? filler : [release(older, '2026-09-30T00:00:00Z')]));
    const result = await findLastPromotedRelease({ fetchPage, isAncestor: () => true });
    expect(result).toEqual({ sha: older });
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  test('falls back to a full rebuild when the release is not an ancestor', async () => {
    const result = await findLastPromotedRelease({
      fetchPage: async () => [release(newer, '2026-10-01T12:00:00Z')],
      isAncestor: () => false,
    });
    expect(result).toMatchObject({ full: true });
  });

  test('falls back to a full rebuild when no release exists', async () => {
    const result = await findLastPromotedRelease({ fetchPage: async () => [], isAncestor: () => true });
    expect(result).toEqual({ full: true, reason: 'no unexpired release-images artifact found' });
  });
});

describe('runCli', () => {
  function outputPath() {
    const directory = mkdtempSync(join(tmpdir(), 'nexus-last-promoted-'));
    temporaryDirectories.push(directory);
    return join(directory, 'output');
  }

  test('writes the base SHA to GITHUB_OUTPUT', async () => {
    const GITHUB_OUTPUT = outputPath();
    await runCli(
      { GITHUB_OUTPUT },
      { fetchPage: async () => [release(newer, '2026-10-01T12:00:00Z')], isAncestor: () => true },
    );
    expect(readFileSync(GITHUB_OUTPUT, 'utf8')).toBe(`sha=${newer}\nfull=false\n`);
  });

  test('requests a full rebuild when the artifact lookup fails', async () => {
    const GITHUB_OUTPUT = outputPath();
    const result = await runCli(
      { GITHUB_OUTPUT },
      {
        fetchPage: async () => {
          throw new Error('artifact listing failed: HTTP 502');
        },
        isAncestor: () => true,
      },
    );
    expect(result).toEqual({ full: true, reason: 'artifact listing failed: HTTP 502' });
    expect(readFileSync(GITHUB_OUTPUT, 'utf8')).toBe('sha=\nfull=true\n');
  });

  test('requires GITHUB_OUTPUT', async () => {
    await expect(runCli({})).rejects.toThrow('GITHUB_OUTPUT is required');
  });

  test('lists artifacts through the GitHub API and checks ancestry with git', async () => {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ artifacts: [release(head, '2026-10-01T12:00:00Z')] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const GITHUB_OUTPUT = outputPath();

    const result = await runCli({ GITHUB_OUTPUT, GITHUB_REPOSITORY: 'owner/repo', GH_TOKEN: 'token' });

    expect(result).toEqual({ sha: head });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/owner/repo/actions/artifacts?per_page=100&page=1');
    expect(init.headers.Authorization).toBe('Bearer token');
  });

  test('treats an unknown commit as not an ancestor', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      json: async () => ({ artifacts: [release('f'.repeat(40), '2026-10-01T12:00:00Z')] }),
    }));
    const result = await runCli({ GITHUB_OUTPUT: outputPath(), GITHUB_REPOSITORY: 'owner/repo', GH_TOKEN: 'token' });
    expect(result).toMatchObject({ full: true });
  });

  test('requests a full rebuild on an HTTP error or missing credentials', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 403 }));
    await expect(
      runCli({ GITHUB_OUTPUT: outputPath(), GITHUB_REPOSITORY: 'owner/repo', GH_TOKEN: 'token' }),
    ).resolves.toEqual({ full: true, reason: 'artifact listing failed: HTTP 403' });
    await expect(runCli({ GITHUB_OUTPUT: outputPath() })).resolves.toEqual({
      full: true,
      reason: 'GITHUB_REPOSITORY and GH_TOKEN are required',
    });
  });
});
