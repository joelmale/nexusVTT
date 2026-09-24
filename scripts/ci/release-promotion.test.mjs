import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { decidePromotion, runPromotionCheck } from './release-promotion.mjs';

vi.mock('node:child_process', async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, execFileSync: vi.fn(original.execFileSync) };
});

const sourceSha = 'a'.repeat(40);
const newerSha = 'b'.repeat(40);
const mainEnv = {
  EVENT_NAME: 'push',
  EVENT_REF: 'refs/heads/main',
  SOURCE_SHA: sourceSha,
};
const temporaryDirectories = [];

function outputEnv(overrides = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'nexus-release-promotion-'));
  temporaryDirectories.push(directory);
  return {
    ...mainEnv,
    GITHUB_OUTPUT: join(directory, 'output'),
    GITHUB_STEP_SUMMARY: join(directory, 'summary'),
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('release promotion eligibility', () => {
  test.each(['push', 'workflow_dispatch'])(
    'allows the current main source for %s',
    (eventName) => {
      expect(
        decidePromotion(
          { ...mainEnv, EVENT_NAME: eventName },
          () => `${sourceSha}\trefs/heads/main\n`,
        ).disposition,
      ).toBe('eligible');
    },
  );

  test.each(['push', 'workflow_dispatch'])(
    'supersedes an older main source for %s',
    (eventName) => {
      expect(
        decidePromotion(
          { ...mainEnv, EVENT_NAME: eventName },
          () => `${newerSha}\trefs/heads/main\n`,
        ),
      ).toEqual({
        disposition: 'superseded',
        sourceSha,
        currentMain: newerSha,
      });
    },
  );

  test.each([
    ['push', 'refs/tags/v1.2.3'],
    ['workflow_dispatch', 'refs/heads/release'],
  ])(
    'preserves explicit non-main release behavior for %s %s',
    (eventName, ref) => {
      const readMain = vi.fn();
      expect(
        decidePromotion(
          { ...mainEnv, EVENT_NAME: eventName, EVENT_REF: ref },
          readMain,
        ).disposition,
      ).toBe('eligible');
      expect(readMain).not.toHaveBeenCalled();
    },
  );

  test.each([
    '',
    'abc',
    `${sourceSha}\trefs/heads/other`,
    `${sourceSha}\trefs/heads/main\n${newerSha}\trefs/heads/main`,
  ])('fails closed for invalid remote output %j', (remote) => {
    expect(() => decidePromotion(mainEnv, () => remote)).toThrow(
      'resolve exactly one',
    );
  });

  test.each([
    [{ SOURCE_SHA: undefined }, 'SOURCE_SHA'],
    [{ SOURCE_SHA: 'abc' }, 'SOURCE_SHA'],
    [{ EVENT_NAME: 'pull_request' }, 'Unsupported promotion event'],
    [{ EVENT_REF: '' }, 'EVENT_REF'],
    [{ EVENT_REF: undefined }, 'EVENT_REF'],
  ])('rejects invalid promotion context %j', (override, message) => {
    expect(() => decidePromotion({ ...mainEnv, ...override }, vi.fn())).toThrow(
      message,
    );
  });

  test('does not turn a failed remote lookup into a superseded success', () => {
    const env = outputEnv();
    expect(() =>
      runPromotionCheck(env, () => {
        throw new Error('git lookup failed');
      }),
    ).toThrow('git lookup failed');
    expect(() => readFileSync(env.GITHUB_OUTPUT)).toThrow();
  });

  test.each(['eligible', 'superseded'])(
    'records the %s outcome for Actions',
    (disposition) => {
      const env = outputEnv();
      const sha = disposition === 'eligible' ? sourceSha : newerSha;
      runPromotionCheck(env, () => `${sha}\trefs/heads/main`);
      expect(readFileSync(env.GITHUB_OUTPUT, 'utf8')).toBe(
        `disposition=${disposition}\n`,
      );
      const summary = readFileSync(env.GITHUB_STEP_SUMMARY, 'utf8');
      expect(summary).toContain(sourceSha);
      expect(summary).toContain(
        disposition === 'eligible'
          ? 'eligible for promotion'
          : 'latest tags were not changed',
      );
    },
  );

  test('requires Actions output paths', () => {
    expect(() => runPromotionCheck(mainEnv, vi.fn())).toThrow(
      'paths are required',
    );
  });

  test('looks up main using Git without shell interpolation', () => {
    const env = outputEnv();
    vi.mocked(execFileSync).mockReturnValueOnce(
      `${sourceSha}\trefs/heads/main\n`,
    );
    expect(runPromotionCheck(env).disposition).toBe('eligible');
    expect(execFileSync).toHaveBeenCalledWith(
      'git',
      ['ls-remote', '--exit-code', 'origin', 'refs/heads/main'],
      { encoding: 'utf8' },
    );
  });

  test('the executable fails when promotion context is invalid', () => {
    const env = outputEnv({ SOURCE_SHA: 'invalid' });
    expect(() =>
      execFileSync(
        process.execPath,
        [fileURLToPath(new URL('./release-promotion.mjs', import.meta.url))],
        { env: { ...process.env, ...env }, stdio: 'pipe' },
      ),
    ).toThrow('SOURCE_SHA must be a full lowercase Git SHA');
    expect(() => readFileSync(env.GITHUB_OUTPUT)).toThrow();
  });

  test('the executable writes outputs for a tagged release', () => {
    const env = outputEnv({ EVENT_REF: 'refs/tags/v1.2.3' });
    execFileSync(
      process.execPath,
      [fileURLToPath(new URL('./release-promotion.mjs', import.meta.url))],
      {
        env: { ...process.env, ...env },
      },
    );
    expect(readFileSync(env.GITHUB_OUTPUT, 'utf8')).toBe(
      'disposition=eligible\n',
    );
  });
});
