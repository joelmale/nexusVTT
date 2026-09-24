import type { Permission } from '../permissions.js';
import { json, KB, NONE, type ProxyRoute } from '../proxy/routeTable.js';

/**
 * THE rules allowlist. `/control-api/v1/rules/<path>` reaches doc-api
 * `/api/admin/rules/<path>` only when method and path match an entry below;
 * anything else is a 404 and never contacts doc-api.
 *
 * Covers every internal admin route in apps/docs/codex/rules-registry.md
 * (apps/codex/services/doc-api/src/routes/rules/admin.ts). The published
 * catalog (`/api/rules/catalog/*`) is for VTT/Forge backends, not the admin
 * console, and is not listed. control-api adds `X-Nexus-Actor` (the
 * session's user ID) and, when RULES_ADMIN_SERVICE_TOKEN is set,
 * `X-Nexus-Service-Token`. `If-Match` passes through, the `ETag` comes back,
 * and typed error bodies (`RulesErrorResponse`, including a 409's `current`
 * head) are relayed unchanged.
 */

const READ: readonly Permission[] = ['rules:read'];
const WRITE: readonly Permission[] = ['rules:write'];
const PUBLISH: readonly Permission[] = ['rules:publish'];

const ENTITY_TYPE = /^(spell|item|monster)$/;
const RULESET = /^(2014|2024)$/;
const STATUS = /^(draft|validated|published|superseded)$/;
const ARCHIVED = /^(true|false|all)$/;
const SEARCH = /^[^\p{Cc}]{1,120}$/u;
const COUNT = /^\d{1,6}$/;
const REVISION = /^[1-9]\d{0,8}$/;

/** Rules data (a monster with its actions) can be sizeable; still far below 1 MB. */
const ENTITY_BODY = json(512 * KB);
const TRANSITION_BODY = json(1 * KB, true);
const TRANSITION_AUDIT = ['expectedRevisionNumber'];

const read = (path: string, extra: Partial<ProxyRoute> = {}): ProxyRoute => ({
  method: 'GET',
  path,
  permission: READ,
  recentAuth: false,
  audited: false,
  action: 'rules.read',
  resourceType: 'rules_entity',
  query: {},
  body: NONE,
  ...extra,
});

const mutate = (spec: Pick<ProxyRoute, 'method' | 'path' | 'permission' | 'action'> & Partial<ProxyRoute>): ProxyRoute => ({
  recentAuth: false,
  audited: true,
  resourceType: 'rules_entity',
  query: {},
  body: TRANSITION_BODY,
  forwardHeaders: ['if-match'],
  auditBodyKeys: TRANSITION_AUDIT,
  ...spec,
});

export const RULES_ALLOWLIST: readonly ProxyRoute[] = [
  read('entities', {
    query: { type: ENTITY_TYPE, ruleset: RULESET, status: STATUS, q: SEARCH, archived: ARCHIVED, limit: COUNT, offset: COUNT },
  }),
  mutate({ method: 'POST', path: 'entities', permission: WRITE, action: 'rules.entity.create', body: ENTITY_BODY, forwardHeaders: [], auditBodyKeys: ['entityType', 'ruleset', 'slug'] }),
  read('entities/:id'),
  read('entities/:id/revisions/:revisionNumber'),
  mutate({ method: 'PUT', path: 'entities/:id/draft', permission: WRITE, action: 'rules.entity.save_draft', body: ENTITY_BODY }),
  mutate({ method: 'POST', path: 'entities/:id/validate', permission: WRITE, action: 'rules.entity.validate' }),
  read('entities/:id/preview', { query: { revision: REVISION } }),
  mutate({ method: 'POST', path: 'entities/:id/publish', permission: PUBLISH, recentAuth: true, action: 'rules.entity.publish' }),
  mutate({
    method: 'POST', path: 'entities/:id/rollback', permission: PUBLISH, recentAuth: true, action: 'rules.entity.rollback',
    body: json(1 * KB), auditBodyKeys: ['expectedRevisionNumber', 'targetRevisionNumber'],
  }),
  read('entities/:id/diff', { query: { from: REVISION, to: REVISION } }),
  mutate({ method: 'POST', path: 'entities/:id/archive', permission: PUBLISH, recentAuth: true, action: 'rules.entity.archive' }),
  mutate({ method: 'POST', path: 'entities/:id/unarchive', permission: PUBLISH, recentAuth: true, action: 'rules.entity.unarchive' }),
];

/** Typed `RulesErrorResponse` bodies relayed to the browser unchanged. */
export const RULES_PASSTHROUGH_ERRORS: ReadonlySet<number> = new Set([400, 404, 409, 422]);
