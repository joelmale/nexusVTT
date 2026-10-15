// node --test apps/codex/scripts/compare-search.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { compareResults, summarize, loadQueries, parseArgs } = require('./compare-search');

test('identical rankings overlap fully', () => {
  const result = compareResults(['a', 'b', 'c'], ['a', 'b', 'c'], 10);
  assert.equal(result.overlap, 1);
  assert.equal(result.topHitAgrees, true);
  assert.deepEqual(result.missing, []);
});

test('reports hits the candidate misses and adds', () => {
  const result = compareResults(['a', 'b', 'c', 'd'], ['a', 'x', 'c', 'y'], 10);
  assert.equal(result.overlap, 0.5);
  assert.deepEqual(result.missing, ['b', 'd']);
  assert.deepEqual(result.extra, ['x', 'y']);
  assert.equal(result.topHitAgrees, true);
});

test('only the top N results count', () => {
  const result = compareResults(['a', 'b', 'c'], ['a', 'z', 'c'], 1);
  assert.equal(result.overlap, 1);
});

test('two empty result sets agree, one empty does not', () => {
  assert.equal(compareResults([], [], 10).overlap, 1);
  assert.equal(compareResults(['a'], [], 10).overlap, 0);
  assert.equal(compareResults(['a'], [], 10).topHitAgrees, false);
});

test('summarize averages overlap overall and per group', () => {
  const summary = summarize([
    { group: 'names', overlap: 1, topHitAgrees: true },
    { group: 'names', overlap: 0.5, topHitAgrees: false },
    { group: 'rules', overlap: 0, topHitAgrees: false },
  ]);
  assert.equal(summary.queries, 3);
  assert.equal(summary.meanOverlap, 0.5);
  assert.equal(summary.groups.names.meanOverlap, 0.75);
  assert.equal(summary.groups.rules.queries, 1);
});

test('the default query set loads and is non-empty', () => {
  const queries = loadQueries(path.join(__dirname, '..', 'eval', 'search-queries.json'));
  assert.ok(queries.length >= 20);
  assert.ok(queries.every((q) => q.group && q.query));
});

test('parseArgs reads both endpoints and thresholds', () => {
  const options = parseArgs(['--a', 'http://a', '--b', 'http://b', '--top', '5', '--min-overlap', '0.7']);
  assert.equal(options.a, 'http://a');
  assert.equal(options.top, 5);
  assert.equal(options.minOverlap, 0.7);
});
