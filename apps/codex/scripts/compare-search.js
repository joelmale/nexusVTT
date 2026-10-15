#!/usr/bin/env node
/**
 * Compare Elasticsearch and Postgres document search on a real query set.
 *
 * doc-api answers with one engine per process (SEARCH_PROVIDER), so run two
 * instances against the same database and point this script at both:
 *
 *   SEARCH_PROVIDER=elastic  PORT=3005 npm run dev   # in doc-api
 *   SEARCH_PROVIDER=postgres PORT=3006 npm run dev
 *   node apps/codex/scripts/compare-search.js \
 *     --a http://localhost:3005 --b http://localhost:3006 \
 *     [--queries apps/codex/eval/search-queries.json] [--top 10] \
 *     [--min-overlap 0.6] [--json report.json]
 *
 * A is the reference (Elasticsearch), B the candidate (Postgres). For each query
 * it reports top-N overlap, whether the top hit agrees, the reference hits the
 * candidate misses, and how many highlight snippets each side returned.
 * Exits 1 when the mean overlap is below --min-overlap.
 *
 * With SEARCH_PROVIDER=both, doc-api also records the same comparison live in
 * the codex_doc_api_search_shadow_* metrics.
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_QUERIES = path.join(__dirname, '..', 'eval', 'search-queries.json');

function parseArgs(argv) {
  const options = { top: 10, queries: DEFAULT_QUERIES };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--a') options.a = argv[++i];
    else if (flag === '--b') options.b = argv[++i];
    else if (flag === '--queries') options.queries = argv[++i];
    else if (flag === '--top') options.top = Number(argv[++i]);
    else if (flag === '--min-overlap') options.minOverlap = Number(argv[++i]);
    else if (flag === '--json') options.json = argv[++i];
    else if (flag === '--help' || flag === '-h') options.help = true;
  }
  return options;
}

function loadQueries(file) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  const groups = Array.isArray(parsed) ? { all: parsed } : parsed;
  return Object.entries(groups).flatMap(([group, queries]) =>
    queries.map((query) => ({ group, query: typeof query === 'string' ? query : query.query })),
  );
}

/** Compare two ranked lists of document ids. Pure, so it is unit tested. */
function compareResults(reference, candidate, top) {
  const a = reference.slice(0, top);
  const b = candidate.slice(0, top);
  const bSet = new Set(b);
  const aSet = new Set(a);
  const shared = a.filter((id) => bSet.has(id));
  const union = new Set([...a, ...b]).size;
  return {
    overlap: union === 0 ? 1 : shared.length / Math.max(a.length, b.length, 1),
    jaccard: union === 0 ? 1 : shared.length / union,
    topHitAgrees: a.length > 0 && b.length > 0 ? a[0] === b[0] : a.length === b.length,
    missing: a.filter((id) => !bSet.has(id)),
    extra: b.filter((id) => !aSet.has(id)),
  };
}

function summarize(rows) {
  const mean = (values) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0);
  const byGroup = {};
  for (const row of rows) {
    (byGroup[row.group] ||= []).push(row);
  }
  return {
    queries: rows.length,
    meanOverlap: mean(rows.map((r) => r.overlap)),
    topHitAgreement: mean(rows.map((r) => (r.topHitAgrees ? 1 : 0))),
    groups: Object.fromEntries(
      Object.entries(byGroup).map(([group, items]) => [
        group,
        { queries: items.length, meanOverlap: mean(items.map((r) => r.overlap)) },
      ]),
    ),
  };
}

async function search(base, query, top) {
  const url = `${base.replace(/\/$/, '')}/api/search/advanced?query=${encodeURIComponent(query)}&size=${top}`;
  const started = Date.now();
  const response = await fetch(url);
  const durationMs = Date.now() - started;
  if (!response.ok) {
    throw new Error(`${base} answered ${response.status} for "${query}"`);
  }
  const payload = await response.json();
  const results = payload.results || [];
  return {
    ids: results.map((hit) => hit.documentId),
    titles: Object.fromEntries(results.map((hit) => [hit.documentId, hit.source && hit.source.title])),
    snippets: results.filter((hit) => hit.highlights && hit.highlights.content && hit.highlights.content.length).length,
    total: payload.total,
    durationMs,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.a || !options.b) {
    console.log('Usage: compare-search.js --a <elastic-api> --b <postgres-api> [--queries file] [--top N] [--min-overlap X] [--json out]');
    process.exit(options.help ? 0 : 2);
  }

  const queries = loadQueries(options.queries);
  const rows = [];
  for (const { group, query } of queries) {
    const [a, b] = await Promise.all([search(options.a, query, options.top), search(options.b, query, options.top)]);
    const comparison = compareResults(a.ids, b.ids, options.top);
    const titles = { ...a.titles, ...b.titles };
    rows.push({
      group,
      query,
      ...comparison,
      aTotal: a.total,
      bTotal: b.total,
      aSnippets: a.snippets,
      bSnippets: b.snippets,
      aMs: a.durationMs,
      bMs: b.durationMs,
      missingTitles: comparison.missing.map((id) => titles[id] || id),
      extraTitles: comparison.extra.map((id) => titles[id] || id),
    });
    const flag = comparison.overlap >= 0.8 ? 'ok  ' : comparison.overlap >= 0.5 ? 'warn' : 'FAIL';
    console.log(
      `[${flag}] ${group.padEnd(8)} overlap=${comparison.overlap.toFixed(2)} top=${comparison.topHitAgrees ? 'same' : 'diff'} ` +
        `a=${a.total} b=${b.total} ${a.durationMs}/${b.durationMs}ms  "${query}"`,
    );
    if (comparison.missing.length) {
      console.log(`         only in A: ${rows[rows.length - 1].missingTitles.join('; ')}`);
    }
  }

  const summary = summarize(rows);
  console.log('');
  console.log(`queries=${summary.queries} meanOverlap=${summary.meanOverlap.toFixed(3)} topHitAgreement=${summary.topHitAgreement.toFixed(3)}`);
  for (const [group, stats] of Object.entries(summary.groups)) {
    console.log(`  ${group}: queries=${stats.queries} meanOverlap=${stats.meanOverlap.toFixed(3)}`);
  }

  if (options.json) {
    fs.writeFileSync(options.json, JSON.stringify({ options, summary, rows }, null, 2));
    console.log(`Report written to ${options.json}`);
  }

  if (options.minOverlap !== undefined && summary.meanOverlap < options.minOverlap) {
    console.error(`Mean overlap ${summary.meanOverlap.toFixed(3)} is below --min-overlap ${options.minOverlap}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { compareResults, summarize, loadQueries, parseArgs };
