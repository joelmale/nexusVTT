#!/usr/bin/env node
// Reports aggregate coverage against apps/vtt/coverage-targets.json as GitHub
// warnings. Never fails the job: the targets are advisory while coverage work
// is in progress.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

const targets = JSON.parse(readFileSync(`${root}apps/vtt/coverage-targets.json`, 'utf8'));
const { total } = JSON.parse(readFileSync(`${root}apps/vtt/coverage/coverage-summary.json`, 'utf8'));
const keys = { lines: 'lines', functions: 'functions', branches: 'branches', statements: 'statements' };

let below = 0;
for (const key of Object.keys(keys)) {
  const actual = total[key].pct;
  const target = targets[key];
  const line = `${key}: ${actual}% (target ${target}%)`;
  if (actual < target) {
    below += 1;
    console.log(`::warning title=Coverage below target::${line}`);
  } else {
    console.log(line);
  }
}
if (below === 0) console.log('Coverage meets every target.');
