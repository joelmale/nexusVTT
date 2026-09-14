#!/usr/bin/env node
const DEFAULT_API_BASE = 'http://localhost:3005';

const QUESTIONS = [
  'How does grappling work underwater?',
  'What does the fireball spell do?',
  'How many hit points does a goblin have?',
];

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    api: DEFAULT_API_BASE,
  };

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--api') options.api = args[i + 1];
  }

  return options;
};

const main = async () => {
  const options = parseArgs();
  let failures = 0;

  for (const question of QUESTIONS) {
    const response = await fetch(`${options.api}/api/search/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, topK: 5 }),
    });
    const payload = await response.json();
    const ok = response.ok && Array.isArray(payload.citations) && payload.citations.length > 0;
    if (!ok) {
      failures += 1;
      console.error(`[eval] FAIL: "${question}" -> missing citations`);
    } else {
      console.log(`[eval] PASS: "${question}" citations=${payload.citations.length}`);
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
