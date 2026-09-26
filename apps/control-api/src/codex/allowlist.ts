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
 *
 * Object storage (MinIO) is never browser-facing. Two entries are served by
 * control-api handlers (`handler`) that talk to object storage server-side:
 * - `POST documents/upload` spools one file, creates the record through
 *   doc-api `documents/bulk`, PUTs the bytes to the presigned URL, and queues
 *   processing (src/codex/upload.ts).
 * - `GET documents/:id/pages/:page/image` streams one page image from the
 *   presigned URL doc-api `documents/:id/page-images` returns
 *   (src/codex/pageImage.ts).
 * The presigned URLs themselves never reach the browser.
 *
 * Bodies are capped at 1 MB (`CODEX_MAX_JSON_BYTES`) except the upload
 * (320 MiB file). Annotation, reference, and bulk-create bodies have their
 * actor fields (`userId`, `documents[].uploadedBy`) overwritten with the
 * session's user ID; client-supplied values are ignored.
 */

import {
  BOOL,
  DATE,
  ID,
  INT,
  json,
  KB,
  MB,
  NONE,
  RouteTable,
  SORT_ORDER,
  TEXT,
  type ProxyRoute,
} from '../proxy/routeTable.js';

export { PATH_PARAM, type BodyRule, type HttpMethod, type LookupResult, type RouteMatch } from '../proxy/routeTable.js';
export type CodexRoute = ProxyRoute;
export const CodexRouteTable = RouteTable;
export type CodexRouteTable = RouteTable;

/** Server-side Codex upload (control-api spools the file and PUTs it to object storage). */
export const CODEX_UPLOAD_MAX_FILE_BYTES = 320 * MB;
/** Multipart framing and metadata fields on top of the file. */
export const CODEX_UPLOAD_MAX_BODY_BYTES = CODEX_UPLOAD_MAX_FILE_BYTES + 1 * MB;
/** Cap for every other Codex request body. */
export const CODEX_MAX_JSON_BYTES = 1 * MB;

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
  read('documents/:id/content', 'document', { forwardHeaders: ['range'], response: 'inlineDocument', timeoutMs: 120_000 }),

  // Upload. `documents/bulk` creates records only (actor stamped from the
  // session); `documents/upload` is the server-side file upload.
  mutate({ method: 'POST', path: 'documents/bulk', permission: WRITE, action: 'codex.document.bulk_create', resourceType: 'document_batch', body: json(CODEX_MAX_JSON_BYTES), stampActor: 'documents.uploadedBy' }),
  mutate({
    method: 'POST', path: 'documents/upload', permission: WRITE, action: 'codex.document.upload', resourceType: 'document', handler: 'upload',
    body: { kind: 'stream', maxBytes: CODEX_UPLOAD_MAX_BODY_BYTES, contentTypes: ['multipart/form-data'] }, timeoutMs: 600_000,
  }),
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
  read('documents/:id/pages/:page/image', 'document', { handler: 'pageImage', response: 'image', timeoutMs: 60_000 }),
  read('documents/:id/annotations', 'annotation', { query: { userId: ID, campaignId: ID } }),
  mutate({ method: 'POST', path: 'documents/:id/annotations', permission: WRITE, action: 'codex.annotation.create', resourceType: 'document', body: json(64 * KB), stampActor: 'userId' }),
  read('references', 'reference', { query: { documentId: ID, userId: ID, campaignId: ID } }),
  mutate({ method: 'POST', path: 'references', permission: WRITE, action: 'codex.reference.create', resourceType: 'reference', body: json(16 * KB), auditBodyKeys: ['documentId'], stampActor: 'userId' }),
  // A reader bookmark, not document content, so codex:write rather than codex:delete.
  mutate({ method: 'DELETE', path: 'references/:id', permission: WRITE, action: 'codex.reference.delete', resourceType: 'reference' }),
];
