// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

// Node.js core modules
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Server as HttpServer } from 'http';

// WebSocket
import { WebSocketServer } from 'ws';

import { createHttpApp } from './bootstrap/httpApp.js';
import { createRealtimeRuntime } from './bootstrap/realtimeRuntime.js';

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
import { SocketManager } from './socket/SocketManager.js';
import { ConnectionLifecycle } from './socket/ConnectionLifecycle.js';
import { GameStateCommitService } from './socket/GameStateCommitService.js';

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

export class NexusServer {
  private wss: WebSocketServer;
  private socketManager: SocketManager;
  private lifecycle: ConnectionLifecycle;
  private gameStateCommits: GameStateCommitService;
  private port: number;
  private httpServer: HttpServer;
  private manifestStore: AssetManifestStore;
  private db: DatabaseService;
  private documentClient: DocumentServiceClient | null;
  private documentsEnabled: boolean;

  private readonly ASSETS_PATH =
    process.env.ASSETS_PATH || path.join(__dirname, '../static-assets/assets');
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

    this.wss = new WebSocketServer({ noServer: true });
    const realtime = createRealtimeRuntime({
      db: this.db,
      deltaSyncMetrics: this.deltaSyncMetrics,
      wss: this.wss,
    });
    this.socketManager = realtime.socketManager;
    this.lifecycle = realtime.lifecycle;
    this.gameStateCommits = realtime.gameStateCommits;
    const { app, sessionMiddleware } = createHttpApp({
      assetsPath: this.ASSETS_PATH,
      db: this.db,
      deltaSyncMetrics: this.deltaSyncMetrics,
      documentClient: this.documentClient,
      documentsEnabled: this.documentsEnabled,
      docApiUrl,
      getSocketManager: () => this.socketManager,
      getGameStateCommits: () => this.gameStateCommits,
      manifestStore: this.manifestStore,
      port,
    });
    this.httpServer = app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Nexus server running on port ${port}`);
    });
    realtime.attach(this.httpServer, sessionMiddleware);

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

export function resolveServerPort(port = process.env.PORT): number {
  return port ? parseInt(port, 10) : 5001;
}

export function startNexusServer(
  port = resolveServerPort(),
  createServer: (serverPort: number) => NexusServer =
    (serverPort) => new NexusServer(serverPort),
): NexusServer {
  console.log(`🚀 Starting WebSocket server on port ${port}...`);
  const server = createServer(port);
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
  return server;
}

const invokedPath = process.argv[1];
if (invokedPath && path.resolve(invokedPath) === __filename) {
  startNexusServer();
}
