import { Queue } from 'bullmq';
import Redis from 'ioredis';
import {
  type ProcessDocumentJob,
  DOCUMENT_JOB_DEFAULT_OPTIONS,
  ingestJobId,
} from '@nexus/document-contracts';
import { env } from '../config/env';

// Create Redis connection
const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export type { ProcessDocumentJob };

// Create queue instance for adding jobs
export const documentQueue = new Queue<ProcessDocumentJob>(env.QUEUE_NAME, {
  connection,
  // Same retry policy as the jobs doc-processor enqueues; without it these
  // ingest jobs got BullMQ's default of a single attempt.
  defaultJobOptions: DOCUMENT_JOB_DEFAULT_OPTIONS,
});

const LIVE_JOB_STATES = new Set(['waiting', 'active', 'delayed', 'prioritized', 'waiting-children']);

// Add a document to the processing queue. If an ingest for it is already
// waiting, active or delayed, that job's id is returned instead of a duplicate.
export async function enqueueDocumentProcessing(documentId: string): Promise<string> {
  const jobId = ingestJobId(documentId);
  const existing = await documentQueue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (LIVE_JOB_STATES.has(state)) return jobId;
    // A finished job holds the id; clear it so BullMQ accepts the new one.
    await existing.remove().catch(() => undefined);
  }
  const job = await documentQueue.add('process-ingest', { documentId, stage: 'ingest' }, { jobId });
  return job.id || '';
}

// Get job status
export async function getJobStatus(jobId: string) {
  const job = await documentQueue.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = state === 'completed' ? 100 : (typeof job.progress === 'number' ? job.progress : 0);
  const failedReason = job.failedReason;

  return {
    id: job.id,
    state,
    progress,
    failedReason,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
  };
}

// Get queue statistics
export async function getQueueStats() {
  // getJobCounts is a pipelined count, unlike getX() which loads every job.
  // `delayed` holds attempts waiting out their retry backoff: not failed yet.
  const counts = await documentQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');

  return {
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    completed: counts.completed ?? 0,
    failed: counts.failed ?? 0,
    delayed: counts.delayed ?? 0,
  };
}

// Get jobs with filters
export async function getJobs(filters: {
  status?: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  limit?: number;
  offset?: number;
} = {}) {
  const { status, limit = 50, offset = 0 } = filters;

  let jobs: any[] = [];

  switch (status) {
    case 'waiting':
      jobs = await documentQueue.getWaiting(offset, limit);
      break;
    case 'active':
      jobs = await documentQueue.getActive(offset, limit);
      break;
    case 'completed':
      jobs = await documentQueue.getCompleted(offset, limit);
      break;
    case 'failed':
      jobs = await documentQueue.getFailed(offset, limit);
      break;
    case 'delayed':
      jobs = await documentQueue.getDelayed(offset, limit);
      break;
    default:
      // Get all jobs (this is expensive, but for admin use)
      const [waiting, active, completed, failed] = await Promise.all([
        documentQueue.getWaiting(0, limit),
        documentQueue.getActive(0, limit),
        documentQueue.getCompleted(0, limit),
        documentQueue.getFailed(0, limit),
      ]);
      jobs = [...waiting, ...active, ...completed, ...failed].slice(offset, offset + limit);
  }

  // Get detailed job info
  const jobDetails = await Promise.all(
    jobs.map(async (job) => {
      const state = await job.getState();
      return {
        id: job.id,
        name: job.name,
        stage: job.data?.stage || job.name.replace(/^process-/, ''),
        documentId: job.data.documentId,
        status: state,
        progress: state === 'completed' ? 100 : (typeof job.progress === 'number' ? job.progress : 0),
        // BullMQ has no `attempts` property on Job: attemptsMade counts finished
        // attempts and opts.attempts is the budget.
        attempts: job.attemptsMade,
        maxAttempts: job.opts?.attempts ?? 1,
        createdAt: job.timestamp,
        processedAt: job.processedOn,
        finishedAt: job.finishedOn,
        failedReason: job.failedReason,
      };
    })
  );

  return jobDetails;
}

// Retry a specific job
export async function retryJob(jobId: string) {
  const job = await documentQueue.getJob(jobId);
  if (!job) {
    throw new Error('Job not found');
  }

  await job.retry();
  return { message: 'Job retry queued' };
}

// Remove a job from queue
export async function removeJob(jobId: string) {
  const job = await documentQueue.getJob(jobId);
  if (!job) {
    throw new Error('Job not found');
  }

  await job.remove();
  return { message: 'Job removed' };
}

// Clean old jobs
export async function cleanOldJobs(olderThanDays: number = 7) {
  // BullMQ queue.clean(grace, limit, type) takes `grace` in milliseconds.
  // BullMQ computes `timestamp = Date.now() - grace`, deleting jobs finished before that timestamp.
  const graceMs = olderThanDays * 24 * 60 * 60 * 1000;

  const [completedRemoved, failedRemoved] = await Promise.all([
    documentQueue.clean(graceMs, 1000, 'completed'),
    documentQueue.clean(graceMs, 1000, 'failed'),
  ]);

  return {
    completedRemoved: completedRemoved.length,
    failedRemoved: failedRemoved.length,
    message: `Cleaned ${completedRemoved.length} completed and ${failedRemoved.length} failed jobs older than ${olderThanDays} days`,
  };
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await documentQueue.close();
  connection.disconnect();
});
