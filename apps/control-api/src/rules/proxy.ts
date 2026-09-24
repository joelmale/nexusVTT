import type { RequestHandler } from 'express';
import { API_PREFIX, type AppDeps } from '../deps.js';
import { allowlistProxy } from '../proxy/forward.js';
import { RULES_PASSTHROUGH_ERRORS } from './allowlist.js';

export const RULES_PREFIX = `${API_PREFIX}/rules/`;

/** `/control-api/v1/rules/<path>` -> doc-api `/api/admin/rules/<path>` for allowlisted routes only. */
export function rulesProxy(deps: AppDeps): RequestHandler {
  return allowlistProxy(deps, {
    upstreamName: 'rules registry',
    prefix: RULES_PREFIX,
    table: (d) => d.rulesRoutes,
    upstreamUrl: (d, path, search) => `${d.config.docApiUrl}/api/admin/rules/${path}${search ? `?${search}` : ''}`,
    upstreamHeaders: (d, context) => ({
      'x-nexus-actor': context.admin!.user.id,
      'x-nexus-service-token': d.config.rulesServiceToken,
    }),
    passthroughErrors: RULES_PASSTHROUGH_ERRORS,
  });
}
