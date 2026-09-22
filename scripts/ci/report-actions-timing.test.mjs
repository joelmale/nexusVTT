import { describe, expect, it, vi } from 'vitest';

import { parseArgs, run } from './report-actions-timing.mjs';

const minimalReport = {
  collection: { repository: 'acme/repo' },
  run: {
    id: 42,
    attempt: 1,
    name: 'CI',
    commit: 'abc',
    event: 'push',
    conclusion: 'success',
  },
  durationsSeconds: {
    triggerToCompletion: 60,
    runnerExecution: 30,
    triggerToValidationGate: null,
    triggerToPublication: null,
  },
  timestamps: {
    validationGateCompletedAt: null,
    publicationCompletedAt: null,
  },
  jobs: [],
  artifacts: [],
  artifactTotalBytes: 0,
  overlap: { sameRepository: [] },
};

describe('timing report CLI', () => {
  it('uses environment defaults and validates overrides', () => {
    expect(
      parseArgs(['--run', '42', '--output', 'report.json'], {
        GITHUB_REPOSITORY: 'acme/repo',
      }),
    ).toMatchObject({
      apiUrl: 'https://api.github.com',
      output: 'report.json',
      repository: 'acme/repo',
      runId: 42,
    });
  });

  it.each([
    [['--run'], 'requires a value'],
    [['--wat'], 'unknown argument'],
    [['--run', '42'], 'repository must be'],
    [['--run', '42', '--repo', 'acme/repo', '--api-url', 'nope'], 'valid URL'],
  ])('rejects invalid arguments', (argumentsList, message) => {
    expect(() => parseArgs(argumentsList, {})).toThrow(message);
  });

  it('returns help without requiring repository or run inputs', () => {
    expect(parseArgs(['--help'], {})).toEqual({ help: true });
  });

  it('writes JSON to stdout and the summary to stderr', async () => {
    const stdout = { write: vi.fn() };
    const stderr = { write: vi.fn() };
    const collectTimingReportImpl = vi.fn(async () => minimalReport);

    await run(['--run', '42', '--repo', 'acme/repo'], {
      collectTimingReportImpl,
      environment: { GH_TOKEN: 'token' },
      stderr,
      stdout,
    });

    expect(collectTimingReportImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        repository: 'acme/repo',
        runId: 42,
        token: 'token',
      }),
    );
    expect(JSON.parse(stdout.write.mock.calls[0][0])).toEqual(minimalReport);
    expect(stderr.write.mock.calls[0][0]).toContain(
      'Trigger → complete: 1m 0s',
    );
  });

  it('loads annotations and dependency edges and writes a named report', async () => {
    const stdout = { write: vi.fn() };
    const collectTimingReportImpl = vi.fn(async () => minimalReport);
    const readJsonImpl = vi.fn(async (path) =>
      path === 'metadata.json'
        ? { affectedWorkspaces: ['apps/vtt'] }
        : { publish: ['validation-gate'] },
    );
    const writeFileImpl = vi.fn(async () => undefined);

    await run(
      [
        '--run',
        '42',
        '--repo',
        'acme/repo',
        '--metadata',
        'metadata.json',
        '--dependency-map',
        'dependencies.json',
        '--validation-job',
        'validation-gate',
        '--publication-job',
        'publish',
        '--output',
        'report.json',
      ],
      {
        collectTimingReportImpl,
        environment: { GITHUB_TOKEN: 'fallback-token' },
        readJsonImpl,
        stdout,
        writeFileImpl,
      },
    );

    expect(collectTimingReportImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        dependencyMap: { publish: ['validation-gate'] },
        metadata: {
          affectedWorkspaces: ['apps/vtt'],
          publicationJob: 'publish',
          validationJob: 'validation-gate',
        },
        token: 'fallback-token',
      }),
    );
    expect(writeFileImpl).toHaveBeenCalledWith(
      'report.json',
      expect.stringContaining('"collection"'),
      { encoding: 'utf8', flag: 'w' },
    );
    expect(stdout.write).toHaveBeenCalledWith(
      expect.stringContaining('JSON: report.json'),
    );
  });

  it('prints help through the runnable interface', async () => {
    const stdout = { write: vi.fn() };
    await run(['--help'], { stdout });
    expect(stdout.write).toHaveBeenCalledWith(
      expect.stringContaining('Usage:'),
    );
  });
});
