#!/usr/bin/env node
const DEFAULT_API_BASE = 'http://localhost:3005';

const QUERIES = [
  'grappling underwater',
  'fireball spell',
  'goblin armor class',
];

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = { api: DEFAULT_API_BASE };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--api') options.api = args[i + 1];
  }
  return options;
};

const main = async () => {
  const options = parseArgs();
  let failures = 0;

  for (const query of QUERIES) {
    const response = await fetch(`${options.api}/api/search/semantic?query=${encodeURIComponent(query)}&topK=5`);
    const payload = await response.json();
    const ok = response.ok && Array.isArray(payload.results) && payload.results.length > 0;
    const citationsOk = ok && payload.results.every((result) => result.documentId && result.chunkId);

    if (!ok || !citationsOk) {
      failures += 1;
      console.error(`[eval] FAIL: "${query}" -> missing results or citations`);
    } else {
      console.log(`[eval] PASS: "${query}" results=${payload.results.length}`);
    }
  }

  if (failures > 0) {
    console.error(`[eval] Completed with ${failures} failures`);
    process.exit(1);
  }

  console.log('[eval] Completed successfully');
};

main().catch((error) => {
  console.error(`[eval] Error: ${error.message}`);
  process.exit(1);
});
