import { Queue } from 'bullmq';
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

// Create queue instance for adding jobs
export const documentQueue = new Queue<ProcessDocumentJob>(env.QUEUE_NAME, {
  connection,
});

// Add a document to the processing queue
export async function enqueueDocumentProcessing(documentId: string): Promise<string> {
  const job = await documentQueue.add('process-ingest', { documentId, stage: 'ingest' });
  return job.id || '';
}

// Get job status
export async function getJobStatus(jobId: string) {
  const job = await documentQueue.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress;
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
  const [waiting, active, completed, failed] = await Promise.all([
    documentQueue.getWaiting(),
    documentQueue.getActive(),
    documentQueue.getCompleted(),
    documentQueue.getFailed(),
  ]);

  return {
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
  };
}

// Get jobs with filters
export async function getJobs(filters: {
  status?: 'waiting' | 'active' | 'completed' | 'failed';
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
        documentId: job.data.documentId,
        status: state,
        progress: job.progress,
        attempts: job.attempts,
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
  const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);

  const [completedRemoved, failedRemoved] = await Promise.all([
    documentQueue.clean(cutoff, 1000, 'completed'),
    documentQueue.clean(cutoff, 1000, 'failed'),
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
