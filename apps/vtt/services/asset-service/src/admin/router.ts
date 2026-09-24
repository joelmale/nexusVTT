import crypto from 'crypto';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import type { AdminViewStatus } from './catalog';
import type { AdminConfig } from './config';
import { AdminError } from './errors';
import type { AssetMetrics } from './metrics';
import { secretsMatch } from './metrics';
import { ASSET_ID_PATTERN } from './pathSafety';
import type { ActorContext, AdminAssetService } from './service';
import {
  parseBooleanFlag,
  parseCampaignIds,
  parseExpectedVersion,
  parseMetadataPatch,
  parseOptionalReason,
  parseUploadFields,
} from './validation';

/**
 * Internal asset-administration API, mounted at `/internal/admin`.
 *
 * Called only by control-api over the internal Docker network — never by a
 * browser, and never proxied by the VTT backend or the frontend gateway.
 * Every route requires:
 *
 *  - `x-nexus-admin-auth: <ASSET_ADMIN_SERVICE_SECRET>` (constant-time
 *    comparison). This is a credential distinct from `ASSET_SERVICE_SECRET`,
 *    which the internet-facing VTT backend also holds; it is never accepted
 *    here. When the admin secret is unset or shorter than 32 characters the
 *    API fails closed with 503.
 *  - a raw request path free of `..`, encoded `.`/`/`/`\` and `//`
 *    (defense in depth against gateway path confusion), and
 *  - `x-nexus-actor: <admin identity>`, echoed in every response and log
 *    line for audit correlation with the control-api audit record.
 *
 * Responses carry asset ids and relative storage keys only — never absolute
 * paths, NAS locations or the service secret.
 */

export const ACTOR_HEADER = 'x-nexus-actor';
export const AUTH_HEADER = 'x-nexus-admin-auth';
export const ADMIN_SECRET_ENV = 'ASSET_ADMIN_SERVICE_SECRET';
export const MIN_ADMIN_SECRET_LENGTH = 32;
/** `..`, percent-encoded `.`, `/` or `\`, and empty path segments. */
const UNSAFE_RAW_PATH = /\.\.|%2e|%2f|%5c|\/\//i;
const ACTOR_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@+-]{0,199}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const JOB_WAIT_MS = 30_000;
const STATUS_FILTERS = new Set(['active', 'quarantined', 'removed', 'deleted', 'all']);

interface AdminLocals {
  audit: ActorContext;
}

function audit(res: Response): ActorContext {
  return (res.locals as AdminLocals).audit;
}

function send(res: Response, status: number, body: Record<string, unknown>): void {
  res.status(status).json({ ...body, audit: audit(res) });
}

function assetIdParam(req: Request): string {
  const raw = req.params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (typeof id !== 'string' || !ASSET_ID_PATTERN.test(id)) {
    throw new AdminError(400, 'invalid-asset-id', 'Asset id is invalid');
  }
  return id;
}

function queryString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), 'utf8').toString('base64url');
}

function decodeCursor(cursor: unknown): number {
  if (typeof cursor !== 'string' || cursor.length === 0) return 0;
  const n = parseInt(Buffer.from(cursor, 'base64url').toString('utf8'), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function body(req: Request): Record<string, unknown> {
  const value: unknown = req.body;
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export interface AdminRouterDependencies {
  service: AdminAssetService;
  metrics: AssetMetrics;
  getConfig: () => AdminConfig;
}

export function createAdminRouter({
  service,
  metrics,
  getConfig,
}: AdminRouterDependencies): express.Router {
  const router = express.Router();

  // 0. Raw path hygiene, before any routing inside the admin API. Only the
  //    path is checked: query values (search terms) may legitimately
  //    contain dots or slashes and never influence routing.
  router.use((req, res, next) => {
    const raw = req.originalUrl;
    const queryIndex = raw.indexOf('?');
    const rawPath = queryIndex >= 0 ? raw.slice(0, queryIndex) : raw;
    if (UNSAFE_RAW_PATH.test(rawPath)) {
      req.resume();
      res.status(400).json({ error: 'invalid-path', message: 'Request path is not allowed' });
      return;
    }
    next();
  });

  // 1. Internal admin credential. Runs before any body buffering (multer)
  //    so unauthenticated uploads are rejected without being read.
  let warnedUnconfigured = false;
  router.use((req, res, next) => {
    const configured = process.env[ADMIN_SECRET_ENV];
    if (!configured || configured.length < MIN_ADMIN_SECRET_LENGTH) {
      if (!warnedUnconfigured) {
        warnedUnconfigured = true;
        console.error(
          JSON.stringify({
            event: 'asset-admin-disabled',
            reason: `${ADMIN_SECRET_ENV} is unset or shorter than ${MIN_ADMIN_SECRET_LENGTH} characters`,
          }),
        );
      }
      req.resume();
      res
        .status(503)
        .json({ error: 'admin-api-disabled', message: 'Asset administration is not configured' });
      return;
    }
    warnedUnconfigured = false;
    const supplied = req.get(AUTH_HEADER);
    if (!secretsMatch(supplied, configured)) {
      req.resume();
      res.status(401).json({ error: 'unauthorized', message: 'Service credential required' });
      return;
    }
    next();
  });

  // 2. Actor + request id for audit correlation.
  router.use((req, res, next) => {
    const actor = req.get(ACTOR_HEADER)?.trim();
    if (!actor || !ACTOR_PATTERN.test(actor)) {
      req.resume();
      res.status(400).json({
        error: 'actor-required',
        message: `A valid ${ACTOR_HEADER} header is required`,
      });
      return;
    }
    const suppliedRequestId = req.get('x-request-id')?.trim();
    const requestId =
      suppliedRequestId && REQUEST_ID_PATTERN.test(suppliedRequestId)
        ? suppliedRequestId
        : crypto.randomUUID();
    (res.locals as AdminLocals).audit = { actor, requestId };
    res.set('X-Nexus-Actor', actor);
    res.set('X-Request-Id', requestId);
    res.set('Cache-Control', 'no-store');
    const started = Date.now();
    res.on('finish', () => {
      console.log(
        JSON.stringify({
          event: 'asset-admin-request',
          actor,
          requestId,
          method: req.method,
          path: req.baseUrl + req.path,
          status: res.statusCode,
          durationMs: Date.now() - started,
        }),
      );
    });
    next();
  });

  // ---------------------------------------------------------------- browse
  router.get('/assets', (req, res) => {
    const status = queryString(req.query.status);
    if (status && !STATUS_FILTERS.has(status)) {
      throw new AdminError(400, 'invalid-query', 'Unknown status filter', { field: 'status' });
    }
    const origin = queryString(req.query.origin);
    if (origin && origin !== 'admin' && origin !== 'library') {
      throw new AdminError(400, 'invalid-query', 'Unknown origin filter', { field: 'origin' });
    }
    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit ?? ''), 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const tags = queryString(req.query.tags)
      ?.split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const result = service.list({
      q: queryString(req.query.q),
      category: queryString(req.query.category),
      tags,
      status: status as AdminViewStatus | 'all' | undefined,
      origin: origin as 'admin' | 'library' | undefined,
      limit,
      offset: decodeCursor(req.query.cursor),
    });
    send(res, 200, {
      assets: result.assets,
      total: result.total,
      limit: result.limit,
      cursor: result.nextOffset === null ? null : encodeCursor(result.nextOffset),
      hasMore: result.nextOffset !== null,
    });
  });

  router.get('/facets', (req, res) => {
    send(res, 200, service.facets());
  });

  router.get('/assets/:id', (req, res) => {
    const asset = service.get(assetIdParam(req));
    res.set('ETag', asset.etag);
    send(res, 200, { asset });
  });

  router.get('/assets/:id/preview', async (req, res, next) => {
    const variant = req.query.variant === 'original' ? 'original' : 'thumbnail';
    const file = await service.previewFile(assetIdParam(req), variant);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Security-Policy', "default-src 'none'");
    res.sendFile(file.absolutePath, { dotfiles: 'allow' }, (error) => {
      if (!error) return;
      if (res.headersSent) return;
      next(new AdminError(404, 'file-not-found', 'Preview file is missing', { key: file.key }));
    });
  });

  // ---------------------------------------------------------------- upload
  router.post('/assets', async (req, res) => {
    if (!req.is('multipart/form-data')) {
      req.resume();
      throw new AdminError(415, 'multipart-required', 'Upload must be multipart/form-data');
    }
    const config = getConfig();
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: config.maxUploadBytes,
        files: 1,
        fields: 20,
        fieldSize: 64 * 1024,
        parts: 25,
      },
    }).single('file');
    try {
      await new Promise<void>((resolve, reject) => {
        upload(req, res, (error: unknown) => (error ? reject(error) : resolve()));
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      metrics.uploads.inc('rejected');
      if (code === 'LIMIT_FILE_SIZE') {
        metrics.uploadRejections.inc('file-too-large');
        throw new AdminError(413, 'file-too-large', 'Uploaded file exceeds the size limit', {
          maxBytes: config.maxUploadBytes,
        });
      }
      metrics.uploadRejections.inc('invalid-multipart');
      throw new AdminError(400, 'invalid-multipart', 'Multipart body is invalid', {
        reason: code ?? 'malformed',
      });
    }
    if (!req.file) {
      throw new AdminError(400, 'file-required', 'A single "file" part is required');
    }
    const fields = parseUploadFields(req.body);
    const force = parseBooleanFlag(body(req).force) || parseBooleanFlag(req.query.force);
    const result = await service.upload({
      buffer: req.file.buffer,
      originalFilename: req.file.originalname,
      fields,
      force,
      context: audit(res),
    });
    res.set('ETag', result.asset.etag);
    send(res, result.duplicate ? 200 : 201, result);
  });

  // -------------------------------------------------------------- metadata
  router.patch('/assets/:id', async (req, res) => {
    const id = assetIdParam(req);
    const expectedVersion = parseExpectedVersion(req.body, req.get('if-match'), id);
    const patch = parseMetadataPatch(req.body);
    const asset = await service.updateMetadata(id, expectedVersion, patch, audit(res));
    res.set('ETag', asset.etag);
    send(res, 200, { asset });
  });

  // ----------------------------------------------------------- derivatives
  router.post('/assets/:id/derivatives', async (req, res) => {
    const asset = await service.regenerateDerivative(assetIdParam(req), audit(res));
    res.set('ETag', asset.etag);
    send(res, 200, { asset });
  });

  // ------------------------------------------------- quarantine and delete
  router.post('/assets/:id/delete-preview', (req, res) => {
    const ids = parseCampaignIds(body(req).referencingCampaignIds);
    send(res, 200, service.deletePreview(assetIdParam(req), ids));
  });

  router.post('/assets/:id/quarantine', async (req, res) => {
    const id = assetIdParam(req);
    const payload = body(req);
    const result = await service.quarantine(
      id,
      {
        expectedVersion: parseExpectedVersion(payload, req.get('if-match'), id),
        reason: parseOptionalReason(payload.reason),
        referencingCampaignIds: parseCampaignIds(payload.referencingCampaignIds),
        acknowledgeReferences: payload.acknowledgeReferences === true,
      },
      audit(res),
    );
    res.set('ETag', result.asset.etag);
    send(res, 200, result);
  });

  router.post('/assets/:id/restore', async (req, res) => {
    const id = assetIdParam(req);
    const expectedVersion = parseExpectedVersion(req.body, req.get('if-match'), id);
    const result = await service.restore(id, expectedVersion, audit(res));
    res.set('ETag', result.asset.etag);
    send(res, 200, result);
  });

  router.post('/assets/:id/permanent-delete', async (req, res) => {
    const id = assetIdParam(req);
    const payload = body(req);
    const result = await service.permanentlyDelete(
      id,
      {
        expectedVersion: parseExpectedVersion(payload, req.get('if-match'), id),
        confirm: payload.confirm === true,
      },
      audit(res),
    );
    send(res, 200, result);
  });

  // ------------------------------------------------------------------ jobs
  async function respondWithJob(
    res: Response,
    started: { job: { status: string }; alreadyRunning: boolean; done: Promise<void> },
    wait: boolean,
  ): Promise<void> {
    if (wait) {
      let timer: NodeJS.Timeout | undefined;
      await Promise.race([
        started.done,
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, JOB_WAIT_MS);
        }),
      ]);
      if (timer) clearTimeout(timer);
    }
    const status = started.job.status === 'running' ? 202 : 200;
    send(res, status, { job: started.job, alreadyRunning: started.alreadyRunning });
  }

  router.post('/jobs/manifest-rebuild', async (req, res) => {
    const started = service.startManifestRebuild(audit(res));
    await respondWithJob(res, started, parseBooleanFlag(req.query.wait));
  });

  router.post('/jobs/integrity-report', async (req, res) => {
    const payload = body(req);
    const verifyHashes =
      payload.verifyHashes === undefined
        ? getConfig().integrityVerifyHashes
        : payload.verifyHashes === true;
    const started = service.startIntegrityReport(audit(res), verifyHashes);
    await respondWithJob(res, started, parseBooleanFlag(req.query.wait));
  });

  router.get('/jobs', (req, res) => {
    send(res, 200, { jobs: service.jobs.list() });
  });

  router.get('/jobs/:jobId', (req, res) => {
    const raw = req.params.jobId;
    const jobId = Array.isArray(raw) ? raw[0] : raw;
    const job = typeof jobId === 'string' ? service.jobs.get(jobId) : undefined;
    if (!job) throw new AdminError(404, 'job-not-found', 'Job not found');
    send(res, 200, { job });
  });

  router.get('/integrity', (req, res) => {
    const report = service.getLatestIntegrityReport();
    if (!report) {
      throw new AdminError(404, 'no-report', 'No integrity report has run yet');
    }
    send(res, 200, { report });
  });

  // -------------------------------------------------------- fallthroughs
  router.use((req, res) => {
    send(res, 404, { error: 'not-found', message: 'Unknown admin route' });
  });

  router.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    void _next;
    if (res.headersSent) return;
    const locals = res.locals as Partial<AdminLocals>;
    const respond = (status: number, payload: Record<string, unknown>) => {
      if (locals.audit) send(res, status, payload);
      else res.status(status).json(payload);
    };
    if (error instanceof AdminError) {
      respond(error.status, {
        error: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      });
      return;
    }
    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      // body-parser and similar client errors: report the class, not the text.
      respond(status, { error: 'bad-request', message: 'Request could not be parsed' });
      return;
    }
    console.error(
      JSON.stringify({
        event: 'asset-admin-error',
        actor: locals.audit?.actor,
        requestId: locals.audit?.requestId,
        code: (error as NodeJS.ErrnoException)?.code ?? (error as Error)?.name ?? 'unknown',
      }),
    );
    respond(500, { error: 'internal-error', message: 'Internal error' });
  });

  return router;
}
