import express, { type RequestHandler } from 'express';
import compression from 'compression';
import connectPgSimple from 'connect-pg-simple';
import cors from 'cors';
import helmet from 'helmet';
import { Pool } from 'pg';
import session from 'express-session';
import passport from '../auth.js';
import type { DatabaseService } from '../database.js';
import type { DeltaSyncMetrics } from '../observability/deltaSyncMetrics.js';
import { CampaignPrepAuthoringService } from '../campaign-prep/CampaignPrepAuthoringService.js';
import { CampaignPrepDependencyResolver } from '../campaign-prep/CampaignPrepDependencyResolver.js';
import { SessionPlanPublishingService } from '../campaign-prep/SessionPlanPublishingService.js';
import { SessionPlanPublishValidator } from '../campaign-prep/SessionPlanPublishValidator.js';
import { registerApiRoutes } from '../routes/api.js';
import { createAssetRouter } from '../routes/assets.routes.js';
import { createAuthRouter } from '../routes/auth.routes.js';
import { createCampaignPrepRouter } from '../routes/campaignPrep.routes.js';
import { createDocumentRoutes } from '../routes/documents.js';
import { createHealthRouter } from '../routes/health.routes.js';
import { createMetricsRouter } from '../routes/metrics.routes.js';
import { createRulesCatalogRouter } from '../routes/rulesCatalog.routes.js';
import { createSystemRouter } from '../routes/system.routes.js';
import type { AssetManifestStore } from '../services/assetManifestStore.js';
import type { DocumentServiceClient } from '../services/documentServiceClient.js';
import { createRulesCatalogUpstreamClient } from '../services/rulesCatalogClient.js';
import { UserAssetCatalogClient } from '../services/userAssetCatalogClient.js';
import type { GameStateCommitService } from '../socket/GameStateCommitService.js';
import type { SocketManager } from '../socket/SocketManager.js';

export interface HttpAppOptions {
  assetsPath: string;
  db: DatabaseService;
  deltaSyncMetrics: DeltaSyncMetrics;
  documentClient: DocumentServiceClient | null;
  documentsEnabled: boolean;
  /**
   * Same DOC_API_URL used for `documentClient` above. Reused as-is for the
   * rules-catalog BFF (server/routes/rulesCatalog.routes.ts) since both proxy
   * the same doc-api service; see apps/docs/codex/rules-registry.md.
   */
  docApiUrl: string | undefined;
  getSocketManager: () => SocketManager;
  manifestStore: AssetManifestStore;
  port: number;
  getGameStateCommits: () => GameStateCommitService;
}

export function createCorsOriginValidator(
  allowedOrigins: string[],
  nodeEnv = process.env.NODE_ENV,
): (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => void {
  return (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    if (nodeEnv !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked for origin: ${origin} (allowed: ${allowedOrigins.join(', ')})`), false);
  };
}

export function createHttpApp({
  assetsPath,
  db,
  deltaSyncMetrics,
  documentClient,
  documentsEnabled,
  docApiUrl,
  getSocketManager,
  manifestStore,
  port,
  getGameStateCommits,
}: HttpAppOptions): { app: express.Application; sessionMiddleware: RequestHandler } {
  const app = express();
  const configuredOrigins = (process.env.CORS_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  const allowedOrigins = configuredOrigins.length
    ? configuredOrigins
    : process.env.NODE_ENV === 'production'
      ? []
      : ['http://localhost:5173', 'http://127.0.0.1:5173'];
  const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sessionStore = new (connectPgSimple(session))({ pool: pgPool, createTableIfMissing: true });
  const sessionMiddleware = session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'a-very-secret-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES !== 'false',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 72,
    },
  });

  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());
  app.use(cors({ origin: createCorsOriginValidator(allowedOrigins), credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());

  app.use(createAuthRouter({ db, passport }));
  registerApiRoutes(app, db, assetsPath);
  const prepDependencyResolver = new CampaignPrepDependencyResolver({
    campaignPrep: db.campaignPrep,
    documentClient,
    getAssetManifest: () => manifestStore.current,
    libraryObjects: db.libraryObjects,
    rulesCatalog: docApiUrl
      ? createRulesCatalogUpstreamClient(docApiUrl)
      : null,
    userAssetCatalog: new UserAssetCatalogClient(
      process.env.ASSET_API_URL || 'http://localhost:5003',
    ),
  });
  app.use(
    '/api',
    createCampaignPrepRouter({
      author: new CampaignPrepAuthoringService(db.campaignPrep),
      db,
      publisher: new SessionPlanPublishingService(
        db.campaignPrep,
        new SessionPlanPublishValidator(prepDependencyResolver),
      ),
    }),
  );
  app.use(createMetricsRouter({
    deltaSyncMetrics,
    getSocketManager,
    db,
    getGameStateQueueDepth: () => getGameStateCommits().queueDepth,
  }));
  app.use(createHealthRouter({ db, getSocketManager, port, getManifest: () => manifestStore.current }));
  app.use(createSystemRouter({ db, getSocketManager, port }));
  app.use('/api', createDocumentRoutes(documentClient, documentsEnabled, db));
  app.use(
    '/api',
    createRulesCatalogRouter({
      docApiUrl,
      timeoutMs: process.env.RULES_CATALOG_TIMEOUT_MS ? Number(process.env.RULES_CATALOG_TIMEOUT_MS) : undefined,
      cacheTtlMs: process.env.RULES_CATALOG_CACHE_TTL_MS ? Number(process.env.RULES_CATALOG_CACHE_TTL_MS) : undefined,
    }),
  );
  app.use(createAssetRouter({ assetApiUrl: process.env.ASSET_API_URL || 'http://localhost:5003' }));

  return { app, sessionMiddleware };
}
