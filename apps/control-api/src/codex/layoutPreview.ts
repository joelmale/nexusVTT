import { sendError } from '../http/context.js';
import type { HandlerContext } from '../proxy/forward.js';
import { docApiJson, objectStorageUrl, UpstreamFailure } from './internal.js';
import { streamObjectImage } from './pageImage.js';

/**
 * `GET /control-api/v1/codex/admin/processing/:id/pages/:page/preview` (codex:read).
 *
 * The ingestion v2 layout-stage preview for one page (Live Proof canvas).
 * Resolves the presigned URL through doc-api
 * `GET /api/admin/processing/:id/pages/:page/preview-source` (not on the
 * browser allowlist) and streams the image server-side, like page images.
 */

const PAGE = /^\d{1,5}$/;

export async function layoutPreviewHandler(hc: HandlerContext): Promise<void> {
  const { deps, res, context, match } = hc;
  const { id, page } = match.params;
  if (hc.rawQuery !== '') return sendError(res, 400, 'invalid_query');
  if (!id || !page || !PAGE.test(page)) return sendError(res, 404, 'not_found');

  let resolved;
  try {
    resolved = await docApiJson(deps, context, 'GET', `admin/processing/${id}/pages/${Number(page)}/preview-source`);
  } catch (error) {
    const reason = error instanceof UpstreamFailure ? error.reason : 'upstream_unavailable';
    return sendError(res, reason === 'upstream_timeout' ? 504 : 502, reason);
  }
  if (resolved.status === 404) return sendError(res, 404, 'not_found');
  if (resolved.status !== 200) {
    deps.logger.warn('doc-api layout preview lookup failed', { requestId: context.requestId, status: resolved.status });
    return sendError(res, 502, 'upstream_error');
  }
  const body = resolved.json as { key?: unknown; url?: unknown } | null;
  const source = objectStorageUrl(deps, body?.url);
  if (!source) {
    deps.logger.error('presigned layout-preview URL is not on the internal object-storage origin; set doc-api S3_PUBLIC_ENDPOINT to it', { requestId: context.requestId });
    return sendError(res, 502, 'upstream_error');
  }
  await streamObjectImage(hc, source, typeof body?.key === 'string' ? body.key : undefined, 'admin/processing/:id/pages/:page/preview');
}
