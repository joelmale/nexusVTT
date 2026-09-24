import { Readable, Transform } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import type { Request, RequestHandler, Response } from 'express';
import type { AppDeps } from '../deps.js';
import { auditEvent, ctx, sendError, type RequestContext } from '../http/context.js';
import { authorize, type Authorization } from '../http/guard.js';
import type { Role } from '../permissions.js';
import type { AuditOutcome } from '../store/types.js';
import type { ActorStamp, ProxyRoute, RouteMatch, RouteTable } from './routeTable.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const RANGE = /^bytes=\d{0,15}-\d{0,15}$/;
/** A single entity tag (`"x"`, `W/"x"`) or a bare revision number. */
const ENTITY_TAG = /^(?:(?:W\/)?"[\x21\x23-\x7e]{0,128}"|\d{1,12})$/;
const ACCEPT = /^[A-Za-z0-9*/+.,;= -]{1,256}$/;
/** Response headers copied from the upstream; everything else is dropped. */
const RESPONSE_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'content-disposition', 'etag', 'last-modified'];
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
/** Upstream types a document may be viewed inline as; anything else is a download. */
const INLINE_DOCUMENT_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'text/plain']);
const CHARSET = /;\s*charset="?([A-Za-z0-9._-]{1,40})"?\s*(?:;|$)/i;
/**
 * Non-PDF inline documents: a sandboxed, script-free opaque origin that can
 * still show an image or plain text.
 */
export const INLINE_DOCUMENT_CSP = "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; object-src 'self'";
/**
 * PDFs: Chromium refuses to start its built-in PDF viewer in a sandboxed
 * document (CSP `sandbox` without `allow-plugins` blocks it) and Firefox's
 * pdf.js needs scripts the sandbox forbids, so PDFs get no `sandbox`. The
 * viewers are browser-internal; the page itself still runs no scripts and
 * loads nothing (`default-src 'none'`).
 */
export const INLINE_PDF_CSP = "default-src 'none'; object-src 'self'; frame-ancestors 'self'";
/** Largest upstream error body relayed to the browser unchanged. */
const MAX_ERROR_BODY = 256 * 1024;

export class BodyTooLarge extends Error {}
export class BadRequest extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

/** Maps an upstream status to the browser-facing status and error code. */
export function normalizeUpstreamError(status: number): { status: number; error: string } {
  if (status === 400 || status === 422) return { status, error: 'invalid_request' };
  if (status === 404) return { status: 404, error: 'not_found' };
  if (status === 409) return { status: 409, error: 'conflict' };
  if (status === 413) return { status: 413, error: 'payload_too_large' };
  if (status === 429) return { status: 429, error: 'rate_limited' };
  // The upstream refusing control-api (401/403), redirects, and 5xx are our
  // dependency's problem, not the browser's request.
  if (status === 401 || status === 403 || status < 400 || status >= 500) {
    return { status: 502, error: 'upstream_error' };
  }
  return { status: 400, error: 'invalid_request' };
}

export function outcomeFor(status: number): AuditOutcome {
  if (status >= 200 && status < 300) return 'success';
  if (status === 409) return 'conflict';
  return 'failure';
}

export function validateQuery(route: ProxyRoute, rawQuery: string): URLSearchParams {
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

export function declaredLength(req: Request): number | null {
  const header = req.headers['content-length'];
  return header && /^\d+$/.test(header) ? Number(header) : null;
}

export function hasBody(req: Request): boolean {
  const length = declaredLength(req);
  return (length !== null && length > 0) || req.headers['transfer-encoding'] !== undefined;
}

function stampActor(record: Record<string, unknown>, stamp: ActorStamp, userId: string): void {
  if (stamp === 'userId') {
    record.userId = userId;
    return;
  }
  const documents = record.documents;
  if (!Array.isArray(documents)) return;
  for (const item of documents) {
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
      (item as Record<string, unknown>).uploadedBy = userId;
    }
  }
}

export interface PreparedBody {
  body?: Buffer | ReadableStream<Uint8Array>;
  contentType?: string;
  fields?: string[];
  auditValues?: Record<string, unknown>;
  overflow?: () => boolean;
}

export async function prepareBody(req: Request, route: ProxyRoute, userId: string): Promise<PreparedBody> {
  const rule = route.body;
  if (rule.kind === 'none') {
    if (hasBody(req)) throw new BadRequest(400, 'unexpected_body');
    return {};
  }
  const length = declaredLength(req);
  if (length !== null && length > rule.maxBytes) throw new BodyTooLarge();
  const contentType = req.headers['content-type'] ?? '';

  if (rule.kind === 'json') {
    if (rule.optional && !hasBody(req)) return {};
    if (!/^application\/json(\s*;\s*charset=utf-8)?$/i.test(contentType.trim())) {
      throw new BadRequest(415, 'unsupported_media_type');
    }
    const raw = await readLimited(req, rule.maxBytes);
    if (rule.optional && raw.length === 0) return {};
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
    const fields = Object.keys(record).sort().slice(0, 50);
    let body = raw;
    if (route.stampActor && !Array.isArray(parsed)) {
      stampActor(record, route.stampActor, userId);
      body = Buffer.from(JSON.stringify(record), 'utf8');
    }
    return { body, contentType: 'application/json', fields, auditValues };
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

/** Everything a route-specific handler needs after authorization. */
export interface HandlerContext {
  deps: AppDeps;
  req: Request;
  res: Response;
  context: RequestContext;
  match: RouteMatch;
  authz: Authorization;
  rawQuery: string;
  resourceId: string | null;
  audit: (outcome: AuditOutcome, summary: Record<string, unknown>, extra?: { resourceId?: string | null }) => Promise<void>;
  baseSummary: Record<string, unknown>;
}

export type RouteHandler = (hc: HandlerContext) => Promise<void>;

export interface ProxySpec {
  /** Short upstream name for logs ("doc-api", "asset-service", "rules"). */
  upstreamName: string;
  /** Full browser path prefix up to and including the trailing slash. */
  prefix: string;
  table: (deps: AppDeps) => RouteTable;
  /** Absolute upstream URL for a validated path and query string. */
  upstreamUrl: (deps: AppDeps, upstreamPath: string, search: string) => string;
  /** Service credentials and actor headers added to every upstream request. */
  upstreamHeaders?: (deps: AppDeps, context: RequestContext) => Record<string, string>;
  /**
   * Upstream error statuses whose JSON body is relayed unchanged (typed
   * service errors such as a 409 carrying the current head). Everything else
   * is normalized to `{ error, requestId }`.
   */
  passthroughErrors?: ReadonlySet<number>;
  handlers?: Readonly<Record<string, RouteHandler>>;
}

function numericVersion(value: unknown): string | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return String(value);
  return null;
}

async function relayErrorBody(upstream: globalThis.Response): Promise<Buffer | null> {
  const type = upstream.headers.get('content-type') ?? '';
  if (!/^application\/json\b/i.test(type) || !upstream.body) return null;
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of upstream.body as unknown as AsyncIterable<Uint8Array>) {
    total += chunk.length;
    if (total > MAX_ERROR_BODY) return null;
    chunks.push(Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks);
  try {
    JSON.parse(raw.toString('utf8'));
  } catch {
    return null;
  }
  return raw;
}

/**
 * Builds the Express handler for one allowlisted upstream. Order: allowlist
 * lookup (404 without contacting anything), authorization (Origin, session,
 * CSRF, permission, recent auth; denials audited), query and body validation,
 * then the upstream call. Mutations are audited once with the outcome.
 */
export function allowlistProxy(deps: AppDeps, spec: ProxySpec): RequestHandler {
  const table = spec.table(deps);
  return async (req, res) => {
    const context = ctx(res);
    if (!req.originalUrl.startsWith(spec.prefix)) return sendError(res, 404, 'not_found');
    const rest = req.originalUrl.slice(spec.prefix.length);
    const queryIndex = rest.indexOf('?');
    const rawPath = queryIndex >= 0 ? rest.slice(0, queryIndex) : rest;
    const rawQuery = queryIndex >= 0 ? rest.slice(queryIndex + 1) : '';

    const lookup = table.lookup(req.method, rawPath);
    if (lookup.kind === 'not_found') return sendError(res, 404, 'not_found');
    const match = lookup.match;
    const { route, params, upstreamPath } = match;
    const resourceId = params.id ?? params.batchId ?? params.jobId ?? null;

    const authz = await authorize(deps, req, res, {
      permission: route.permission,
      recentAuth: route.recentAuth,
      action: route.action,
      resourceType: route.resourceType,
      resourceId,
    });
    if (!authz) return;

    let priorVersion: string | null = null;
    const audit = async (outcome: AuditOutcome, summary: Record<string, unknown>, extra: { resourceId?: string | null } = {}) => {
      if (!route.audited) return;
      const roleUsed: Role | null = authz.roleUsed;
      await deps.store.appendAudit({
        ...auditEvent(res, { action: route.action, outcome, resourceType: route.resourceType, resourceId: extra.resourceId ?? resourceId, roleUsed, summary }),
        priorVersion,
      });
    };
    const baseSummary: Record<string, unknown> = { method: route.method, route: route.path };

    if (route.handler) {
      const handler = spec.handlers?.[route.handler];
      if (!handler) throw new Error(`No handler registered for ${route.handler}`);
      await handler({ deps, req, res, context, match, authz, rawQuery, resourceId, audit, baseSummary });
      return;
    }

    const headers: Record<string, string> = {
      'x-request-id': context.requestId,
      'user-agent': 'nexus-control-api',
      accept: typeof req.headers.accept === 'string' && ACCEPT.test(req.headers.accept) ? req.headers.accept : 'application/json',
    };

    let query: URLSearchParams;
    let prepared: PreparedBody;
    try {
      query = validateQuery(route, rawQuery);
      for (const name of route.forwardHeaders ?? []) {
        const value = req.headers[name];
        if (value === undefined) continue;
        const valid = typeof value === 'string' && (name === 'range' ? RANGE.test(value) : ENTITY_TAG.test(value.trim()));
        if (!valid) {
          // A malformed Range is ignored (full response); a malformed
          // precondition must not silently become an unconditional write.
          if (name === 'range') continue;
          throw new BadRequest(400, 'invalid_precondition');
        }
        headers[name] = name === 'range' ? value : value.trim();
        if (name === 'if-match') priorVersion = value.trim().slice(0, 140);
      }
      prepared = await prepareBody(req, route, context.admin!.user.id);
    } catch (error) {
      const status = error instanceof BodyTooLarge ? 413 : error instanceof BadRequest ? error.status : 400;
      const code = error instanceof BodyTooLarge ? 'payload_too_large' : error instanceof BadRequest ? error.code : 'invalid_request';
      await audit('failure', { ...baseSummary, reason: code });
      if (status === 413) res.setHeader('Connection', 'close');
      return sendError(res, status, code);
    }
    if (route.audited && [...query.keys()].length > 0) baseSummary.query = Object.fromEntries(query);
    if (prepared.fields) baseSummary.fields = prepared.fields;
    if (prepared.auditValues && Object.keys(prepared.auditValues).length > 0) {
      baseSummary.values = prepared.auditValues;
      priorVersion ??= numericVersion(prepared.auditValues.expectedRevisionNumber) ?? numericVersion(prepared.auditValues.expectedVersion);
    }

    Object.assign(headers, spec.upstreamHeaders?.(deps, context) ?? {});
    if (prepared.contentType) headers['content-type'] = prepared.contentType;

    const url = spec.upstreamUrl(deps, upstreamPath, query.toString());
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
        await audit('failure', { ...baseSummary, reason: 'payload_too_large' });
        res.setHeader('Connection', 'close');
        return sendError(res, 413, 'payload_too_large');
      }
      const timedOut = abort.signal.aborted && (abort.signal.reason as Error | undefined)?.message === 'timeout';
      deps.logger.warn(`${spec.upstreamName} request failed`, { requestId: context.requestId, route: route.path, timedOut, error });
      await audit('failure', { ...baseSummary, reason: timedOut ? 'upstream_timeout' : 'upstream_unavailable' });
      return sendError(res, timedOut ? 504 : 502, timedOut ? 'upstream_timeout' : 'upstream_unavailable');
    }

    if (upstream.status === 304 && route.method === 'GET') {
      clearTimeout(timeout);
      await upstream.body?.cancel().catch(() => undefined);
      const etag = upstream.headers.get('etag');
      if (etag) res.setHeader('ETag', etag);
      return res.status(304).end();
    }

    if (upstream.status >= 300) {
      let relayed: Buffer | null = null;
      try {
        if (spec.passthroughErrors?.has(upstream.status)) relayed = await relayErrorBody(upstream);
      } catch {
        relayed = null;
      }
      clearTimeout(timeout);
      await upstream.body?.cancel().catch(() => undefined);
      if (upstream.status >= 500 || upstream.status < 400) {
        deps.logger.warn(`${spec.upstreamName} error`, { requestId: context.requestId, route: route.path, status: upstream.status });
      }
      await audit(outcomeFor(upstream.status), { ...baseSummary, upstreamStatus: upstream.status });
      if (relayed) {
        const etag = upstream.headers.get('etag');
        if (etag) res.setHeader('ETag', etag);
        res.status(upstream.status).type('application/json').send(relayed);
        return;
      }
      const normalized = normalizeUpstreamError(upstream.status);
      return sendError(res, normalized.status, normalized.error);
    }

    const upstreamType = (upstream.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    if (route.response === 'image' && !IMAGE_TYPES.has(upstreamType)) {
      clearTimeout(timeout);
      await upstream.body?.cancel().catch(() => undefined);
      deps.logger.warn(`${spec.upstreamName} returned a non-image preview`, { requestId: context.requestId, route: route.path });
      return sendError(res, 502, 'upstream_error');
    }

    await audit('success', { ...baseSummary, upstreamStatus: upstream.status });
    res.status(upstream.status);
    for (const name of RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value !== null) res.setHeader(name, value);
    }
    if (route.response === 'inlineDocument') setInlineDocumentHeaders(res, upstream.headers.get('content-type') ?? '');
    if (route.response === 'image') setImageHeaders(res, upstreamType);
    if (!upstream.body) {
      clearTimeout(timeout);
      return res.end();
    }
    pipeUpstream(deps, context, spec.upstreamName, route.path, upstream.body, res, () => clearTimeout(timeout));
  };
}

/**
 * Headers for a document opened in a browser tab. Only the listed types are
 * shown inline (the charset of `text/plain` is kept); anything else, such as
 * HTML or SVG from an upload, becomes an `application/octet-stream`
 * attachment so it can never render on the admin origin.
 */
export function setInlineDocumentHeaders(res: Response, upstreamContentType: string): void {
  const mediaType = upstreamContentType.split(';')[0]!.trim().toLowerCase();
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!INLINE_DOCUMENT_TYPES.has(mediaType)) {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment');
    res.setHeader('Content-Security-Policy', INLINE_DOCUMENT_CSP);
    return;
  }
  const charset = mediaType === 'text/plain' ? CHARSET.exec(upstreamContentType)?.[1] : undefined;
  res.setHeader('Content-Type', charset ? `${mediaType}; charset=${charset}` : mediaType);
  res.setHeader('Content-Security-Policy', mediaType === 'application/pdf' ? INLINE_PDF_CSP : INLINE_DOCUMENT_CSP);
}

/** Headers for an image served to the Admin UI (`<img src>`), never a document. */
export function setImageHeaders(res: Response, contentType: string): void {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; sandbox");
}

export function isImageType(value: string): boolean {
  return IMAGE_TYPES.has(value);
}

export function pipeUpstream(
  deps: AppDeps,
  context: RequestContext,
  upstreamName: string,
  routePath: string,
  stream: globalThis.ReadableStream<Uint8Array>,
  res: Response,
  onClose: () => void,
): void {
  const body = Readable.fromWeb(stream as NodeReadableStream<Uint8Array>);
  body.on('error', (error) => {
    deps.logger.warn(`${upstreamName} response stream failed`, { requestId: context.requestId, route: routePath, error });
    res.destroy();
  });
  body.on('close', onClose);
  body.pipe(res);
}
