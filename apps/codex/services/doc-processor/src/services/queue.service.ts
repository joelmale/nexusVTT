import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import {
  type ProcessDocumentJob,
  DOCUMENT_JOB_DEFAULT_OPTIONS,
  ingestJobId,
} from '@nexus/document-contracts';
import { env } from '../config/env';
import { stageJobOptions } from './stage-retry';

// Create Redis connection
const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export type { ProcessDocumentJob };

// Create queue instance
export const documentQueue = new Queue<ProcessDocumentJob>(env.QUEUE_NAME, {
  connection,
  defaultJobOptions: DOCUMENT_JOB_DEFAULT_OPTIONS,
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

const LIVE_JOB_STATES = new Set(['waiting', 'active', 'delayed', 'prioritized', 'waiting-children']);

/**
 * Enqueues a document's ingest unless one is already waiting, active or
 * delayed, in which case that job's id is returned. A finished ingest job with
 * the same deterministic id is removed first so BullMQ accepts the new one.
 */
export async function enqueueIngestOnce(documentId: string): Promise<string> {
  const jobId = ingestJobId(documentId);
  const existing = await documentQueue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (LIVE_JOB_STATES.has(state)) return jobId;
    await existing.remove().catch(() => undefined);
  }
  const job = await documentQueue.add('process-ingest', { documentId, stage: 'ingest' }, { jobId });
  return job.id || '';
}

/** Ids of documents that have a document-processing or asset job in flight. */
export async function getDocumentIdsWithLiveJobs(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const queue of [documentQueue, assetQueue]) {
    const jobs = await queue.getJobs(['waiting', 'active', 'delayed', 'prioritized']);
    for (const job of jobs) {
      if (job?.data?.documentId) ids.add(job.data.documentId);
    }
  }
  return ids;
}

export async function enqueueStage(documentId: string, stage: ProcessDocumentJob['stage']): Promise<string> {
  if ((stage || 'ingest') === 'ingest') return enqueueIngestOnce(documentId);
  const job = await documentQueue.add(`process-${stage}`, { documentId, stage }, stageJobOptions(stage));
  return job.id || '';
}

export async function enqueueAssetStage(documentId: string): Promise<string> {
  const job = await assetQueue.add('process-assets', { documentId, stage: 'assets' });
  return job.id || '';
}

/** Closes both queues and the shared Redis connection. Workers are closed first by index.ts. */
export async function closeQueues(): Promise<void> {
  await documentQueue.close();
  await assetQueue.close();
  connection.disconnect();
}
