import { afterEach, describe, expect, test, vi } from 'vitest';

// Isolate observability/metrics.ts from a real Redis connection (see the
// matching comment in src/observability/__tests__/metrics.test.ts).
vi.mock('../services/queue.service', () => ({
  documentQueue: {
    name: 'document-processing',
    getJobCounts: vi.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }),
  },
  assetQueue: {
    name: 'document-assets',
    getJobCounts: vi.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }),
  },
}));

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.METRICS_PORT;
  delete process.env.METRICS_AUTH_TOKEN;
}

describe('metrics-server', () => {
  afterEach(() => {
    resetEnv();
    vi.resetModules();
  });

  test('does not start a server when METRICS_PORT is unset', async () => {
    resetEnv();
    const { startMetricsServer } = await import('../metrics-server');
    expect(startMetricsServer()).toBeUndefined();
  });

  test('serves GET /metrics on the configured port when unauthenticated', async () => {
    resetEnv();
    process.env.METRICS_PORT = '0';
    const { startMetricsServer } = await import('../metrics-server');

    const server = startMetricsServer();
    expect(server).toBeDefined();
    await new Promise((resolve) => server!.once('listening', resolve));
    const port = (server!.address() as { port: number }).port;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/metrics`);
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain('codex_doc_processor_');
    } finally {
      await new Promise((resolve) => server!.close(resolve));
    }
  });

  test('rejects a missing or incorrect bearer token when METRICS_AUTH_TOKEN is set', async () => {
    resetEnv();
    process.env.METRICS_PORT = '0';
    process.env.METRICS_AUTH_TOKEN = 'test-token';
    const { startMetricsServer } = await import('../metrics-server');

    const server = startMetricsServer();
    await new Promise((resolve) => server!.once('listening', resolve));
    const port = (server!.address() as { port: number }).port;

    try {
      const unauthorized = await fetch(`http://127.0.0.1:${port}/metrics`);
      expect(unauthorized.status).toBe(401);

      const wrong = await fetch(`http://127.0.0.1:${port}/metrics`, {
        headers: { authorization: 'Bearer nope' },
      });
      expect(wrong.status).toBe(401);

      const correct = await fetch(`http://127.0.0.1:${port}/metrics`, {
        headers: { authorization: 'Bearer test-token' },
      });
      expect(correct.status).toBe(200);
    } finally {
      await new Promise((resolve) => server!.close(resolve));
    }
  });
});
