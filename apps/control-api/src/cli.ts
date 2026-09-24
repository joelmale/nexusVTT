import { runCli } from './cliCommands.js';
import { ConfigError, loadDatabaseUrl } from './config.js';
import { PgControlStore } from './store/pgStore.js';

async function main(): Promise<void> {
  let databaseUrl: string;
  try {
    databaseUrl = loadDatabaseUrl(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 2;
      return;
    }
    throw error;
  }
  const store = PgControlStore.fromUrl(databaseUrl);
  try {
    process.exitCode = await runCli(process.argv.slice(2), store, {
      out: (line) => process.stdout.write(`${line}\n`),
      err: (line) => process.stderr.write(`${line}\n`),
    });
  } finally {
    await store.close();
  }
}

main().catch((error: unknown) => {
  // Message only: connection errors can embed the database URL in a stack.
  process.stderr.write(`control-api cli failed: ${(error as Error).message}\n`);
  process.exitCode = 1;
});
