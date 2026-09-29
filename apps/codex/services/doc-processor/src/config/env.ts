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
  PAGE_IMAGE_MAX_PAGES: z.string().default('350').transform(Number),
  OCR_MAX_PAGES: z.string().default('350').transform(Number),
  OCR_WORKER_POOL_SIZE: z.string().default('2').transform(Number),
  OCR_TEXT_MIN_CHARS: z.string().default('50').transform(Number),
  OCR_TEXT_MIN_WORDS: z.string().default('10').transform(Number),

  // OCR Service Sidecar (GPU accelerated RapidOCR/PaddleOCR sidecar)
  OCR_SERVICE_URL: z.string().optional(),
  OCR_SERVICE_TIMEOUT_MS: z.string().default('15000').transform(Number),

  // Ingestion pipeline v2 (apps/docs/codex/ingestion-pipeline-v2-plan.md).
  // New documents take PIPELINE_VERSION; a document keeps the version it was
  // first processed with (metadata.processing.pipelineVersion).
  PIPELINE_VERSION: z.enum(['v1', 'v2']).default('v1'),
  LAYOUT_BATCH_PAGES: z.string().default('5').transform(Number),
  LAYOUT_SERVICE_TIMEOUT_MS: z.string().default('600000').transform(Number),

  // v2 extraction via the Dockhand server's Ollama (internal network only).
  // VLM_MODEL is provisional until the gold set picks one; confirm the tag
  // with `ollama list` on the server.
  OLLAMA_URL: z.string().default('http://ollama:11434'),
  // One model for text and image extraction (decided in review). Experiments
  // switch this value; they never run two models side by side. The model name
  // is part of the extraction cache key.
  VLM_MODEL: z.string().default('qwen2.5vl:7b'),
  OLLAMA_KEEP_ALIVE: z.string().default('10m'),
  LLM_TIMEOUT_MS: z.string().default('120000').transform(Number),
  // Part of the extraction cache key; bump it when prompts or schemas change.
  EXTRACT_PROMPT_VERSION: z.string().default('1'),
  EXTRACT_CROP_DPI: z.string().default('200').transform(Number),
  // The 6 GB RTX A2000 cannot hold Surya and the VLM together: unload the
  // layout models before extract and the VLM after it.
  GPU_HANDOFF: z.string().default('true').transform(val => val === 'true'),

  // Embeddings
  EMBEDDINGS_PROVIDER: z.enum(['none', 'hash', 'sidecar']).default('none'),
  EMBEDDINGS_DIM: z.string().default('64').transform(Number),
  EMBEDDINGS_BATCH_SIZE: z.string().default('20').transform(Number),

  // Logging
  LOGGING_ENABLED: z.string().default('true').transform(val => val === 'true'),
  LOGGING_INDEX: z.string().default('nexus-logs'),
  LOGGING_SERVICE_NAME: z.string().default('doc-processor'),

  // Observability (Phase 3, see apps/docs/platform/observability-runbook.md).
  // doc-processor has no HTTP surface otherwise; setting METRICS_PORT starts
  // a minimal GET /metrics server. Unset (the default) disables it entirely
  // -- there is no reason to open a port in local dev.
  METRICS_PORT: z.string().optional().transform(val => (val ? Number(val) : undefined)),
  // Bearer token required on GET /metrics when set, same fail-closed-only-
  // when-configured behavior as apps/vtt/server/routes/metrics.routes.ts.
  METRICS_AUTH_TOKEN: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
