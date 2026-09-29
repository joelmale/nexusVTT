import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const REPOSITORY_PATTERN = /^[^/\s]+\/[^/\s]+$/;

export function selectSuccessfulValidation(payload, sourceSha, requiredEvent) {
  if (!SHA_PATTERN.test(sourceSha ?? '')) {
    throw new Error('SOURCE_SHA must be a full lowercase Git SHA');
  }
  if (!Array.isArray(payload?.workflow_runs)) {
    throw new Error('GitHub validation response did not contain workflow_runs');
  }
  if (!['push', 'workflow_dispatch'].includes(requiredEvent)) {
    throw new Error(
      'REQUIRED_VALIDATION_EVENT must be push or workflow_dispatch',
    );
  }

  const successfulRuns = payload.workflow_runs
    .filter(
      (run) =>
        run?.head_sha === sourceSha &&
        run?.event === requiredEvent &&
        run?.status === 'completed' &&
        run?.conclusion === 'success',
    )
    .sort((left, right) => (right.run_number ?? 0) - (left.run_number ?? 0));

  if (successfulRuns.length === 0) {
    throw new Error(
      `No successful completed ${requiredEvent} CI Pipeline run exists for ${sourceSha}`,
    );
  }

  const [run] = successfulRuns;
  if (!Number.isSafeInteger(run.id) || run.id <= 0) {
    throw new Error('Successful validation run did not contain a valid id');
  }
  if (typeof run.html_url !== 'string' || run.html_url.length === 0) {
    throw new Error('Successful validation run did not contain a URL');
  }
  return run;
}

export async function fetchSuccessfulValidation(
  env = process.env,
  fetchImplementation = fetch,
) {
  const {
    GITHUB_API_URL = 'https://api.github.com',
    GITHUB_REPOSITORY,
    GITHUB_TOKEN,
    REQUIRED_VALIDATION_EVENT,
    SOURCE_SHA,
  } = env;
  if (!REPOSITORY_PATTERN.test(GITHUB_REPOSITORY ?? '')) {
    throw new Error('GITHUB_REPOSITORY must be in owner/name form');
  }
  if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is required');
  if (!SHA_PATTERN.test(SOURCE_SHA ?? '')) {
    throw new Error('SOURCE_SHA must be a full lowercase Git SHA');
  }

  const workflow = encodeURIComponent('ci.yml');
  const query = new URLSearchParams({
    head_sha: SOURCE_SHA,
    per_page: '100',
    status: 'completed',
  });
  const response = await fetchImplementation(
    `${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/actions/workflows/${workflow}/runs?${query}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );
  if (!response.ok) {
    throw new Error(
      `GitHub validation lookup failed with HTTP ${response.status}`,
    );
  }

  return selectSuccessfulValidation(
    await response.json(),
    SOURCE_SHA,
    REQUIRED_VALIDATION_EVENT,
  );
}

function delay(milliseconds) {
  return new Promise((resolvePromise) =>
    setTimeout(resolvePromise, milliseconds),
  );
}

export async function waitForSuccessfulValidation(
  env = process.env,
  fetchImplementation = fetch,
  sleepImplementation = delay,
) {
  const waitMilliseconds = Number(env.VALIDATION_WAIT_MS ?? 0);
  const pollMilliseconds = Number(env.VALIDATION_POLL_MS ?? 15000);
  if (!Number.isSafeInteger(waitMilliseconds) || waitMilliseconds < 0) {
    throw new Error('VALIDATION_WAIT_MS must be a non-negative integer');
  }
  if (!Number.isSafeInteger(pollMilliseconds) || pollMilliseconds <= 0) {
    throw new Error('VALIDATION_POLL_MS must be a positive integer');
  }

  const deadline = Date.now() + waitMilliseconds;
  while (true) {
    try {
      return await fetchSuccessfulValidation(env, fetchImplementation);
    } catch (error) {
      const isPendingEvidence =
        error instanceof Error &&
        error.message.startsWith('No successful completed');
      if (!isPendingEvidence || Date.now() >= deadline) throw error;
      await sleepImplementation(pollMilliseconds);
    }
  }
}

export async function runValidationEvidence(env = process.env) {
  if (!env.GITHUB_OUTPUT || !env.GITHUB_STEP_SUMMARY) {
    throw new Error('GitHub output and summary paths are required');
  }
  const run = await waitForSuccessfulValidation(env);
  appendFileSync(env.GITHUB_OUTPUT, `run_id=${run.id}\n`);
  appendFileSync(env.GITHUB_OUTPUT, `run_url=${run.html_url}\n`);
  appendFileSync(
    env.GITHUB_STEP_SUMMARY,
    `### Validation evidence\n\nExact-source CI succeeded in [run ${run.id}](${run.html_url}) for \`${env.SOURCE_SHA}\`.\n`,
  );
  return run;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    await runValidationEvidence();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
