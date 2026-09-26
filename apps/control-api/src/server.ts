import { createApp } from './app.js';
import { OpenIdProvider } from './auth/oidc.js';
import { CookieCrypto } from './auth/tokens.js';
import { ASSET_ALLOWLIST } from './assets/allowlist.js';
import { CODEX_ALLOWLIST } from './codex/allowlist.js';
import { ConfigError, loadServerConfig } from './config.js';
import { UPLOAD_BODY_DEADLINE_MS } from './http/bodyDeadline.js';
import { createLogger, type LogLevel } from './logger.js';
import { RouteTable } from './proxy/routeTable.js';
import { RULES_ALLOWLIST } from './rules/allowlist.js';
import { PgControlStore } from './store/pgStore.js';

const LEVELS = new Set<LogLevel>(['debug', 'info', 'warn', 'error']);
const level = process.env.LOG_LEVEL as LogLevel | undefined;
const logger = createLogger({ level: level && LEVELS.has(level) ? level : 'info' });

function main(): void {
  let config;
  try {
    config = loadServerConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      logger.error('invalid configuration; refusing to start', { error });
      process.exit(1);
    }
    throw error;
  }

  const store = PgControlStore.fromUrl(config.databaseUrl);
  const app = createApp({
    config,
    store,
    identityProvider: OpenIdProvider.google({
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
      redirectUri: config.googleCallbackUrl,
      issuer: config.googleIssuer,
    }),
    cookieCrypto: new CookieCrypto(config.sessionSecret),
    logger,
    codexRoutes: new RouteTable(CODEX_ALLOWLIST),
    assetRoutes: new RouteTable(ASSET_ALLOWLIST),
    rulesRoutes: new RouteTable(RULES_ALLOWLIST),
    now: () => new Date(),
    fetch: globalThis.fetch,
  });

  const server = app.listen(config.port, () => {
    logger.info('control-api listening', { port: config.port });
  });
  // Headers must arrive quickly (slowloris). requestTimeout is one value for
  // every route, so it only backstops the longest body allowance (the 320 MiB
  // Codex upload); bodyDeadline() enforces the shorter per-route deadlines
  // and a no-progress idle timeout.
  server.headersTimeout = 30_000;
  server.requestTimeout = UPLOAD_BODY_DEADLINE_MS + 60_000;

  const shutdown = (signal: string) => {
    logger.info('shutting down', { signal });
    server.close(() => {
      store.close().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
