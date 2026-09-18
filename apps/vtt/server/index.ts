// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

// Node.js core modules
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Express and middleware
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';

// WebSocket
import { WebSocketServer } from 'ws';

// Session and database
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { Pool } from 'pg';

// Authentication
import passport from './auth.js';

// Custom types
import type { Connection } from './types.js';

// Sockets
import { SocketManager } from './socket/SocketManager.js';
import { ChatHandler } from './socket/handlers/ChatHandler.js';
import { SceneHandler } from './socket/handlers/SceneHandler.js';
import { DiceHandler } from './socket/handlers/DiceHandler.js';
import { DocumentSyncHandler } from './socket/handlers/DocumentSyncHandler.js';
import { HostHandler } from './socket/handlers/HostHandler.js';
import { EntitySyncHandler } from './socket/handlers/EntitySyncHandler.js';
import { CharacterHandler } from './socket/handlers/CharacterHandler.js';
import { CombatHandler } from './socket/handlers/CombatHandler.js';
import { ConnectionLifecycle } from './socket/ConnectionLifecycle.js';
import { GameStateCommitService } from './socket/GameStateCommitService.js';
import { sendError } from './socket/messaging.js';
import {
  attachWebSocketUpgrade,
  registerWebSocketConnections,
} from './socket/websocketUpgrade.js';

// Services
import { DatabaseService, createDatabaseService } from './database.js';
import {
  DocumentServiceClient,
  createDocumentServiceClient,
} from './services/documentServiceClient.js';
import { AssetManifestStore } from './services/assetManifestStore.js';
import {
  createDeltaSyncMetrics,
  type DeltaSyncMetrics,
} from './observability/deltaSyncMetrics.js';

// Routes
import { createDocumentRoutes } from './routes/documents.js';
import { registerApiRoutes } from './routes/api.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createMetricsRouter } from './routes/metrics.routes.js';
import { createHealthRouter } from './routes/health.routes.js';
import { createSystemRouter } from './routes/system.routes.js';
import { createAssetRouter } from './routes/assets.routes.js';

export interface ExpressSessionUser {
  id: string;
  email: string | null;
  name: string;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl: string | null;
  provider: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class NexusServer {
  private wss: WebSocketServer;
  private socketManager: SocketManager;
  private lifecycle: ConnectionLifecycle;
  private gameStateCommits: GameStateCommitService;
  private port: number;
  private app: express.Application;
  private httpServer: ReturnType<typeof express.application.listen>;
  private manifestStore: AssetManifestStore;
  private db: DatabaseService;
  private documentClient: DocumentServiceClient | null;
  private documentsEnabled: boolean;

  private readonly ASSETS_PATH =
    process.env.ASSETS_PATH || path.join(__dirname, '../static-assets/assets');
  private readonly CORS_ORIGINS: string[] = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  private readonly CACHE_MAX_AGE = parseInt(
    process.env.CACHE_MAX_AGE || '86400',
  );

  /**
   * Delta-sync metrics accumulator. Shared by reference with the metrics
   * routes and the game-state commit service; see
   * server/observability/deltaSyncMetrics.ts.
   */
  private readonly deltaSyncMetrics: DeltaSyncMetrics =
    createDeltaSyncMetrics();

  constructor(port: number) {
    if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
      console.error('❌ SESSION_SECRET must be set in production');
      process.exit(1);
    }
    if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET must be set in production');
      process.exit(1);
    }

    this.port = port;
    this.db = createDatabaseService();
    this.manifestStore = new AssetManifestStore(this.ASSETS_PATH);

    // Initialize document service client
    const docApiUrl = process.env.DOC_API_URL;
    this.documentsEnabled = !!docApiUrl;
    this.documentClient = docApiUrl
      ? createDocumentServiceClient(docApiUrl)
      : null;

    this.app = express();

    // Trust nginx proxy for secure cookies and proper request headers
    this.app.set('trust proxy', 1);

    this.app.use(
      helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }),
    );
    this.app.use(compression());
    const defaultCorsOrigins =
      process.env.NODE_ENV === 'production'
        ? []
        : ['http://localhost:5173', 'http://127.0.0.1:5173'];

    const allowedOrigins = this.CORS_ORIGINS.length
      ? this.CORS_ORIGINS
      : defaultCorsOrigins;

    this.app.use(
      cors({
        origin: (origin, callback) => {
          // Allow same-origin or non-browser requests (like server-to-server)
          if (!origin) return callback(null, true);
          if (allowedOrigins.includes(origin)) return callback(null, true);

          // Allow any localhost origin in non-production environments
          if (process.env.NODE_ENV !== 'production') {
            const isLocalhost =
              /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
            if (isLocalhost) return callback(null, true);
          }

          return callback(
            new Error(
              `CORS blocked for origin: ${origin} (allowed: ${allowedOrigins.join(', ')})`,
            ),
            false,
          );
        },
        credentials: true,
      }),
    );
    // Increase body size limit for token image uploads (base64 images can be large)
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ limit: '10mb', extended: true }));

    // Use DATABASE_URL for server-side PostgreSQL connection (VITE_ prefix is for client only)
    const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
    const sessionStore = new (connectPgSimple(session))({
      pool: pgPool,
      createTableIfMissing: true,
    });

    const sessionMiddleware = session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || 'a-very-secret-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        // Secure flag is independent of FORCE_HTTPS (which only controls HTTP→HTTPS
        // redirect). Behind a TLS-terminating proxy (Cloudflare/Traefik), the public
        // site is always HTTPS so cookies must be Secure regardless of whether the
        // backend itself redirects HTTP. FORCE_HTTPS=false disables redirect loops;
        // SECURE_COOKIES=false is the separate override for non-TLS environments.
        secure:
          process.env.NODE_ENV === 'production' &&
          process.env.SECURE_COOKIES !== 'false',
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 1000 * 60 * 60 * 72, // 72 hours
      },
    });

    this.app.use(sessionMiddleware);
    this.app.use(passport.initialize());
    this.app.use(passport.session());

    this.setupAuthRoutes();
    this.setupApiRoutes();
    this.setupMetricsRoutes();
    this.setupHealthRoutes();
    this.setupSystemRoutes();
    this.setupDocumentRoutes();
    this.setupAssetRoutes();

    this.httpServer = this.app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Nexus server running on port ${port}`);
    });

    this.wss = new WebSocketServer({ noServer: true });
    this.socketManager = new SocketManager(this.wss, this.db);
    this.lifecycle = new ConnectionLifecycle({
      socketManager: this.socketManager,
      db: this.db,
    });
    this.gameStateCommits = new GameStateCommitService({
      socketManager: this.socketManager,
      db: this.db,
      deltaSyncMetrics: this.deltaSyncMetrics,
    });

    // Register event handlers
    new ChatHandler(this.socketManager, this.db);
    new SceneHandler(this.socketManager, this.db);
    new DiceHandler(this.socketManager, this.db);
    new DocumentSyncHandler(this.socketManager, this.db);
    new HostHandler(this.socketManager, this.db);
    new EntitySyncHandler(this.socketManager, this.db);
    new CharacterHandler(this.socketManager, this.db);
    new CombatHandler(this.socketManager, this.db);

    // Commit + broadcast host game-state uploads through the content-hash
    // token chain. This lives here (rather than in a handler) because it owns
    // the authoritative room.gameState/room.syncToken, JSON-patch delta
    // generation, and DB persistence. Only the host may drive canonical state.
    this.socketManager.on(
      'event:game-state-update',
      ({ connection, room, message }) => {
        const isSenderHost =
          room.host === connection.id || room.coHosts.has(connection.id);
        if (!isSenderHost) {
          sendError(connection, 'Access denied: Host privilege required.');
          return;
        }
        this.gameStateCommits.enqueueUpload(
          room.code,
          connection,
          message.data,
        );
      },
    );

    // Presence: when a socket drops, run the full disconnect flow (remove the
    // player from the room, broadcast session/leave, hibernate on host loss,
    // persist connection status). SocketManager emits 'disconnect' with the
    // still-live connection before deleting it, so handleDisconnect can resolve
    // the room. Without this, players stayed "connected" in peers' lists.
    this.socketManager.on(
      'disconnect',
      ({
        id,
        instanceId,
        connection,
      }: {
        id: string;
        instanceId: string;
        connection: Connection;
      }) => {
        void this.lifecycle.handleDisconnect(id, instanceId, connection);
      },
    );

    attachWebSocketUpgrade({
      httpServer: this.httpServer,
      wss: this.wss,
      sessionMiddleware,
    });

    registerWebSocketConnections(this.wss, (ws, req) => {
      void this.lifecycle.handleConnection(ws, req);
    });

    this.manifestStore.load();
    this.initialize();
  }

  private async initialize() {
    try {
      await this.db.initialize();
      await this.runLocalMigrations();
      await this.socketManager.initializeRealtime();
      // await this.loadRoomsFromDatabase(); // This needs to be updated for the new schema
      console.log('✅ Server initialization complete');
    } catch (error) {
      console.error('❌ Server initialization failed:', error);
      process.exit(1);
    }
  }

  /**
   * Runs lightweight, idempotent migrations for local deployments.
   * Currently applies local auth columns if missing.
   */
  private async runLocalMigrations() {
    try {
      // Check for passwordHash column; if missing, apply migration file
      const pool = this.db.getPool();
      const columnCheck = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'passwordHash'`,
      );

      if (columnCheck.rowCount === 0) {
        const migrationPath = path.join(
          __dirname,
          './migrations/2025-12-08-add-local-auth.sql',
        );
        if (fs.existsSync(migrationPath)) {
          const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
          await pool.query(migrationSql);
          console.log('✅ Applied local auth migration');
        } else {
          console.warn(
            '⚠️ Local auth migration file not found; skipping schema update',
          );
        }
      }
    } catch (err) {
      console.warn('⚠️ Local migrations skipped:', err);
    }
  }

  /**
   * Sets up authentication routes for OAuth and user management
   * @private
   * @returns {void}
   */
  private setupAuthRoutes(): void {
    this.app.use(createAuthRouter({ db: this.db, passport }));
  }

  /**
   * Sets up API routes for guest users, campaigns, and characters
   * @private
   * @returns {void}
   */
  private setupApiRoutes(): void {
    registerApiRoutes(this.app, this.db, this.ASSETS_PATH);
  }

  /**
   * Sets up document routes for accessing NexusCodex services
   * @private
   * @returns {void}
   */
  private setupDocumentRoutes(): void {
    const documentRoutes = createDocumentRoutes(
      this.documentClient,
      this.documentsEnabled,
      this.db,
    );
    this.app.use('/api', documentRoutes);
    if (this.documentsEnabled) {
      console.log('📚 Document routes initialized');
    } else {
      console.log(
        '📚 Document routes initialized in disabled mode (DOC_API_URL not set)',
      );
    }
  }

  private setupMetricsRoutes(): void {
    // Register metrics before the '/api' document-router catch-all.
    this.app.use(
      createMetricsRouter({
        deltaSyncMetrics: this.deltaSyncMetrics,
        getSocketManager: () => this.socketManager,
        db: this.db,
        getGameStateQueueDepth: () => this.gameStateCommits.queueDepth,
      }),
    );
  }

  private setupHealthRoutes(): void {
    this.app.use(
      createHealthRouter({
        db: this.db,
        getSocketManager: () => this.socketManager,
        port: this.port,
        getManifest: () => this.manifestStore.current,
      }),
    );
  }

  private setupSystemRoutes(): void {
    this.app.use(
      createSystemRouter({
        db: this.db,
        getSocketManager: () => this.socketManager,
        port: this.port,
      }),
    );
  }

  private setupAssetRoutes() {
    this.app.use(
      createAssetRouter({
        assetApiUrl: process.env.ASSET_API_URL || 'http://localhost:5003',
      }),
    );
  }

  public async shutdown() {
    console.log('🛑 Shutting down Nexus server...');
    this.socketManager.rooms.forEach((room) => {
      if (room.hibernationTimer) {
        clearTimeout(room.hibernationTimer);
      }
    });
    await this.socketManager.shutdown();
    try {
      await this.db.close();
      console.log('✅ Database closed');
    } catch (error) {
      console.error('Failed to close database:', error);
    }
    this.wss.close(() => {
      console.log('✅ WebSocket server closed');
    });
    this.httpServer.close(() => {
      console.log('✅ HTTP server closed');
      console.log('✅ Server shutdown complete');
    });
  }
}

const REQUIRED_PORT = process.env.PORT ? parseInt(process.env.PORT) : 5001;
console.log(`🚀 Starting WebSocket server on port ${REQUIRED_PORT}...`);
const server = new NexusServer(REQUIRED_PORT);
let shutdownStarted = false;

const handleShutdownSignal = (signal: NodeJS.Signals): void => {
  if (shutdownStarted) return;
  shutdownStarted = true;
  console.log(`Received ${signal}`);
  void server.shutdown().catch((error: unknown) => {
    console.error('Server shutdown failed:', error);
    process.exitCode = 1;
  });
};

process.once('SIGTERM', () => handleShutdownSignal('SIGTERM'));
process.once('SIGINT', () => handleShutdownSignal('SIGINT'));
