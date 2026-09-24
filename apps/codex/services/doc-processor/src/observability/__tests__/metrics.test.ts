import { afterEach, describe, expect, test, vi } from 'vitest';

// Isolate the queue-depth gauge from a real Redis connection: metrics.ts
// imports documentQueue/assetQueue from queue.service, which constructs an
// ioredis client at module load time with no 'error' listener attached, so a
// real import here would attempt (and fail) to connect in the test sandbox.
vi.mock('../../services/queue.service', () => ({
  documentQueue: {
    name: 'document-processing',
    getJobCounts: vi.fn().mockResolvedValue({
      waiting: 3,
      active: 1,
      completed: 20,
      failed: 2,
      delayed: 0,
    }),
  },
  assetQueue: {
    name: 'document-assets',
    getJobCounts: vi.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 5,
      failed: 0,
      delayed: 0,
    }),
  },
}));

describe('observability/metrics', () => {
  afterEach(() => {
    vi.resetModules();
  });

  test('recordJobOutcome increments the counter and observes duration', async () => {
    const { recordJobOutcome, registry } = await import('../metrics');

    recordJobOutcome('document-processing', 'completed', 12.5);
    recordJobOutcome('document-processing', 'failed');

    const text = await registry.metrics();
    expect(text).toContain(
      'codex_doc_processor_jobs_total{queue="document-processing",outcome="completed"} 1',
    );
    expect(text).toContain(
      'codex_doc_processor_jobs_total{queue="document-processing",outcome="failed"} 1',
    );
    expect(text).toContain('codex_doc_processor_job_duration_seconds');
  });

  test('queue depth gauge samples both queues from BullMQ on scrape', async () => {
    const { registry } = await import('../metrics');

    const text = await registry.metrics();
    expect(text).toContain(
      'codex_doc_processor_queue_depth{queue="document-processing",state="waiting"} 3',
    );
    expect(text).toContain(
      'codex_doc_processor_queue_depth{queue="document-assets",state="completed"} 5',
    );
  });
});
