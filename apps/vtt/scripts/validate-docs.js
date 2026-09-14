#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = process.cwd();
const repositoryRoot = path.resolve(workspaceRoot, '../..');
const docsRoot = path.join(repositoryRoot, 'apps/docs/vtt');

const markdownFiles = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      markdownFiles.push(fullPath);
    }
  }
}

walk(docsRoot);

const failures = [];
const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
const stalePatterns = [
  /docker-compose\.homelab/i,
  /PORTAINER_WEBHOOK/i,
  /npm run prisma:/i,
  /cd asset-server/i,
  /VITE_ASSET_SERVER_URL/i,
];

function relative(file) {
  return path.relative(repositoryRoot, file).replaceAll(path.sep, '/');
}

function shouldSkipStaleScan(file) {
  return relative(file).startsWith('apps/docs/vtt/roadmap/archive/');
}

for (const file of markdownFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const fileDir = path.dirname(file);

  if (text.includes('\\n')) {
    failures.push(`${relative(file)} contains a literal \\n sequence`);
  }

  for (const match of text.matchAll(linkPattern)) {
    const rawTarget = match[1].split('#')[0];
    if (
      !rawTarget ||
      rawTarget.startsWith('/') ||
      /^[a-z][a-z0-9+.-]*:/i.test(rawTarget) ||
      rawTarget.startsWith('mailto:')
    ) {
      continue;
    }

    const decodedTarget = decodeURIComponent(rawTarget);
    const targetPath = path.resolve(fileDir, decodedTarget);
    if (!fs.existsSync(targetPath)) {
      failures.push(`${relative(file)} links to missing ${rawTarget}`);
    }
  }

  if (!shouldSkipStaleScan(file)) {
    for (const pattern of stalePatterns) {
      if (pattern.test(text)) {
        failures.push(`${relative(file)} matches stale docs pattern ${pattern}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error('Documentation validation failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Documentation validation passed (${markdownFiles.length} Markdown files).`);
