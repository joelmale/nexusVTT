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
] as const;

export const CALLBACK_PATH = '/control-api/v1/auth/google/callback';

function isSecureOrigin(url: URL): boolean {
  if (url.protocol === 'https:') return true;
  // Browsers treat http://localhost as a secure context, so __Host- cookies
  // still work there for local development.
  return url.protocol === 'http:' && url.hostname === 'localhost';
}

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
export function loadServerConfig(env: NodeJS.ProcessEnv): ServerConfig {
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
  };
}

export function loadDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const url = env.CONTROL_DATABASE_URL;
  if (!url) throw new ConfigError('Missing required environment variables: CONTROL_DATABASE_URL');
  return url;
}
