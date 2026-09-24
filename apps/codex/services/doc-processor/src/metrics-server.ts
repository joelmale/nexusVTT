import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from './config/env';
import { registry } from './observability/metrics';

function tokensMatch(supplied: string | undefined, configured: string): boolean {
  if (!supplied) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(supplied), digest(configured));
}

/**
 * Starts a minimal GET /metrics HTTP server for doc-processor, which
 * otherwise has no HTTP surface. Disabled by default (and always disabled in
 * local dev) -- only starts when METRICS_PORT is configured. See
 * apps/docs/platform/observability-runbook.md.
 */
export function startMetricsServer(): ReturnType<typeof createServer> | undefined {
  if (env.METRICS_PORT === undefined) {
    return undefined;
  }

  const server = createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== '/metrics') {
      response.writeHead(404).end();
      return;
    }

    const configuredToken = env.METRICS_AUTH_TOKEN;
    if (configuredToken) {
      const header = request.headers.authorization;
      const supplied = header?.replace(/^Bearer\s+/i, '');
      if (!tokensMatch(supplied, configuredToken)) {
        response.writeHead(401, { 'content-type': 'text/plain' }).end('Unauthorized\n');
        return;
      }
    }

    registry
      .metrics()
      .then((body) => {
        response.writeHead(200, { 'content-type': registry.contentType }).end(body);
      })
      .catch((error) => {
        response.writeHead(500, { 'content-type': 'text/plain' }).end(String(error));
      });
  });

  server.listen(env.METRICS_PORT, () => {
    console.log(`doc-processor metrics server listening on :${env.METRICS_PORT}`);
  });

  return server;
}
