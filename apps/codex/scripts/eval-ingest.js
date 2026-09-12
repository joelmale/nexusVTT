#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = { baseline: null };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--baseline') options.baseline = args[i + 1];
  }
  return { options, args };
};

const extractTiming = (output, key) => {
  const match = output.match(new RegExp(`- ${key}: (\\d+)`));
  return match ? Number(match[1]) : null;
};

const main = () => {
  const { options, args } = parseArgs();
  const result = spawnSync('node', ['scripts/benchmark-ingest.js', ...args], { encoding: 'utf-8' });

  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }

  if (!options.baseline) {
    console.log('[eval] No baseline provided; skipping regression check.');
    return;
  }

  const baseline = JSON.parse(fs.readFileSync(options.baseline, 'utf-8'));
  const totalProcessingMs = extractTiming(result.stdout, 'totalProcessingMs');

  if (!baseline.totalProcessingMs || !totalProcessingMs) {
    console.log('[eval] Baseline missing totalProcessingMs; skipping regression check.');
    return;
  }

  const threshold = baseline.thresholdMultiplier || 1.5;
  const limit = baseline.totalProcessingMs * threshold;

  if (totalProcessingMs > limit) {
    console.error(`[eval] Regression: ${totalProcessingMs}ms exceeds threshold ${limit}ms`);
    process.exit(1);
  }

  console.log(`[eval] OK: ${totalProcessingMs}ms within threshold ${limit}ms`);
};

main();
