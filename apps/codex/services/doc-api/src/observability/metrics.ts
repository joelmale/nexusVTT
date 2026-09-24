import { createHash, timingSafeEqual } from 'node:crypto';
import client from 'prom-client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { env } from '../config/env';
import { documentQueue } from '../services/queue.service';

/**
 * Dedicated registry (not the default global one) so tests can construct an
 * isolated instance per run without leaking counters across test files.
 */
export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: 'codex_doc_api_' });

export const httpRequestsTotal = new client.Counter({
  name: 'codex_doc_api_http_requests_total',
  help: 'Total HTTP requests handled by doc-api, labeled by method, route template and status code.',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [registry],
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'codex_doc_api_http_request_duration_seconds',
  help: 'doc-api HTTP request duration in seconds, labeled by method, route template and status code.',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const httpRequestsInFlight = new client.Gauge({
  name: 'codex_doc_api_http_requests_in_flight',
  help: 'HTTP requests currently being handled by doc-api.',
  registers: [registry],
});

export const elasticsearchSearchDurationSeconds = new client.Histogram({
  name: 'codex_doc_api_elasticsearch_search_duration_seconds',
  help: 'Elasticsearch search call duration in seconds, labeled by operation.',
  labelNames: ['operation'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

// Sampled cheaply on scrape: BullMQ's getJobCounts() is a small pipelined
// Redis read, not an aggregate database query, per the "instrument at the
// source, no expensive aggregate queries per scrape" constraint.
// eslint-disable-next-line no-new
new client.Gauge({
  name: 'codex_doc_api_queue_depth',
  help: 'Document processing queue depth by queue and state, sampled from BullMQ on each scrape.',
  labelNames: ['queue', 'state'] as const,
  registers: [registry],
  async collect() {
    try {
      const counts = await documentQueue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
      );
      for (const [state, count] of Object.entries(counts)) {
        this.set({ queue: documentQueue.name, state }, count as number);
      }
    } catch {
      // Redis unavailable for this scrape: leave the gauge at its last
      // known value rather than failing the whole /metrics response.
    }
  },
});

function tokensMatch(supplied: string | undefined, configured: string): boolean {
  if (!supplied) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(supplied), digest(configured));
}

function routeLabel(request: FastifyRequest): string {
  return request.routeOptions?.url ?? request.url;
}

/**
 * Registers HTTP metrics hooks and the `/metrics` scrape endpoint directly on
 * the root Fastify instance. Called once from server.ts as a single line so
 * that file's diff stays minimal for the parallel Phase 4 rules-registry work.
 */
export function registerMetrics(fastify: FastifyInstance): void {
  fastify.addHook('onRequest', async () => {
    httpRequestsInFlight.inc();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    httpRequestsInFlight.dec();
    const durationSeconds = reply.elapsedTime / 1000;
    const labels = {
      method: request.method,
      route: routeLabel(request),
      status_code: String(reply.statusCode),
    };
    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationSeconds);
  });

  fastify.get('/metrics', async (request, reply) => {
    const configuredToken = env.METRICS_AUTH_TOKEN;
    if (configuredToken) {
      const header = request.headers.authorization;
      const supplied = header?.replace(/^Bearer\s+/i, '');
      if (!tokensMatch(supplied, configuredToken)) {
        return reply.status(401).type('text/plain').send('Unauthorized\n');
      }
    }
    reply.type(registry.contentType);
    return registry.metrics();
  });
}
