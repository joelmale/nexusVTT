import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler, type Express, type RequestHandler } from 'express';
import helmet from 'helmet';
import { assetsProxy } from './assets/proxy.js';
import { codexProxy } from './codex/proxy.js';
import { API_PREFIX, type AppDeps } from './deps.js';
import { bodyDeadline } from './http/bodyDeadline.js';
import { ctx, sendError, type RequestContext } from './http/context.js';
import { apiRateLimit, loadSession } from './http/guard.js';
import { adminRouter } from './routes/admin.js';
import { loginRouter, logoutRouter } from './routes/auth.js';
import { operationsRouter } from './operations/summary.js';
import { rulesProxy } from './rules/proxy.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** nginx `$request_id`: 16 random bytes as 32 lowercase hex characters. */
const NGINX_REQUEST_ID = /^[0-9a-f]{32}$/;

/** Reuses the gateway's request ID when it is a UUID or an nginx `$request_id`. */
export function inboundRequestId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (UUID.test(value)) return value.toLowerCase();
  return NGINX_REQUEST_ID.test(value) ? value : null;
}
const READINESS_TIMEOUT_MS = 2_000;
/** Routes whose request body may take `UPLOAD_BODY_DEADLINE_MS` to arrive. */
export const LONG_BODY_ROUTES: ReadonlySet<string> = new Set([`POST ${API_PREFIX}/codex/documents/upload`]);

function requestContext(deps: AppDeps): RequestHandler {
  return (req, res, next) => {
    const inbound = req.headers['x-request-id'];
    const requestId = inboundRequestId(inbound) ?? randomUUID();
    const context: RequestContext = {
      requestId,
      sourceIp: req.ip ?? null,
      sessionState: 'none',
      sessionPresented: false,
      admin: null,
    };
    res.locals.ctx = context;
    res.setHeader('X-Request-Id', requestId);
    const started = process.hrtime.bigint();
    // Path only (captured before routers rewrite req.url): query strings can carry search terms.
    const path = req.path;
    res.on('finish', () => {
      const probe = (path === '/healthz' || path === '/readyz') && res.statusCode === 200;
      deps.logger[probe ? 'debug' : 'info']('request', {
        requestId,
        method: req.method,
        path,
        status: res.statusCode,
        durationMs: Number((process.hrtime.bigint() - started) / 1_000_000n),
        userId: context.admin?.user.id,
      });
    });
    next();
  };
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', deps.config.trustProxyHops);
  app.set('case sensitive routing', true);
  app.set('strict routing', true);
  app.set('query parser', 'simple');

  app.use(requestContext(deps));
  app.use(
    bodyDeadline({
      logger: deps.logger,
      longBodyRoutes: LONG_BODY_ROUTES,
      deadlineMs: deps.config.bodyDeadlineMs,
      longDeadlineMs: deps.config.uploadBodyDeadlineMs,
      idleTimeoutMs: deps.config.bodyIdleTimeoutMs,
    }),
  );
  app.use(
    helmet({
      contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-origin' },
      strictTransportSecurity: false, // owned by the TLS-terminating proxy
    }),
  );

  app.get('/healthz', (_req, res) => {
    res.type('text/plain').send('ok');
  });
  app.get('/readyz', async (_req, res) => {
    try {
      await Promise.race([
        deps.store.ping(),
        new Promise((_resolve, reject) => setTimeout(() => reject(new Error('timeout')), READINESS_TIMEOUT_MS).unref()),
      ]);
      res.type('text/plain').send('ok');
    } catch (error) {
      deps.logger.warn('readiness check failed', { error });
      res.status(503).type('text/plain').send('unavailable');
    }
  });

  const api = express.Router({ caseSensitive: true, strict: true });
  api.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    // No CORS: the Admin UI is same-origin, so preflights are never answered.
    if (req.method === 'OPTIONS') return sendError(res, 404, 'not_found');
    next();
  });
  // Login and callback carry their own per-client login limit and no session.
  api.use(loginRouter(deps));
  api.use(loadSession(deps));
  api.use(apiRateLimit(deps));
  api.use(logoutRouter(deps));
  api.use(adminRouter(deps));
  api.use(operationsRouter(deps));
  api.use('/codex', codexProxy(deps));
  api.use('/assets', assetsProxy(deps));
  api.use('/rules', rulesProxy(deps));
  api.use((_req, res) => sendError(res, 404, 'not_found'));
  app.use(API_PREFIX, api);

  app.use((_req, res) => {
    res.status(404).type('text/plain').send('not found');
  });

  const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    deps.logger.error('unhandled error', { requestId: ctx(res)?.requestId, error });
    if (res.headersSent) {
      res.destroy();
      return;
    }
    sendError(res, 500, 'internal_error');
  };
  app.use(errorHandler);
  return app;
}
