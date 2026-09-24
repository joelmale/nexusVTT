import { Router } from 'express';
import type { AppDeps } from '../deps.js';
import { ctx, type RequestContext } from '../http/context.js';
import { guard } from '../http/guard.js';

/**
 * `GET /control-api/v1/operations/summary` (ops:read): a concise status page
 * for the admin console; Grafana stays the detailed workspace.
 *
 * Sources, all queried in parallel with a short timeout:
 * - VTT backend `GET /api/system/health`
 * - doc-api `GET /health`
 * - asset-service `GET /internal/admin/integrity` (latest cached report)
 * - Prometheus (optional) instant queries from the fixed table below.
 *   Queries are never built from request input.
 *
 * A failing or slow source degrades its own entry (`down`/`unknown`) and
 * never fails the response. The body carries fixed service names and short
 * fixed details only: no upstream error text, hostnames, or secrets.
 */

export type ServiceStatus = 'up' | 'degraded' | 'down' | 'unknown';

export interface ServiceEntry {
  name: string;
  status: ServiceStatus;
  detail?: string;
}

export interface OperationsMetrics {
  activeRooms?: number;
  websocketConnections?: number;
  commitP95Ms?: number;
  codexQueueWaiting?: number;
  codexQueueFailed?: number;
  assetMissingFiles?: number;
  assetManifestAgeSeconds?: number;
}

export interface FiringAlert {
  name: string;
  severity: string;
  since: string | null;
}

export interface OperationsSummary {
  generatedAt: string;
  services: ServiceEntry[];
  metrics: OperationsMetrics;
  alerts: FiringAlert[];
  links: { grafana: string | null; runbooks: Array<{ title: string; url: string }> };
}

export const OPERATIONS_SOURCE_TIMEOUT_MS = 2_000;
const MAX_SOURCE_BODY = 512 * 1024;
const MAX_ALERTS = 50;

/** The only PromQL control-api ever sends. Keys are OperationsMetrics fields. */
export const PROMETHEUS_QUERIES: Readonly<Record<keyof OperationsMetrics, string>> = {
  activeRooms: 'sum(nexus_vtt_rooms)',
  websocketConnections: 'sum(nexus_vtt_connections)',
  commitP95Ms: '1000 * histogram_quantile(0.95, sum by (le) (rate(nexus_vtt_game_state_commit_duration_seconds_bucket[10m])))',
  codexQueueWaiting: 'sum(codex_doc_processor_queue_depth{state="waiting"})',
  codexQueueFailed: 'sum(codex_doc_processor_queue_depth{state="failed"})',
  assetMissingFiles: 'max(asset_missing_files)',
  assetManifestAgeSeconds: 'max(asset_manifest_age_seconds)',
};
export const PROMETHEUS_ALERTS_QUERY = 'ALERTS{alertstate="firing"}';
/** Value is the Unix time each pending/firing alert became active. */
export const PROMETHEUS_ALERT_SINCE_QUERY = 'ALERTS_FOR_STATE';

const DOCS = 'https://joelmale.github.io/nexusVTT';
export const RUNBOOKS: ReadonlyArray<{ title: string; url: string }> = [
  { title: 'Observability runbook', url: `${DOCS}/platform/observability-runbook` },
  { title: 'Multiplayer reliability operations', url: `${DOCS}/vtt/operations/multiplayer-observability` },
  { title: 'Asset administration', url: `${DOCS}/vtt/operations/asset-administration` },
  { title: 'Rules registry', url: `${DOCS}/codex/rules-registry` },
];

const SEVERITY_ORDER = ['critical', 'warning', 'info'];

type Probe =
  | { kind: 'response'; status: number; json: unknown }
  | { kind: 'timeout' }
  | { kind: 'unreachable' };

async function probe(deps: AppDeps, context: RequestContext, url: string, headers: Record<string, string> = {}): Promise<Probe> {
  const abort = new AbortController();
  const timeoutMs = deps.config.operationsTimeoutMs ?? OPERATIONS_SOURCE_TIMEOUT_MS;
  const timer = setTimeout(() => abort.abort(new Error('timeout')), timeoutMs);
  try {
    const response = await deps.fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json', 'user-agent': 'nexus-control-api', 'x-request-id': context.requestId, ...headers },
      redirect: 'manual',
      signal: abort.signal,
    });
    let json: unknown = null;
    if (response.body) {
      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
        total += chunk.length;
        if (total > MAX_SOURCE_BODY) break;
        chunks.push(Buffer.from(chunk));
      }
      if (total <= MAX_SOURCE_BODY) {
        try {
          json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
          json = null;
        }
      } else {
        await response.body.cancel().catch(() => undefined);
      }
    }
    return { kind: 'response', status: response.status, json };
  } catch {
    return abort.signal.aborted ? { kind: 'timeout' } : { kind: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

function unreachable(name: string, result: Probe): ServiceEntry {
  return result.kind === 'timeout'
    ? { name, status: 'unknown', detail: 'health check timed out' }
    : { name, status: 'down', detail: 'unreachable' };
}

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

async function backendSource(deps: AppDeps, context: RequestContext) {
  const result = await probe(deps, context, `${deps.config.backendUrl}/api/system/health`);
  const name = 'vtt-backend';
  if (result.kind !== 'response') return { service: unreachable(name, result), rooms: undefined, connections: undefined };
  const body = (result.json ?? {}) as { status?: unknown; rooms?: unknown; connections?: unknown };
  if (result.status === 200 && body.status === 'ok') {
    return { service: { name, status: 'up' as const }, rooms: finite(body.rooms), connections: finite(body.connections) };
  }
  const detail = result.status === 503 ? 'a required dependency is unavailable' : 'unexpected health response';
  return { service: { name, status: 'degraded' as const, detail }, rooms: undefined, connections: undefined };
}

async function docApiSource(deps: AppDeps, context: RequestContext): Promise<ServiceEntry> {
  const result = await probe(deps, context, `${deps.config.docApiUrl}/health`);
  const name = 'codex-doc-api';
  if (result.kind !== 'response') return unreachable(name, result);
  if (result.status === 200) return { name, status: 'up' };
  return { name, status: 'degraded', detail: result.status === 503 ? 'database unavailable' : 'unexpected health response' };
}

async function assetSource(deps: AppDeps, context: RequestContext) {
  const result = await probe(deps, context, `${deps.config.assetServiceUrl}/internal/admin/integrity`, {
    'x-nexus-admin-auth': deps.config.assetAdminServiceSecret,
    'x-nexus-actor': context.admin!.user.id,
  });
  const name = 'asset-service';
  if (result.kind !== 'response') return { service: unreachable(name, result), missingFiles: undefined };
  if (result.status === 404) return { service: { name, status: 'up' as const, detail: 'no integrity report yet' }, missingFiles: undefined };
  if (result.status === 401 || result.status === 403) {
    return { service: { name, status: 'unknown' as const, detail: 'service credential rejected' }, missingFiles: undefined };
  }
  if (result.status !== 200) return { service: { name, status: 'degraded' as const, detail: 'unexpected integrity response' }, missingFiles: undefined };
  const counts = ((result.json as { report?: { counts?: Record<string, unknown> } } | null)?.report?.counts ?? {}) as Record<string, unknown>;
  const missingFiles = finite(counts.missingFiles);
  const hashMismatches = finite(counts.hashMismatches) ?? 0;
  if ((missingFiles ?? 0) > 0 || hashMismatches > 0) {
    const detail = `integrity report: ${missingFiles ?? 0} missing file(s), ${hashMismatches} hash mismatch(es)`;
    return { service: { name, status: 'degraded' as const, detail }, missingFiles };
  }
  return { service: { name, status: 'up' as const }, missingFiles };
}

interface PromSample {
  metric: Record<string, string>;
  value: number;
}

async function promQuery(deps: AppDeps, context: RequestContext, query: string): Promise<PromSample[] | null> {
  const url = `${deps.config.prometheusUrl}/api/v1/query?${new URLSearchParams({ query }).toString()}`;
  const result = await probe(deps, context, url);
  if (result.kind !== 'response' || result.status !== 200) return null;
  const body = result.json as { status?: unknown; data?: { resultType?: unknown; result?: unknown } } | null;
  if (body?.status !== 'success' || body.data?.resultType !== 'vector' || !Array.isArray(body.data.result)) return null;
  const samples: PromSample[] = [];
  for (const item of body.data.result as Array<{ metric?: unknown; value?: unknown }>) {
    const metric = item.metric && typeof item.metric === 'object' ? (item.metric as Record<string, string>) : {};
    const value = Array.isArray(item.value) ? Number(item.value[1]) : Number.NaN;
    samples.push({ metric, value });
  }
  return samples;
}

function labelKey(metric: Record<string, string>): string {
  return Object.entries(metric)
    .filter(([key]) => key !== '__name__' && key !== 'alertstate')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join(',');
}

async function prometheusSource(deps: AppDeps, context: RequestContext) {
  const name = 'prometheus';
  if (!deps.config.prometheusUrl) {
    return { service: { name, status: 'unknown' as const, detail: 'not configured' }, metrics: {} as OperationsMetrics, alerts: [] as FiringAlert[] };
  }
  const keys = Object.keys(PROMETHEUS_QUERIES) as Array<keyof OperationsMetrics>;
  const [values, firing, since] = await Promise.all([
    Promise.all(keys.map((key) => promQuery(deps, context, PROMETHEUS_QUERIES[key]))),
    promQuery(deps, context, PROMETHEUS_ALERTS_QUERY),
    promQuery(deps, context, PROMETHEUS_ALERT_SINCE_QUERY),
  ]);
  const answered = values.some((value) => value !== null) || firing !== null;
  if (!answered) {
    return { service: { name, status: 'unknown' as const, detail: 'unreachable' }, metrics: {} as OperationsMetrics, alerts: [] as FiringAlert[] };
  }
  const metrics: OperationsMetrics = {};
  keys.forEach((key, index) => {
    const sample = values[index]?.[0];
    const value = sample ? finite(sample.value) : undefined;
    if (value !== undefined) metrics[key] = key === 'commitP95Ms' ? Math.round(value * 10) / 10 : Math.round(value);
  });
  const activeSince = new Map<string, number>();
  for (const sample of since ?? []) {
    if (Number.isFinite(sample.value)) activeSince.set(labelKey(sample.metric), sample.value);
  }
  const alerts: FiringAlert[] = (firing ?? [])
    .filter((sample) => typeof sample.metric.alertname === 'string' && sample.metric.alertname.length > 0)
    .map((sample) => {
      const started = activeSince.get(labelKey(sample.metric));
      return {
        name: sample.metric.alertname!.slice(0, 200),
        severity: /^[a-z]{1,20}$/.test(sample.metric.severity ?? '') ? sample.metric.severity! : 'none',
        since: started !== undefined && started > 0 ? new Date(started * 1000).toISOString() : null,
      };
    });
  const rank = (severity: string) => {
    const index = SEVERITY_ORDER.indexOf(severity);
    return index < 0 ? SEVERITY_ORDER.length : index;
  };
  alerts.sort((a, b) => rank(a.severity) - rank(b.severity) || a.name.localeCompare(b.name));
  const complete = values.every((value) => value !== null) && firing !== null;
  const service: ServiceEntry = complete ? { name, status: 'up' } : { name, status: 'degraded', detail: 'some queries failed' };
  return { service, metrics, alerts: alerts.slice(0, MAX_ALERTS) };
}

export async function buildOperationsSummary(deps: AppDeps, context: RequestContext): Promise<OperationsSummary> {
  const [backend, docApi, assets, prometheus] = await Promise.all([
    backendSource(deps, context),
    docApiSource(deps, context),
    assetSource(deps, context),
    prometheusSource(deps, context),
  ]);
  const metrics: OperationsMetrics = { ...prometheus.metrics };
  metrics.activeRooms ??= backend.rooms;
  metrics.websocketConnections ??= backend.connections;
  // The integrity report is the source of truth for missing files.
  if (assets.missingFiles !== undefined) metrics.assetMissingFiles = assets.missingFiles;
  for (const key of Object.keys(metrics) as Array<keyof OperationsMetrics>) {
    if (metrics[key] === undefined) delete metrics[key];
  }
  return {
    generatedAt: deps.now().toISOString(),
    services: [backend.service, docApi, assets.service, prometheus.service],
    metrics,
    alerts: prometheus.alerts,
    links: { grafana: deps.config.grafanaUrl, runbooks: [...RUNBOOKS] },
  };
}

export function operationsRouter(deps: AppDeps): Router {
  const router = Router();
  router.get(
    '/operations/summary',
    guard(deps, { permission: ['ops:read'], action: 'operations.read', resourceType: 'operations' }),
    async (req, res) => {
      if (Object.keys(req.query).length > 0) {
        res.status(400).json({ error: 'invalid_query', requestId: ctx(res).requestId });
        return;
      }
      const context = ctx(res);
      try {
        res.json(await buildOperationsSummary(deps, context));
      } catch (error) {
        // Every source already degrades on its own; this is a last resort.
        deps.logger.error('operations summary failed', { requestId: context.requestId, error });
        res.json({
          generatedAt: deps.now().toISOString(),
          services: ['vtt-backend', 'codex-doc-api', 'asset-service', 'prometheus'].map((name) => ({ name, status: 'unknown', detail: 'summary unavailable' })),
          metrics: {},
          alerts: [],
          links: { grafana: deps.config.grafanaUrl, runbooks: [...RUNBOOKS] },
        } satisfies OperationsSummary);
      }
    },
  );
  return router;
}
