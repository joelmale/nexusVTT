import client from 'prom-client';
import { documentQueue, assetQueue } from '../services/queue.service';

/** Dedicated registry so tests can import a fresh instance per run. */
export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: 'codex_doc_processor_' });

export const jobsTotal = new client.Counter({
  name: 'codex_doc_processor_jobs_total',
  help: 'Document processing jobs finished by doc-processor, labeled by queue and outcome.',
  labelNames: ['queue', 'outcome'] as const,
  registers: [registry],
});

export const jobDurationSeconds = new client.Histogram({
  name: 'codex_doc_processor_job_duration_seconds',
  help: 'Document processing job duration in seconds (queued to finished), labeled by queue.',
  labelNames: ['queue'] as const,
  buckets: [0.5, 1, 2.5, 5, 10, 30, 60, 120, 300, 600],
  registers: [registry],
});

// Sampled cheaply on scrape via BullMQ's pipelined getJobCounts(), not an
// aggregate database query.
// eslint-disable-next-line no-new
new client.Gauge({
  name: 'codex_doc_processor_queue_depth',
  help: 'Document processing queue depth by queue and state, sampled from BullMQ on each scrape.',
  labelNames: ['queue', 'state'] as const,
  registers: [registry],
  async collect() {
    for (const queue of [documentQueue, assetQueue]) {
      try {
        const counts = await queue.getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
        );
        for (const [state, count] of Object.entries(counts)) {
          this.set({ queue: queue.name, state }, count as number);
        }
      } catch {
        // Redis unavailable for this scrape: leave the gauge at its last
        // known value rather than failing the whole /metrics response.
      }
    }
  },
});

/**
 * Records a finished BullMQ job's outcome. Called from the worker
 * 'completed'/'failed' event handlers in src/index.ts -- event-driven, so
 * this never issues a query of its own.
 */
export function recordJobOutcome(
  queue: string,
  outcome: 'completed' | 'failed',
  durationSeconds?: number,
): void {
  jobsTotal.inc({ queue, outcome });
  if (typeof durationSeconds === 'number' && Number.isFinite(durationSeconds)) {
    jobDurationSeconds.observe({ queue }, durationSeconds);
  }
}
