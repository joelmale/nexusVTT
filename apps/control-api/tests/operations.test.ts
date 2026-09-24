import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PROMETHEUS_ALERT_SINCE_QUERY, PROMETHEUS_ALERTS_QUERY, PROMETHEUS_QUERIES, type OperationsSummary } from '../src/operations/summary.js';
import {
  ASSET_SERVICE_SECRET,
  ASSET_SERVICE_URL,
  BACKEND_URL,
  DOC_API_URL,
  GRAFANA_URL,
  PROMETHEUS_URL,
  startHarness,
  type Harness,
  type TestSession,
  type UpstreamCall,
} from './support/harness.js';

const SUMMARY = '/control-api/v1/operations/summary';

type Behaviour = 'up' | 'down' | 'slow' | 'error' | 'garbage';

const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

function vector(samples: Array<{ metric?: Record<string, string>; value: string }>) {
  return json(200, { status: 'success', data: { resultType: 'vector', result: samples.map((s) => ({ metric: s.metric ?? {}, value: [1_790_000_000, s.value] })) } });
}

const PROM_VALUES: Record<string, string> = {
  [PROMETHEUS_QUERIES.activeRooms]: '7',
  [PROMETHEUS_QUERIES.websocketConnections]: '23',
  [PROMETHEUS_QUERIES.commitP95Ms]: '41.26',
  [PROMETHEUS_QUERIES.codexQueueWaiting]: '3',
  [PROMETHEUS_QUERIES.codexQueueFailed]: '1',
  [PROMETHEUS_QUERIES.assetMissingFiles]: '9',
  [PROMETHEUS_QUERIES.assetManifestAgeSeconds]: '120.4',
};

function never(call: UpstreamCall): Promise<Response> {
  return new Promise((_resolve, reject) => {
    call.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  });
}

function stub(behaviour: Partial<Record<'backend' | 'docApi' | 'assets' | 'prometheus', Behaviour>> = {}) {
  return (call: UpstreamCall): Response | Promise<Response> => {
    const url = new URL(call.url);
    const source = call.url.startsWith(BACKEND_URL) ? 'backend' : call.url.startsWith(DOC_API_URL) ? 'docApi' : call.url.startsWith(ASSET_SERVICE_URL) ? 'assets' : call.url.startsWith(PROMETHEUS_URL) ? 'prometheus' : null;
    const mode = (source && behaviour[source]) ?? 'up';
    if (mode === 'down') throw new TypeError(`fetch failed: connect ECONNREFUSED ${url.host}`);
    if (mode === 'slow') return never(call);
    if (mode === 'error') return new Response(`Error: internal failure at ${url.host} password=hunter2`, { status: 500 });
    if (mode === 'garbage') return new Response('<html>not json</html>', { status: 200, headers: { 'content-type': 'text/html' } });
    if (source === 'backend') return json(200, { status: 'ok', rooms: 2, connections: 5, port: 5001, wsUrl: '/ws', realtime: { enabled: true, connected: true } });
    if (source === 'docApi') return json(200, { status: 'healthy', database: 'connected' });
    if (source === 'assets') return json(200, { report: { id: 'r1', counts: { missingFiles: 0, hashMismatches: 0, orphanedFiles: 4 } }, audit: { actor: 'x', requestId: 'y' } });
    if (source === 'prometheus') {
      const query = url.searchParams.get('query')!;
      if (query === PROMETHEUS_ALERTS_QUERY) {
        return vector([
          { metric: { __name__: 'ALERTS', alertname: 'NexusPlatformHostDiskHigh', alertstate: 'firing', severity: 'warning', instance: 'node-exporter:9100' }, value: '1' },
          { metric: { __name__: 'ALERTS', alertname: 'NexusVttCommitFailures', alertstate: 'firing', severity: 'critical', instance: 'backend:5001' }, value: '1' },
        ]);
      }
      if (query === PROMETHEUS_ALERT_SINCE_QUERY) {
        return vector([{ metric: { __name__: 'ALERTS_FOR_STATE', alertname: 'NexusVttCommitFailures', severity: 'critical', instance: 'backend:5001' }, value: '1790000000' }]);
      }
      return vector([{ value: PROM_VALUES[query] ?? 'NaN' }]);
    }
    return json(404, {});
  };
}

describe('GET /operations/summary', () => {
  let h: Harness;
  let operator: TestSession;
  beforeAll(async () => {
    h = await startHarness();
    operator = await h.sessionFor(['operator']);
  });
  afterAll(async () => {
    await h.close();
  });
  beforeEach(() => {
    h.upstreamCalls.length = 0;
    h.store.audit.length = 0;
  });

  const summary = async (): Promise<{ status: number; body: OperationsSummary; text: string }> => {
    const res = await h.request(SUMMARY, { session: operator });
    const text = await res.text();
    return { status: res.status, body: JSON.parse(text) as OperationsSummary, text };
  };

  const assertNoLeaks = (text: string) => {
    for (const secret of [ASSET_SERVICE_SECRET, 'http://', 'backend:5001', 'doc-api:3000', 'asset-server', 'prometheus:9090', 'node-exporter', 'ECONNREFUSED', 'hunter2', 'internal failure', operator.cookieValue]) {
      expect(text, secret).not.toContain(secret);
    }
  };

  it('aggregates every source when all are healthy', async () => {
    h.upstream.respond = stub();
    const { status, body, text } = await summary();
    expect(status).toBe(200);
    expect(body.generatedAt).toBe(h.clock.now.toISOString());
    expect(body.services).toEqual([
      { name: 'vtt-backend', status: 'up' },
      { name: 'codex-doc-api', status: 'up' },
      { name: 'asset-service', status: 'up' },
      { name: 'prometheus', status: 'up' },
    ]);
    expect(body.metrics).toEqual({
      activeRooms: 7,
      websocketConnections: 23,
      commitP95Ms: 41.3,
      codexQueueWaiting: 3,
      codexQueueFailed: 1,
      // The integrity report wins over the Prometheus gauge.
      assetMissingFiles: 0,
      assetManifestAgeSeconds: 120,
    });
    expect(body.alerts).toEqual([
      { name: 'NexusVttCommitFailures', severity: 'critical', since: new Date(1_790_000_000 * 1000).toISOString() },
      { name: 'NexusPlatformHostDiskHigh', severity: 'warning', since: null },
    ]);
    expect(body.links.grafana).toBe(GRAFANA_URL);
    expect(body.links.runbooks.length).toBeGreaterThan(0);
    for (const runbook of body.links.runbooks) expect(runbook.url).toMatch(/^https:\/\/joelmale\.github\.io\/nexusVTT\//);
    assertNoLeaks(text);
    expect(h.store.audit).toHaveLength(0); // a read
  });

  it('sends only the fixed PromQL queries and the asset credential only to the asset service', async () => {
    h.upstream.respond = stub();
    await summary();
    const fixed = new Set([...Object.values(PROMETHEUS_QUERIES), PROMETHEUS_ALERTS_QUERY, PROMETHEUS_ALERT_SINCE_QUERY]);
    const promCalls = h.upstreamCalls.filter((call) => call.url.startsWith(PROMETHEUS_URL));
    expect(promCalls).toHaveLength(fixed.size);
    for (const call of promCalls) {
      const url = new URL(call.url);
      expect(url.pathname).toBe('/api/v1/query');
      expect([...url.searchParams.keys()]).toEqual(['query']);
      expect(fixed.has(url.searchParams.get('query')!)).toBe(true);
    }
    for (const call of h.upstreamCalls) {
      expect(call.method).toBe('GET');
      expect(call.headers.cookie).toBeUndefined();
      if (call.url.startsWith(ASSET_SERVICE_URL)) {
        expect(call.url).toBe(`${ASSET_SERVICE_URL}/internal/admin/integrity`);
        expect(call.headers['x-nexus-auth']).toBe(ASSET_SERVICE_SECRET);
        expect(call.headers['x-nexus-actor']).toBe(operator.user.id);
      } else {
        expect(call.headers['x-nexus-auth']).toBeUndefined();
      }
    }
    expect(h.upstreamCalls.some((call) => call.url === `${BACKEND_URL}/api/system/health`)).toBe(true);
    expect(h.upstreamCalls.some((call) => call.url === `${DOC_API_URL}/health`)).toBe(true);
  });

  it('refuses any query string (no user-supplied PromQL)', async () => {
    h.upstream.respond = stub();
    const res = await h.request(`${SUMMARY}?query=${encodeURIComponent('up')}`, { session: operator });
    expect(res.status).toBe(400);
    expect(h.upstreamCalls).toHaveLength(0);
  });

  const cases: Array<[string, Partial<Record<'backend' | 'docApi' | 'assets' | 'prometheus', Behaviour>>, Record<string, { status: string; detail?: string }>]> = [
    ['backend down', { backend: 'down' }, { 'vtt-backend': { status: 'down', detail: 'unreachable' } }],
    ['backend slow', { backend: 'slow' }, { 'vtt-backend': { status: 'unknown', detail: 'health check timed out' } }],
    ['backend 500', { backend: 'error' }, { 'vtt-backend': { status: 'degraded', detail: 'unexpected health response' } }],
    ['doc-api down', { docApi: 'down' }, { 'codex-doc-api': { status: 'down', detail: 'unreachable' } }],
    ['doc-api slow', { docApi: 'slow' }, { 'codex-doc-api': { status: 'unknown', detail: 'health check timed out' } }],
    ['asset service down', { assets: 'down' }, { 'asset-service': { status: 'down', detail: 'unreachable' } }],
    ['asset service slow', { assets: 'slow' }, { 'asset-service': { status: 'unknown', detail: 'health check timed out' } }],
    ['asset service 500', { assets: 'error' }, { 'asset-service': { status: 'degraded', detail: 'unexpected integrity response' } }],
    ['prometheus down', { prometheus: 'down' }, { prometheus: { status: 'unknown', detail: 'unreachable' } }],
    ['prometheus slow', { prometheus: 'slow' }, { prometheus: { status: 'unknown', detail: 'unreachable' } }],
    ['prometheus garbage', { prometheus: 'garbage' }, { prometheus: { status: 'unknown', detail: 'unreachable' } }],
    ['everything down', { backend: 'down', docApi: 'down', assets: 'down', prometheus: 'down' }, {
      'vtt-backend': { status: 'down', detail: 'unreachable' },
      'codex-doc-api': { status: 'down', detail: 'unreachable' },
      'asset-service': { status: 'down', detail: 'unreachable' },
      prometheus: { status: 'unknown', detail: 'unreachable' },
    }],
  ];

  for (const [name, behaviour, expected] of cases) {
    it(`degrades without failing when ${name}`, async () => {
      h.upstream.respond = stub(behaviour);
      const started = Date.now();
      const { status, body, text } = await summary();
      expect(status).toBe(200);
      expect(Date.now() - started).toBeLessThan(3_000);
      for (const service of body.services) {
        expect(service).toEqual(expected[service.name] ? { name: service.name, ...expected[service.name] } : { name: service.name, status: 'up' });
      }
      assertNoLeaks(text);
    });
  }

  it('falls back to backend health for load metrics when Prometheus is unavailable', async () => {
    h.upstream.respond = stub({ prometheus: 'down' });
    const { body } = await summary();
    expect(body.metrics).toEqual({ activeRooms: 2, websocketConnections: 5, assetMissingFiles: 0 });
    expect(body.alerts).toEqual([]);
  });

  it('reports a degraded asset service when the integrity report finds problems', async () => {
    const base = stub();
    h.upstream.respond = (call) =>
      call.url.startsWith(ASSET_SERVICE_URL)
        ? json(200, { report: { counts: { missingFiles: 2, hashMismatches: 1 } } })
        : base(call);
    const { body } = await summary();
    expect(body.services.find((s) => s.name === 'asset-service')).toEqual({ name: 'asset-service', status: 'degraded', detail: 'integrity report: 2 missing file(s), 1 hash mismatch(es)' });
    expect(body.metrics.assetMissingFiles).toBe(2);
  });

  it('treats a missing integrity report and a rejected credential distinctly', async () => {
    const base = stub();
    h.upstream.respond = (call) => (call.url.startsWith(ASSET_SERVICE_URL) ? json(404, { error: 'no-report' }) : base(call));
    expect((await summary()).body.services[2]).toEqual({ name: 'asset-service', status: 'up', detail: 'no integrity report yet' });
    h.upstream.respond = (call) => (call.url.startsWith(ASSET_SERVICE_URL) ? json(401, { error: 'unauthorized' }) : base(call));
    const { body } = await summary();
    expect(body.services[2]).toEqual({ name: 'asset-service', status: 'unknown', detail: 'service credential rejected' });
    // Prometheus still supplies the gauge.
    expect(body.metrics.assetMissingFiles).toBe(9);
  });

  it('reports a degraded backend that answers 503', async () => {
    const base = stub();
    h.upstream.respond = (call) => (call.url.startsWith(BACKEND_URL) ? json(503, { status: 'error', reason: 'connect ECONNREFUSED redis:6379' }) : base(call));
    const { body, text } = await summary();
    expect(body.services[0]).toEqual({ name: 'vtt-backend', status: 'degraded', detail: 'a required dependency is unavailable' });
    expect(text).not.toContain('redis');
  });
});

describe('GET /operations/summary without Prometheus or Grafana', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await startHarness({ config: { prometheusUrl: null, grafanaUrl: null } });
  });
  afterAll(async () => {
    await h.close();
  });

  it('marks Prometheus not configured and never calls it', async () => {
    h.upstream.respond = stub();
    const s = await h.sessionFor(['auditor']);
    const res = await h.request(SUMMARY, { session: s });
    expect(res.status).toBe(200);
    const body = (await res.json()) as OperationsSummary;
    expect(body.services[3]).toEqual({ name: 'prometheus', status: 'unknown', detail: 'not configured' });
    expect(body.links.grafana).toBeNull();
    expect(body.metrics).toEqual({ activeRooms: 2, websocketConnections: 5, assetMissingFiles: 0 });
    expect(h.upstreamCalls.some((call) => call.url.startsWith(PROMETHEUS_URL))).toBe(false);
  });
});
