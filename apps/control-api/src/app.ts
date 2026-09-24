import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler, type Express, type RequestHandler } from 'express';
import helmet from 'helmet';
import { codexProxy } from './codex/proxy.js';
import { API_PREFIX, type AppDeps } from './deps.js';
import { ctx, sendError, type RequestContext } from './http/context.js';
import { apiRateLimit, loadSession } from './http/guard.js';
import { adminRouter } from './routes/admin.js';
import { loginRouter, logoutRouter } from './routes/auth.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const READINESS_TIMEOUT_MS = 2_000;

function requestContext(deps: AppDeps): RequestHandler {
  return (req, res, next) => {
    const inbound = req.headers['x-request-id'];
    const requestId = typeof inbound === 'string' && UUID.test(inbound) ? inbound.toLowerCase() : randomUUID();
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
  api.use('/codex', codexProxy(deps));
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
