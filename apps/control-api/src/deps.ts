import type { IdentityProvider } from './auth/oidc.js';
import type { CookieCrypto } from './auth/tokens.js';
import type { CodexRouteTable } from './codex/allowlist.js';
import type { Logger } from './logger.js';
import type { ControlStore } from './store/types.js';

export const API_PREFIX = '/control-api/v1';
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const ABSOLUTE_LIFETIME_MS = 12 * 60 * 60 * 1000;
export const RECENT_AUTH_MS = 10 * 60 * 1000;
export const LOGIN_STATE_TTL_MS = 10 * 60 * 1000;
export const LOGIN_RATE_LIMIT = 10;
export const API_RATE_LIMIT = 300;

export interface AppConfig {
  adminOrigin: string;
  docApiUrl: string;
  googleCallbackUrl: string;
  trustProxyHops: number;
}

export interface AppDeps {
  config: AppConfig;
  store: ControlStore;
  identityProvider: IdentityProvider;
  cookieCrypto: CookieCrypto;
  logger: Logger;
  codexRoutes: CodexRouteTable;
  /** Injectable for tests. */
  now: () => Date;
  fetch: typeof fetch;
}
