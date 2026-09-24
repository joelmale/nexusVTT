import { Readable, Transform } from 'node:stream';
import type { Request, RequestHandler } from 'express';
import { API_PREFIX, type AppDeps } from '../deps.js';
import { auditEvent, ctx, sendError } from '../http/context.js';
import { authorize } from '../http/guard.js';
import type { Role } from '../permissions.js';
import type { AuditOutcome } from '../store/types.js';
import type { CodexRoute, RouteMatch } from './allowlist.js';

export const CODEX_PREFIX = `${API_PREFIX}/codex/`;

const DEFAULT_TIMEOUT_MS = 30_000;
const RANGE = /^bytes=\d{0,15}-\d{0,15}$/;
const ACCEPT = /^[A-Za-z0-9*/+.,;= -]{1,256}$/;
/** Response headers copied from doc-api; everything else is dropped. */
const RESPONSE_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'content-disposition', 'etag', 'last-modified'];

class BodyTooLarge extends Error {}
class BadRequest extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

/** Maps a doc-api status to the browser-facing status and error code. */
export function normalizeUpstreamError(status: number): { status: number; error: string } {
  if (status === 400 || status === 422) return { status, error: 'invalid_request' };
  if (status === 404) return { status: 404, error: 'not_found' };
  if (status === 409) return { status: 409, error: 'conflict' };
  if (status === 413) return { status: 413, error: 'payload_too_large' };
  if (status === 429) return { status: 429, error: 'rate_limited' };
  // doc-api refusing control-api (401/403), redirects, and 5xx are our
  // dependency's problem, not the browser's request.
  if (status === 401 || status === 403 || status < 400 || status >= 500) {
    return { status: 502, error: 'upstream_error' };
  }
  return { status: 400, error: 'invalid_request' };
}

function outcomeFor(status: number): AuditOutcome {
  if (status >= 200 && status < 300) return 'success';
  if (status === 409) return 'conflict';
  return 'failure';
}

function validateQuery(route: CodexRoute, rawQuery: string): URLSearchParams {
  const incoming = new URLSearchParams(rawQuery);
  const outgoing = new URLSearchParams();
  const seen = new Set<string>();
  for (const [key, value] of incoming) {
    const pattern = route.query[key];
    if (!Object.hasOwn(route.query, key) || !pattern || seen.has(key) || !pattern.test(value)) {
      throw new BadRequest(400, 'invalid_query');
    }
    seen.add(key);
    outgoing.append(key, value);
  }
  return outgoing;
}

async function readLimited(req: Request, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    total += chunk.length;
    if (total > maxBytes) throw new BodyTooLarge();
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function declaredLength(req: Request): number | null {
  const header = req.headers['content-length'];
  return header && /^\d+$/.test(header) ? Number(header) : null;
}

function hasBody(req: Request): boolean {
  const length = declaredLength(req);
  return (length !== null && length > 0) || req.headers['transfer-encoding'] !== undefined;
}

interface PreparedBody {
  body?: Buffer | ReadableStream<Uint8Array>;
  contentType?: string;
  fields?: string[];
  auditValues?: Record<string, unknown>;
  overflow?: () => boolean;
}

async function prepareBody(req: Request, route: CodexRoute): Promise<PreparedBody> {
  const rule = route.body;
  if (rule.kind === 'none') {
    if (hasBody(req)) throw new BadRequest(400, 'unexpected_body');
    return {};
  }
  const length = declaredLength(req);
  if (length !== null && length > rule.maxBytes) throw new BodyTooLarge();
  const contentType = req.headers['content-type'] ?? '';

  if (rule.kind === 'json') {
    if (!/^application\/json(\s*;\s*charset=utf-8)?$/i.test(contentType.trim())) {
      throw new BadRequest(415, 'unsupported_media_type');
    }
    const raw = await readLimited(req, rule.maxBytes);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString('utf8'));
    } catch {
      throw new BadRequest(400, 'invalid_json');
    }
    if (parsed === null || typeof parsed !== 'object') throw new BadRequest(400, 'invalid_json');
    const record = Array.isArray(parsed) ? {} : (parsed as Record<string, unknown>);
    const auditValues: Record<string, unknown> = {};
    for (const key of route.auditBodyKeys ?? []) {
      if (Object.hasOwn(record, key)) auditValues[key] = record[key];
    }
    return {
      body: raw,
      contentType: 'application/json',
      fields: Object.keys(record).sort().slice(0, 50),
      auditValues,
    };
  }

  // Streamed body (multipart upload): forwarded as it arrives, capped in flight.
  const mediaType = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!rule.contentTypes.includes(mediaType) || !/^[\x20-\x7e]{1,512}$/.test(contentType)) {
    throw new BadRequest(415, 'unsupported_media_type');
  }
  let total = 0;
  let exceeded = false;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      total += chunk.length;
      if (total > rule.maxBytes) {
        exceeded = true;
        callback(new BodyTooLarge());
        return;
      }
      callback(null, chunk);
    },
  });
  req.pipe(counter);
  return {
    body: Readable.toWeb(counter) as ReadableStream<Uint8Array>,
    contentType,
    overflow: () => exceeded,
  };
}

export function codexProxy(deps: AppDeps): RequestHandler {
  return async (req, res) => {
    const context = ctx(res);
    if (!req.originalUrl.startsWith(CODEX_PREFIX)) return sendError(res, 404, 'not_found');
    const rest = req.originalUrl.slice(CODEX_PREFIX.length);
    const queryIndex = rest.indexOf('?');
    const rawPath = queryIndex >= 0 ? rest.slice(0, queryIndex) : rest;
    const rawQuery = queryIndex >= 0 ? rest.slice(queryIndex + 1) : '';

    const lookup = deps.codexRoutes.lookup(req.method, rawPath);
    if (lookup.kind === 'not_found') return sendError(res, 404, 'not_found');
    const { route, params, upstreamPath }: RouteMatch = lookup.match;
    const resourceId = params.id ?? params.batchId ?? null;

    const authz = await authorize(deps, req, res, {
      permission: route.permission,
      recentAuth: route.recentAuth,
      action: route.action,
      resourceType: route.resourceType,
      resourceId,
    });
    if (!authz) return;

    const audit = async (outcome: AuditOutcome, summary: Record<string, unknown>, roleUsed: Role | null) => {
      if (!route.audited) return;
      await deps.store.appendAudit(
        auditEvent(res, { action: route.action, outcome, resourceType: route.resourceType, resourceId, roleUsed, summary }),
      );
    };
    const baseSummary: Record<string, unknown> = { method: route.method, route: route.path };

    let query: URLSearchParams;
    let prepared: PreparedBody;
    try {
      query = validateQuery(route, rawQuery);
      prepared = await prepareBody(req, route);
    } catch (error) {
      const status = error instanceof BodyTooLarge ? 413 : error instanceof BadRequest ? error.status : 400;
      const code = error instanceof BodyTooLarge ? 'payload_too_large' : error instanceof BadRequest ? error.code : 'invalid_request';
      await audit('failure', { ...baseSummary, reason: code }, authz.roleUsed);
      if (status === 413) res.setHeader('Connection', 'close');
      return sendError(res, status, code);
    }
    if (route.audited && [...query.keys()].length > 0) baseSummary.query = Object.fromEntries(query);
    if (prepared.fields) baseSummary.fields = prepared.fields;
    if (prepared.auditValues && Object.keys(prepared.auditValues).length > 0) baseSummary.values = prepared.auditValues;

    const headers: Record<string, string> = {
      'x-request-id': context.requestId,
      'user-agent': 'nexus-control-api',
      accept: typeof req.headers.accept === 'string' && ACCEPT.test(req.headers.accept) ? req.headers.accept : 'application/json',
    };
    if (prepared.contentType) headers['content-type'] = prepared.contentType;
    if (route.forwardHeaders?.includes('range') && typeof req.headers.range === 'string' && RANGE.test(req.headers.range)) {
      headers.range = req.headers.range;
    }

    const search = query.toString();
    const url = `${deps.config.docApiUrl}/api/${upstreamPath}${search ? `?${search}` : ''}`;
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(new Error('timeout')), route.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    res.on('close', () => {
      if (!res.writableFinished) abort.abort(new Error('client closed'));
    });

    let upstream: globalThis.Response;
    try {
      upstream = await deps.fetch(url, {
        method: route.method,
        headers,
        body: prepared.body,
        redirect: 'manual',
        signal: abort.signal,
        ...(prepared.body instanceof ReadableStream ? { duplex: 'half' } : {}),
      } as RequestInit);
    } catch (error) {
      clearTimeout(timeout);
      if (prepared.overflow?.()) {
        await audit('failure', { ...baseSummary, reason: 'payload_too_large' }, authz.roleUsed);
        res.setHeader('Connection', 'close');
        return sendError(res, 413, 'payload_too_large');
      }
      const timedOut = abort.signal.aborted && (abort.signal.reason as Error | undefined)?.message === 'timeout';
      deps.logger.warn('doc-api request failed', { requestId: context.requestId, route: route.path, timedOut, error });
      await audit('failure', { ...baseSummary, reason: timedOut ? 'upstream_timeout' : 'upstream_unavailable' }, authz.roleUsed);
      return sendError(res, timedOut ? 504 : 502, timedOut ? 'upstream_timeout' : 'upstream_unavailable');
    }

    if (upstream.status >= 300) {
      clearTimeout(timeout);
      await upstream.body?.cancel().catch(() => undefined);
      const normalized = normalizeUpstreamError(upstream.status);
      if (upstream.status >= 500 || upstream.status < 400) {
        deps.logger.warn('doc-api error', { requestId: context.requestId, route: route.path, status: upstream.status });
      }
      await audit(outcomeFor(upstream.status), { ...baseSummary, upstreamStatus: upstream.status }, authz.roleUsed);
      return sendError(res, normalized.status, normalized.error);
    }

    await audit('success', { ...baseSummary, upstreamStatus: upstream.status }, authz.roleUsed);
    res.status(upstream.status);
    for (const name of RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value !== null) res.setHeader(name, value);
    }
    if (route.inlineDocument) {
      res.setHeader('Content-Security-Policy', "default-src 'none'; object-src 'self'; frame-ancestors 'none'");
    }
    if (!upstream.body) {
      clearTimeout(timeout);
      return res.end();
    }
    const body = Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream<Uint8Array>);
    body.on('error', (error) => {
      deps.logger.warn('doc-api response stream failed', { requestId: context.requestId, route: route.path, error });
      res.destroy();
    });
    body.on('close', () => clearTimeout(timeout));
    body.pipe(res);
  };
}
