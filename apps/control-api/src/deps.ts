import type { IdentityProvider } from './auth/oidc.js';
import type { CookieCrypto } from './auth/tokens.js';
import type { Logger } from './logger.js';
import type { RouteTable } from './proxy/routeTable.js';
import type { ControlStore } from './store/types.js';

export const API_PREFIX = '/control-api/v1';
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const ABSOLUTE_LIFETIME_MS = 12 * 60 * 60 * 1000;
export const RECENT_AUTH_MS = 10 * 60 * 1000;
export const LOGIN_STATE_TTL_MS = 10 * 60 * 1000;
/** `GET /auth/login` starts per client IP per minute (the callback is not counted). */
export const LOGIN_RATE_LIMIT = 20;
/** All `GET /auth/login` starts per minute across every client: a flood stop only. */
export const LOGIN_GLOBAL_RATE_LIMIT = 300;
/** Allowed clock skew between Google's `auth_time` and the login start. */
export const AUTH_TIME_SKEW_MS = 60 * 1000;
export const API_RATE_LIMIT = 300;

export interface AppConfig {
  adminOrigin: string;
  docApiUrl: string;
  googleCallbackUrl: string;
  trustProxyHops: number;
  assetServiceUrl: string;
  /** Sent as `x-nexus-admin-auth` to asset-service `/internal/admin` (ASSET_ADMIN_SERVICE_SECRET). */
  assetAdminServiceSecret: string;
  backendUrl: string;
  prometheusUrl: string | null;
  grafanaUrl: string | null;
  /** Always sent as X-Nexus-Service-Token to the rules admin API (RULES_ADMIN_SERVICE_TOKEN). */
  rulesServiceToken: string;
  /** Only presigned URLs on this origin are fetched (codex-minio). */
  objectStorageOrigin: string;
  /** Test overrides; production uses the documented constants. */
  operationsTimeoutMs?: number;
  codexUploadMaxFileBytes?: number;
  bodyDeadlineMs?: number;
  uploadBodyDeadlineMs?: number;
  bodyIdleTimeoutMs?: number;
}

export interface AppDeps {
  config: AppConfig;
  store: ControlStore;
  identityProvider: IdentityProvider;
  cookieCrypto: CookieCrypto;
  logger: Logger;
  codexRoutes: RouteTable;
  assetRoutes: RouteTable;
  rulesRoutes: RouteTable;
  /** Injectable for tests. */
  now: () => Date;
  fetch: typeof fetch;
}
