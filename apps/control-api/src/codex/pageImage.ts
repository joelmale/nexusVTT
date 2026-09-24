import { sendError } from '../http/context.js';
import { isImageType, pipeUpstream, setImageHeaders, type HandlerContext } from '../proxy/forward.js';
import { docApiJson, objectStorageUrl, UpstreamFailure } from './internal.js';

/**
 * `GET /control-api/v1/codex/documents/:id/pages/:page/image` (codex:read).
 *
 * Resolves the page through doc-api `GET /api/documents/:id/page-images`,
 * then fetches the presigned object-storage URL server-side (internal origin
 * only) and streams the image with safe headers. The presigned URL never
 * reaches the browser.
 */

const PAGE = /^\d{1,5}$/;
const IMAGE_TIMEOUT_MS = 60_000;
const TYPE_BY_EXTENSION: Readonly<Record<string, string>> = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
/** Types object storage reports when the uploader set none; only these fall back to the key's extension. */
const GENERIC_TYPES = new Set(['', 'application/octet-stream', 'binary/octet-stream']);

interface PageEntry {
  key?: unknown;
  url?: unknown;
  pageNumber?: unknown;
}

export async function pageImageHandler(hc: HandlerContext): Promise<void> {
  const { deps, res, context, match } = hc;
  const { id, page } = match.params;
  if (hc.rawQuery !== '') return sendError(res, 400, 'invalid_query');
  if (!id || !page || !PAGE.test(page)) return sendError(res, 404, 'not_found');
  const pageNumber = Number(page);

  let listing;
  try {
    listing = await docApiJson(deps, context, 'GET', `documents/${id}/page-images`);
  } catch (error) {
    const reason = error instanceof UpstreamFailure ? error.reason : 'upstream_unavailable';
    return sendError(res, reason === 'upstream_timeout' ? 504 : 502, reason);
  }
  if (listing.status === 404) return sendError(res, 404, 'not_found');
  if (listing.status !== 200) {
    deps.logger.warn('doc-api page listing failed', { requestId: context.requestId, status: listing.status });
    return sendError(res, 502, 'upstream_error');
  }
  const pages = (listing.json as { pages?: unknown } | null)?.pages;
  const entry = Array.isArray(pages)
    ? (pages as PageEntry[]).find((candidate) => candidate && candidate.pageNumber === pageNumber)
    : undefined;
  if (!entry) return sendError(res, 404, 'not_found');
  const source = objectStorageUrl(deps, entry.url);
  if (!source) {
    deps.logger.error('presigned page-image URL is not on the internal object-storage origin; set doc-api S3_PUBLIC_ENDPOINT to it', { requestId: context.requestId });
    return sendError(res, 502, 'upstream_error');
  }

  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(new Error('timeout')), IMAGE_TIMEOUT_MS);
  res.on('close', () => {
    if (!res.writableFinished) abort.abort(new Error('client closed'));
  });
  let image: globalThis.Response;
  try {
    // Only the presigned URL itself: no browser headers, cookies, or credentials.
    image = await deps.fetch(source.href, { method: 'GET', redirect: 'manual', signal: abort.signal });
  } catch (error) {
    clearTimeout(timeout);
    deps.logger.warn('object storage page image fetch failed', { requestId: context.requestId, error });
    return sendError(res, 502, 'upstream_unavailable');
  }
  if (image.status !== 200 || !image.body) {
    clearTimeout(timeout);
    await image.body?.cancel().catch(() => undefined);
    deps.logger.warn('object storage returned an error for a page image', { requestId: context.requestId, status: image.status });
    return sendError(res, image.status === 404 ? 404 : 502, image.status === 404 ? 'not_found' : 'upstream_error');
  }
  let contentType = (image.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  if (GENERIC_TYPES.has(contentType)) {
    // MinIO reports a generic type when none was stored; use the key's extension.
    const key = typeof entry.key === 'string' ? entry.key : source.pathname;
    contentType = TYPE_BY_EXTENSION[key.slice(key.lastIndexOf('.') + 1).toLowerCase()] ?? '';
  }
  if (!isImageType(contentType)) {
    clearTimeout(timeout);
    await image.body.cancel().catch(() => undefined);
    return sendError(res, 502, 'upstream_error');
  }
  res.status(200);
  setImageHeaders(res, contentType);
  const length = image.headers.get('content-length');
  if (length && /^\d{1,12}$/.test(length)) res.setHeader('Content-Length', length);
  pipeUpstream(deps, context, 'object storage', 'documents/:id/pages/:page/image', image.body, res, () => clearTimeout(timeout));
}
