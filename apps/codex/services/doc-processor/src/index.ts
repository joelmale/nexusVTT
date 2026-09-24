import { createWorker, createAssetWorker } from './services/queue.service';
import { elasticService } from './services/elastic.service';
import { processDocumentWorker } from './workers/process-document.worker';
import { centralLoggingService } from './services/central-logging.service';
import { env } from './config/env';
import { startMetricsServer } from './metrics-server';
import { recordJobOutcome } from './observability/metrics';

function jobDurationSeconds(job: { processedOn?: number | null; finishedOn?: number | null }): number | undefined {
  if (!job.processedOn || !job.finishedOn) return undefined;
  return (job.finishedOn - job.processedOn) / 1000;
}

async function start() {
  console.log('Starting document processor worker...');
  await centralLoggingService.log('info', 'doc-processor starting');
  startMetricsServer();

  try {
    // Initialize ElasticSearch index
    console.log('Initializing ElasticSearch index...');
    await centralLoggingService.log('info', 'Initializing ElasticSearch index');
    await elasticService.initializeIndex();

    // Create and start worker
    const worker = createWorker(processDocumentWorker);
    const assetWorker = createAssetWorker(processDocumentWorker);

    worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed successfully`);
      centralLoggingService.log('info', 'Job completed', { jobId: job.id });
      recordJobOutcome(env.QUEUE_NAME, 'completed', jobDurationSeconds(job));
    });

    worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err.message);
      centralLoggingService.log('error', 'Job failed', { jobId: job?.id, error: err.message });
      recordJobOutcome(env.QUEUE_NAME, 'failed', job ? jobDurationSeconds(job) : undefined);
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
      console.error(`Asset job ${job?.id} failed:`, err.message);
      centralLoggingService.log('error', 'Asset job failed', { jobId: job?.id, error: err.message });
      recordJobOutcome(env.ASSET_QUEUE_NAME, 'failed', job ? jobDurationSeconds(job) : undefined);
    });

    assetWorker.on('error', (err) => {
      console.error('Asset worker error:', err);
      centralLoggingService.log('critical', 'Asset worker error', { error: err.message || String(err) });
    });

    console.log('Document processor worker started successfully');
    console.log('Waiting for jobs...');
    await centralLoggingService.log('info', 'doc-processor ready');
  } catch (error) {
    console.error('Failed to start worker:', error);
    await centralLoggingService.log('critical', 'doc-processor failed to start', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

start();
