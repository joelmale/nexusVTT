import type { Permission } from '../permissions.js';
import { BOOL, INT, json, KB, MB, NONE, TEXT, type ProxyRoute } from '../proxy/routeTable.js';

/**
 * THE asset allowlist. `/control-api/v1/assets/<path>` reaches the asset
 * service `/internal/admin/<path>` only when method and path match an entry
 * below; anything else is a 404 and never contacts the asset service.
 *
 * Covers every route in apps/docs/vtt/operations/asset-administration.md
 * (apps/vtt/services/asset-service/src/admin/router.ts). control-api adds
 * `x-nexus-auth` (ASSET_SERVICE_SECRET) and `x-nexus-actor` (the session's
 * user ID); the browser never sees the secret. `If-Match`/`If-None-Match`
 * pass through, and typed 4xx bodies (for example `409 version-conflict`
 * with the current asset) are relayed unchanged.
 */

/** Asset-service default upload limit (ASSET_ADMIN_MAX_UPLOAD_BYTES). */
export const ASSET_UPLOAD_MAX_FILE_BYTES = 25 * MB;
/** The whole multipart body: the file plus up to 20 small metadata fields. */
export const ASSET_UPLOAD_MAX_BODY_BYTES = ASSET_UPLOAD_MAX_FILE_BYTES + 1 * MB;

const READ: readonly Permission[] = ['assets:read'];
const WRITE: readonly Permission[] = ['assets:write'];
const DELETE: readonly Permission[] = ['assets:delete'];

const STATUS = /^(active|quarantined|removed|deleted|all)$/;
const ORIGIN = /^(admin|library)$/;
const CURSOR = /^[A-Za-z0-9_-]{1,64}$/;
const VARIANT = /^(thumbnail|original)$/;
const CONDITIONAL = ['if-match', 'if-none-match'] as const;

const read = (path: string, resourceType: string, extra: Partial<ProxyRoute> = {}): ProxyRoute => ({
  method: 'GET',
  path,
  permission: READ,
  recentAuth: false,
  audited: false,
  action: 'assets.read',
  resourceType,
  query: {},
  body: NONE,
  forwardHeaders: ['if-none-match'],
  ...extra,
});

const mutate = (spec: Pick<ProxyRoute, 'method' | 'path' | 'permission' | 'action' | 'resourceType'> & Partial<ProxyRoute>): ProxyRoute => ({
  recentAuth: false,
  audited: true,
  query: {},
  body: NONE,
  forwardHeaders: CONDITIONAL,
  ...spec,
});

export const ASSET_ALLOWLIST: readonly ProxyRoute[] = [
  // Browse
  read('assets', 'asset', { query: { q: TEXT, category: TEXT, tags: TEXT, status: STATUS, origin: ORIGIN, cursor: CURSOR, limit: INT } }),
  read('facets', 'asset'),
  read('assets/:id', 'asset'),
  read('assets/:id/preview', 'asset', { query: { variant: VARIANT }, response: 'image' }),

  // Upload and metadata
  mutate({
    method: 'POST', path: 'assets', permission: WRITE, action: 'assets.upload', resourceType: 'asset', query: { force: BOOL },
    body: { kind: 'stream', maxBytes: ASSET_UPLOAD_MAX_BODY_BYTES, contentTypes: ['multipart/form-data'] }, forwardHeaders: [], timeoutMs: 120_000,
  }),
  mutate({ method: 'PATCH', path: 'assets/:id', permission: WRITE, action: 'assets.update_metadata', resourceType: 'asset', body: json(64 * KB), auditBodyKeys: ['expectedVersion'] }),
  mutate({ method: 'POST', path: 'assets/:id/derivatives', permission: WRITE, action: 'assets.regenerate_derivative', resourceType: 'asset', body: json(1 * KB, true), timeoutMs: 120_000 }),

  // Quarantine and deletion. delete-preview changes nothing (a read on POST).
  { ...read('assets/:id/delete-preview', 'asset'), method: 'POST', body: json(64 * KB, true), forwardHeaders: [] },
  mutate({ method: 'POST', path: 'assets/:id/quarantine', permission: WRITE, action: 'assets.quarantine', resourceType: 'asset', body: json(64 * KB), auditBodyKeys: ['expectedVersion', 'acknowledgeReferences'] }),
  mutate({ method: 'POST', path: 'assets/:id/restore', permission: WRITE, action: 'assets.restore', resourceType: 'asset', body: json(4 * KB), auditBodyKeys: ['expectedVersion'] }),
  mutate({ method: 'POST', path: 'assets/:id/permanent-delete', permission: DELETE, recentAuth: true, action: 'assets.permanent_delete', resourceType: 'asset', body: json(4 * KB), auditBodyKeys: ['expectedVersion', 'confirm'] }),

  // Jobs and integrity
  mutate({ method: 'POST', path: 'jobs/manifest-rebuild', permission: WRITE, action: 'assets.job.manifest_rebuild', resourceType: 'asset_job', query: { wait: BOOL }, body: json(1 * KB, true), forwardHeaders: [], timeoutMs: 45_000 }),
  mutate({ method: 'POST', path: 'jobs/integrity-report', permission: WRITE, action: 'assets.job.integrity_report', resourceType: 'asset_job', query: { wait: BOOL }, body: json(1 * KB, true), auditBodyKeys: ['verifyHashes'], forwardHeaders: [], timeoutMs: 45_000 }),
  read('jobs', 'asset_job'),
  read('jobs/:jobId', 'asset_job'),
  read('integrity', 'asset_integrity'),
];

/** Typed asset-service error bodies relayed to the browser unchanged. */
export const ASSET_PASSTHROUGH_ERRORS: ReadonlySet<number> = new Set([400, 404, 409, 413, 415, 422, 428]);
