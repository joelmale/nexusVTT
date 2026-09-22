const STEP_CATEGORIES = [
  [
    'cache-import',
    /(?:restore|import|download).*cache|cache.*(?:restore|import)/i,
  ],
  ['cache-export', /(?:save|export|upload).*cache|cache.*(?:save|export)/i],
  [
    'artifact-transfer',
    /(?:upload|download).*artifact|artifact.*(?:upload|download)/i,
  ],
  ['image-push', /(?:push|publish).*(?:image|container)|docker\s+push/i],
  [
    'image-build',
    /(?:buildx|docker).*(?:build|bake)|build.*(?:image|container)/i,
  ],
  [
    'contract-build',
    /(?:build|compile).*contract|contract.*(?:build|compile)/i,
  ],
  ['install', /npm\s+(?:ci|install)|install.*(?:dependenc|package)/i],
  ['scan', /codeql|trivy|grype|sarif|vulnerab|security.*scan|scan.*security/i],
  ['test', /test|vitest|playwright|smoke|soak/i],
];

const METADATA_KEYS = new Set([
  'affectedWorkspaces',
  'cacheNamespace',
  'cacheState',
  'cacheStorageBytes',
  'changeClass',
  'coverage',
  'imageDigests',
  'notes',
  'publicationJob',
  'rerunSourceShaType',
  'runnerConcurrency',
  'sarifCategories',
  'sboms',
  'testCounts',
  'validationJob',
]);

const SOURCE_SHA_TYPES = new Set(['branch', 'pr-merge', 'tag', 'unknown']);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} must be a non-empty string`);
  }
}

function assertStringArray(value, field) {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string')
  ) {
    throw new Error(`${field} must be an array of strings`);
  }
}

function assertNumberRecord(value, field, { percentage = false } = {}) {
  if (!isObject(value)) throw new Error(`${field} must be an object`);
  for (const [key, entry] of Object.entries(value)) {
    if (!Number.isFinite(entry) || entry < 0 || (percentage && entry > 100)) {
      throw new Error(
        `${field}.${key} must be ${percentage ? 'a percentage from 0 to 100' : 'a non-negative number'}`,
      );
    }
  }
}

export function validateMetadata(metadata) {
  if (!isObject(metadata)) throw new Error('metadata must be a JSON object');

  for (const key of Object.keys(metadata)) {
    if (!METADATA_KEYS.has(key))
      throw new Error(`unsupported metadata field: ${key}`);
  }

  for (const key of ['affectedWorkspaces', 'notes', 'sarifCategories']) {
    if (metadata[key] !== undefined) assertStringArray(metadata[key], key);
  }
  for (const key of [
    'cacheNamespace',
    'changeClass',
    'publicationJob',
    'validationJob',
  ]) {
    if (metadata[key] !== undefined) assertString(metadata[key], key);
  }
  if (
    metadata.rerunSourceShaType !== undefined &&
    !SOURCE_SHA_TYPES.has(metadata.rerunSourceShaType)
  ) {
    throw new Error(
      'rerunSourceShaType must be one of: branch, pr-merge, tag, unknown',
    );
  }
  if (metadata.testCounts !== undefined) {
    assertNumberRecord(metadata.testCounts, 'testCounts');
  }
  if (
    metadata.cacheStorageBytes !== undefined &&
    (!Number.isFinite(metadata.cacheStorageBytes) ||
      metadata.cacheStorageBytes < 0)
  ) {
    throw new Error('cacheStorageBytes must be a non-negative number');
  }
  if (metadata.coverage !== undefined) {
    assertNumberRecord(metadata.coverage, 'coverage', { percentage: true });
  }
  if (metadata.imageDigests !== undefined) {
    if (!isObject(metadata.imageDigests)) {
      throw new Error('imageDigests must be an object');
    }
    for (const [key, value] of Object.entries(metadata.imageDigests)) {
      assertString(value, `imageDigests.${key}`);
    }
  }
  if (metadata.runnerConcurrency !== undefined) {
    if (!isObject(metadata.runnerConcurrency)) {
      throw new Error('runnerConcurrency must be an object');
    }
    for (const key of ['account', 'configured']) {
      const value = metadata.runnerConcurrency[key];
      if (
        value !== undefined &&
        value !== null &&
        (!Number.isInteger(value) || value < 0)
      ) {
        throw new Error(
          `runnerConcurrency.${key} must be a non-negative integer or null`,
        );
      }
    }
    if (
      metadata.runnerConcurrency.notes !== undefined &&
      typeof metadata.runnerConcurrency.notes !== 'string'
    ) {
      throw new Error('runnerConcurrency.notes must be a string');
    }
  }
  if (metadata.cacheState !== undefined && !isObject(metadata.cacheState)) {
    throw new Error('cacheState must be an object');
  }
  if (metadata.sboms !== undefined && !Array.isArray(metadata.sboms)) {
    throw new Error('sboms must be an array');
  }

  return metadata;
}

export function validateDependencyMap(dependencyMap) {
  if (!isObject(dependencyMap))
    throw new Error('dependency map must be a JSON object');
  for (const [job, dependencies] of Object.entries(dependencyMap)) {
    assertString(job, 'dependency map job name');
    assertStringArray(dependencies, `dependency map entry for ${job}`);
    if (dependencies.includes(job)) {
      throw new Error(
        `dependency map entry for ${job} cannot depend on itself`,
      );
    }
  }
  return dependencyMap;
}

export function parseRepository(value) {
  assertString(value, 'repository');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) {
    throw new Error('repository must use the owner/name form');
  }
  return value;
}

export function parseRunId(value) {
  const text = String(value ?? '');
  const urlMatch = text.match(/\/actions\/runs\/(\d+)(?:\/|$|\?)/);
  const candidate = urlMatch?.[1] ?? text;
  if (!/^[1-9]\d*$/.test(candidate)) {
    throw new Error('run must be a positive Actions run ID or run URL');
  }
  return Number(candidate);
}

export function durationSeconds(start, end) {
  if (!start || !end) return null;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return null;
  }
  return Math.round((endMs - startMs) / 100) / 10;
}

export function classifyStep(name) {
  return STEP_CATEGORIES.find(([, pattern]) => pattern.test(name))?.[0] ?? null;
}

function workflowPath(path) {
  return typeof path === 'string' ? path.split('@')[0] : null;
}

function latestTimestamp(values) {
  const valid = values
    .filter(Boolean)
    .sort((left, right) => Date.parse(left) - Date.parse(right));
  return valid.at(-1) ?? null;
}

function matchingJobs(jobs, name) {
  if (!name) return [];
  return jobs.filter(
    (job) => job.name === name || job.name.startsWith(`${name} (`),
  );
}

function makeStep(step) {
  return {
    number: step.number,
    name: step.name,
    status: step.status,
    conclusion: step.conclusion,
    startedAt: step.started_at ?? null,
    completedAt: step.completed_at ?? null,
    durationSeconds: durationSeconds(step.started_at, step.completed_at),
    category: classifyStep(step.name),
  };
}

function makeJob(job, triggerAt, jobsByName, dependencyMap) {
  const dependencyNames = dependencyMap[job.name] ?? [];
  const missingDependencyNames = dependencyNames.filter(
    (name) => !jobsByName.has(name),
  );
  const dependenciesCompletedAt = latestTimestamp(
    dependencyNames.flatMap((name) =>
      (jobsByName.get(name) ?? []).map((dependency) => dependency.completed_at),
    ),
  );

  return {
    id: job.id,
    name: job.name,
    attempt: job.run_attempt ?? null,
    status: job.status,
    conclusion: job.conclusion,
    runner: {
      name: job.runner_name || null,
      group: job.runner_group_name || null,
      labels: Array.isArray(job.labels) ? job.labels : [],
    },
    startedAt: job.started_at ?? null,
    completedAt: job.completed_at ?? null,
    durationSeconds: durationSeconds(job.started_at, job.completed_at),
    schedulingDelaySeconds: durationSeconds(triggerAt, job.started_at),
    dependencyNames,
    missingDependencyNames,
    dependenciesCompletedAt,
    dependencyStartDelaySeconds:
      dependencyNames.length > 0 && missingDependencyNames.length === 0
        ? durationSeconds(dependenciesCompletedAt, job.started_at)
        : null,
    steps: Array.isArray(job.steps) ? job.steps.map(makeStep) : [],
  };
}

function categoryTotals(jobs) {
  const totals = Object.fromEntries(
    STEP_CATEGORIES.map(([category]) => [category, 0]),
  );
  for (const job of jobs) {
    for (const step of job.steps) {
      if (step.category && step.durationSeconds !== null) {
        totals[step.category] += step.durationSeconds;
      }
    }
  }
  return Object.fromEntries(
    Object.entries(totals).map(([category, total]) => [
      category,
      Math.round(total * 10) / 10,
    ]),
  );
}

export function buildTimingReport({
  artifacts = [],
  collectedAt = new Date().toISOString(),
  concurrentRuns = [],
  dependencyMap = {},
  jobs,
  metadata = {},
  repository,
  run,
  workflowRevisionSha = null,
}) {
  validateMetadata(metadata);
  validateDependencyMap(dependencyMap);
  parseRepository(repository);

  if (!isObject(run) || !Array.isArray(jobs) || !Array.isArray(artifacts)) {
    throw new Error(
      'run, jobs, and artifacts must contain GitHub API response data',
    );
  }

  const jobsByName = new Map();
  for (const job of jobs) {
    const matching = jobsByName.get(job.name) ?? [];
    matching.push(job);
    jobsByName.set(job.name, matching);
  }
  const reportedJobs = jobs.map((job) =>
    makeJob(job, run.created_at, jobsByName, dependencyMap),
  );
  const validationCompletedAt = latestTimestamp(
    matchingJobs(jobs, metadata.validationJob).map((job) => job.completed_at),
  );
  const publicationCompletedAt = latestTimestamp(
    matchingJobs(jobs, metadata.publicationJob).map((job) => job.completed_at),
  );
  const completedAt =
    run.status === 'completed' ? (run.updated_at ?? null) : null;
  const overlappingRuns = concurrentRuns
    .filter((candidate) => candidate.id !== run.id)
    .filter((candidate) => {
      const candidateEnd = candidate.updated_at ?? candidate.run_started_at;
      return (
        Date.parse(candidate.created_at) <=
          Date.parse(completedAt ?? collectedAt) &&
        Date.parse(candidateEnd) >= Date.parse(run.created_at)
      );
    })
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      event: candidate.event,
      status: candidate.status,
      conclusion: candidate.conclusion,
      createdAt: candidate.created_at,
      completedAt:
        candidate.status === 'completed' ? candidate.updated_at : null,
      htmlUrl: candidate.html_url,
    }));

  return {
    schemaVersion: 1,
    collection: {
      collectedAt,
      source: 'github-rest-api',
      repository,
    },
    run: {
      id: run.id,
      attempt: run.run_attempt ?? 1,
      name: run.name,
      displayTitle: run.display_title,
      htmlUrl: run.html_url,
      event: run.event,
      status: run.status,
      conclusion: run.conclusion,
      commit: run.head_sha,
      headBranch: run.head_branch,
      workflow: {
        id: run.workflow_id,
        path: workflowPath(run.path),
        revisionSha: workflowRevisionSha,
      },
      rerunSourceShaType: metadata.rerunSourceShaType ?? 'unknown',
    },
    timestamps: {
      triggeredAt: run.created_at,
      runStartedAt: run.run_started_at ?? null,
      completedAt,
      validationGateCompletedAt: validationCompletedAt,
      publicationCompletedAt,
    },
    durationsSeconds: {
      triggerToRunStart: durationSeconds(run.created_at, run.run_started_at),
      triggerToCompletion: durationSeconds(run.created_at, completedAt),
      triggerToValidationGate: durationSeconds(
        run.created_at,
        validationCompletedAt,
      ),
      triggerToPublication: durationSeconds(
        run.created_at,
        publicationCompletedAt,
      ),
      runnerExecution:
        Math.round(
          reportedJobs.reduce(
            (total, job) => total + (job.durationSeconds ?? 0),
            0,
          ) * 10,
        ) / 10,
      observedRunnerMinutes:
        Math.round(
          (reportedJobs.reduce(
            (total, job) => total + (job.durationSeconds ?? 0),
            0,
          ) /
            60) *
            100,
        ) / 100,
    },
    dimensions: {
      affectedWorkspaces: metadata.affectedWorkspaces ?? null,
      cacheNamespace: metadata.cacheNamespace ?? null,
      cacheState: metadata.cacheState ?? null,
      cacheStorageBytes: metadata.cacheStorageBytes ?? null,
      changeClass: metadata.changeClass ?? null,
      testCounts: metadata.testCounts ?? null,
      coverage: metadata.coverage ?? null,
      sarifCategories: metadata.sarifCategories ?? null,
      sboms: metadata.sboms ?? null,
      sourceSha: run.head_sha,
      imageDigests: metadata.imageDigests ?? null,
      runnerConcurrency: metadata.runnerConcurrency ?? null,
      notes: metadata.notes ?? [],
    },
    jobs: reportedJobs,
    stepCategoryTotalsSeconds: categoryTotals(reportedJobs),
    artifacts: artifacts.map((artifact) => ({
      id: artifact.id,
      name: artifact.name,
      sizeBytes: artifact.size_in_bytes,
      expired: artifact.expired,
      createdAt: artifact.created_at,
      expiresAt: artifact.expires_at,
    })),
    artifactTotalBytes: artifacts.reduce(
      (total, artifact) => total + (artifact.size_in_bytes ?? 0),
      0,
    ),
    overlap: {
      sameRepository: overlappingRuns,
      otherRepositories: null,
    },
    unavailableFromRunApi: {
      affectedWorkspaces: 'supply metadata from the change classifier',
      accountRunnerConcurrency:
        'supply metadata from repository or organization settings',
      cacheStorageBytes:
        'supply metadata from repository or organization settings',
      cacheState: 'supply metadata emitted by cache steps',
      coverageAndTestCounts: 'supply metadata from test artifacts',
      imageDigestsAndSboms: 'supply metadata from build and security artifacts',
      otherRepositoryOverlap:
        'requires organization-wide data not exposed by this run endpoint',
    },
  };
}

function formatDuration(seconds) {
  if (seconds === null) return 'n/a';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round((seconds - minutes * 60) * 10) / 10;
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB'];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatSummary(report) {
  const lines = [
    `${report.collection.repository} · ${report.run.name} #${report.run.id} (attempt ${report.run.attempt})`,
    `Commit ${report.run.commit} · ${report.run.event} · ${report.run.conclusion ?? report.run.status}`,
    `Trigger → complete: ${formatDuration(report.durationsSeconds.triggerToCompletion)}; runner execution: ${formatDuration(report.durationsSeconds.runnerExecution)}`,
  ];
  if (report.timestamps.validationGateCompletedAt) {
    lines.push(
      `Trigger → validation gate: ${formatDuration(report.durationsSeconds.triggerToValidationGate)}`,
    );
  }
  if (report.timestamps.publicationCompletedAt) {
    lines.push(
      `Trigger → publication: ${formatDuration(report.durationsSeconds.triggerToPublication)}`,
    );
  }
  lines.push('Jobs:');
  for (const job of report.jobs) {
    const dependencyDelay =
      job.dependencyStartDelaySeconds === null
        ? ''
        : `; after dependencies ${formatDuration(job.dependencyStartDelaySeconds)}`;
    lines.push(
      `  ${job.name}: ${job.conclusion ?? job.status}, ${formatDuration(job.durationSeconds)}; start delay ${formatDuration(job.schedulingDelaySeconds)}${dependencyDelay}`,
    );
  }
  lines.push(
    `Artifacts: ${report.artifacts.length} (${formatBytes(report.artifactTotalBytes)}); overlapping repository runs: ${report.overlap.sameRepository.length}`,
  );
  return lines.join('\n');
}

function nextLink(headers) {
  const link = headers.get('link');
  if (!link) return null;
  for (const section of link.split(',')) {
    const match = section.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match?.[2] === 'next') return match[1];
  }
  return null;
}

export function createGitHubClient({ apiUrl, fetchImpl = fetch, token }) {
  const baseUrl = apiUrl.replace(/\/$/, '');
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'nexus-ci-timing-reporter',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  async function request(url, { optional = false } = {}) {
    const response = await fetchImpl(
      url.startsWith('http') ? url : `${baseUrl}${url}`,
      {
        headers,
      },
    );
    if (optional && response.status === 404) return null;
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `GitHub API ${response.status} for ${url}: ${body.slice(0, 300)}`,
      );
    }
    return { data: await response.json(), headers: response.headers };
  }

  async function paginate(path, key) {
    const items = [];
    let url = path;
    let pages = 0;
    while (url) {
      pages += 1;
      if (pages > 50)
        throw new Error(`GitHub API pagination exceeded 50 pages for ${path}`);
      const response = await request(url);
      if (!Array.isArray(response.data[key])) {
        throw new Error(
          `GitHub API response for ${path} did not include ${key}`,
        );
      }
      items.push(...response.data[key]);
      url = nextLink(response.headers);
    }
    return items;
  }

  return { paginate, request };
}

function encodeContentPath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

export async function collectTimingReport({
  apiUrl = 'https://api.github.com',
  dependencyMap = {},
  fetchImpl = fetch,
  metadata = {},
  repository,
  runId,
  token,
}) {
  parseRepository(repository);
  const parsedRunId = parseRunId(runId);
  validateMetadata(metadata);
  validateDependencyMap(dependencyMap);

  const client = createGitHubClient({ apiUrl, fetchImpl, token });
  const runResponse = await client.request(
    `/repos/${repository}/actions/runs/${parsedRunId}`,
  );
  const run = runResponse.data;
  if (run.id !== parsedRunId)
    throw new Error('GitHub API returned a different run ID');

  const path = workflowPath(run.path);
  const windowEnd = run.updated_at ?? new Date().toISOString();
  const overlapWindowStart = new Date(
    Date.parse(run.created_at) - 24 * 60 * 60 * 1000,
  ).toISOString();
  const overlapQuery = new URLSearchParams({
    created: `${overlapWindowStart}..${windowEnd}`,
    per_page: '100',
  });
  const workflowRequest = path
    ? client.request(
        `/repos/${repository}/contents/${encodeContentPath(path)}?ref=${encodeURIComponent(run.head_sha)}`,
        { optional: true },
      )
    : Promise.resolve(null);

  const [jobs, artifacts, workflowResponse, concurrentRuns] = await Promise.all(
    [
      client.paginate(
        `/repos/${repository}/actions/runs/${parsedRunId}/jobs?filter=all&per_page=100`,
        'jobs',
      ),
      client.paginate(
        `/repos/${repository}/actions/runs/${parsedRunId}/artifacts?per_page=100`,
        'artifacts',
      ),
      workflowRequest,
      client.paginate(
        `/repos/${repository}/actions/runs?${overlapQuery}`,
        'workflow_runs',
      ),
    ],
  );

  return buildTimingReport({
    artifacts,
    concurrentRuns,
    dependencyMap,
    jobs,
    metadata,
    repository,
    run,
    workflowRevisionSha: workflowResponse?.data?.sha ?? null,
  });
}
