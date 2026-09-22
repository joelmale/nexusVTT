#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import {
  collectTimingReport,
  formatSummary,
  parseRepository,
  parseRunId,
  validateDependencyMap,
  validateMetadata,
} from './actions-timing-lib.mjs';

const HELP = `Usage:
  node scripts/ci/report-actions-timing.mjs --run <id-or-url> [options]

Options:
  --repo <owner/name>          Repository (default: GITHUB_REPOSITORY)
  --run <id-or-url>            Actions run ID or GitHub Actions run URL
  --output <path|->            JSON destination (default: - for stdout)
  --metadata <path>            Optional measured dimensions JSON
  --dependency-map <path>      Optional { "job": ["dependency"] } JSON
  --validation-job <name>      Exact gate job name (matrix suffixes are accepted)
  --publication-job <name>     Exact publication job name
  --api-url <url>              GitHub API URL (default: GH_API_URL or api.github.com)
  --help                       Show this help

Authentication uses GH_TOKEN, then GITHUB_TOKEN. The tool only performs GET requests.
When --output is '-', JSON is written to stdout and the summary to stderr.
`;

export function parseArgs(argv, environment = process.env) {
  const options = {
    apiUrl: environment.GH_API_URL ?? 'https://api.github.com',
    output: '-',
    repository: environment.GITHUB_REPOSITORY,
  };
  const valueOptions = new Map([
    ['--api-url', 'apiUrl'],
    ['--dependency-map', 'dependencyMapPath'],
    ['--metadata', 'metadataPath'],
    ['--output', 'output'],
    ['--publication-job', 'publicationJob'],
    ['--repo', 'repository'],
    ['--run', 'runId'],
    ['--validation-job', 'validationJob'],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help') return { help: true };
    const property = valueOptions.get(argument);
    if (!property) throw new Error(`unknown argument: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--'))
      throw new Error(`${argument} requires a value`);
    options[property] = value;
    index += 1;
  }

  options.repository = parseRepository(options.repository);
  options.runId = parseRunId(options.runId);
  if (typeof options.output !== 'string' || options.output.trim() === '') {
    throw new Error('output must be a path or -');
  }
  try {
    new URL(options.apiUrl);
  } catch {
    throw new Error('api-url must be a valid URL');
  }
  return options;
}

async function readJson(path, description) {
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    throw new Error(
      `could not read ${description} at ${path}: ${error.message}`,
    );
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      `${description} at ${path} is not valid JSON: ${error.message}`,
    );
  }
}

export async function run(
  argv,
  {
    collectTimingReportImpl = collectTimingReport,
    environment = process.env,
    readJsonImpl = readJson,
    stderr = process.stderr,
    stdout = process.stdout,
    writeFileImpl = writeFile,
  } = {},
) {
  const options = parseArgs(argv, environment);
  if (options.help) {
    stdout.write(HELP);
    return;
  }

  const metadata = options.metadataPath
    ? validateMetadata(await readJsonImpl(options.metadataPath, 'metadata'))
    : {};
  if (options.validationJob) metadata.validationJob = options.validationJob;
  if (options.publicationJob) metadata.publicationJob = options.publicationJob;
  validateMetadata(metadata);

  const dependencyMap = options.dependencyMapPath
    ? validateDependencyMap(
        await readJsonImpl(options.dependencyMapPath, 'dependency map'),
      )
    : {};
  const report = await collectTimingReportImpl({
    apiUrl: options.apiUrl,
    dependencyMap,
    metadata,
    repository: options.repository,
    runId: options.runId,
    token: environment.GH_TOKEN ?? environment.GITHUB_TOKEN,
  });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const summary = `${formatSummary(report)}\n`;
  if (options.output === '-') {
    stdout.write(json);
    stderr.write(summary);
  } else {
    await writeFileImpl(options.output, json, { encoding: 'utf8', flag: 'w' });
    stdout.write(`${summary}JSON: ${options.output}\n`);
  }
}

export async function main() {
  try {
    await run(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`actions timing report failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
