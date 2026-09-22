import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it, test } from 'vitest';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const scriptPath = path.join(import.meta.dirname, 'coverage-manifest.mjs');
const sourceSha = 'a'.repeat(40);

function run(args) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
}

function createReport(root, kind, index, count, contents = `${kind}-${index}`) {
  const reportDirectory = path.join(root, `${kind}-${index}`);
  fs.mkdirSync(reportDirectory, { recursive: true });
  const blobPath = path.join(reportDirectory, 'report.json');
  fs.writeFileSync(blobPath, contents);
  const result = run([
    'create',
    '--kind', kind,
    '--index', String(index),
    '--count', String(count),
    '--source-sha', sourceSha,
    '--blob', blobPath,
    '--output', path.join(reportDirectory, 'coverage-manifest.json'),
  ]);
  assert.equal(result.status, 0, result.stderr);
  return reportDirectory;
}

test('validates and stages the complete expected report set', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-manifest-'));
  try {
    for (let index = 1; index <= 3; index += 1) createReport(root, 'unit', index, 3);
    createReport(root, 'integration', 1, 1);
    const staged = path.join(root, 'staged');
    const result = run([
      'validate',
      '--directory', root,
      '--output', staged,
      '--source-sha', sourceSha,
      '--unit-count', '3',
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(fs.readdirSync(staged).sort(), [
      'integration-1-of-1.json',
      'unit-1-of-3.json',
      'unit-2-of-3.json',
      'unit-3-of-3.json',
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('fails closed when an expected shard is missing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-manifest-'));
  try {
    createReport(root, 'unit', 1, 3);
    createReport(root, 'unit', 2, 3);
    createReport(root, 'integration', 1, 1);
    const result = run([
      'validate', '--directory', root, '--output', path.join(root, 'staged'),
      '--source-sha', sourceSha, '--unit-count', '3',
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /missing=\[unit:3:3\]/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rejects source mismatches and tampered blobs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-manifest-'));
  try {
    const reportDirectory = createReport(root, 'unit', 1, 1);
    let result = run([
      'validate', '--directory', root, '--output', path.join(root, 'staged'),
      '--source-sha', 'b'.repeat(40), '--unit-count', '1',
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /source SHA mismatch/);

    fs.appendFileSync(path.join(reportDirectory, 'report.json'), 'tampered');
    result = run([
      'validate', '--directory', root, '--output', path.join(root, 'staged'),
      '--source-sha', sourceSha, '--unit-count', '1',
    ]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /integrity check failed/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
