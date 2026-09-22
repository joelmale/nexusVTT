import { describe, expect, it, vi } from 'vitest';

import {
  buildTimingReport,
  classifyStep,
  collectTimingReport,
  createGitHubClient,
  formatSummary,
  parseRepository,
  parseRunId,
  validateDependencyMap,
  validateMetadata,
} from './actions-timing-lib.mjs';

const run = {
  id: 42,
  run_attempt: 2,
  name: 'CI',
  display_title: 'Improve timing',
  html_url: 'https://github.com/acme/repo/actions/runs/42',
  event: 'pull_request',
  status: 'completed',
  conclusion: 'success',
  head_sha: 'abc123',
  head_branch: 'feature',
  workflow_id: 7,
  path: '.github/workflows/ci.yml@refs/pull/1/merge',
  created_at: '2026-09-22T12:00:00Z',
  run_started_at: '2026-09-22T12:00:10Z',
  updated_at: '2026-09-22T12:05:00Z',
};

const jobs = [
  {
    id: 1,
    name: 'lint',
    run_attempt: 2,
    status: 'completed',
    conclusion: 'success',
    runner_name: 'GitHub Actions 1',
    runner_group_name: 'GitHub Actions',
    labels: ['ubuntu-latest'],
    started_at: '2026-09-22T12:00:20Z',
    completed_at: '2026-09-22T12:01:20Z',
    steps: [
      {
        number: 1,
        name: 'npm ci',
        status: 'completed',
        conclusion: 'success',
        started_at: '2026-09-22T12:00:20Z',
        completed_at: '2026-09-22T12:00:50Z',
      },
    ],
  },
  {
    id: 2,
    name: 'validation-gate',
    status: 'completed',
    conclusion: 'success',
    started_at: '2026-09-22T12:01:30Z',
    completed_at: '2026-09-22T12:02:00Z',
    steps: [
      {
        number: 1,
        name: 'Run tests',
        status: 'completed',
        conclusion: 'success',
        started_at: '2026-09-22T12:01:30Z',
        completed_at: '2026-09-22T12:01:50Z',
      },
    ],
  },
];

describe('input validation', () => {
  it('accepts run URLs and repository slugs', () => {
    expect(
      parseRunId(
        'https://github.com/acme/repo/actions/runs/123?check_suite_focus=true',
      ),
    ).toBe(123);
    expect(parseRepository('acme/repo.js')).toBe('acme/repo.js');
  });

  it.each([
    () => parseRunId('0'),
    () => parseRepository('acme'),
    () => validateMetadata(null),
    () => validateMetadata({ affectedWorkspaces: 'apps/vtt' }),
    () => validateMetadata({ changeClass: '' }),
    () => validateMetadata({ testCounts: [] }),
    () => validateMetadata({ testCounts: { passed: -1 } }),
    () => validateMetadata({ cacheStorageBytes: -1 }),
    () => validateMetadata({ coverage: { lines: 101 } }),
    () => validateMetadata({ imageDigests: [] }),
    () => validateMetadata({ imageDigests: { vtt: '' } }),
    () => validateMetadata({ runnerConcurrency: [] }),
    () => validateMetadata({ runnerConcurrency: { account: -1 } }),
    () => validateMetadata({ runnerConcurrency: { notes: 1 } }),
    () => validateMetadata({ cacheState: 'hit' }),
    () => validateMetadata({ sboms: {} }),
    () => validateMetadata({ surprise: true }),
    () => validateDependencyMap([]),
    () => validateDependencyMap({ lint: 'build' }),
    () => validateDependencyMap({ lint: ['lint'] }),
  ])('rejects unsafe or malformed inputs', (action) => {
    expect(action).toThrow();
  });

  it('accepts the complete supported annotation shape', () => {
    const metadata = {
      affectedWorkspaces: ['apps/vtt'],
      cacheNamespace: 'warm-main',
      cacheState: { npm: 'hit' },
      cacheStorageBytes: 2048,
      changeClass: 'vtt-only',
      coverage: { lines: 54 },
      imageDigests: { vtt: 'sha256:abc' },
      notes: ['controlled warm run'],
      publicationJob: 'publish',
      rerunSourceShaType: 'branch',
      runnerConcurrency: { account: null, configured: 4, notes: 'observed' },
      sarifCategories: ['codeql'],
      sboms: [{ name: 'vtt.cdx.json' }],
      testCounts: { passed: 100 },
      validationJob: 'gate',
    };

    expect(validateMetadata(metadata)).toBe(metadata);
    expect(validateDependencyMap({ publish: ['gate'] })).toEqual({
      publish: ['gate'],
    });
  });
});

describe('report construction', () => {
  it('calculates timings, categories, dependency delay, artifacts, and overlap', () => {
    const report = buildTimingReport({
      artifacts: [
        {
          id: 9,
          name: 'coverage',
          size_in_bytes: 1024,
          expired: false,
          created_at: '2026-09-22T12:02:00Z',
          expires_at: '2026-09-29T12:02:00Z',
        },
      ],
      collectedAt: '2026-09-22T12:10:00Z',
      concurrentRuns: [
        run,
        {
          ...run,
          id: 43,
          name: 'Security',
          created_at: '2026-09-22T12:01:00Z',
          updated_at: '2026-09-22T12:03:00Z',
        },
      ],
      dependencyMap: { 'validation-gate': ['lint'] },
      jobs,
      metadata: {
        affectedWorkspaces: ['apps/vtt'],
        coverage: { lines: 54.5 },
        rerunSourceShaType: 'pr-merge',
        validationJob: 'validation-gate',
      },
      repository: 'acme/repo',
      run,
      workflowRevisionSha: 'workflowblob',
    });

    expect(report.run.workflow).toEqual({
      id: 7,
      path: '.github/workflows/ci.yml',
      revisionSha: 'workflowblob',
    });
    expect(report.durationsSeconds).toMatchObject({
      triggerToCompletion: 300,
      triggerToRunStart: 10,
      triggerToValidationGate: 120,
      runnerExecution: 90,
      observedRunnerMinutes: 1.5,
    });
    expect(report.jobs[1].dependencyStartDelaySeconds).toBe(10);
    expect(report.jobs[0].steps[0].category).toBe('install');
    expect(report.stepCategoryTotalsSeconds).toMatchObject({
      install: 30,
      test: 20,
    });
    expect(report.artifactTotalBytes).toBe(1024);
    expect(report.overlap.sameRepository.map(({ id }) => id)).toEqual([43]);
    expect(formatSummary(report)).toContain('Trigger → validation gate: 2m 0s');
  });

  it('keeps incomplete and missing dependency timing explicitly null', () => {
    const report = buildTimingReport({
      dependencyMap: { 'validation-gate': ['missing'] },
      jobs,
      repository: 'acme/repo',
      run: {
        ...run,
        status: 'in_progress',
        updated_at: '2026-09-22T12:05:00Z',
      },
    });

    expect(report.timestamps.completedAt).toBeNull();
    expect(report.durationsSeconds.triggerToCompletion).toBeNull();
    expect(report.jobs[1]).toMatchObject({
      dependencyStartDelaySeconds: null,
      missingDependencyNames: ['missing'],
    });
  });

  it.each([
    ['Restore npm cache', 'cache-import'],
    ['Save Docker cache', 'cache-export'],
    ['Upload test artifact', 'artifact-transfer'],
    ['Push container image', 'image-push'],
    ['Build Docker image', 'image-build'],
    ['Compile contracts', 'contract-build'],
    ['Trivy scan', 'scan'],
    ['Cleanup', null],
  ])('classifies %s as %s', (name, category) => {
    expect(classifyStep(name)).toBe(category);
  });
});

describe('GitHub collection', () => {
  it('uses read-only API requests, follows pagination, and resolves the workflow blob', async () => {
    const requests = [];
    const responses = new Map([
      [
        'https://api.github.test/repos/acme/repo/actions/runs/42',
        { body: run },
      ],
      [
        'https://api.github.test/repos/acme/repo/actions/runs/42/jobs?filter=all&per_page=100',
        {
          body: { jobs: [jobs[0]] },
          link: '<https://api.github.test/jobs-page-2>; rel="next"',
        },
      ],
      ['https://api.github.test/jobs-page-2', { body: { jobs: [jobs[1]] } }],
      [
        'https://api.github.test/repos/acme/repo/actions/runs/42/artifacts?per_page=100',
        { body: { artifacts: [] } },
      ],
      [
        'https://api.github.test/repos/acme/repo/contents/.github/workflows/ci.yml?ref=abc123',
        { body: { sha: 'workflowblob' } },
      ],
    ]);
    const fetchImpl = vi.fn(async (url, init) => {
      requests.push({ url, init });
      if (url.includes('/actions/runs?created=')) {
        return new Response(JSON.stringify({ workflow_runs: [run] }), {
          status: 200,
        });
      }
      const response = responses.get(url);
      if (!response) return new Response('missing fixture', { status: 404 });
      return new Response(JSON.stringify(response.body), {
        status: 200,
        headers: response.link ? { Link: response.link } : {},
      });
    });

    const report = await collectTimingReport({
      apiUrl: 'https://api.github.test',
      fetchImpl,
      metadata: { validationJob: 'validation-gate' },
      repository: 'acme/repo',
      runId: 42,
      token: 'secret',
    });

    expect(report.jobs).toHaveLength(2);
    expect(report.run.workflow.revisionSha).toBe('workflowblob');
    expect(requests.every(({ init }) => init.method === undefined)).toBe(true);
    expect(requests[0].init.headers.Authorization).toBe('Bearer secret');
  });

  it('surfaces API errors without exposing the token', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('rate limited', { status: 403 }),
    );
    await expect(
      collectTimingReport({
        apiUrl: 'https://api.github.test',
        fetchImpl,
        repository: 'acme/repo',
        runId: 42,
        token: 'do-not-print',
      }),
    ).rejects.not.toThrow(/do-not-print/);
  });

  it('supports optional 404s and rejects malformed pagination responses', async () => {
    const client = createGitHubClient({
      apiUrl: 'https://api.github.test/',
      fetchImpl: async (url) =>
        url.endsWith('/optional')
          ? new Response('missing', { status: 404 })
          : new Response(JSON.stringify({ wrong: [] }), { status: 200 }),
    });

    await expect(
      client.request('/optional', { optional: true }),
    ).resolves.toBeNull();
    await expect(client.paginate('/items', 'items')).rejects.toThrow(
      'did not include items',
    );
  });

  it('rejects a run response with a mismatched identity', async () => {
    await expect(
      collectTimingReport({
        apiUrl: 'https://api.github.test',
        fetchImpl: async () =>
          new Response(JSON.stringify({ ...run, id: 99 }), { status: 200 }),
        repository: 'acme/repo',
        runId: 42,
      }),
    ).rejects.toThrow('different run ID');
  });
});
