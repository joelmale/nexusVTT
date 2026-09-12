import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string(),

  // ElasticSearch
  ELASTICSEARCH_URL: z.string(),
  ELASTICSEARCH_INDEX: z.string().default('documents'),

  // S3/MinIO
  S3_ENDPOINT: z.string(),
  S3_ACCESS_KEY: z.string(),
  S3_SECRET_KEY: z.string(),
  S3_BUCKET: z.string().default('documents'),
  S3_REGION: z.string().default('us-east-1'),
  S3_FORCE_PATH_STYLE: z.string().default('true').transform(val => val === 'true'),

  // Processing Configuration
  QUEUE_NAME: z.string().default('document-processing'),
  ASSET_QUEUE_NAME: z.string().default('document-assets'),
  WORKER_CONCURRENCY: z.string().default('2').transform(Number),
  ASSET_WORKER_CONCURRENCY: z.string().default('1').transform(Number),
  THUMBNAIL_WIDTH: z.string().default('300').transform(Number),
  THUMBNAIL_QUALITY: z.string().default('80').transform(Number),
  PAGE_IMAGE_WIDTH: z.string().default('1200').transform(Number),
  PAGE_IMAGE_QUALITY: z.string().default('80').transform(Number),
  PAGE_IMAGE_MAX_PAGES: z.string().default('200').transform(Number),
  OCR_MAX_PAGES: z.string().default('50').transform(Number),
  OCR_WORKER_POOL_SIZE: z.string().default('2').transform(Number),
  OCR_TEXT_MIN_CHARS: z.string().default('50').transform(Number),
  OCR_TEXT_MIN_WORDS: z.string().default('10').transform(Number),

  // Embeddings
  EMBEDDINGS_PROVIDER: z.enum(['none', 'hash']).default('none'),
  EMBEDDINGS_DIM: z.string().default('64').transform(Number),
  EMBEDDINGS_BATCH_SIZE: z.string().default('20').transform(Number),

  // Logging
  LOGGING_ENABLED: z.string().default('true').transform(val => val === 'true'),
  LOGGING_INDEX: z.string().default('nexus-logs'),
  LOGGING_SERVICE_NAME: z.string().default('doc-processor'),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
