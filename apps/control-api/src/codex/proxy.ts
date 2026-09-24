import type { RequestHandler } from 'express';
import { API_PREFIX, type AppDeps } from '../deps.js';
import { allowlistProxy } from '../proxy/forward.js';
import { pageImageHandler } from './pageImage.js';
import { uploadHandler } from './upload.js';

export { normalizeUpstreamError } from '../proxy/forward.js';

export const CODEX_PREFIX = `${API_PREFIX}/codex/`;

/** `/control-api/v1/codex/<path>` -> doc-api `/api/<path>` for allowlisted routes only. */
export function codexProxy(deps: AppDeps): RequestHandler {
  return allowlistProxy(deps, {
    upstreamName: 'doc-api',
    prefix: CODEX_PREFIX,
    table: (d) => d.codexRoutes,
    upstreamUrl: (d, path, search) => `${d.config.docApiUrl}/api/${path}${search ? `?${search}` : ''}`,
    handlers: { upload: uploadHandler, pageImage: pageImageHandler },
  });
}
