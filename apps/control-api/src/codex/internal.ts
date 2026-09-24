import type { AppDeps } from '../deps.js';
import type { RequestContext } from '../http/context.js';

const MAX_JSON_RESPONSE = 1024 * 1024;

export class UpstreamFailure extends Error {
  constructor(
    readonly reason: 'upstream_timeout' | 'upstream_unavailable' | 'upstream_error' | 'object_storage_error',
    readonly upstreamStatus: number | null = null,
  ) {
    super(reason);
  }
}

export interface JsonResponse {
  status: number;
  json: unknown;
}

/**
 * One server-side doc-api call on behalf of a control-api handler. Never
 * follows redirects; the response body is capped and must be JSON.
 */
export async function docApiJson(
  deps: AppDeps,
  context: RequestContext,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  options: { body?: unknown; timeoutMs?: number } = {},
): Promise<JsonResponse> {
  const headers: Record<string, string> = {
    'x-request-id': context.requestId,
    'user-agent': 'nexus-control-api',
    accept: 'application/json',
  };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  const response = await timedFetch(deps, `${deps.config.docApiUrl}/api/${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }, options.timeoutMs ?? 30_000, 'upstream');
  const text = await readCapped(response, MAX_JSON_RESPONSE);
  let json: unknown = null;
  if (text.length > 0) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { status: response.status, json };
}

export async function timedFetch(
  deps: AppDeps,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  kind: 'upstream' | 'object_storage',
): Promise<globalThis.Response> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(new Error('timeout')), timeoutMs);
  try {
    return await deps.fetch(url, { ...init, redirect: 'manual', signal: abort.signal } as RequestInit);
  } catch {
    const timedOut = abort.signal.aborted;
    if (kind === 'object_storage') throw new UpstreamFailure('object_storage_error');
    throw new UpstreamFailure(timedOut ? 'upstream_timeout' : 'upstream_unavailable');
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(response: globalThis.Response, maxBytes: number): Promise<string> {
  if (!response.body) return '';
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    total += chunk.length;
    if (total > maxBytes) {
      await response.body.cancel().catch(() => undefined);
      throw new UpstreamFailure('upstream_error', response.status);
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * A presigned object-storage URL from doc-api, accepted only when it points
 * at the configured internal object-storage origin (codex-minio). This keeps
 * control-api from being steered to arbitrary hosts by a doc-api response.
 */
export function objectStorageUrl(deps: AppDeps, raw: unknown): URL | null {
  if (typeof raw !== 'string' || raw.length > 8192) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.origin !== deps.config.objectStorageOrigin || url.username || url.password) return null;
  return url;
}
