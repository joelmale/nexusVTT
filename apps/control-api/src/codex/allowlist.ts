import type { Permission } from '../permissions.js';

/**
 * THE Codex allowlist. `/control-api/v1/codex/<path>` reaches doc-api
 * `/api/<path>` only when method and path match an entry below. Anything else
 * is a 404 and never contacts doc-api.
 *
 * The table covers exactly the calls the Admin UI makes
 * (apps/codex/services/admin-ui/src). Each entry was checked against the
 * matching doc-api route in apps/codex/services/doc-api/src/routes.
 *
 * Deliberately NOT listed (the Admin UI does not call them):
 * - admin/users*            doc-api's legacy user admin; control-api owns identity.
 * - admin/validation/fix    validation auto-fix (add with codex:maintain + recent auth when the UI needs it).
 * - admin/documents/bulk-delete, bulk-update, admin/tags*, admin/duplicates*
 * - admin/alerts/rules (PUT), admin/metrics/cleanup, admin/alerts/cleanup
 * - documents (POST single create), documents/:id (PUT/DELETE), structured-data, vtt/*
 * - The presigned object-storage PUT returned by documents/bulk (`uploadUrl`)
 *   goes from the browser to object storage and is not a doc-api call.
 */

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type BodyRule =
  | { kind: 'none' }
  | { kind: 'json'; maxBytes: number }
  | { kind: 'stream'; maxBytes: number; contentTypes: readonly string[] };

export interface CodexRoute {
  method: HttpMethod;
  /** Path below `/api/`; `:name` segments must match PATH_PARAM. */
  path: string;
  /** Any-of: the caller needs at least one of these permissions. */
  permission: readonly Permission[];
  /** Requires a Google login within the last 10 minutes. */
  recentAuth: boolean;
  /** Mutations are audited with the doc-api outcome. Denials are always audited. */
  audited: boolean;
  /** Audit action name. */
  action: string;
  resourceType: string;
  /** Allowed query keys and the pattern each value must match. */
  query: Readonly<Record<string, RegExp>>;
  body: BodyRule;
  /** Top-level JSON body keys whose (identifier) values are copied to the audit summary. */
  auditBodyKeys?: readonly string[];
  /** Extra request headers forwarded to doc-api (validated). */
  forwardHeaders?: readonly 'range'[];
  /**
   * Response is a document opened in a browser tab (PDF). Its CSP still
   * forbids scripts but allows the same-origin PDF viewer embed.
   */
  inlineDocument?: boolean;
  timeoutMs?: number;
}

export const PATH_PARAM = /^[A-Za-z0-9_-]{1,128}$/;

const INT = /^\d{1,6}$/;
const BOOL = /^(true|false)$/;
/** Free text without control characters. */
const TEXT = /^\P{Cc}{0,256}$/u;
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const DATE = /^[0-9TZ:.+-]{1,40}$/;
const SORT_ORDER = /^(asc|desc)$/;

const NONE: BodyRule = { kind: 'none' };
const json = (maxBytes: number): BodyRule => ({ kind: 'json', maxBytes });
const KB = 1024;

const READ: readonly Permission[] = ['codex:read'];
const WRITE: readonly Permission[] = ['codex:write'];
const DELETE: readonly Permission[] = ['codex:delete'];
const MAINTAIN: readonly Permission[] = ['codex:maintain'];
const OPERATE: readonly Permission[] = ['codex:operate'];

type RouteSpec = Omit<CodexRoute, 'recentAuth' | 'audited' | 'query' | 'body' | 'action' | 'resourceType'> &
  Partial<Pick<CodexRoute, 'recentAuth' | 'audited' | 'query' | 'body' | 'action' | 'resourceType'>>;

const read = (path: string, resourceType: string, extra: Partial<RouteSpec> = {}): CodexRoute => ({
  method: 'GET',
  path,
  permission: READ,
  recentAuth: false,
  audited: false,
  action: 'codex.read',
  resourceType,
  query: {},
  body: NONE,
  ...extra,
});

const mutate = (spec: RouteSpec & { action: string; resourceType: string }): CodexRoute => ({
  recentAuth: false,
  audited: true,
  query: {},
  body: NONE,
  ...spec,
});

export const CODEX_ALLOWLIST: readonly CodexRoute[] = [
  // Dashboard
  read('admin/stats', 'codex_stats'),

  // Documents
  read('admin/documents', 'document', {
    query: { page: INT, limit: INT, status: ID, type: ID, search: TEXT },
  }),
  mutate({ method: 'PATCH', path: 'admin/documents/:id', permission: WRITE, action: 'codex.document.update', resourceType: 'document', body: json(64 * KB) }),
  mutate({ method: 'DELETE', path: 'admin/documents/:id', permission: DELETE, recentAuth: true, action: 'codex.document.delete', resourceType: 'document' }),
  mutate({ method: 'POST', path: 'admin/documents/:id/reprocess', permission: WRITE, action: 'codex.document.reprocess', resourceType: 'document' }),
  read('documents/:id/content', 'document', { forwardHeaders: ['range'], inlineDocument: true, timeoutMs: 120_000 }),

  // Bulk upload (JSON metadata; files go to presigned object-storage URLs)
  mutate({ method: 'POST', path: 'documents/bulk', permission: WRITE, action: 'codex.document.bulk_create', resourceType: 'document_batch', body: json(1024 * KB) }),
  read('documents/bulk/:batchId/status', 'document_batch'),
  mutate({ method: 'POST', path: 'documents/:id/process', permission: WRITE, action: 'codex.document.process', resourceType: 'document' }),

  // Data quality
  read('admin/processing/summary', 'processing'),
  read('admin/processing/issues', 'processing'),
  read('admin/validation/comprehensive', 'validation'),
  read('admin/processing/search-check/:id', 'document', { query: { q: TEXT } }),

  // Processing queue
  read('admin/queue/stats', 'queue'),
  read('admin/queue/jobs', 'queue_job', { query: { status: ID, limit: INT } }),
  read('admin/queue/jobs/:id/logs', 'queue_job'),
  read('admin/processing/report/:id', 'document'),
  mutate({ method: 'POST', path: 'admin/queue/jobs/:id/retry', permission: ['codex:write', 'codex:operate'], action: 'codex.queue.job_retry', resourceType: 'queue_job' }),
  mutate({ method: 'DELETE', path: 'admin/queue/jobs/:id', permission: MAINTAIN, action: 'codex.queue.job_remove', resourceType: 'queue_job' }),
  mutate({ method: 'POST', path: 'admin/queue/clean', permission: OPERATE, action: 'codex.queue.clean', resourceType: 'queue', body: json(1 * KB), auditBodyKeys: ['olderThanDays'] }),

  // Deduplication
  read('deduplication/duplicates', 'document'),
  mutate({ method: 'POST', path: 'deduplication/merge', permission: DELETE, recentAuth: true, action: 'codex.document.merge_duplicates', resourceType: 'document', body: json(64 * KB), auditBodyKeys: ['primaryId', 'duplicateIds'] }),

  // Elasticsearch index maintenance
  read('admin/elasticsearch/health', 'search_index'),
  read('admin/elasticsearch/stats', 'search_index'),
  mutate({ method: 'POST', path: 'admin/elasticsearch/reindex', permission: MAINTAIN, recentAuth: true, action: 'codex.index.reindex', resourceType: 'search_index', query: { force: BOOL, batchSize: INT }, timeoutMs: 300_000 }),
  mutate({ method: 'POST', path: 'admin/elasticsearch/recreate-index', permission: MAINTAIN, recentAuth: true, action: 'codex.index.recreate', resourceType: 'search_index', timeoutMs: 300_000 }),
  mutate({ method: 'POST', path: 'admin/elasticsearch/optimize', permission: MAINTAIN, recentAuth: true, action: 'codex.index.optimize', resourceType: 'search_index', timeoutMs: 300_000 }),
  mutate({ method: 'DELETE', path: 'admin/elasticsearch/clear', permission: MAINTAIN, recentAuth: true, action: 'codex.index.clear', resourceType: 'search_index', timeoutMs: 300_000 }),

  // Health, metrics, alerts
  read('admin/health', 'health'),
  read('admin/metrics/summary/:period', 'metrics'),
  read('admin/metrics/recent', 'metrics', { query: { count: INT } }),
  read('admin/alerts', 'alert'),
  read('admin/alerts/stats', 'alert'),
  mutate({ method: 'POST', path: 'admin/alerts/:id/acknowledge', permission: OPERATE, action: 'codex.alert.acknowledge', resourceType: 'alert' }),
  mutate({ method: 'POST', path: 'admin/alerts/:id/resolve', permission: OPERATE, action: 'codex.alert.resolve', resourceType: 'alert' }),

  // Logs
  read('admin/logs', 'log', { query: { service: ID, level: ID, q: TEXT } }),

  // Search (reads; `ask` is a POST but changes nothing)
  read('search/advanced', 'document', {
    query: { query: TEXT, sortBy: ID, sortOrder: SORT_ORDER, from: INT, size: INT, type: ID, uploadedBy: TEXT, uploadedAfter: DATE, uploadedBefore: DATE },
  }),
  read('search/quick', 'document', { query: { query: TEXT, size: INT } }),
  read('search/semantic', 'document', { query: { query: TEXT, topK: INT } }),
  { ...read('search/ask', 'document'), method: 'POST', body: json(8 * KB), timeoutMs: 60_000 },

  // Reader
  read('documents/:id/page-images', 'document'),
  read('documents/:id/annotations', 'annotation', { query: { userId: ID, campaignId: ID } }),
  mutate({ method: 'POST', path: 'documents/:id/annotations', permission: WRITE, action: 'codex.annotation.create', resourceType: 'document', body: json(64 * KB) }),
  read('references', 'reference', { query: { documentId: ID, userId: ID, campaignId: ID } }),
  mutate({ method: 'POST', path: 'references', permission: WRITE, action: 'codex.reference.create', resourceType: 'reference', body: json(16 * KB), auditBodyKeys: ['documentId'] }),
  // A reader bookmark, not document content, so codex:write rather than codex:delete.
  mutate({ method: 'DELETE', path: 'references/:id', permission: WRITE, action: 'codex.reference.delete', resourceType: 'reference' }),
];

interface CompiledRoute {
  route: CodexRoute;
  segments: readonly ({ literal: string } | { param: string })[];
}

export interface RouteMatch {
  route: CodexRoute;
  params: Record<string, string>;
  /** Validated doc-api path below `/api/`. */
  upstreamPath: string;
}

export type LookupResult =
  | { kind: 'match'; match: RouteMatch }
  | { kind: 'not_found' };

export class CodexRouteTable {
  private readonly compiled: CompiledRoute[];

  constructor(routes: readonly CodexRoute[]) {
    const seen = new Set<string>();
    this.compiled = routes.map((route) => {
      const key = `${route.method} ${route.path.replace(/:[^/]+/g, ':')}`;
      if (seen.has(key)) throw new Error(`Duplicate Codex allowlist entry: ${key}`);
      seen.add(key);
      return {
        route,
        segments: route.path.split('/').map((segment) =>
          segment.startsWith(':') ? { param: segment.slice(1) } : { literal: segment },
        ),
      };
    });
  }

  /**
   * `rawPath` is the undecoded path after `/codex/`. Matching the raw form
   * means `%2F`, `%2e%2e`, `..`, `.` and empty segments can never match a
   * param or literal, so they fall through to 404.
   */
  lookup(method: string, rawPath: string): LookupResult {
    const parts = rawPath.split('/');
    for (const { route, segments } of this.compiled) {
      if (route.method !== method || segments.length !== parts.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < segments.length && ok; i++) {
        const segment = segments[i]!;
        const part = parts[i]!;
        if ('literal' in segment) ok = part === segment.literal;
        else if (PATH_PARAM.test(part)) params[segment.param] = part;
        else ok = false;
      }
      if (ok) return { kind: 'match', match: { route, params, upstreamPath: parts.join('/') } };
    }
    return { kind: 'not_found' };
  }
}
