import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SHA_PATTERN = /^[0-9a-f]{40}$/;

export function decidePromotion(env, readMainRef) {
  const { EVENT_NAME, EVENT_REF, SOURCE_SHA } = env;
  if (!SHA_PATTERN.test(SOURCE_SHA ?? '')) {
    throw new Error('SOURCE_SHA must be a full lowercase Git SHA');
  }
  if (!['push', 'workflow_dispatch'].includes(EVENT_NAME)) {
    throw new Error(`Unsupported promotion event: ${EVENT_NAME}`);
  }
  if (!EVENT_REF?.startsWith('refs/')) {
    throw new Error('EVENT_REF must be a full Git ref');
  }

  if (EVENT_REF !== 'refs/heads/main') {
    return { disposition: 'eligible', sourceSha: SOURCE_SHA };
  }

  const remote = readMainRef().trim();
  const match = /^([0-9a-f]{40})\s+refs\/heads\/main$/.exec(remote);
  if (!match) throw new Error('Could not resolve exactly one remote main SHA');

  return {
    disposition: match[1] === SOURCE_SHA ? 'eligible' : 'superseded',
    sourceSha: SOURCE_SHA,
    currentMain: match[1],
  };
}

export function runPromotionCheck(
  env = process.env,
  readMainRef = () =>
    execFileSync(
      'git',
      ['ls-remote', '--exit-code', 'origin', 'refs/heads/main'],
      {
        encoding: 'utf8',
      },
    ),
) {
  if (!env.GITHUB_OUTPUT || !env.GITHUB_STEP_SUMMARY) {
    throw new Error('GitHub output and summary paths are required');
  }
  const decision = decidePromotion(env, readMainRef);
  const message =
    decision.disposition === 'superseded'
      ? `Release ${decision.sourceSha} was superseded by main at ${decision.currentMain}. Immutable images remain available; latest tags were not changed.`
      : `Release ${decision.sourceSha} is eligible for promotion.`;

  appendFileSync(
    env.GITHUB_STEP_SUMMARY,
    `### Release promotion\n\n${message}\n`,
  );
  appendFileSync(env.GITHUB_OUTPUT, `disposition=${decision.disposition}\n`);
  return decision;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    runPromotionCheck();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
