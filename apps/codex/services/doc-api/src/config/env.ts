import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string(),

  // ElasticSearch
  ELASTICSEARCH_URL: z.string(),
  ELASTICSEARCH_INDEX: z.string().default('documents'),

  // Queue
  QUEUE_NAME: z.string().default('document-processing'),

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
  LOGGING_INDEX: z.string().default('nexus-logs'),
  LOGGING_SERVICE_NAME: z.string().default('doc-api'),

  // Auth
  AUTH_DISABLED: z.string().default('false').transform(val => val === 'true'),

  // Embeddings
  EMBEDDINGS_PROVIDER: z.enum(['none', 'hash']).default('none'),
  EMBEDDINGS_DIM: z.string().default('64').transform(Number),

  // LLM
  LLM_PROVIDER: z.enum(['none']).default('none'),
  LLM_MODEL: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
