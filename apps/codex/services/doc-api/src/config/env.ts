import { z } from 'zod';
import dotenv from 'dotenv';
import { DEFAULT_DOCUMENT_QUEUE_NAME } from '@nexus/document-contracts';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string(),


  // Queue
  QUEUE_NAME: z.string().default(DEFAULT_DOCUMENT_QUEUE_NAME),

  // S3/MinIO
  S3_ENDPOINT: z.string(),
  S3_PUBLIC_ENDPOINT: z.string().optional(), // Public endpoint for pre-signed URLs (defaults to S3_ENDPOINT)
  S3_ACCESS_KEY: z.string(),
  S3_SECRET_KEY: z.string(),
  S3_BUCKET: z.string().default('documents'),
  S3_REGION: z.string().default('us-east-1'),
  S3_FORCE_PATH_STYLE: z.string().default('true').transform(val => val === 'true'),

  // API Configuration
  UPLOAD_URL_EXPIRY: z.string().default('3600').transform(Number), // 1 hour
  DOWNLOAD_URL_EXPIRY: z.string().default('3600').transform(Number), // 1 hour
  MAX_FILE_SIZE: z.string().default('104857600').transform(Number), // 100MB

  // Logging
  LOGGING_ENABLED: z.string().default('true').transform(val => val === 'true'),
  LOGGING_SERVICE_NAME: z.string().default('doc-api'),
  // Rows in log_events older than this are pruned daily.
  LOG_RETENTION_DAYS: z.string().default('30').transform(Number),

  // Auth
  AUTH_DISABLED: z.string().default('false').transform(val => val === 'true'),

  // Observability: bearer token required on GET /metrics when set (fails
  // closed for a wrong/missing token, fails open -- i.e. unauthenticated --
  // only when left unset, matching apps/vtt/server/routes/metrics.routes.ts).
  // See apps/docs/platform/observability-runbook.md before deploying.
  METRICS_AUTH_TOKEN: z.string().optional(),

  // Embeddings
  EMBEDDINGS_PROVIDER: z.enum(['none', 'hash']).default('none'),
  EMBEDDINGS_DIM: z.string().default('64').transform(Number),

  // LLM
  LLM_PROVIDER: z.enum(['none']).default('none'),
  LLM_MODEL: z.string().optional(),

  // Extraction LLM settings page (services/settings.service.ts). doc-processor
  // reads the same variables; the saved settings override the routing defaults,
  // but DEEPSEEK_API_KEY from the environment always wins over a saved key.
  CODEX_SETTINGS_KEY: z.string().optional(),
  EXTRACT_PROVIDER: z.enum(['auto', 'ollama', 'deepseek']).default('auto'),
  DEEPSEEK_API_KEY: z.string().default(''),
  DEEPSEEK_API_URL: z.string().default('https://api.deepseek.com'),
  DEEPSEEK_MODEL: z.string().default('deepseek-chat'),
  DEEPSEEK_MAX_TOKENS: z.string().default('4096').transform(Number),
  DEEPSEEK_FOR: z
    .string()
    .default('spell,item')
    .transform((value) =>
      value
        .split(',')
        .map((part) => part.trim())
        .filter((part): part is 'monster' | 'spell' | 'item' => ['monster', 'spell', 'item'].includes(part)),
    ),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
