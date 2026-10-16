import { canvasBackend } from './utils/canvas';
import { createWorker, createAssetWorker, enqueueIngestOnce, getDocumentIdsWithLiveJobs, closeQueues } from './services/queue.service';
import { isFinalAttempt } from './services/stage-retry';
import { reconcileDocuments } from './startup-reconcile';
import { prisma } from './services/database.service';
import { processDocumentWorker } from './workers/process-document.worker';
import { centralLoggingService } from './services/central-logging.service';
import { env } from './config/env';
import { ocrHealthService } from './services/ocr-health.service';
import { startMetricsServer } from './metrics-server';
import { recordJobOutcome } from './observability/metrics';

function jobDurationSeconds(job: { processedOn?: number | null; finishedOn?: number | null }): number | undefined {
  if (!job.processedOn || !job.finishedOn) return undefined;
  return (job.finishedOn - job.processedOn) / 1000;
}

/**
 * On SIGTERM/SIGINT stop taking jobs and let the running one finish (workers'
 * close() waits for it), so a deploy does not abandon a job mid-stage and rely
 * on stall detection to retry it.
 */
function installShutdownHandlers(workers: Array<{ close: () => Promise<void> }>) {
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, finishing active jobs before exit...`);
    // Escape hatch: a stuck job must not block the container forever.
    const force = setTimeout(() => {
      console.error('Shutdown timed out, exiting');
      process.exit(1);
    }, env.SHUTDOWN_TIMEOUT_MS);
    force.unref();
    try {
      await Promise.all(workers.map((w) => w.close()));
      await closeQueues();
      await prisma.$disconnect();
    } catch (err) {
      console.error('Error during shutdown:', err);
    }
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

async function start() {
  console.log(`Starting document processor worker (canvas backend: ${canvasBackend})...`);
  await centralLoggingService.log('info', `doc-processor starting (canvas: ${canvasBackend})`);
  startMetricsServer();

  if (env.OCR_SERVICE_URL) {
    // Non-fatal at startup: stages that need ocr-service re-check and fail
    // themselves, so BullMQ retries them once the sidecar is back.
    try {
      const health = await ocrHealthService.check('startup');
      const embed = health.embed ? `${health.embed.model} (dim ${health.embed.dim})` : 'not reported';
      console.log(`[doc-processor] ocr-service healthy; embed model: ${embed}`);
    } catch (err: any) {
      console.warn(`[doc-processor] Warning: ${err.message}`);
    }
  }

  try {
    // Create and start worker
    const worker = createWorker(processDocumentWorker);
    const assetWorker = createAssetWorker(processDocumentWorker);

    worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed successfully`);
      centralLoggingService.log('info', 'Job completed', { jobId: job.id });
      recordJobOutcome(env.QUEUE_NAME, 'completed', jobDurationSeconds(job));
    });

    // 'failed' fires for every attempt. Only the last one is a failed job;
    // earlier ones are retries and must not inflate the failure metric.
    worker.on('failed', (job, err) => {
      const final = !job || isFinalAttempt(job, err, true);
      console.error(`Job ${job?.id} ${final ? 'failed' : 'attempt failed, will retry'}:`, err.message);
      centralLoggingService.log(final ? 'error' : 'warn', final ? 'Job failed' : 'Job attempt failed, retrying', {
        jobId: job?.id,
        attempt: job?.attemptsMade,
        error: err.message,
      });
      if (final) recordJobOutcome(env.QUEUE_NAME, 'failed', job ? jobDurationSeconds(job) : undefined);
    });

    worker.on('error', (err) => {
      console.error('Worker error:', err);
      centralLoggingService.log('critical', 'Worker error', { error: err.message || String(err) });
    });

    assetWorker.on('completed', (job) => {
      console.log(`Asset job ${job.id} completed successfully`);
      centralLoggingService.log('info', 'Asset job completed', { jobId: job.id });
      recordJobOutcome(env.ASSET_QUEUE_NAME, 'completed', jobDurationSeconds(job));
    });

    assetWorker.on('failed', (job, err) => {
      const final = !job || isFinalAttempt(job, err, true);
      console.error(`Asset job ${job?.id} ${final ? 'failed' : 'attempt failed, will retry'}:`, err.message);
      centralLoggingService.log(final ? 'error' : 'warn', final ? 'Asset job failed' : 'Asset job attempt failed, retrying', {
        jobId: job?.id,
        attempt: job?.attemptsMade,
        error: err.message,
      });
      if (final) recordJobOutcome(env.ASSET_QUEUE_NAME, 'failed', job ? jobDurationSeconds(job) : undefined);
    });

    assetWorker.on('error', (err) => {
      console.error('Asset worker error:', err);
      centralLoggingService.log('critical', 'Asset worker error', { error: err.message || String(err) });
    });

    console.log('Document processor worker started successfully');
    console.log('Waiting for jobs...');
    await centralLoggingService.log('info', 'doc-processor ready');

    installShutdownHandlers([worker, assetWorker]);

    // Re-queue documents a previous run left failed/pending without a job.
    try {
      const result = await reconcileDocuments({
        findDocuments: () => prisma.document.findMany({
          where: { ocrStatus: { in: ['failed', 'pending'] } },
          select: { id: true, title: true, ocrStatus: true, metadata: true },
        }),
        getLiveJobDocumentIds: getDocumentIdsWithLiveJobs,
        updateMetadata: async (documentId, ocrStatus, metadata) => {
          await prisma.document.update({ where: { id: documentId }, data: { ocrStatus, metadata: metadata as any } });
        },
        enqueueIngest: enqueueIngestOnce,
        log: (message) => console.log(`[doc-processor] ${message}`),
      });
      console.log(
        `[doc-processor] Startup reconcile: ${result.requeued.length} re-queued, ${result.skippedLive.length} already queued, ${result.exhausted.length} out of retries`,
      );
    } catch (reprocessErr: any) {
      console.warn(`[doc-processor] Could not check failed documents on startup: ${reprocessErr.message}`);
    }
  } catch (error) {
    console.error('Failed to start worker:', error);
    await centralLoggingService.log('critical', 'doc-processor failed to start', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}


start();
