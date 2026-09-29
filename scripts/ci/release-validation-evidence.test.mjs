import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  fetchSuccessfulValidation,
  runValidationEvidence,
  selectSuccessfulValidation,
  waitForSuccessfulValidation,
} from './release-validation-evidence.mjs';

const sourceSha = 'a'.repeat(40);
const temporaryDirectories = [];

function response(payload, { ok = true, status = 200 } = {}) {
  return { ok, status, json: vi.fn().mockResolvedValue(payload) };
}

function actionsEnv(overrides = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'nexus-validation-evidence-'));
  temporaryDirectories.push(directory);
  return {
    GITHUB_API_URL: 'https://github.example/api/v3',
    GITHUB_OUTPUT: join(directory, 'output'),
    GITHUB_REPOSITORY: 'nexus/vtt',
    GITHUB_STEP_SUMMARY: join(directory, 'summary'),
    GITHUB_TOKEN: 'test-token',
    REQUIRED_VALIDATION_EVENT: 'push',
    SOURCE_SHA: sourceSha,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('release validation evidence', () => {
  test('selects the newest successful completed run for the exact SHA', () => {
    expect(
      selectSuccessfulValidation(
        {
          workflow_runs: [
            {
              conclusion: 'success',
              event: 'push',
              head_sha: sourceSha,
              html_url: 'https://github.example/runs/1',
              id: 1,
              run_number: 10,
              status: 'completed',
            },
            {
              conclusion: 'success',
              event: 'push',
              head_sha: sourceSha,
              html_url: 'https://github.example/runs/2',
              id: 2,
              run_number: 11,
              status: 'completed',
            },
          ],
        },
        sourceSha,
        'push',
      ).id,
    ).toBe(2);
  });

  test.each([
    [{ workflow_runs: [] }, 'No successful'],
    [
      {
        workflow_runs: [
          {
            conclusion: 'failure',
            event: 'push',
            head_sha: sourceSha,
            html_url: 'https://github.example/runs/1',
            id: 1,
            status: 'completed',
          },
        ],
      },
      'No successful',
    ],
    [{}, 'workflow_runs'],
  ])(
    'fails closed for invalid or unsuccessful evidence',
    (payload, message) => {
      expect(() =>
        selectSuccessfulValidation(payload, sourceSha, 'push'),
      ).toThrow(message);
    },
  );

  test('queries only the CI workflow and exact source SHA', async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(
      response({
        workflow_runs: [
          {
            conclusion: 'success',
            event: 'push',
            head_sha: sourceSha,
            html_url: 'https://github.example/runs/7',
            id: 7,
            status: 'completed',
          },
        ],
      }),
    );
    await fetchSuccessfulValidation(actionsEnv(), fetchImplementation);

    const [url, request] = fetchImplementation.mock.calls[0];
    expect(url).toContain('/actions/workflows/ci.yml/runs?');
    expect(url).toContain(`head_sha=${sourceSha}`);
    expect(url).toContain('status=completed');
    expect(request.headers.Authorization).toBe('Bearer test-token');
  });

  test('does not turn an API failure into validation evidence', async () => {
    await expect(
      fetchSuccessfulValidation(
        actionsEnv(),
        vi.fn().mockResolvedValue(response({}, { ok: false, status: 503 })),
      ),
    ).rejects.toThrow('HTTP 503');
  });

  test('does not accept a PR run as release validation evidence', () => {
    expect(() =>
      selectSuccessfulValidation(
        {
          workflow_runs: [
            {
              conclusion: 'success',
              event: 'pull_request',
              head_sha: sourceSha,
              html_url: 'https://github.example/runs/8',
              id: 8,
              status: 'completed',
            },
          ],
        },
        sourceSha,
        'push',
      ),
    ).toThrow('No successful completed push');
  });

  test('waits for the exact-source CI run when delivery starts concurrently', async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(response({ workflow_runs: [] }))
      .mockResolvedValueOnce(
        response({
          workflow_runs: [
            {
              conclusion: 'success',
              event: 'push',
              head_sha: sourceSha,
              html_url: 'https://github.example/runs/12',
              id: 12,
              status: 'completed',
            },
          ],
        }),
      );
    const sleepImplementation = vi.fn().mockResolvedValue(undefined);

    const run = await waitForSuccessfulValidation(
      actionsEnv({ VALIDATION_POLL_MS: '1', VALIDATION_WAIT_MS: '1000' }),
      fetchImplementation,
      sleepImplementation,
    );

    expect(run.id).toBe(12);
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(sleepImplementation).toHaveBeenCalledWith(1);
  });

  const successfulRunsResponse = () =>
    response({
      workflow_runs: [
        {
          conclusion: 'success',
          event: 'push',
          head_sha: sourceSha,
          html_url: 'https://github.example/runs/21',
          id: 21,
          status: 'completed',
        },
      ],
    });

  test('keeps polling through a transient GitHub server error', async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(response({}, { ok: false, status: 500 }))
      .mockResolvedValueOnce(response({}, { ok: false, status: 429 }))
      .mockResolvedValueOnce(successfulRunsResponse());
    const sleepImplementation = vi.fn().mockResolvedValue(undefined);

    const run = await waitForSuccessfulValidation(
      actionsEnv({ VALIDATION_POLL_MS: '1', VALIDATION_WAIT_MS: '1000' }),
      fetchImplementation,
      sleepImplementation,
    );

    expect(run.id).toBe(21);
    expect(fetchImplementation).toHaveBeenCalledTimes(3);
    expect(sleepImplementation).toHaveBeenCalledTimes(2);
  });

  test('keeps polling through a dropped connection', async () => {
    const fetchImplementation = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(successfulRunsResponse());

    const run = await waitForSuccessfulValidation(
      actionsEnv({ VALIDATION_POLL_MS: '1', VALIDATION_WAIT_MS: '1000' }),
      fetchImplementation,
      vi.fn().mockResolvedValue(undefined),
    );

    expect(run.id).toBe(21);
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  test('fails immediately on a non-transient API error', async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValue(response({}, { ok: false, status: 403 }));
    const sleepImplementation = vi.fn().mockResolvedValue(undefined);

    await expect(
      waitForSuccessfulValidation(
        actionsEnv({ VALIDATION_POLL_MS: '1', VALIDATION_WAIT_MS: '1000' }),
        fetchImplementation,
        sleepImplementation,
      ),
    ).rejects.toThrow('HTTP 403');
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(sleepImplementation).not.toHaveBeenCalled();
  });

  test('stops retrying a transient error once the wait window is over', async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValue(response({}, { ok: false, status: 502 }));

    await expect(
      waitForSuccessfulValidation(
        actionsEnv({ VALIDATION_POLL_MS: '1', VALIDATION_WAIT_MS: '0' }),
        fetchImplementation,
        vi.fn().mockResolvedValue(undefined),
      ),
    ).rejects.toThrow('HTTP 502');
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  test('records auditable outputs without exposing the token', async () => {
    const env = actionsEnv();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          workflow_runs: [
            {
              conclusion: 'success',
              event: 'push',
              head_sha: sourceSha,
              html_url: 'https://github.example/runs/9',
              id: 9,
              status: 'completed',
            },
          ],
        }),
      ),
    );
    await runValidationEvidence(env);

    expect(readFileSync(env.GITHUB_OUTPUT, 'utf8')).toBe(
      'run_id=9\nrun_url=https://github.example/runs/9\n',
    );
    const summary = readFileSync(env.GITHUB_STEP_SUMMARY, 'utf8');
    expect(summary).toContain(sourceSha);
    expect(summary).not.toContain(env.GITHUB_TOKEN);
  });
});
