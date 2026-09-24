import type { RequestHandler } from 'express';
import { API_PREFIX, type AppDeps } from '../deps.js';
import { allowlistProxy } from '../proxy/forward.js';
import { ASSET_PASSTHROUGH_ERRORS } from './allowlist.js';

export const ASSETS_PREFIX = `${API_PREFIX}/assets/`;

/** `/control-api/v1/assets/<path>` -> asset-service `/internal/admin/<path>` for allowlisted routes only. */
export function assetsProxy(deps: AppDeps): RequestHandler {
  return allowlistProxy(deps, {
    upstreamName: 'asset-service',
    prefix: ASSETS_PREFIX,
    table: (d) => d.assetRoutes,
    upstreamUrl: (d, path, search) => `${d.config.assetServiceUrl}/internal/admin/${path}${search ? `?${search}` : ''}`,
    upstreamHeaders: (d, context) => ({
      'x-nexus-auth': d.config.assetServiceSecret,
      'x-nexus-actor': context.admin!.user.id,
    }),
    passthroughErrors: ASSET_PASSTHROUGH_ERRORS,
  });
}
