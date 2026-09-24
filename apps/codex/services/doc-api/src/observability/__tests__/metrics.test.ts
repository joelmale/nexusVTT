import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

// Isolate the queue-depth gauge from a real Redis connection: metrics.ts
// imports documentQueue from queue.service, and queue.service constructs an
// ioredis client at module load time with no 'error' listener attached, so a
// real import here would attempt (and fail) to connect in the test sandbox.
vi.mock('../../services/queue.service', () => ({
  documentQueue: {
    name: 'document-processing',
    getJobCounts: vi.fn().mockResolvedValue({
      waiting: 2,
      active: 1,
      completed: 10,
      failed: 0,
      delayed: 0,
    }),
  },
}));

describe('observability/metrics', () => {
  const ORIGINAL_TOKEN = process.env.METRICS_AUTH_TOKEN;

  afterEach(() => {
    if (ORIGINAL_TOKEN === undefined) {
      delete process.env.METRICS_AUTH_TOKEN;
    } else {
      process.env.METRICS_AUTH_TOKEN = ORIGINAL_TOKEN;
    }
    vi.resetModules();
  });

  it('serves Prometheus-formatted metrics and counts HTTP requests', async () => {
    delete process.env.METRICS_AUTH_TOKEN;
    const { registerMetrics } = await import('../metrics');

    const app = Fastify();
    registerMetrics(app);
    app.get('/ping', async () => ({ ok: true }));
    await app.ready();

    await app.inject({ method: 'GET', url: '/ping' });
    const response = await app.inject({ method: 'GET', url: '/metrics' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toContain(
      'codex_doc_api_http_requests_total{method="GET",route="/ping",status_code="200"} 1',
    );
    expect(response.body).toContain('codex_doc_api_http_request_duration_seconds');
    // The /metrics request itself is in flight while the registry snapshot is
    // taken (onResponse -- which decrements it -- has not fired yet), so the
    // gauge reads 1 here rather than 0.
    expect(response.body).toContain('codex_doc_api_http_requests_in_flight 1');
    expect(response.body).toContain(
      'codex_doc_api_queue_depth{queue="document-processing",state="waiting"} 2',
    );

    await app.close();
  });

  it('leaves /metrics open when METRICS_AUTH_TOKEN is unset', async () => {
    delete process.env.METRICS_AUTH_TOKEN;
    const { registerMetrics } = await import('../metrics');

    const app = Fastify();
    registerMetrics(app);
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/metrics' });
    expect(response.statusCode).toBe(200);

    await app.close();
  });

  it('rejects a missing or incorrect bearer token when METRICS_AUTH_TOKEN is set', async () => {
    process.env.METRICS_AUTH_TOKEN = 'test-token';
    const { registerMetrics } = await import('../metrics');

    const app = Fastify();
    registerMetrics(app);
    await app.ready();

    const missing = await app.inject({ method: 'GET', url: '/metrics' });
    expect(missing.statusCode).toBe(401);

    const wrong = await app.inject({
      method: 'GET',
      url: '/metrics',
      headers: { authorization: 'Bearer nope' },
    });
    expect(wrong.statusCode).toBe(401);

    const correct = await app.inject({
      method: 'GET',
      url: '/metrics',
      headers: { authorization: 'Bearer test-token' },
    });
    expect(correct.statusCode).toBe(200);

    await app.close();
  });
});
