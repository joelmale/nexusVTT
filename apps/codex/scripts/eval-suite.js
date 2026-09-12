#!/usr/bin/env node
const { spawnSync } = require('child_process');

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
};

const args = process.argv.slice(2);

run('node', ['scripts/eval-retrieval.js', ...args]);
run('node', ['scripts/eval-ask.js', ...args]);
