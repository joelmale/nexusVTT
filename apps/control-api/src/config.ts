import { z } from 'zod';

export interface ServerConfig {
  databaseUrl: string;
  docApiUrl: string;
  adminOrigin: string;
  googleClientId: string;
  googleClientSecret: string;
  googleCallbackUrl: string;
  sessionSecret: string;
  trustProxyHops: number;
  port: number;
  googleIssuer: string;
  assetServiceUrl: string;
  assetAdminServiceSecret: string;
  backendUrl: string;
  prometheusUrl: string | null;
  grafanaUrl: string | null;
  rulesServiceToken: string;
  objectStorageOrigin: string;
}

export class ConfigError extends Error {}

const REQUIRED_SERVER_VARS = [
  'CONTROL_DATABASE_URL',
  'DOC_API_URL',
  'ADMIN_ORIGIN',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'CONTROL_GOOGLE_CALLBACK_URL',
  'CONTROL_SESSION_SECRET',
  'TRUST_PROXY_HOPS',
  'ASSET_ADMIN_SERVICE_SECRET',
  'RULES_ADMIN_SERVICE_TOKEN',
] as const;

/** Service credentials control-api presents upstream; long random values only. */
export const MIN_SERVICE_SECRET_LENGTH = 32;

export const DEFAULT_ASSET_SERVICE_URL = 'http://asset-server:5003';
export const DEFAULT_BACKEND_URL = 'http://backend:5001';
/** Where doc-api's presigned object-storage URLs must point (codex-minio on nexus-internal-net). */
export const DEFAULT_OBJECT_STORAGE_URL = 'http://codex-minio:9000';

export const CALLBACK_PATH = '/control-api/v1/auth/google/callback';

function isSecureOrigin(url: URL): boolean {
  if (url.protocol === 'https:') return true;
  // Browsers treat http://localhost as a secure context, so __Host- cookies
  // still work there for local development.
  return url.protocol === 'http:' && url.hostname === 'localhost';
}

const httpUrl = z
  .string()
  .url()
  .refine(
    (value) => {
      try {
        const url = new URL(value);
        return /^https?:$/.test(url.protocol) && !url.username && !url.password;
      } catch {
        return false;
      }
    },
    { message: 'must be an http(s) URL without credentials' },
  );

const OPTIONAL_SERVER_VARS = [
  'ASSET_SERVICE_URL',
  'BACKEND_URL',
  'PROMETHEUS_URL',
  'GRAFANA_URL',
  'CODEX_OBJECT_STORAGE_URL',
] as const;

/** Compose renders an unset optional `${VAR:-}` as an empty string; treat it as unset. */
function withoutEmptyOptionals(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const copy: NodeJS.ProcessEnv = { ...env };
  for (const name of OPTIONAL_SERVER_VARS) {
    if (copy[name] === '') delete copy[name];
  }
  return copy;
}

const trimSlash = (value: string) => value.replace(/\/+$/, '');

const serverSchema = z
  .object({
    CONTROL_DATABASE_URL: z.string().min(1),
    DOC_API_URL: z.string().url(),
    ADMIN_ORIGIN: z.string().url(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    CONTROL_GOOGLE_CALLBACK_URL: z.string().url(),
    CONTROL_SESSION_SECRET: z.string().min(32),
    TRUST_PROXY_HOPS: z.string().regex(/^\d{1,2}$/),
    PORT: z.string().regex(/^\d{1,5}$/).optional(),
    ASSET_ADMIN_SERVICE_SECRET: z.string().min(MIN_SERVICE_SECRET_LENGTH),
    ASSET_SERVICE_URL: httpUrl.optional(),
    BACKEND_URL: httpUrl.optional(),
    PROMETHEUS_URL: httpUrl.optional(),
    GRAFANA_URL: httpUrl.optional(),
    RULES_ADMIN_SERVICE_TOKEN: z.string().min(MIN_SERVICE_SECRET_LENGTH),
    CODEX_OBJECT_STORAGE_URL: httpUrl.optional(),
  })
  .superRefine((env, ctx) => {
    const origin = new URL(env.ADMIN_ORIGIN);
    if (origin.origin !== env.ADMIN_ORIGIN.replace(/\/$/, '') || !isSecureOrigin(origin)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ADMIN_ORIGIN'],
        message: 'must be a bare https origin (scheme://host[:port])',
      });
    }
    const callback = new URL(env.CONTROL_GOOGLE_CALLBACK_URL);
    if (callback.origin !== origin.origin || callback.pathname !== CALLBACK_PATH || callback.search) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CONTROL_GOOGLE_CALLBACK_URL'],
        message: `must be ADMIN_ORIGIN + ${CALLBACK_PATH}`,
      });
    }
  });

/**
 * Fails fast with the names (never the values) of missing or invalid
 * variables. There are no defaults for identity or secrets.
 */
export function loadServerConfig(rawEnv: NodeJS.ProcessEnv): ServerConfig {
  const env = withoutEmptyOptionals(rawEnv);
  const missing = REQUIRED_SERVER_VARS.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new ConfigError(`Missing required environment variables: ${missing.join(', ')}`);
  }
  const parsed = serverSchema.safeParse(env);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))];
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new ConfigError(`Invalid environment variables: ${names.join(', ')} (${details})`);
  }
  const value = parsed.data;
  return {
    databaseUrl: value.CONTROL_DATABASE_URL,
    docApiUrl: value.DOC_API_URL.replace(/\/+$/, ''),
    adminOrigin: new URL(value.ADMIN_ORIGIN).origin,
    googleClientId: value.GOOGLE_CLIENT_ID,
    googleClientSecret: value.GOOGLE_CLIENT_SECRET,
    googleCallbackUrl: value.CONTROL_GOOGLE_CALLBACK_URL,
    sessionSecret: value.CONTROL_SESSION_SECRET,
    trustProxyHops: Number(value.TRUST_PROXY_HOPS),
    port: value.PORT ? Number(value.PORT) : 4000,
    googleIssuer: 'https://accounts.google.com',
    assetServiceUrl: trimSlash(value.ASSET_SERVICE_URL ?? DEFAULT_ASSET_SERVICE_URL),
    assetAdminServiceSecret: value.ASSET_ADMIN_SERVICE_SECRET,
    backendUrl: trimSlash(value.BACKEND_URL ?? DEFAULT_BACKEND_URL),
    prometheusUrl: value.PROMETHEUS_URL ? trimSlash(value.PROMETHEUS_URL) : null,
    grafanaUrl: value.GRAFANA_URL ?? null,
    rulesServiceToken: value.RULES_ADMIN_SERVICE_TOKEN,
    objectStorageOrigin: new URL(value.CODEX_OBJECT_STORAGE_URL ?? DEFAULT_OBJECT_STORAGE_URL).origin,
  };
}

export function loadDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const url = env.CONTROL_DATABASE_URL;
  if (!url) throw new ConfigError('Missing required environment variables: CONTROL_DATABASE_URL');
  return url;
}
