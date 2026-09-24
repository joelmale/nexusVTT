import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import {
  DEFAULT_CONFIG_PATH,
  detectGitChanges,
  evaluateAffectedTargets,
  formatSummary,
  fullSuiteReasonFor,
  loadConfig,
  matchesPattern,
  parseNameStatusZ,
  runCli,
  validateConfig,
} from './affected-targets.mjs';

const config = loadConfig();
const allTargets = Object.keys(config.targets);

function decide(...paths) {
  return evaluateAffectedTargets({
    config,
    changes: paths.map((path) => ({ status: 'M', paths: [path] })),
  });
}

function expectAffected(decision, expected) {
  expect(decision.affectedTargets).toEqual(expect.arrayContaining(expected));
  expect(decision.affectedTargets).toHaveLength(expected.length);
}

describe('affected target configuration', () => {
  test('loads the checked-in dependency graph', () => {
    expect(JSON.parse(readFileSync(DEFAULT_CONFIG_PATH, 'utf8')).version).toBe(
      1,
    );
    expect(config.targets.gateway.dependsOn).toEqual(
      expect.arrayContaining(['vtt', 'forge', 'codex-admin-ui', 'codex-dm-ui']),
    );
  });

  test('rejects missing dependencies and dependency cycles', () => {
    const missingDependency = structuredClone(config);
    missingDependency.targets.gateway.dependsOn.push('missing');
    expect(() => validateConfig(missingDependency)).toThrow(
      'unknown dependency',
    );

    const cycle = structuredClone(config);
    cycle.targets.assets.dependsOn.push('gateway');
    expect(() => validateConfig(cycle)).toThrow('dependency cycle');
  });

  test('supports the glob forms used by the central configuration', () => {
    expect(matchesPattern('apps/vtt/src/App.tsx', 'apps/vtt/src/**')).toBe(
      true,
    );
    expect(matchesPattern('apps/vtt/src/App.tsx', 'apps/vtt/*.ts')).toBe(false);
    expect(matchesPattern('apps/vtt/vite.config.ts', 'apps/vtt/*.ts')).toBe(
      true,
    );
    expect(
      matchesPattern(
        'apps/vtt/scripts/generate-assets.js',
        'apps/vtt/scripts/generate-*.js',
      ),
    ).toBe(true);
    expect(matchesPattern('root-file.ts', '**/*.?s')).toBe(true);
  });

  test.each([
    [null, 'must be an object'],
    [{ version: 2 }, 'unsupported'],
    [{ version: 1, targets: null }, 'targets must be an object'],
    [{ version: 1, targets: {} }, 'at least one target'],
    [
      { version: 1, targets: { INVALID: {} }, fanoutRules: [] },
      'invalid target id',
    ],
    [
      { version: 1, targets: { valid: null }, fanoutRules: [] },
      'must be an object',
    ],
    [
      {
        version: 1,
        targets: { valid: { paths: 'bad', dependsOn: [] } },
        fanoutRules: [],
      },
      'paths must be an array',
    ],
    [
      {
        version: 1,
        targets: { valid: { paths: ['x'], dependsOn: ['valid'] } },
        fanoutRules: [],
      },
      'cannot depend on itself',
    ],
    [
      {
        version: 1,
        targets: { valid: { paths: ['x'], dependsOn: [] } },
        fanoutRules: null,
      },
      'fanoutRules must be an array',
    ],
    [
      {
        version: 1,
        targets: { valid: { paths: ['x'], dependsOn: [] } },
        fanoutRules: [null],
      },
      'fanout rule must be an object',
    ],
    [
      {
        version: 1,
        targets: { valid: { paths: ['x'], dependsOn: [] } },
        fanoutRules: [{ name: '', paths: ['x'], targets: 'all' }],
      },
      'must have a name',
    ],
    [
      {
        version: 1,
        targets: { valid: { paths: ['x'], dependsOn: [] } },
        fanoutRules: [
          { name: 'same', paths: ['x'], targets: 'all' },
          { name: 'same', paths: ['y'], targets: 'all' },
        ],
      },
      'duplicate fanout rule',
    ],
    [
      {
        version: 1,
        targets: { valid: { paths: ['x'], dependsOn: [] } },
        fanoutRules: [{ name: 'bad', paths: ['x'], targets: ['missing'] }],
      },
      'unknown target',
    ],
  ])('rejects malformed configuration %#', (candidate, message) => {
    expect(() => validateConfig(candidate)).toThrow(message);
  });
});

describe('representative Stage 3A change classes', () => {
  test('keeps docs-only changes isolated from application targets', () => {
    expectAffected(decide('apps/docs/docs/intro.md'), ['docs']);
  });

  test('propagates a VTT frontend-only change to the unified gateway', () => {
    expectAffected(decide('apps/vtt/src/components/Toolbar.tsx'), [
      'vtt',
      'gateway',
    ]);
  });

  test('propagates a VTT backend-only change to the unified gateway', () => {
    expectAffected(decide('apps/vtt/server/routes/campaign.ts'), [
      'vtt',
      'gateway',
    ]);
  });

  test('propagates a Forge-only change to the unified gateway', () => {
    expectAffected(decide('apps/forge/src/App.tsx'), ['forge', 'gateway']);
  });

  test.each([
    [
      'admin UI',
      'apps/codex/services/admin-ui/src/App.tsx',
      ['codex-admin-ui', 'gateway'],
    ],
    [
      'DM UI',
      'apps/codex/services/dm-ui/src/App.tsx',
      ['codex-dm-ui', 'gateway'],
    ],
    [
      'document API',
      'apps/codex/services/doc-api/src/server.ts',
      ['codex-doc-api'],
    ],
    [
      'document processor',
      'apps/codex/services/doc-processor/src/index.ts',
      ['codex-doc-processor'],
    ],
    [
      'document websocket',
      'apps/codex/services/doc-websocket/src/index.ts',
      ['codex-doc-websocket'],
    ],
    [
      'control API',
      'apps/control-api/src/server.ts',
      ['control-api'],
    ],
  ])('classifies a %s change', (_name, path, expected) => {
    expectAffected(decide(path), expected);
  });

  test.each([
    'package.json',
    'package-lock.json',
    '.npmrc',
    'packages/character-contracts/src/index.ts',
  ])('fans root/shared dependency input %s out to every target', (path) => {
    const decision = decide(path);
    expect(decision.mode).toBe('targeted');
    expectAffected(decision, allTargets);
  });

  test('propagates VTT migrations through Postgres and gateway consumers', () => {
    expectAffected(
      decide(
        'apps/vtt/server/migrations/2026-07-19-add-room-event-journal.sql',
      ),
      ['postgres', 'vtt', 'gateway'],
    );
  });

  test.each([
    ['apps/vtt/docker/frontend.Dockerfile', ['gateway']],
    ['apps/vtt/docker/admin-placeholder/index.html', ['gateway']],
    ['apps/vtt/docker/backend.Dockerfile', ['vtt', 'gateway']],
    ['apps/vtt/docker/asset-service.Dockerfile', ['assets', 'vtt', 'gateway']],
    ['apps/vtt/docker/postgres.Dockerfile', ['postgres', 'vtt', 'gateway']],
    ['apps/forge/Dockerfile', ['forge', 'gateway']],
    ['apps/codex/services/doc-api/Dockerfile', ['codex-doc-api']],
  ])('classifies Docker input %s', (path, expected) => {
    expectAffected(decide(path), expected);
  });

  test.each([
    'deploy/homelab/compose.yaml',
    'monitoring/prometheus.yml',
    '.github/workflows/ci.yml',
    '.github/ci/affected-targets.json',
    '.dockerignore',
  ])('fans operational/configuration input %s out to every target', (path) => {
    expectAffected(decide(path), allTargets);
  });

  test('fans a Codex Prisma migration out to every schema consumer', () => {
    expectAffected(
      decide(
        'apps/codex/services/doc-api/prisma/migrations/20260922000000_add_index/migration.sql',
      ),
      ['codex-doc-api', 'codex-doc-processor', 'codex-doc-websocket'],
    );
  });
});

describe('rename, deletion, and conservative behavior', () => {
  test('evaluates both sides of a rename', () => {
    const decision = evaluateAffectedTargets({
      config,
      changes: [
        {
          status: 'R100',
          paths: ['apps/docs/docs/forge.md', 'apps/forge/src/forge-help.ts'],
        },
      ],
    });
    expectAffected(decision, ['forge', 'docs', 'gateway']);
  });

  test('classifies deleted paths exactly like present paths', () => {
    const decision = evaluateAffectedTargets({
      config,
      changes: [
        {
          status: 'D',
          paths: ['apps/codex/services/dm-ui/src/legacy.tsx'],
        },
      ],
    });
    expectAffected(decision, ['codex-dm-ui', 'gateway']);
  });

  test('runs every target for unknown or malformed paths', () => {
    const unknown = decide('future-application/src/index.ts');
    expect(unknown.mode).toBe('full');
    expect(unknown.unknownPaths).toEqual(['future-application/src/index.ts']);
    expectAffected(unknown, allTargets);

    const malformed = evaluateAffectedTargets({
      config,
      changes: [{ status: 'M', paths: ['../outside'] }],
    });
    expect(malformed.reason).toBe('invalid-change-path');
    expectAffected(malformed, allTargets);

    const absolute = evaluateAffectedTargets({
      config,
      changes: [{ status: 'M', paths: ['C:\\outside.ts'] }],
    });
    expect(absolute.reason).toBe('invalid-change-path');
  });

  test('normalizes harmless Git path forms and defaults a missing status', () => {
    const decision = evaluateAffectedTargets({
      config,
      changes: [{ paths: ['.\\apps\\docs\\intro.md'] }],
    });
    expectAffected(decision, ['docs']);
    expect(decision.changedFiles).toEqual(['apps/docs/intro.md']);
  });

  test.each(['failed', 'unresolved-comparison', 'api-error'])(
    'runs every target when detection status is %s',
    (detectionStatus) => {
      const decision = evaluateAffectedTargets({ config, detectionStatus });
      expect(decision.mode).toBe('full');
      expectAffected(decision, allTargets);
    },
  );

  test('runs every target when a change list is explicit or implicitly truncated', () => {
    const explicit = evaluateAffectedTargets({ config, truncated: true });
    expect(explicit.reason).toBe('change-list-truncated');
    expectAffected(explicit, allTargets);

    const implicit = evaluateAffectedTargets({
      config,
      maxChanges: 1,
      changes: [
        { status: 'M', paths: ['apps/docs/a.md'] },
        { status: 'M', paths: ['apps/docs/b.md'] },
      ],
    });
    expect(implicit.reason).toBe('change-list-truncated');
    expectAffected(implicit, allTargets);
  });

  test('rejects incomplete and unsupported change records conservatively', () => {
    const missingPath = evaluateAffectedTargets({
      config,
      changes: [{ status: 'D', paths: [] }],
    });
    expect(missingPath.reason).toBe('invalid-change-record');
    expectAffected(missingPath, allTargets);

    const unsupported = evaluateAffectedTargets({
      config,
      changes: [{ status: 'X', paths: ['apps/docs/a.md'] }],
    });
    expect(unsupported.reason).toBe('unsupported-change-status:X');
    expectAffected(unsupported, allTargets);

    const invalidList = evaluateAffectedTargets({ config, changes: 'bad' });
    expect(invalidList.reason).toBe('invalid-change-list');
    expectAffected(invalidList, allTargets);

    const invalidRecord = evaluateAffectedTargets({ config, changes: [null] });
    expect(invalidRecord.reason).toBe('invalid-change-record');
    expectAffected(invalidRecord, allTargets);

    const invalidStatus = evaluateAffectedTargets({
      config,
      changes: [{ status: 1, paths: ['apps/docs/a.md'] }],
    });
    expect(invalidStatus.reason).toBe('invalid-change-status');
    expectAffected(invalidStatus, allTargets);
  });
});

describe('git and full-suite integration inputs', () => {
  test('parses modified, deleted, renamed, and copied NUL-delimited records', () => {
    expect(
      parseNameStatusZ(
        'M\0apps/docs/a.md\0D\0apps/docs/b.md\0R095\0old.ts\0new.ts\0C100\0one.ts\0two.ts\0',
      ),
    ).toEqual([
      { status: 'M', paths: ['apps/docs/a.md'] },
      { status: 'D', paths: ['apps/docs/b.md'] },
      { status: 'R095', paths: ['old.ts', 'new.ts'] },
      { status: 'C100', paths: ['one.ts', 'two.ts'] },
    ]);
    expect(() => parseNameStatusZ('R100\0only-old.ts\0')).toThrow(
      'incomplete git diff record',
    );
  });

  test.each([
    [{ event: 'workflow_dispatch' }, 'workflow_dispatch-full-suite'],
    [{ event: 'schedule' }, 'schedule-full-suite'],
    [{ event: 'release' }, 'release-full-suite'],
    [{ event: 'push', ref: 'refs/tags/v2.0.0' }, 'tag-full-suite'],
    [{ event: 'pull_request', forceFull: true }, 'explicit-full-suite'],
  ])('requires a full suite for %j', (input, expected) => {
    expect(fullSuiteReasonFor(input)).toBe(expected);
  });

  test('allows targeted PR and branch-push decisions', () => {
    expect(
      fullSuiteReasonFor({ event: 'pull_request', ref: 'refs/pull/1/merge' }),
    ).toBeUndefined();
    expect(
      fullSuiteReasonFor({ event: 'push', ref: 'refs/heads/main' }),
    ).toBeUndefined();
  });

  test('uses merge-base diffing and rejects a missing comparison base', () => {
    expect(detectGitChanges({ base: 'HEAD', head: 'HEAD' })).toEqual([]);
    expect(() => detectGitChanges({})).toThrow('comparison base is required');
  });
});

describe('shadow-decision CLI', () => {
  test('renders empty and populated summaries', () => {
    expect(
      formatSummary({
        mode: 'targeted',
        reason: 'classified-paths',
        detectionStatus: 'ok',
        affectedTargets: [],
        unknownPaths: [],
      }),
    ).toContain('Affected: (none)');
    expect(
      formatSummary({
        mode: 'full',
        reason: 'unknown-paths',
        detectionStatus: 'conservative',
        affectedTargets: ['vtt'],
        unknownPaths: ['new/path'],
      }),
    ).toContain('Unclassified: new/path');
  });

  test('prints help without requiring a comparison', () => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    expect(runCli(['--help'])).toBe(0);
    expect(write).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
    write.mockRestore();
  });

  test('emits full-suite JSON, summary, files, and GitHub outputs', () => {
    const directory = mkdtempSync(join(tmpdir(), 'affected-targets-'));
    const jsonPath = join(directory, 'decision.json');
    const outputPath = join(directory, 'github-output.txt');
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    expect(
      runCli([
        '--full',
        '--format',
        'both',
        '--json-file',
        jsonPath,
        '--github-output',
        outputPath,
      ]),
    ).toBe(0);
    expect(JSON.parse(readFileSync(jsonPath, 'utf8')).mode).toBe('full');
    const outputs = readFileSync(outputPath, 'utf8');
    expect(outputs).toContain('full_validation=true');
    expect(outputs).toContain('codex_doc_api=true');
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('Affected-target shadow decision'),
    );
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('"mode": "full"'),
    );
    write.mockRestore();
  });

  test('fails closed for configuration and comparison failures', () => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    expect(
      runCli(['--config', 'does-not-exist.json', '--format', 'json']),
    ).toBe(0);
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('configuration-error'),
    );

    write.mockClear();
    expect(runCli(['--base', 'does-not-exist', '--format', 'summary'])).toBe(0);
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('change-detection-failed'),
    );
    write.mockRestore();
  });

  test('emits a targeted decision for a resolved comparison and honors truncation', () => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    expect(runCli(['--base', 'HEAD', '--format', 'json'])).toBe(0);
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('"mode": "targeted"'),
    );

    write.mockClear();
    expect(runCli(['--base', 'HEAD', '--truncated', '--format', 'json'])).toBe(
      0,
    );
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('change-list-truncated'),
    );
    write.mockRestore();
  });

  test.each([
    [['--format', 'yaml'], '--format must be'],
    [['--max-changes', '0'], '--max-changes must be'],
    [['--max-changes', 'not-a-number'], '--max-changes must be'],
    [['--base'], '--base requires a value'],
    [['surprise'], 'unexpected argument'],
  ])('rejects invalid CLI arguments %#', (arguments_, message) => {
    expect(() => runCli(arguments_)).toThrow(message);
  });
});
