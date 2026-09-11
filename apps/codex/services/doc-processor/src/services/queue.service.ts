import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { env } from '../config/env';

// Create Redis connection
const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export interface ProcessDocumentJob {
  documentId: string;
  stage?: 'ingest' | 'render' | 'ocr' | 'extract' | 'index' | 'assets';
}

// Create queue instance
export const documentQueue = new Queue<ProcessDocumentJob>(env.QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 7 * 24 * 3600, // Keep completed jobs for 7 days
      count: 1000,
    },
    removeOnFail: {
      age: 30 * 24 * 3600, // Keep failed jobs for 30 days
    },
  },
});

export const assetQueue = new Queue<ProcessDocumentJob>(env.ASSET_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    removeOnComplete: {
      age: 7 * 24 * 3600,
      count: 1000,
    },
    removeOnFail: {
      age: 30 * 24 * 3600,
    },
  },
});

export function createWorker(
  processor: (job: Job<ProcessDocumentJob>) => Promise<void>
): Worker<ProcessDocumentJob> {
  return new Worker<ProcessDocumentJob>(env.QUEUE_NAME, processor, {
    connection,
    concurrency: env.WORKER_CONCURRENCY,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  });
}

export function createAssetWorker(
  processor: (job: Job<ProcessDocumentJob>) => Promise<void>
): Worker<ProcessDocumentJob> {
  return new Worker<ProcessDocumentJob>(env.ASSET_QUEUE_NAME, processor, {
    connection,
    concurrency: env.ASSET_WORKER_CONCURRENCY,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  });
}

export async function enqueueStage(documentId: string, stage: ProcessDocumentJob['stage']): Promise<string> {
  const job = await documentQueue.add(`process-${stage || 'ingest'}`, { documentId, stage });
  return job.id || '';
}

export async function enqueueAssetStage(documentId: string): Promise<string> {
  const job = await assetQueue.add('process-assets', { documentId, stage: 'assets' });
  return job.id || '';
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing queue and connection...');
  await documentQueue.close();
  await assetQueue.close();
  connection.disconnect();
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing queue and connection...');
  await documentQueue.close();
  await assetQueue.close();
  connection.disconnect();
});
