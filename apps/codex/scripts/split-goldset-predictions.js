#!/usr/bin/env node
/**
 * Splits the single JSON written by fetch-goldset-predictions.js into one
 * <pageId>.json per page, the layout `eval-pipeline.js --predictions` reads.
 *
 *   node scripts/split-goldset-predictions.js predictions.json eval/runs/baseline
 */
const fs = require('fs');
const path = require('path');

const [input, outDir] = process.argv.slice(2);
if (!input || !outDir) {
  console.error('usage: node scripts/split-goldset-predictions.js <predictions.json> <out dir>');
  process.exit(2);
}

const pages = JSON.parse(fs.readFileSync(input, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });
for (const [pageId, prediction] of Object.entries(pages)) {
  fs.writeFileSync(path.join(outDir, `${pageId}.json`), `${JSON.stringify(prediction, null, 2)}\n`);
}
console.log(`wrote ${Object.keys(pages).length} pages to ${outDir}`);
