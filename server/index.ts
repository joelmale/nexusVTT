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
import { createProxyMiddleware } from 'http-proxy-middleware';

// WebSocket and HTTP types
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';

// Session and database
import session, { Session } from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { Pool } from 'pg';

// Authentication
import passport from './auth.js';

// UUID
import { v4 as uuidv4 } from 'uuid';

// JSON Patch for delta updates
import jsonpatch from 'fast-json-patch';

// Custom types
import type {
  Room,
  Connection,
  ServerMessage,
  ServerDiceRollResultMessage,
  GameState,
  ServerChatMessage,
} from './types.js';

// Shared types
import type { AssetManifest } from '../shared/types.js';

// Delta-sync contracts + synchronous hashing (server-only)
import type {
  GameStateUpload,
  SyncableGameState,
  StateHash,
  JsonValue,
  JsonPatch,
  ResyncReason,
} from '../shared/sync/contracts.js';
import { hashSync } from '../shared/sync/hashSync.js';
import type { Operation } from 'fast-json-patch';

// Middleware
import { assetWriteGuard } from './middleware/assetWriteGuard.js';

// Sockets
import { SocketManager } from './socket/SocketManager.js';
import { ChatHandler } from './socket/handlers/ChatHandler.js';
import { SceneHandler } from './socket/handlers/SceneHandler.js';
import { DiceHandler } from './socket/handlers/DiceHandler.js';
import { DocumentSyncHandler } from './socket/handlers/DocumentSyncHandler.js';
import { HostHandler } from './socket/handlers/HostHandler.js';
import { EntitySyncHandler } from './socket/handlers/EntitySyncHandler.js';
import { CharacterHandler } from './socket/handlers/CharacterHandler.js';

// Services
import {
  DatabaseService,
  createDatabaseService,
  SessionRecord,
} from './database.js';
import {
  DocumentServiceClient,
  createDocumentServiceClient,
} from './services/documentServiceClient.js';

// Routes
import { createDocumentRoutes } from './routes/documents.js';

// Dice functions and types
import {
  validateDiceRollRequest,
  createServerDiceRoll,
  DiceRollRequest,
} from './diceRoller.js';
import { sanitizeLog } from './sanitizeLog.js';
import { generateRandomCampaign, generateRandomCharacter } from './utils/mockGenerator.js';
import { isDevMode } from './utils/devMode.js';

interface SessionUser {
  id: string;
  email: string | null;
  name: string;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl: string | null;
  provider: string;
}

interface CustomSession extends Session {
  guestUser?: {
    id: string;
    name: string;
    provider: string;
  };
  passport?: {
    user?: SessionUser;
  };
}

interface RequestWithSession extends IncomingMessage {
  session: CustomSession;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSET_CATEGORIES = {
  Maps: 'Maps',
  Tokens: 'Tokens',
  Art: 'Art',
  Handouts: 'Handouts',
  Reference: 'Reference',
};

type CharacterRecord = {
  id: string;
  name: string;
  ownerId: string;
  data: unknown;
  createdAt: Date;
  updatedAt: Date;
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(',')}}`;
};

const normalizeCharacterPayload = (value: unknown): unknown => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
};

const normalizeForHash = (value: unknown): unknown => {
  const normalized = normalizeCharacterPayload(value);
  if (
    normalized === null ||
    normalized === undefined ||
    typeof normalized !== 'object'
  ) {
    return normalized;
  }

  if (Array.isArray(normalized)) {
    return normalized.map((item) => {
      const normalizedItem = normalizeForHash(item);
      return normalizedItem === undefined ? null : normalizedItem;
    });
  }

  const record = normalized as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  const omittedKeys = new Set([
    'id',
    'createdAt',
    'updatedAt',
    'playerId',
    'version',
    'name',
  ]);

  Object.keys(record)
    .sort()
    .forEach((key) => {
      if (omittedKeys.has(key)) return;
      const normalizedValue = normalizeForHash(record[key]);
      if (normalizedValue === undefined) return;
      sanitized[key] = normalizedValue;
    });

  return sanitized;
};

const buildCharacterKey = (name: string, data: unknown): string => {
  const normalizedName = name.trim().toLowerCase();
  return `${normalizedName}::${stableStringify(normalizeForHash(data))}`;
};

const dedupeCharacters = (characters: CharacterRecord[]) => {
  const sorted = [...characters].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  const seen = new Set<string>();
  const unique: CharacterRecord[] = [];
  const duplicateIds: string[] = [];

  for (const character of sorted) {
    const key = buildCharacterKey(character.name, character.data);
    if (seen.has(key)) {
      duplicateIds.push(character.id);
      continue;
    }
    seen.add(key);
    unique.push(character);
  }

  return { unique, duplicateIds };
};

class NexusServer {
  private wss: WebSocketServer;
  private socketManager: SocketManager;
  private port: number;
  private app: express.Application;
  private httpServer: ReturnType<typeof express.application.listen>;
  private manifest: AssetManifest | null = null;
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
  // Session timeouts (72 hours = 259200000 ms)
  private readonly HIBERNATION_TIMEOUT = 72 * 60 * 60 * 1000; // 72 hours before abandoning inactive session
  private readonly ABANDONMENT_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours after abandonment before database cleanup
  private readonly HEARTBEAT_INTERVAL = 30 * 1000;
  private readonly HEARTBEAT_TIMEOUT = 10 * 1000;
  private readonly MAX_CONSECUTIVE_MISSES = 3;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  /**
   * Delta-sync metrics accumulator.
   *
   * ROLLOUT PROCEDURE:
   * 1. Flip VITE_DELTA_SYNC=true in a canary deployment.
   * 2. Monitor GET /api/metrics/delta-sync over 24–48 hours.
   * 3. Healthy steady state:
   *    - resyncRate near 0% (aside from reconnects)
   *    - resync['integrity-mismatch'] === 0 (nonzero = canonical serialization bug → STOP, investigate)
   *    - commits.patch > 0 (delta-sync is being used)
   *    - patchBytesSaved > 0 (compression is working)
   * 4. Enable by default only after a clean canary.
   *
   * If integrity-mismatch counter is nonzero, the client and server hashing
   * disagree on the canonical form. This is a determinism bug and MUST be
   * investigated before production rollout.
   */
  private deltaSyncMetrics: {
    commits: { legacy: number; full: number; patch: number };
    resync: Record<ResyncReason, number>;
    patchBytesSaved: number;
    totalUploads: number;
  } = {
    commits: { legacy: 0, full: 0, patch: 0 },
    resync: {
      'base-mismatch': 0,
      'integrity-mismatch': 0,
      'malformed-patch': 0,
      'payload-too-large': 0,
    },
    patchBytesSaved: 0,
    totalUploads: 0,
  };

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
            const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
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
    this.setupDocumentRoutes();
    this.setupAssetRoutes();
    this.setupHealthRoutes();

    this.httpServer = this.app.listen(port, '0.0.0.0', () => {
      console.log(`🚀 Nexus server running on port ${port}`);
    });

    this.wss = new WebSocketServer({ noServer: true });
    this.socketManager = new SocketManager(this.wss, this.db);

    // Register event handlers
    new ChatHandler(this.socketManager, this.db);
    new SceneHandler(this.socketManager, this.db);
    new DiceHandler(this.socketManager, this.db);
    new DocumentSyncHandler(this.socketManager, this.db);
    new HostHandler(this.socketManager, this.db);
    new EntitySyncHandler(this.socketManager, this.db);
    new CharacterHandler(this.socketManager, this.db);

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
          this.sendError(connection, 'Access denied: Host privilege required.');
          return;
        }
        this.handleGameStateUpload(room.code, connection, message.data);
      },
    );

    // Presence: when a socket drops, run the full disconnect flow (remove the
    // player from the room, broadcast session/leave, hibernate on host loss,
    // persist connection status). SocketManager emits 'disconnect' with the
    // still-live connection before deleting it, so handleDisconnect can resolve
    // the room. Without this, players stayed "connected" in peers' lists.
    this.socketManager.on('disconnect', ({ id }: { id: string }) => {
      void this.handleDisconnect(id);
    });

    this.httpServer.on(
      'upgrade',
      (req: IncomingMessage, socket: Duplex, head: Buffer) => {
        sessionMiddleware(
          req as express.Request,
          {} as express.Response,
          () => {
            this.wss.handleUpgrade(req, socket, head, (ws) => {
              this.wss.emit('connection', ws, req);
            });
          },
        );
      },
    );

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req as RequestWithSession);
    });

    this.loadManifest();
    this.initialize();
  }

  private async initialize() {
    try {
      await this.db.initialize();
      await this.runLocalMigrations();
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
    // Local account registration
    this.app.post('/auth/register', async (req, res) => {
      try {
        const { email, password, displayName } = req.body || {};

        if (!email || typeof email !== 'string') {
          return res.status(400).json({ error: 'Email is required' });
        }
        const normalizedEmail = email.toLowerCase().trim();
        const atIdx = normalizedEmail.indexOf('@');
        const dotIdx = normalizedEmail.lastIndexOf('.');
        if (atIdx < 1 || dotIdx <= atIdx + 1 || dotIdx >= normalizedEmail.length - 1) {
          return res.status(400).json({ error: 'Invalid email format' });
        }

        if (!password || typeof password !== 'string') {
          return res.status(400).json({ error: 'Password is required' });
        }
        if (password.length < 8 || password.length > 128) {
          return res
            .status(400)
            .json({ error: 'Password must be between 8 and 128 characters' });
        }

        const existing = await this.db.getUserByEmail(normalizedEmail);
        if (existing) {
          return res.status(409).json({
            error:
              existing.provider === 'local'
                ? 'Account already exists. Please sign in.'
                : `Account exists via ${existing.provider}. Please sign in with ${existing.provider}.`,
          });
        }

        const user = await this.db.createLocalUser(
          normalizedEmail,
          password,
          displayName,
        );

        req.login(user, (err) => {
          if (err) {
            console.error('Login after register failed', err);
            return res.status(500).json({ error: 'Login failed' });
          }
          res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            displayName: user.displayName || user.name,
            provider: user.provider,
            avatarUrl: user.avatarUrl,
            bio: user.bio,
            preferences: user.preferences || {},
            isActive: user.isActive,
          });
        });
      } catch (error) {
        console.error('Registration failed:', error);
        res.status(500).json({ error: 'Registration failed' });
      }
    });

    // Local account login
    this.app.post('/auth/login', async (req, res) => {
      try {
        const { email, password } = req.body || {};

        if (
          !email ||
          typeof email !== 'string' ||
          !password ||
          typeof password !== 'string'
        ) {
          return res
            .status(400)
            .json({ error: 'Email and password are required' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await this.db.validateLocalLogin(
          normalizedEmail,
          password,
        );

        if (!user) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        req.login(user, (err) => {
          if (err) {
            console.error('Login failed', err);
            return res.status(500).json({ error: 'Login failed' });
          }

          res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            displayName: user.displayName || user.name,
            provider: user.provider,
            avatarUrl: user.avatarUrl,
            bio: user.bio,
            preferences: user.preferences || {},
            isActive: user.isActive,
          });
        });
      } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
      }
    });

    this.app.get(
      '/auth/google',
      passport.authenticate('google', { scope: ['profile', 'email'] }),
    );
    this.app.get('/auth/google/callback', (req, res, next) => {
      passport.authenticate(
        'google',
        (err: unknown, user: Express.User | false, info?: unknown) => {
          if (err) {
            console.error('Google OAuth callback failed:', err);
            return res.redirect('/?oauthError=google_auth_error');
          }

          if (!user) {
            console.warn('Google OAuth failed: no user returned', info);
            return res.redirect('/?oauthError=google_no_user');
          }

          req.login(user, (loginErr) => {
            if (loginErr) {
              console.error('Google OAuth session creation failed:', loginErr);
              return res.redirect('/?oauthError=google_session_error');
            }

            // In production, use relative path or configured URL
            // In development, use localhost with Vite dev server port
            const redirectUrl =
              process.env.FRONTEND_URL ||
              (process.env.NODE_ENV === 'production'
                ? '/dashboard'
                : 'http://localhost:5173/dashboard');

            res.redirect(redirectUrl);
          });
        },
      )(req, res, next);
    });
    this.app.get('/auth/discord', passport.authenticate('discord'));
    this.app.get(
      '/auth/discord/callback',
      passport.authenticate('discord', { failureRedirect: '/' }),
      (req, res) => {
        // In production, use relative path or configured URL
        // In development, use localhost with Vite dev server port
        const redirectUrl =
          process.env.FRONTEND_URL ||
          (process.env.NODE_ENV === 'production'
            ? '/dashboard'
            : 'http://localhost:5173/dashboard');
        res.redirect(redirectUrl);
      },
    );
    this.app.get('/auth/logout', (req, res, next) => {
      req.logout((err) => {
        if (err) {
          return next(err);
        }
        res.redirect('/');
      });
    });
    this.app.get('/auth/me', async (req, res) => {
      if (req.isAuthenticated()) {
        try {
          const user = req.user as { id: string };
          const profile = await this.db.getUserProfile(user.id);
          res.json(profile || req.user);
        } catch (error) {
          console.error('Failed to fetch user profile for /auth/me:', error);
          res.json(req.user);
        }
      } else {
        res.status(401).json({ message: 'Not authenticated' });
      }
    });
  }

  /**
   * Sets up API routes for guest users, campaigns, and characters
   * @private
   * @returns {void}
   */
  private setupApiRoutes(): void {
    // ============================================================================
    // USER ACCOUNT ROUTES
    // ============================================================================
    this.app.get('/api/users/profile', async (req, res) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const user = req.user as { id: string };
        const profile = await this.db.getUserProfile(user.id);

        if (!profile) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json({
          id: profile.id,
          email: profile.email,
          name: profile.name,
          displayName: profile.displayName || profile.name,
          bio: profile.bio,
          avatarUrl: profile.avatarUrl,
          provider: profile.provider,
          preferences: profile.preferences || {},
          isActive: profile.isActive,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
          lastLogin: profile.lastLogin,
          stats: profile.stats,
        });
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
      }
    });

    this.app.put('/api/users/profile', async (req, res) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const { displayName, bio, avatarUrl } = req.body || {};

        if (displayName !== undefined) {
          if (typeof displayName !== 'string') {
            return res
              .status(400)
              .json({ error: 'displayName must be a string' });
          }
          if (
            displayName.trim().length === 0 ||
            displayName.trim().length > 100
          ) {
            return res.status(400).json({
              error: 'displayName must be between 1 and 100 characters',
            });
          }
        }

        if (bio !== undefined && typeof bio !== 'string') {
          return res.status(400).json({ error: 'bio must be a string' });
        }
        if (typeof bio === 'string' && bio.length > 1000) {
          return res
            .status(400)
            .json({ error: 'bio must be 1000 characters or less' });
        }

        if (avatarUrl !== undefined && typeof avatarUrl !== 'string') {
          return res.status(400).json({ error: 'avatarUrl must be a string' });
        }
        if (typeof avatarUrl === 'string' && avatarUrl.length > 2000) {
          return res.status(400).json({ error: 'avatarUrl is too long' });
        }

        const user = req.user as { id: string };
        const updated = await this.db.updateUserProfile(user.id, {
          displayName: displayName?.trim() ?? undefined,
          bio: bio ?? undefined,
          avatarUrl: avatarUrl ?? undefined,
        });

        res.json({
          id: updated.id,
          email: updated.email,
          name: updated.name,
          displayName: updated.displayName || updated.name,
          bio: updated.bio,
          avatarUrl: updated.avatarUrl,
          provider: updated.provider,
          preferences: updated.preferences || {},
          isActive: updated.isActive,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          lastLogin: updated.lastLogin,
        });
      } catch (error) {
        console.error('Failed to update user profile:', error);
        res.status(500).json({ error: 'Failed to update user profile' });
      }
    });

    this.app.get('/api/users/preferences', async (req, res) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        const user = req.user as { id: string };
        const preferences = await this.db.getUserPreferences(user.id);
        res.json(preferences);
      } catch (error) {
        console.error('Failed to fetch preferences:', error);
        res.status(500).json({ error: 'Failed to fetch preferences' });
      }
    });

    this.app.put('/api/users/preferences', async (req, res) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const { allowSpectators, shareCharacterSheets, logSessions, ...rest } =
          req.body || {};

        const invalid =
          (allowSpectators !== undefined &&
            typeof allowSpectators !== 'boolean') ||
          (shareCharacterSheets !== undefined &&
            typeof shareCharacterSheets !== 'boolean') ||
          (logSessions !== undefined && typeof logSessions !== 'boolean');

        if (invalid) {
          return res
            .status(400)
            .json({ error: 'Preference values must be boolean' });
        }

        const user = req.user as { id: string };
        const currentPrefs = await this.db.getUserPreferences(user.id);
        const mergedPrefs = {
          ...currentPrefs,
          ...(allowSpectators !== undefined ? { allowSpectators } : {}),
          ...(shareCharacterSheets !== undefined
            ? { shareCharacterSheets }
            : {}),
          ...(logSessions !== undefined ? { logSessions } : {}),
          ...rest,
        };

        const updated = await this.db.updateUserPreferences(
          user.id,
          mergedPrefs,
        );
        res.json(updated);
      } catch (error) {
        console.error('Failed to update preferences:', error);
        res.status(500).json({ error: 'Failed to update preferences' });
      }
    });

    this.app.post('/api/users/migrate-guest', async (req, res) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: 'Authentication required' });
        }
        const guest = (req.session as CustomSession).guestUser;
        if (!guest) {
          return res.status(400).json({ error: 'No guest session to migrate' });
        }

        const user = req.user as { id: string };
        await this.db.migrateGuestToUser(guest.id, user.id);

        delete (req.session as CustomSession).guestUser;

        res.json({ success: true });
      } catch (error) {
        console.error('Failed to migrate guest data:', error);
        res.status(500).json({ error: 'Failed to migrate guest data' });
      }
    });

    this.app.delete('/api/users/account', async (req, res) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const user = req.user as { id: string };
        await this.db.deactivateUser(user.id);

        req.logout((err) => {
          if (err) {
            console.error('Logout after deactivate failed:', err);
          }
        });

        res.json({ success: true });
      } catch (error) {
        console.error('Failed to deactivate account:', error);
        res.status(500).json({ error: 'Failed to deactivate account' });
      }
    });

    // ============================================================================
    // GUEST USER ROUTES
    // ============================================================================

    /**
     * POST /api/guest-users
     * Creates a new guest user for non-authenticated gameplay
     * Body: { name: string }
     */
    this.app.post('/api/guest-users', async (req, res) => {
      try {
        const { name } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          return res.status(400).json({ error: 'Name is required' });
        }

        if (name.trim().length > 50) {
          return res
            .status(400)
            .json({ error: 'Name must be 50 characters or less' });
        }

        // Create guest user in database
        const guestUser = await this.db.createGuestUser(name.trim());

        // Create a session for the guest user (without using passport)
        (req.session as CustomSession).guestUser = {
          id: guestUser.id,
          name: guestUser.name,
          provider: 'guest',
        };

        res.status(201).json({
          id: guestUser.id,
          name: guestUser.name,
          provider: 'guest',
        });
      } catch (error) {
        console.error('Failed to create guest user:', error);
        res.status(500).json({ error: 'Failed to create guest user' });
      }
    });

    /**
     * GET /api/guest-me
     * Gets current guest user from session
     */
    this.app.get('/api/guest-me', (req, res) => {
      const guestUser = (req.session as CustomSession).guestUser;
      if (guestUser) {
        res.json(guestUser);
      } else {
        res.status(401).json({ message: 'Not a guest user' });
      }
    });

    /**
     * POST /api/dev/populate-mock-data
     * Dev-only endpoint to populate mock campaigns and characters.
     * Gated by the unified dev-mode flag (DEV_MODE, default NODE_ENV!==production).
     */
    if (isDevMode()) {
      this.app.post('/api/dev/populate-mock-data', async (req, res) => {
        try {
          if (!req.isAuthenticated()) {
            return res.status(401).json({ error: 'Authentication required' });
          }

          const user = req.user as { id: string };

          // Configurable counts (default 3 campaigns / 4 characters), clamped to
          // a sane range so a bad request can't ask for thousands of inserts.
          const clamp = (v: unknown, def: number) =>
            Math.min(Math.max(Math.floor(Number(v) || def), 0), 25);
          const campaignCount = clamp(req.body?.campaigns, 3);
          const characterCount = clamp(req.body?.characters, 4);

          console.log(
            `🛠️ Dev seeding requested for user ${user.id}: ${campaignCount} campaigns, ${characterCount} characters`,
          );

          // Each insert is isolated so one failure can't abort the whole batch;
          // we report partial success instead of 500-ing everything.
          const createdCampaigns = [];
          const createdCharacters = [];
          const errors: string[] = [];

          for (let i = 0; i < campaignCount; i++) {
            try {
              const campData = generateRandomCampaign(user.id);
              const campaign = await this.db.createCampaign(
                user.id,
                campData.name,
                campData.description ?? undefined,
              );
              createdCampaigns.push(campaign);
            } catch (err) {
              console.error(`Seed campaign ${i} failed:`, err);
              errors.push(`campaign ${i}: ${(err as Error).message}`);
            }
          }

          for (let i = 0; i < characterCount; i++) {
            try {
              const charData = generateRandomCharacter(user.id);
              const character = await this.db.createCharacter(
                user.id,
                charData.name,
                charData.data,
              );
              createdCharacters.push(character);
            } catch (err) {
              console.error(`Seed character ${i} failed:`, err);
              errors.push(`character ${i}: ${(err as Error).message}`);
            }
          }

          res.json({
            success: errors.length === 0,
            campaigns: createdCampaigns,
            characters: createdCharacters,
            requested: { campaigns: campaignCount, characters: characterCount },
            errors,
          });
        } catch (error) {
          console.error('Failed to populate mock data:', error);
          res.status(500).json({ error: 'Failed to populate mock data' });
        }
      });
    }

    // ============================================================================
    // CAMPAIGN ROUTES
    // ============================================================================

    /**
     * GET /api/campaigns
     * Gets all campaigns for the authenticated user
     * Requires authentication
     */
    this.app.get('/api/campaigns', async (req, res) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const user = req.user as { id: string };
        const campaigns = await this.db.getCampaignsByUser(user.id);

        res.json(campaigns);
      } catch (error) {
        console.error('Failed to fetch campaigns:', error);
        res.status(500).json({ error: 'Failed to fetch campaigns' });
      }
    });

    /**
     * POST /api/campaigns
     * Creates a new campaign
     * Requires authentication
     * Body: { name: string, description?: string }
     */
    this.app.post('/api/campaigns', async (req, res) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const { name, description } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          return res.status(400).json({ error: 'Campaign name is required' });
        }

        if (name.trim().length > 255) {
          return res
            .status(400)
            .json({ error: 'Campaign name must be 255 characters or less' });
        }

        const user = req.user as { id: string };
        const campaign = await this.db.createCampaign(
          user.id,
          name.trim(),
          description?.trim() || undefined,
        );

        res.status(201).json(campaign);
      } catch (error) {
        console.error('Failed to create campaign:', error);
        res.status(500).json({ error: 'Failed to create campaign' });
      }
    });

    /**
     * PUT /api/campaigns/:id
     * Updates a campaign
     * Requires authentication and ownership
     * Body: { name?: string, description?: string, scenes?: unknown }
     */
    this.app.put('/api/campaigns/:id', async (req, res) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const campaignId = req.params.id;
        const updates = req.body;

        const user = req.user as { id: string };
        const campaign = await this.db.getCampaignById(campaignId);
        if (!campaign) {
          return res.status(404).json({ error: 'Campaign not found' });
        }
        if (campaign.dmId !== user.id) {
          return res
            .status(403)
            .json({ error: 'Access denied: not campaign owner' });
        }

        // Validate updates
        if (updates.name !== undefined) {
          if (
            typeof updates.name !== 'string' ||
            updates.name.trim().length === 0
          ) {
            return res
              .status(400)
              .json({ error: 'Campaign name cannot be empty' });
          }
          if (updates.name.trim().length > 255) {
            return res
              .status(400)
              .json({ error: 'Campaign name must be 255 characters or less' });
          }
          updates.name = updates.name.trim();
        }

        if (
          updates.description !== undefined &&
          typeof updates.description === 'string'
        ) {
          updates.description = updates.description.trim();
        }

        await this.db.updateCampaign(campaignId, updates);

        res.json({ success: true, message: 'Campaign updated successfully' });
      } catch (error) {
        console.error('Failed to update campaign:', error);
        res.status(500).json({ error: 'Failed to update campaign' });
      }
    });

    /**
     * DELETE /api/campaigns/:id
     * Deletes a campaign (and cascades to its sessions via ON DELETE CASCADE)
     * Requires authentication and ownership
     */
    this.app.delete('/api/campaigns/:id', async (req, res) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const campaignId = req.params.id;

        // Verify ownership
        const campaign = await this.db.getCampaignById(campaignId);
        if (!campaign) {
          return res.status(404).json({ error: 'Campaign not found' });
        }

        const user = req.user as { id: string };
        if (campaign.dmId !== user.id) {
          return res
            .status(403)
            .json({ error: 'Access denied: not campaign owner' });
        }

        await this.db.deleteCampaign(campaignId);

        res.json({ success: true, message: 'Campaign deleted successfully' });
      } catch (error) {
        console.error('Failed to delete campaign:', error);
        res.status(500).json({ error: 'Failed to delete campaign' });
      }
    });

    /**
     * GET /api/characters
     * Retrieves all characters owned by the authenticated user
     * Requires authentication
     */
    this.app.get('/api/characters', async (req, res) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const user = req.user as { id: string };
        const characters = await this.db.getCharactersByUser(user.id);
        const { unique, duplicateIds } = dedupeCharacters(characters);

        if (duplicateIds.length > 0) {
          await this.db.deleteCharactersByIds(duplicateIds);
        }

        res.json(unique);
      } catch (error) {
        console.error('Failed to fetch characters:', error);
        res.status(500).json({ error: 'Failed to fetch characters' });
      }
    });

    /**
     * GET /api/characters/:id
     * Retrieves a specific character by ID
     * Requires authentication and ownership
     */
    this.app.get('/api/characters/:id', async (req, res) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const characterId = req.params.id;
        const character = await this.db.getCharacterById(characterId);

        if (!character) {
          return res.status(404).json({ error: 'Character not found' });
        }

        // Verify ownership
        const user = req.user as { id: string };
        if (character.ownerId !== user.id) {
          return res.status(403).json({ error: 'Access denied' });
        }

        res.json(character);
      } catch (error) {
        console.error('Failed to fetch character:', error);
        res.status(500).json({ error: 'Failed to fetch character' });
      }
    });

    /**
     * POST /api/characters
     * Creates a new character
     * Requires authentication
     * Body: { name: string, data?: object }
     */
    this.app.post('/api/characters', async (req, res) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const { name, data } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          return res.status(400).json({ error: 'Character name is required' });
        }

        if (name.trim().length > 255) {
          return res
            .status(400)
            .json({ error: 'Character name must be 255 characters or less' });
        }

        const user = req.user as { id: string };
        const existingCharacters = await this.db.getCharactersByUser(user.id);
        const incomingKey = buildCharacterKey(name.trim(), data || {});
        const match = existingCharacters
          .map((character) => ({
            character,
            key: buildCharacterKey(character.name, character.data),
          }))
          .filter(({ key }) => key === incomingKey)
          .sort(
            (a, b) =>
              new Date(b.character.updatedAt).getTime() -
              new Date(a.character.updatedAt).getTime(),
          )[0]?.character;

        if (match) {
          return res.status(200).json(match);
        }

        const character = await this.db.createCharacter(
          user.id,
          name.trim(),
          data || {},
        );

        res.status(201).json(character);
      } catch (error) {
        console.error('Failed to create character:', error);
        res.status(500).json({ error: 'Failed to create character' });
      }
    });

    /**
     * PUT /api/characters/:id
     * Updates a character
     * Requires authentication and ownership
     * Body: { name?: string, data?: object }
     */
    this.app.put('/api/characters/:id', async (req, res) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const characterId = req.params.id;
        const updates = req.body;

        // Verify ownership
        const character = await this.db.getCharacterById(characterId);
        if (!character) {
          return res.status(404).json({ error: 'Character not found' });
        }

        const user = req.user as { id: string };
        if (character.ownerId !== user.id) {
          return res.status(403).json({ error: 'Access denied' });
        }

        // Validate updates
        if (updates.name !== undefined) {
          if (
            typeof updates.name !== 'string' ||
            updates.name.trim().length === 0
          ) {
            return res
              .status(400)
              .json({ error: 'Character name cannot be empty' });
          }
          if (updates.name.trim().length > 255) {
            return res
              .status(400)
              .json({ error: 'Character name must be 255 characters or less' });
          }
          updates.name = updates.name.trim();
        }

        await this.db.updateCharacter(characterId, updates);

        res.json({ success: true, message: 'Character updated successfully' });
      } catch (error) {
        console.error('Failed to update character:', error);
        res.status(500).json({ error: 'Failed to update character' });
      }
    });

    /**
     * DELETE /api/characters/:id
     * Deletes a character
     * Requires authentication and ownership
     */
    this.app.delete('/api/characters/:id', async (req, res) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const characterId = req.params.id;

        // Verify ownership
        const character = await this.db.getCharacterById(characterId);
        if (!character) {
          return res.status(404).json({ error: 'Character not found' });
        }

        const user = req.user as { id: string };
        if (character.ownerId !== user.id) {
          return res.status(403).json({ error: 'Access denied' });
        }

        await this.db.deleteCharacter(characterId);

        res.json({ success: true, message: 'Character deleted successfully' });
      } catch (error) {
        console.error('Failed to delete character:', error);
        res.status(500).json({ error: 'Failed to delete character' });
      }
    });

    /**
     * DELETE /api/characters
     * Deletes all characters owned by the authenticated user
     */
    this.app.delete('/api/characters', async (req, res) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const user = req.user as { id: string };
        const deletedCount = await this.db.deleteCharactersByUser(user.id);

        res.json({
          success: true,
          deletedCount,
        });
      } catch (error) {
        console.error('Failed to delete all characters:', error);
        res.status(500).json({ error: 'Failed to delete characters' });
      }
    });

    /**
     * POST /api/tokens/save
     * Saves a customized token image to the server
     * Body: { tokenId: string, imageData: string (base64), name: string }
     */
    this.app.post('/api/tokens/save', async (req, res) => {
      try {
        const { tokenId, imageData, name } = req.body;

        if (!tokenId || !imageData || !name) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate that imageData is a base64 PNG
        if (!imageData.startsWith('data:image/png;base64,')) {
          return res.status(400).json({ error: 'Invalid image format' });
        }

        // Extract base64 data
        const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Create custom tokens directory if it doesn't exist
        // Save to ASSETS_PATH/assets/tokens/custom to match the static serve path
        const customTokensDir = path.join(
          this.ASSETS_PATH,
          'assets',
          'tokens',
          'custom',
        );
        if (!fs.existsSync(customTokensDir)) {
          fs.mkdirSync(customTokensDir, { recursive: true });
        }

        // Generate filename from tokenId
        const sanitizedName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const sanitizedId = String(tokenId).replace(/[^a-z0-9]/gi, '_');
        const filename = `${sanitizedName}_${sanitizedId}.png`;
        const filepath = path.join(customTokensDir, filename);

        // Reject if resolved path escapes the tokens directory
        if (!filepath.startsWith(path.resolve(customTokensDir) + path.sep)) {
          return res.status(400).json({ error: 'Invalid token path' });
        }

        // Write the file
        fs.writeFileSync(filepath, buffer);

        // Return the server path
        const serverPath = `/assets/tokens/custom/${filename}`;

        console.log(`💾 Saved custom token: ${sanitizeLog(serverPath)}`);
        res.json({
          success: true,
          path: serverPath,
          message: 'Token saved successfully',
        });
      } catch (error) {
        console.error('Failed to save token:', error);
        res.status(500).json({ error: 'Failed to save token' });
      }
    });
  }

  /**
   * Sets up document routes for accessing NexusCodex services
   * @private
   * @returns {void}
   */
  private setupDocumentRoutes(): void {
    // Delta-sync observability. Registered BEFORE the '/api' document-router
    // mount below, otherwise that router's catch-all 404 shadows it.
    this.app.get('/api/metrics/delta-sync', (req, res) => {
      const totalResyncs = Object.values(this.deltaSyncMetrics.resync).reduce(
        (sum, count) => sum + count,
        0,
      );
      const totalCommits =
        this.deltaSyncMetrics.commits.legacy +
        this.deltaSyncMetrics.commits.full +
        this.deltaSyncMetrics.commits.patch;
      // totalUploads already counts every attempt (commits AND resyncs), so it
      // is the correct denominator — adding totalResyncs again would understate
      // the rate (the dangerous direction for a health signal).
      const totalOps = this.deltaSyncMetrics.totalUploads;
      const resyncRate = totalOps > 0 ? (totalResyncs / totalOps) * 100 : 0;
      res.json({
        commits: this.deltaSyncMetrics.commits,
        totalCommits,
        resync: this.deltaSyncMetrics.resync,
        totalResyncs,
        patchBytesSaved: this.deltaSyncMetrics.patchBytesSaved,
        totalUploads: this.deltaSyncMetrics.totalUploads,
        resyncRate: parseFloat(resyncRate.toFixed(2)),
        timestamp: Date.now(),
      });
    });

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

  private setupHealthRoutes(): void {
    this.app.get('/health', async (req, res) => {
      const wsUrl =
        process.env.NODE_ENV === 'production'
          ? '/ws'
          : `ws://localhost:${this.port}`;

      try {
        await this.db.healthCheck();
        res.json({
          status: 'ok',
          version: '1.0.0',
          port: this.port,
          wsUrl,
          rooms: this.socketManager.rooms.size,
          connections: this.socketManager.connections.size,
          assetsLoaded: this.manifest?.totalAssets || 0,
          uptime: process.uptime(),
        });
      } catch {
        res.status(503).json({
          status: 'error',
          reason: 'database unavailable',
          uptime: process.uptime(),
        });
      }
    });

    this.app.get('/', (req, res) => {
      // In production behind nginx proxy, use relative /ws path
      // In development, use localhost:port for direct connection
      const wsUrl =
        process.env.NODE_ENV === 'production'
          ? '/ws'
          : `ws://localhost:${this.port}`;

      res.json({
        status: 'ok',
        port: this.port,
        wsUrl,
        rooms: this.socketManager.rooms.size,
        connections: this.socketManager.connections.size,
      });
    });
  }

  private setupAssetRoutes() {
    const assetApiUrl = process.env.ASSET_API_URL || 'http://localhost:5003';

    const assetProxy = createProxyMiddleware({
      target: assetApiUrl,
      changeOrigin: true,
    });

    this.app.use('/manifest.json', assetProxy);
    this.app.use('/search', assetProxy);
    this.app.use('/category', assetProxy);
    this.app.use('/asset', assetProxy);

    Object.values(ASSET_CATEGORIES).forEach((categoryName) => {
      this.app.use(`/${categoryName}/assets`, assetProxy);
      this.app.use(`/${categoryName}/thumbnails`, assetProxy);
    });
    this.app.use('/assets', assetProxy);
    this.app.use('/thumbnails', assetProxy);
    this.app.use('/users', assetProxy);

    // ADR-0012: the VTT authenticates the session user (assetWriteGuard) and
    // only then forwards to the asset service with the shared secret. The
    // asset service itself has no dev-secret fallback (see
    // services/asset-service/src/index.ts), so a fallback here would only
    // ever succeed against a local asset-service instance where the
    // operator deliberately set ASSET_SERVICE_SECRET=dev-secret. It is
    // gated to non-production and logged so it can't silently ship.
    let assetServiceSecret = process.env.ASSET_SERVICE_SECRET;
    if (!assetServiceSecret) {
      if (process.env.NODE_ENV === 'production') {
        console.error(
          '❌ ASSET_SERVICE_SECRET is not set in production. User asset uploads/deletes will be rejected by the asset service.',
        );
      } else {
        console.warn(
          '⚠️ ASSET_SERVICE_SECRET not set — falling back to "dev-secret" for local development only.',
        );
        assetServiceSecret = 'dev-secret';
      }
    }

    const userAssetProxy = createProxyMiddleware({
      target: assetApiUrl,
      changeOrigin: true,
      pathRewrite: { '^/api/user': '/user' },
      on: {
        proxyReq: (proxyReq: any, _req: any, _res: any) => {
          if (assetServiceSecret) {
            proxyReq.setHeader('x-nexus-auth', assetServiceSecret);
          }
        }
      }
    });

    // Mounted at '/api/user' (not '/user') to match the client's existing
    // call site (src/services/tokenAssets.ts) and to sit alongside the
    // other /api/* routes without ambiguity vs. the public /users read
    // mount. assetWriteGuard runs first and validates the session before
    // the proxy injects the shared secret; pathRewrite strips the '/api'
    // prefix so the asset service still sees /user/:userId/...
    this.app.use('/api/user', assetWriteGuard, userAssetProxy);

    this.app.use((req, res, next) => {
      if (
        req.path.startsWith('/api') ||
        req.path.startsWith('/manifest') ||
        req.path.startsWith('/search') ||
        req.path.startsWith('/category') ||
        req.path.startsWith('/asset/')
      ) {
        res.status(404).json({
          error: 'Not found',
          availableEndpoints: [
            '/health',
            '/manifest.json',
            '/search?q=term',
            '/category/:name',
            '/asset/:id',
            '/assets/:filename',
            '/thumbnails/:filename',
          ],
        });
      } else {
        next();
      }
    });
  }

  private loadManifest() {
    try {
      const manifestPath = path.join(this.ASSETS_PATH, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        this.manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        console.log(
          `📋 Loaded manifest: ${this.manifest?.totalAssets} assets in ${this.manifest?.categories.length} categories`,
        );
      } else {
        console.warn('⚠️  No manifest.json found at', manifestPath);
        this.manifest = {
          version: '1.0.0',
          generatedAt: new Date().toISOString(),
          totalAssets: 0,
          categories: [],
          assets: [],
        };
      }
    } catch (error) {
      console.error('❌ Failed to load manifest:', error);
      this.manifest = {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        totalAssets: 0,
        categories: [],
        assets: [],
      };
    }

    if (process.env.NODE_ENV !== 'production') {
      const manifestPath = path.join(this.ASSETS_PATH, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        fs.watchFile(manifestPath, () => {
          console.log('📋 Manifest changed, reloading...');
          this.loadManifest();
        });
      }
    }
  }

  private async handleConnection(ws: WebSocket, req: RequestWithSession) {
    const user = req.session?.passport?.user;
    const guestUser = req.session?.guestUser;
    const url = new URL(req.url!, 'ws://localhost');
    const params = url.searchParams;
    const userIdFromQuery = params.get('userId');
    const userNameFromQuery = params.get('userName');

    // Priority: authenticated user > guest user > query param > new UUID
    let uuid = user?.id || guestUser?.id || userIdFromQuery || uuidv4();
    const displayName =
      user?.name || guestUser?.name || userNameFromQuery || 'Guest';
    let userType = user ? 'Authenticated' : guestUser ? 'Guest' : 'Anonymous';

    // To prevent identity spoofing, verify that if a userId is claimed via query param
    // but the connection is anonymous (no active session cookie), it does not clash
    // with an existing user in the database.
    if (!user && !guestUser && userIdFromQuery) {
      try {
        const existingUser = await this.db.getUserById(userIdFromQuery);
        if (existingUser) {
          // Deny impersonation: generate a new UUID and treat as Anonymous
          console.warn(
            `⚠️ Security warning: Connection from anonymous client attempted to claim existing user ID ${userIdFromQuery}. Generating a new guest identity.`,
          );
          uuid = uuidv4();
          userType = 'Anonymous';
        }
      } catch (error) {
        console.warn(`Failed to verify userIdFromQuery:`, error);
      }
    }

    // Ensure user exists in database (critical for foreign key constraints)
    // For guest users, create them in the database if they don't exist
    if (userType === 'Guest' || userType === 'Anonymous') {
      try {
        const existingUser = await this.db.getUserById(uuid);
        if (!existingUser) {
          console.log(
            `🔧 Creating missing database record for user: ${uuid} (${displayName})`,
          );
          await this.db.createGuestUser(displayName, uuid);
          console.log(`✅ Guest user created in database: ${uuid}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to ensure user exists in database:`, error);
      }
    }

    console.log(`📡 New connection: ${uuid} (${userType} as ${displayName})`);

    const connection = this.socketManager.addConnection(ws, displayName, uuid);

    const host = params.get('host');
    const join = params.get('join')?.toUpperCase();
    const reconnect = params.get('reconnect')?.toUpperCase();
    const campaignId = params.get('campaignId'); // Get campaign ID from query params

    if (host) {
      await this.handleHostConnection(connection, host, campaignId);
    } else if (reconnect) {
      await this.handleHostReconnection(connection, reconnect, campaignId);
    } else if (join) {
      await this.handleJoinConnection(connection, join);
    } else {
      await this.handleDefaultConnection(connection, campaignId);
    }
  }

  /**
   * Handles a new host connection (creates campaign and session)
   * If campaignId is provided, uses existing campaign; otherwise creates a new one.
   * Creates session in database, then initializes in-memory room state.
   * @private
   * @param {Connection} connection - WebSocket connection object
   * @param {string} [hostRoomCode] - Optional specific room code to use
   * @param {string | null} [campaignId] - Optional campaign ID to use (from authenticated user)
   * @returns {Promise<void>}
   */
  private async handleHostConnection(
    connection: Connection,
    hostRoomCode?: string,
    campaignId?: string | null,
  ): Promise<void> {
    try {
      const normalizedHostCode = hostRoomCode?.toUpperCase();
      let preferredRoomCode = normalizedHostCode;

      let usedCampaignId: string;
      let campaignScenes: unknown[] = [];

      if (campaignId) {
        console.log(`🗂️ Using existing campaign: ${campaignId}`);
        usedCampaignId = campaignId;

        const campaign = await this.db.getCampaignById(campaignId);
        if (!campaign) {
          this.sendError(connection, 'Campaign not found');
          return;
        }
        if (!preferredRoomCode && campaign.lastRoomCode) {
          preferredRoomCode = campaign.lastRoomCode.toUpperCase();
        }
        if (campaign.scenes) {
          campaignScenes = Array.isArray(campaign.scenes)
            ? campaign.scenes
            : [];
          console.log(
            `📚 Loaded ${campaignScenes.length} scenes from campaign`,
          );
        }
      } else {
        console.log(`🗂️ Creating new campaign for guest DM`);
        const campaign = await this.db.createCampaign(
          connection.id,
          `Campaign ${preferredRoomCode || 'Session'}`,
          'Auto-created campaign for quick session',
        );
        usedCampaignId = campaign.id;
      }

      if (preferredRoomCode && this.socketManager.rooms.has(preferredRoomCode)) {
        console.log(
          `🔄 Reusing active room code ${preferredRoomCode} for campaign ${usedCampaignId}`,
        );
        await this.handleHostReconnection(
          connection,
          preferredRoomCode,
          campaignId,
        );
        return;
      }

      let sessionId = '';
      let joinCode = '';

      if (preferredRoomCode) {
        const existingSession =
          await this.db.getSessionByJoinCode(preferredRoomCode);
        if (existingSession) {
          if (existingSession.campaignId === usedCampaignId) {
            const activated = await this.db.activateSessionByJoinCode(
              preferredRoomCode,
              connection.id,
            );
            if (!activated) {
              this.sendError(connection, 'Failed to reactivate session');
              return;
            }
            sessionId = activated.id;
            joinCode = activated.joinCode;
          } else {
            preferredRoomCode = undefined;
          }
        } else {
          const created = await this.db.createSessionWithJoinCode(
            usedCampaignId,
            connection.id,
            preferredRoomCode,
          );
          sessionId = created.sessionId;
          joinCode = created.joinCode;
        }
      }

      if (!preferredRoomCode) {
        const created = await this.db.createSession(
          usedCampaignId,
          connection.id,
        );
        sessionId = created.sessionId;
        joinCode = created.joinCode;
      }

      try {
        await this.db.updateCampaign(usedCampaignId, {
          lastRoomCode: joinCode,
          lastRoomCodeUpdatedAt: new Date(),
        });
      } catch (error) {
        console.warn('Failed to update campaign room code:', error);
      }

      // Create in-memory room state for real-time operations
      const room: Room = {
        code: joinCode,
        host: connection.id,
        coHosts: new Set(),
        players: new Set([connection.id]),
        connections: new Map([[connection.id, connection.ws]]),
        created: Date.now(),
        lastActivity: Date.now(),
        status: 'active',
        dmConnected: true,
        stateVersion: 0, // Initialize state version for delta updates
        entityVersions: new Map(),
        syncToken: null, // No committed state yet
      };

      this.socketManager.rooms.set(joinCode, room);
      connection.room = joinCode;
      connection.user!.type = 'host'; // Preserve the user's actual name from OAuth/guest login

      // Send session created confirmation to client
      this.sendMessage(connection, {
        type: 'event',
        data: {
          name: 'session/created',
          roomCode: joinCode,
          room: joinCode, // Keep for backward compatibility
          sessionId,
          campaignId: usedCampaignId,
          campaignScenes, // Include campaign scenes for loading into game state
          uuid: connection.id,
          hostId: connection.id,
          coHostIds: Array.from(room.coHosts),
          dmConnected: room.dmConnected,
          players: [
            {
              id: connection.id,
              name: connection.user!.name || 'Host',
              type: 'host',
              color: 'blue',
              connected: true,
              canEditScenes: true,
            },
          ],
        },
        timestamp: Date.now(),
      });

      console.log(
        `🏠 Session created: ${joinCode} (${sessionId}) for campaign ${usedCampaignId}`,
      );
    } catch (error) {
      console.error('Failed to create session:', error);
      this.sendError(connection, 'Failed to create session');
    }
  }

  private async handleHostReconnection(
    connection: Connection,
    roomCode: string,
    campaignId?: string | null,
  ) {
    const normalizedRoomCode = roomCode.toUpperCase();
    let room = this.socketManager.rooms.get(normalizedRoomCode);

    if (!room) {
      const session = await this.db.getSessionByJoinCode(normalizedRoomCode);
      if (session) {
        if (campaignId && session.campaignId !== campaignId) {
          this.sendError(connection, 'Room code belongs to another campaign');
          return;
        }
        await this.db.activateSessionByJoinCode(
          normalizedRoomCode,
          connection.id,
        );
        room = await this.recoverRoomFromSession(normalizedRoomCode);
      } else if (campaignId) {
        const campaign = await this.db.getCampaignById(campaignId);
        if (
          !campaign ||
          campaign.lastRoomCode?.toUpperCase() !== normalizedRoomCode
        ) {
          this.sendError(connection, 'Room not found');
          return;
        }
        const created = await this.db.createSessionWithJoinCode(
          campaignId,
          connection.id,
          normalizedRoomCode,
        );
        room = {
          code: created.joinCode,
          host: connection.id,
          coHosts: new Set(),
          players: new Set([connection.id]),
          connections: new Map(),
          created: Date.now(),
          lastActivity: Date.now(),
          status: 'active',
          dmConnected: true,
          hibernationTimer: undefined,
          gameState: undefined,
          previousGameState: undefined,
          stateVersion: 0,
          entityVersions: new Map(),
          syncToken: null, // No committed state yet
        };
        this.socketManager.rooms.set(created.joinCode, room);
      }
    }

    if (!room) {
      this.sendError(connection, 'Room not found');
      return;
    }

    // Reactivate hibernated room and restore host
    if (room.status === 'hibernating') {
      console.log(
        `🔄 Host reconnecting to hibernated room: ${normalizedRoomCode}`,
      );

      room.status = 'active';
      room.lastActivity = Date.now();

      // Clear hibernation timer
      if (room.hibernationTimer) {
        clearTimeout(room.hibernationTimer);
        room.hibernationTimer = undefined;
      }

      // Load game state from database if not in memory
      if (!room.gameState) {
        try {
          const session =
            await this.db.getSessionByJoinCode(normalizedRoomCode);
          if (session?.gameState) {
            room.gameState = session.gameState as GameState;
            console.log(
              `📂 Loaded game state from database: ${(session.gameState as GameState).scenes?.length || 0} scenes`,
            );
          }
        } catch (error) {
          console.error(
            `Failed to load game state for room ${roomCode}:`,
            error,
          );
        }
      }
    } else {
      console.log(`🔄 Host reconnecting to active room: ${normalizedRoomCode}`);
    }

    // Set up host connection
    room.host = connection.id;
    room.dmConnected = true;
    room.players.add(connection.id);
    room.connections.set(connection.id, connection.ws);
    room.lastActivity = Date.now();
    connection.room = normalizedRoomCode;
    connection.user = { name: 'Host', type: 'host' };

    if (campaignId) {
      try {
        await this.db.updateCampaign(campaignId, {
          lastRoomCode: normalizedRoomCode,
          lastRoomCodeUpdatedAt: new Date(),
        });
      } catch (error) {
        console.error('Failed to update campaign room code:', error);
      }
    }

    try {
      const session = await this.db.getSessionByJoinCode(normalizedRoomCode);
      if (session) {
        await this.db.addPlayerToSession(connection.id, session.id);
      }
    } catch (error) {
      console.error('Failed to update host connection in database:', error);
    }

    // Send reconnection confirmation
    console.log(
      `🎮 Room gameState when reconnecting:`,
      room.gameState ? 'exists' : 'null',
      room.gameState
        ? `${room.gameState.scenes?.length || 0} scenes`
        : 'no data',
    );
    this.sendMessage(connection, {
      type: 'event',
      data: {
        name: 'session/reconnected',
        roomCode: normalizedRoomCode,
        room: normalizedRoomCode,
        uuid: connection.id,
        hostId: room.host,
        roomStatus: room.status,
        gameState: room.gameState,
        dmConnected: room.dmConnected,
      },
      timestamp: Date.now(),
    });

    // Notify all players about host reconnection
    this.broadcastToRoom(
      normalizedRoomCode,
      {
        type: 'event',
        data: {
          name: 'session/host-reconnected',
          uuid: connection.id,
        },
        timestamp: Date.now(),
      },
      connection.id,
    );

    this.broadcastToRoom(
      normalizedRoomCode,
      {
        type: 'event',
        data: {
          name: 'session/dm-status',
          dmConnected: true,
        },
        timestamp: Date.now(),
      },
      connection.id,
    );

    console.log(
      `🏠 Host reconnected to room ${normalizedRoomCode}: ${connection.id}`,
    );
  }

  /**
   * Handles a player joining an existing room/session
   * Adds player to session in database and broadcasts to other players
   * @private
   * @param {Connection} connection - WebSocket connection object
   * @param {string} roomCode - Join code of the room to join
   * @returns {Promise<void>}
   */
  private async handleJoinConnection(
    connection: Connection,
    roomCode: string,
  ): Promise<void> {
    let room = this.socketManager.rooms.get(roomCode);
    let sessionRecord: SessionRecord | null = null;

    if (!room) {
      const recoveredRoom = await this.recoverRoomFromSession(roomCode);
      if (!recoveredRoom) {
        this.sendError(
          connection,
          'Room not found or offline - ask the host to reopen the session',
        );
        return;
      }
      room = recoveredRoom;
    }

    // Attempt room recovery if needed
    if (room.status !== 'active') {
      const recovered = this.attemptRoomRecovery(roomCode, connection);
      if (!recovered) {
        this.sendError(connection, 'Room is no longer available');
        return;
      }
    }

    // Add player to in-memory room state
    room.players.add(connection.id);
    room.connections.set(connection.id, connection.ws);
    room.lastActivity = Date.now();
    connection.room = roomCode;
    connection.user = { name: 'Player', type: 'player' };

    // Add player to database session
    try {
      sessionRecord = await this.db.getSessionByJoinCode(roomCode);
      if (sessionRecord) {
        await this.db.addPlayerToSession(connection.id, sessionRecord.id);
      }
    } catch (error) {
      console.error('Failed to add player to session in database:', error);
    }

    // Notify player they joined
    this.sendMessage(connection, {
      type: 'event',
      data: {
        name: 'session/joined',
        roomCode,
        room: roomCode, // Keep for backward compatibility
        uuid: connection.id,
        hostId: room.host,
        coHostIds: Array.from(room.coHosts),
        roomStatus: room.status,
        gameState: room.gameState,
        campaignId: sessionRecord?.campaignId,
        dmConnected: room.dmConnected,
        players: Array.from(room.players).map((playerId) => {
          const conn = this.socketManager.connections.get(playerId);
          return {
            id: playerId,
            name: conn?.user?.name || 'Unknown',
            type:
              playerId === room.host
                ? 'host'
                : room.coHosts.has(playerId)
                  ? 'host'
                  : 'player',
            color: 'blue',
            connected: true,
            canEditScenes: playerId === room.host || room.coHosts.has(playerId),
          };
        }),
      },
      timestamp: Date.now(),
    });

    // Notify other players about the new player
    this.broadcastToRoom(
      roomCode,
      {
        type: 'event',
        data: {
          name: 'session/join',
          uuid: connection.id,
          player: {
            id: connection.id,
            name: connection.user!.name || 'Player',
            type: 'player',
            color: 'blue',
            connected: true,
            canEditScenes: false,
          },
        },
        timestamp: Date.now(),
      },
      connection.id,
    );

    console.log(`👋 Player joined room ${roomCode}: ${connection.id}`);
  }

  private async handleDefaultConnection(
    connection: Connection,
    campaignId?: string | null,
  ) {
    const roomCode = this.generateRoomCode();
    await this.handleHostConnection(connection, roomCode, campaignId);
  }

  private routeMessage(fromUuid: string, message: ServerMessage) {
    // Handle heartbeat messages regardless of room state
    if (message.type === 'heartbeat') {
      const heartbeatData = message.data as {
        type: 'ping' | 'pong';
        id: string;
      };
      if (heartbeatData.type === 'pong') {
        this.handleHeartbeatPong(fromUuid, heartbeatData.id);
      }
      return;
    }

    const connection = this.socketManager.connections.get(fromUuid);
    if (!connection?.room) return;

    const room = this.socketManager.rooms.get(connection.room);
    if (!room) return;

    room.lastActivity = Date.now();

    if (message.type === 'event') {
      const eventName = (message.data as { name?: string })?.name;
      const isSenderHost =
        room.host === connection.id || room.coHosts.has(connection.id);

      const dmOnlyActions = new Set([
        'game-state-update',
        'scene/create',
        'scene/update',
        'scene/delete',
        'scene/reorder',
        'scene/change',
        'host/transfer',
        'host/add-cohost',
        'host/remove-cohost',
        'drawing/clear',
        'session/kickPlayer',
        'session/updatePermissions',
      ]);

      const dmOfflineRestrictedActions = new Set([
        'drawing/create',
        'drawing/update',
        'drawing/delete',
        'token/place',
        'token/update',
        'token/delete',
        'token/move',
        'prop/place',
        'prop/update',
        'prop/delete',
        'prop/move',
        'prop/interact',
      ]);

      // Enforce DM-Only actions: Only host or co-host can perform
      if (eventName && dmOnlyActions.has(eventName) && !isSenderHost) {
        connection.maliciousAttemptsCount = (connection.maliciousAttemptsCount || 0) + 1;
        console.warn(
          `⚠️ Security violation: Unauthorized user ${connection.id} attempted DM-Only action "${eventName}" (Attempt ${connection.maliciousAttemptsCount}/3)`,
        );

        this.sendMessage(connection, {
          type: 'error',
          data: {
            message: 'Access denied: Host privilege required.',
            code: 403,
          },
          timestamp: Date.now(),
        });

        if (connection.maliciousAttemptsCount >= 3) {
          console.error(
            `🔌 Anti-tamper: Terminating connection for user ${connection.id} due to repeated security violations.`,
          );
          connection.ws.terminate();
        }
        return;
      }

      // Enforce DM-Offline restrictions: Players cannot perform when DM is offline
      if (
        eventName &&
        dmOfflineRestrictedActions.has(eventName) &&
        !isSenderHost &&
        !room.dmConnected
      ) {
        this.sendMessage(connection, {
          type: 'error',
          data: {
            message: 'Host is offline; this action is temporarily restricted.',
            code: 403,
          },
          timestamp: Date.now(),
        });
        return;
      }
    }

    if (
      message.type === 'event' &&
      message.data?.name === 'dice/roll-request'
    ) {
      this.handleDiceRollRequest(
        fromUuid,
        connection,
        message.data as unknown as DiceRollRequest,
      );
      return;
    }

    if (message.type === 'event') {
      const eventName = message.data?.name;
      if (eventName === 'host/transfer') {
        this.handleHostTransfer(
          fromUuid,
          connection,
          room,
          message.data as unknown as { targetUserId: string },
        );
        return;
      } else if (eventName === 'host/add-cohost') {
        this.handleAddCoHost(
          fromUuid,
          connection,
          room,
          message.data as unknown as { targetUserId: string },
        );
        return;
      } else if (eventName === 'host/remove-cohost') {
        this.handleRemoveCoHost(
          fromUuid,
          connection,
          room,
          message.data as unknown as { targetUserId: string },
        );
        return;
      }
    }

    if (
      message.type === 'event' &&
      message.data?.name === 'game-state-update'
    ) {
      // NOTE: routeMessage is legacy/unused (SocketManager.handleMessage drives
      // the live path via the 'event:game-state-update' subscription). Kept in
      // sync with the new content-hash commit flow for correctness.
      const senderIsHost =
        room.host === connection.id || room.coHosts.has(connection.id);
      if (senderIsHost) {
        this.handleGameStateUpload(
          connection.room,
          connection,
          message.data,
        );
      } else {
        this.sendError(connection, 'Access denied: Host privilege required.');
      }
    }

    if (
      message.type === 'event' &&
      [
        'token/move',
        'token/update',
        'token/delete',
        'prop/move',
        'prop/update',
        'prop/delete',
        'prop/interact',
      ].includes((message.data as { name: string })?.name)
    ) {
      const eventData = message.data as {
        name: string;
        tokenId?: string;
        propId?: string;
        expectedVersion: number;
      };
      const entityId = eventData.tokenId || eventData.propId;
      const expectedVersion = eventData.expectedVersion;

      if (entityId && expectedVersion !== undefined) {
        const currentVersion = room.entityVersions.get(entityId) || 0;

        if (expectedVersion < currentVersion) {
          console.warn(
            `⚠️ Version conflict detected for ${entityId}: expected ${expectedVersion}, current ${currentVersion}`,
          );

          this.sendMessage(connection, {
            type: 'error',
            data: {
              message: `Update rejected due to version conflict for ${entityId} (expected v${expectedVersion}, current v${currentVersion})`,
              code: 409,
            },
            timestamp: Date.now(),
          });

          return;
        }

        room.entityVersions.set(entityId, expectedVersion + 1);
      }
    }

    if (
      message.type === 'event' &&
      (message.data as unknown as { updateId: string })?.updateId &&
      (message.data as unknown as { name: string })?.name !== 'cursor/update'
    ) {
      this.sendMessage(connection, {
        type: 'update-confirmed',
        data: {
          updateId: (message.data as unknown as { updateId: string }).updateId,
        },
        timestamp: Date.now(),
      });
    }

    if (message.type === 'chat-message') {
      this.handleChatMessage(fromUuid, connection, message);
      return;
    }

    if (message.dst) {
      const targetConnection = this.socketManager.connections.get(message.dst);
      if (targetConnection && room.connections.has(message.dst)) {
        this.sendMessage(targetConnection, {
          ...message,
          src: fromUuid,
          timestamp: Date.now(),
        });
      }
    } else {
      this.broadcastToRoom(
        connection.room,
        {
          ...message,
          src: fromUuid,
          timestamp: Date.now(),
        },
        fromUuid,
      );
    }
  }

  private handleChatMessage(
    fromUuid: string,
    connection: Connection,
    message: ServerChatMessage,
  ) {
    if (!connection.room) return;
    const room = this.socketManager.rooms.get(connection.room);
    if (!room) return;
    const content = message.data?.content || '';
    console.log(
      `💬 Chat message from ${fromUuid} in room ${connection.room}: ${content}`,
    );
    this.broadcastToRoom(
      connection.room,
      {
        ...message,
        src: fromUuid,
        timestamp: Date.now(),
      },
      fromUuid,
    );
  }

  private handleDiceRollRequest(
    fromUuid: string,
    connection: Connection,
    data: DiceRollRequest,
  ) {
    console.log(`🎲 Dice roll request from ${fromUuid}:`, data);
    const validation = validateDiceRollRequest(data);
    if (!validation.valid) {
      this.sendError(
        connection,
        validation.error || 'Invalid dice roll request',
      );
      return;
    }
    const userName = connection.user!.name || 'Unknown Player';
    const isHost = connection.user!.type === 'host';
    const roll = createServerDiceRoll(data.expression, fromUuid, userName, {
      isPrivate: isHost && data.isPrivate,
      advantage: data.advantage,
      disadvantage: data.disadvantage,
    });
    if (!roll) {
      this.sendError(connection, 'Failed to create dice roll');
      return;
    }
    console.log(`🎲 Dice roll generated:`, {
      id: roll.id,
      expression: roll.expression,
      total: roll.total,
      crit: roll.crit,
    });
    this.broadcastToRoom(connection.room!, {
      type: 'event',
      data: {
        name: 'dice/roll-result',
        roll,
      } as ServerDiceRollResultMessage['data'],
      src: fromUuid,
      timestamp: Date.now(),
    });
  }

  // Hard caps guarding the critical section from oversized payloads. A trip
  // sends a payload-too-large resync instead of touching room state.
  private static readonly MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MiB serialized
  private static readonly MAX_PATCH_OPS = 5000;

  /**
   * Commits a host game-state upload through the content-hash token chain and
   * fans it out. Accepts THREE input shapes on `data`:
   *   - Tagged full  : data.upload = { kind: 'full',  state, newToken }
   *   - Tagged patch : data.upload = { kind: 'patch', patch, baseToken, newToken }
   *   - Legacy       : no data.upload; top-level { scenes, activeSceneId,
   *                    characters, initiative } (current client format).
   *
   * CRITICAL SECTION: between reading room.syncToken and writing the new
   * room.gameState + room.syncToken there is ZERO `await`. All hashing is the
   * synchronous hashSync(); DB persistence is dispatched (fire-and-forget)
   * strictly AFTER the token has advanced.
   *
   * The host gate is enforced by the caller.
   * @private
   */
  private handleGameStateUpload(
    roomCode: string,
    sender: Connection,
    data: unknown,
  ): void {
    const room = this.socketManager.rooms.get(roomCode);
    if (!room) return;

    const upload = (data as { upload?: GameStateUpload }).upload;
    this.deltaSyncMetrics.totalUploads++;

    // ---- payload-too-large guard (before touching any state) -------------
    if (upload) {
      const serialized = JSON.stringify(upload);
      if (serialized.length > NexusServer.MAX_UPLOAD_BYTES) {
        this.sendResync(sender, room.syncToken, 'payload-too-large');
        return;
      }
      if (
        upload.kind === 'patch' &&
        upload.patch.length > NexusServer.MAX_PATCH_OPS
      ) {
        this.sendResync(sender, room.syncToken, 'payload-too-large');
        return;
      }
    } else {
      // Legacy untagged snapshot: guard on the serialized top-level data.
      const serialized = JSON.stringify(data ?? {});
      if (serialized.length > NexusServer.MAX_UPLOAD_BYTES) {
        this.sendResync(sender, room.syncToken, 'payload-too-large');
        return;
      }
    }

    // ================== CRITICAL SECTION (no await below) =================
    // Capture the pre-commit anchors BEFORE mutating the room.
    const prevToken = room.syncToken;
    const prevState: SyncableGameState = room.gameState
      ? (jsonpatch.deepClone(room.gameState) as unknown as SyncableGameState)
      : { scenes: [], activeSceneId: null, characters: [], initiative: {} };

    // The committed next state + its token, resolved per input shape. A null
    // committed marks a rejection (resync already sent) so we bail without
    // advancing the chain.
    let committed: SyncableGameState | null = null;
    let committedToken: StateHash | null = null;
    // For patch uploads we reuse the client's patch as the peer broadcast; for
    // full/legacy we compute a delta below. undefined = compute delta.
    let broadcastPatch: JsonPatch | undefined;

    if (!upload) {
      // --- Legacy full (trusted; client sent no token, no integrity check) --
      const state = this.buildSyncableFromLegacy(data);
      committed = state;
      committedToken = hashSync(state as unknown as JsonValue);
    } else if (upload.kind === 'full') {
      // --- Tagged full: verify integrity against declared newToken ----------
      if (hashSync(upload.state as unknown as JsonValue) !== upload.newToken) {
        this.sendResync(sender, room.syncToken, 'integrity-mismatch');
        return;
      }
      committed = upload.state;
      committedToken = upload.newToken;
    } else {
      // --- Patch: base-match, apply, integrity-check ------------------------
      if (upload.baseToken !== room.syncToken) {
        this.sendResync(sender, room.syncToken, 'base-mismatch');
        return; // no mutation
      }
      let candidate: SyncableGameState;
      try {
        const result = jsonpatch.applyPatch(
          jsonpatch.deepClone(prevState),
          upload.patch as Operation[],
          /* validateOperation */ true,
        );
        candidate = result.newDocument as unknown as SyncableGameState;
      } catch {
        this.sendResync(sender, room.syncToken, 'malformed-patch');
        return;
      }
      if (hashSync(candidate as unknown as JsonValue) !== upload.newToken) {
        this.sendResync(sender, room.syncToken, 'integrity-mismatch');
        return;
      }
      committed = candidate;
      committedToken = upload.newToken;
      broadcastPatch = upload.patch;
    }

    // Commit: advance authoritative state + token + version atomically.
    room.gameState = committed as unknown as GameState;
    room.syncToken = committedToken;
    room.stateVersion++;
    room.previousGameState = prevState as unknown as GameState;
    const newToken = room.syncToken;
    const version = room.stateVersion;

    // Record commit branch for metrics (legacy/full/patch).
    if (!upload) {
      this.deltaSyncMetrics.commits.legacy++;
    } else if (upload.kind === 'full') {
      this.deltaSyncMetrics.commits.full++;
    } else {
      // upload.kind === 'patch'
      this.deltaSyncMetrics.commits.patch++;
      // Calculate bytes saved: max(0, fullSnapshotSize - patchSize).
      const fullSnapshotBytes = JSON.stringify(committed).length;
      const patchBytes = JSON.stringify(upload.patch).length;
      this.deltaSyncMetrics.patchBytesSaved += Math.max(
        0,
        fullSnapshotBytes - patchBytes,
      );
    }

    // Peer delta: for full/legacy commits compute prevState -> committed so
    // peers still receive a minimal patch rather than a whole snapshot.
    const patch: JsonPatch =
      broadcastPatch ??
      (jsonpatch.compare(
        prevState as unknown as Record<string, unknown>,
        committed as unknown as Record<string, unknown>,
      ) as JsonPatch);
    // =================== END CRITICAL SECTION =============================

    // 1) Ack the sender (excluded from the peer broadcast) so it advances its
    //    own chain to the committed token.
    this.sendSyncAck(sender, newToken, version);

    // 2) Broadcast the chained patch to peers, excluding the sender.
    if (patch.length > 0) {
      this.broadcastToRoom(
        roomCode,
        {
          type: 'game-state-patch',
          data: {
            patch: patch as unknown[],
            version,
            baseToken: prevToken,
            newToken,
          },
          timestamp: Date.now(),
        },
        sender.id,
      );
      console.log(
        `📡 Broadcasting game state patch v${version} to room ${roomCode} (${patch.length} operations) [excluding sender ${sender.id}]`,
      );
    }

    // 3) Persist off the critical path (the one `await`, fire-and-forget).
    void this.persistRoomGameState(roomCode);
  }

  /**
   * Builds a SyncableGameState from a legacy untagged snapshot (the current
   * client format), tolerating missing fields. Trusted fallback: no token was
   * supplied, so no integrity check is possible.
   * @private
   */
  private buildSyncableFromLegacy(data: unknown): SyncableGameState {
    const d = (data ?? {}) as Partial<{
      scenes: JsonValue[];
      activeSceneId: string | null;
      characters: JsonValue[];
      initiative: JsonValue;
    }>;
    return {
      scenes: Array.isArray(d.scenes) ? d.scenes : [],
      activeSceneId: d.activeSceneId ?? null,
      characters: Array.isArray(d.characters) ? d.characters : [],
      initiative: d.initiative ?? {},
    };
  }

  /**
   * Persists the room's committed game state to the database (session snapshot
   * + campaign scenes). Runs AFTER the token chain has advanced; safe to fail.
   * @private
   */
  private async persistRoomGameState(roomCode: string): Promise<void> {
    const room = this.socketManager.rooms.get(roomCode);
    if (!room?.gameState) return;
    try {
      const session = await this.db.getSessionByJoinCode(roomCode);
      if (session) {
        await this.db.saveGameState(session.id, room.gameState);
        if (room.gameState.scenes && session.campaignId) {
          await this.db.saveCampaignScenes(
            session.campaignId,
            room.gameState.scenes,
          );
        }
        console.log(`💾 Game state updated and persisted for room ${roomCode}`);
      }
    } catch (error) {
      console.error('Failed to persist game state:', error);
    }
  }

  /**
   * Sends a game-state-ack to the sender confirming the committed token.
   * @private
   */
  private sendSyncAck(
    connection: Connection,
    token: StateHash,
    version: number,
  ): void {
    this.sendMessage(connection, {
      type: 'game-state-ack',
      data: { token, version },
      timestamp: Date.now(),
    });
  }

  /**
   * Sends a game-state-resync-required directive to the sender after a chain
   * break (base/integrity mismatch, malformed patch, oversized payload).
   * Increments the resync counter for the given reason.
   * @private
   */
  private sendResync(
    connection: Connection,
    serverToken: StateHash | null,
    reason: ResyncReason,
  ): void {
    this.deltaSyncMetrics.resync[reason]++;
    this.sendMessage(connection, {
      type: 'game-state-resync-required',
      data: { serverToken, reason },
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcasts a message to all connections in a room
   * @private
   * @param {string} roomCode - Join code of the room
   * @param {ServerMessage} message - Message to broadcast
   * @param {string} [excludeUuid] - Optional UUID to exclude from broadcast
   * @returns {void}
   */
  private broadcastToRoom(
    roomCode: string,
    message: ServerMessage,
    excludeUuid?: string,
  ): void {
    const room = this.socketManager.rooms.get(roomCode);
    if (!room) return;

    room.connections.forEach((ws, uuid) => {
      if (uuid !== excludeUuid) {
        const connection = this.socketManager.connections.get(uuid);
        if (connection) {
          this.sendMessage(connection, message);
        }
      }
    });
  }

  /**
   * Sends a message to a specific connection
   * Only sends if WebSocket connection is open
   * @private
   * @param {Connection} connection - Target connection
   * @param {ServerMessage} message - Message to send
   * @returns {void}
   */
  private sendMessage(connection: Connection, message: ServerMessage): void {
    if (connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Sends an error message to a connection
   * @private
   * @param {Connection} connection - Target connection
   * @param {string} error - Error message text
   * @returns {void}
   */
  private sendError(connection: Connection, error: string): void {
    this.sendMessage(connection, {
      type: 'error',
      data: { message: error },
      timestamp: Date.now(),
    });
  }

  /**
   * Handles a WebSocket disconnection
   * Updates database and manages host transfer or room hibernation as needed
   * @private
   * @param {string} uuid - Connection UUID that disconnected
   * @returns {Promise<void>}
   */
  private async handleDisconnect(uuid: string): Promise<void> {
    const connection = this.socketManager.connections.get(uuid);
    if (!connection?.room) {
      this.socketManager.connections.delete(uuid);
      return;
    }

    const room = this.socketManager.rooms.get(connection.room);
    if (!room) {
      this.socketManager.connections.delete(uuid);
      return;
    }

    // Idempotency: a single socket can reach here through more than one path
    // (e.g. a forced terminate plus the ws 'close' event it triggers). Claim
    // this member synchronously — before any await — so an interleaved second
    // pass bails out here instead of re-broadcasting the leave or re-hibernating.
    if (!room.connections.has(uuid)) {
      this.socketManager.connections.delete(uuid);
      return;
    }
    room.connections.delete(uuid);

    // Get session from database to find sessionId
    let session: SessionRecord | null = null;
    try {
      session = await this.db.getSessionByJoinCode(connection.room);
    } catch (error) {
      console.error('Failed to fetch session from database:', error);
    }

    // Update player connection status in database
    if (session) {
      try {
        await this.db.updatePlayerConnection(uuid, session.id, false);
      } catch (error) {
        console.error('Failed to update player connection status:', error);
      }
    }

    // Handle host disconnection
    if (room.host === uuid) {
      console.log(
        `👑 Host left room ${connection.room}, entering DM offline mode`,
      );

      room.dmConnected = false;
      room.players.delete(uuid);
      room.connections.delete(uuid);
      room.lastActivity = Date.now();

      this.hibernateRoom(connection.room);

      this.broadcastToRoom(connection.room, {
        type: 'event',
        data: {
          name: 'session/hibernated',
          message:
            'Host disconnected. Room is still available while players remain connected.',
          reconnectWindow: this.HIBERNATION_TIMEOUT,
          dmConnected: false,
        },
        timestamp: Date.now(),
      });

      this.broadcastToRoom(connection.room, {
        type: 'event',
        data: {
          name: 'session/dm-status',
          dmConnected: false,
        },
        timestamp: Date.now(),
      });
    } else {
      // Regular player disconnection
      console.log(`👋 Player left room ${connection.room}: ${uuid}`);
      room.players.delete(uuid);
      room.connections.delete(uuid);
      room.lastActivity = Date.now();

      this.broadcastToRoom(connection.room, {
        type: 'event',
        data: { name: 'session/leave', uuid },
        timestamp: Date.now(),
      });

      if (!room.dmConnected && room.players.size === 0) {
        this.hibernateRoom(connection.room);
      }
    }

    this.socketManager.connections.delete(uuid);

    // Stop heartbeat if no connections remain
    if (this.socketManager.connections.size === 0) {
      this.stopHeartbeat();
    }
  }

  /**
   * Hibernates a room when the host disconnects with no replacement
   * Room enters hibernation mode for HIBERNATION_TIMEOUT before being abandoned
   * @private
   * @param {string} roomCode - Join code of the room to hibernate
   * @returns {Promise<void>}
   */
  private async hibernateRoom(roomCode: string): Promise<void> {
    const room = this.socketManager.rooms.get(roomCode);
    if (!room || room.status === 'hibernating') return;

    room.status = 'hibernating';
    room.lastActivity = Date.now();

    // Update session status in database
    try {
      const session = await this.db.getSessionByJoinCode(roomCode);
      if (session) {
        await this.db.updateSessionStatus(session.id, 'hibernating');
      }
    } catch (error) {
      console.error('Failed to update session status to hibernating:', error);
    }

    // Clear any existing hibernation timer
    if (room.hibernationTimer) {
      clearTimeout(room.hibernationTimer);
    }

    // Only schedule abandonment if no players are connected
    if (room.players.size === 0) {
      room.hibernationTimer = setTimeout(() => {
        this.abandonRoom(roomCode);
      }, this.HIBERNATION_TIMEOUT);
    } else {
      room.hibernationTimer = undefined;
    }

    console.log(
      `😴 Room ${roomCode} hibernated${room.players.size === 0 ? `, will be abandoned in ${this.HIBERNATION_TIMEOUT / 1000}s` : ', waiting for host reconnect'}`,
    );
  }

  /**
   * Abandons a room after hibernation timeout expires
   * Closes all connections and schedules database cleanup
   * @private
   * @param {string} roomCode - Join code of the room to abandon
   * @returns {Promise<void>}
   */
  private async abandonRoom(roomCode: string): Promise<void> {
    const room = this.socketManager.rooms.get(roomCode);
    if (!room) return;

    console.log(`🗑️ Abandoning room: ${roomCode}`);

    // Update session status in database
    try {
      const session = await this.db.getSessionByJoinCode(roomCode);
      if (session) {
        await this.db.updateSessionStatus(session.id, 'abandoned');
      }
    } catch (error) {
      console.error('Failed to update session status to abandoned:', error);
    }

    // Clear hibernation timer
    if (room.hibernationTimer) {
      clearTimeout(room.hibernationTimer);
    }

    // Close all remaining connections
    room.connections.forEach((ws, connUuid) => {
      ws.close();
      this.socketManager.connections.delete(connUuid);
    });

    // Remove room from memory
    this.socketManager.rooms.delete(roomCode);

    // Schedule database cleanup after abandonment timeout
    setTimeout(async () => {
      try {
        const session = await this.db.getSessionByJoinCode(roomCode);
        if (session) {
          await this.db.deleteSession(session.id);
          console.log(
            `🗑️ Deleted abandoned session from database: ${roomCode}`,
          );
        }
      } catch (error) {
        console.error('Failed to delete session from database:', error);
      }
    }, this.ABANDONMENT_TIMEOUT);
  }

  private attemptRoomRecovery(
    roomCode: string,
    _connection: Connection,
  ): boolean {
    const room = this.socketManager.rooms.get(roomCode);
    if (!room) return false;
    if (room.status === 'abandoned') {
      return false;
    }
    if (room.status === 'hibernating') {
      if (!room.dmConnected) {
        return true;
      }
      console.log(`🔄 Reactivating hibernated room: ${roomCode}`);
      room.status = 'active';
      room.lastActivity = Date.now();
      if (room.hibernationTimer) {
        clearTimeout(room.hibernationTimer);
        room.hibernationTimer = undefined;
      }
      this.broadcastToRoom(roomCode, {
        type: 'event',
        data: {
          name: 'session/reactivated',
          message: 'Room has been reactivated.',
          reconnectBy: _connection.id,
        },
        timestamp: Date.now(),
      });
      return true;
    }
    return room.status === 'active';
  }

  /**
   * Rehydrates an in-memory room from persisted session data when a join request
   * arrives but the room map does not contain the code (e.g., after a restart
   * or when a player hit a different instance). This is a best-effort recovery;
   * host connections are not restored here.
   */
  private async recoverRoomFromSession(
    roomCode: string,
  ): Promise<Room | undefined> {
    try {
      const session = await this.db.getSessionByJoinCode(roomCode);
      if (!session || session.status === 'abandoned') {
        return undefined;
      }

      const recoveredRoom: Room = {
        code: session.joinCode,
        host: session.primaryHostId,
        coHosts: new Set<string>(),
        players: new Set<string>(),
        connections: new Map(),
        created: session.createdAt
          ? new Date(session.createdAt).getTime()
          : Date.now(),
        lastActivity: Date.now(),
        status: session.status === 'hibernating' ? 'hibernating' : 'active',
        dmConnected: false,
        hibernationTimer: undefined,
        gameState: session.gameState as GameState,
        previousGameState: undefined,
        stateVersion: 0,
        entityVersions: new Map(),
        // Anchor the token chain to the persisted state so patch uploads from a
        // reconnecting host can baseToken-match without a forced full resync.
        syncToken: session.gameState
          ? hashSync(session.gameState as unknown as JsonValue)
          : null,
      };

      this.socketManager.rooms.set(roomCode, recoveredRoom);
      console.log(
        `🔄 Recovered room ${roomCode} from session; status: ${recoveredRoom.status}`,
      );
      return recoveredRoom;
    } catch (error) {
      console.error(`Failed to recover room ${roomCode} from session:`, error);
      return undefined;
    }
  }

  private selectNewHost(room: Room, excludeUuid?: string): string | null {
    const candidates = Array.from(room.players).filter(
      (uuid) => uuid !== excludeUuid,
    );
    if (candidates.length === 0) {
      return null;
    }
    for (const candidate of candidates) {
      if (room.coHosts.has(candidate)) {
        return candidate;
      }
    }
    return candidates[0];
  }

  private handleHostTransfer(
    fromUuid: string,
    connection: Connection,
    room: Room,
    data: { targetUserId: string },
  ) {
    if (room.host !== fromUuid) {
      this.sendError(
        connection,
        'Only the current host can transfer host privileges',
      );
      return;
    }
    const targetUserId = data.targetUserId;
    if (!targetUserId || !room.players.has(targetUserId)) {
      this.sendError(connection, 'Invalid target user for host transfer');
      return;
    }
    const oldHost = room.host;
    room.host = targetUserId;
    room.coHosts.delete(targetUserId);
    const oldHostConnection = this.socketManager.connections.get(oldHost);
    const newHostConnection = this.socketManager.connections.get(targetUserId);
    if (oldHostConnection) {
      oldHostConnection.user = {
        name: oldHostConnection.user?.name || 'Player',
        type: 'player',
      };
    }
    if (newHostConnection) {
      newHostConnection.user = {
        name: newHostConnection.user?.name || 'Host',
        type: 'host',
      };
    }
    console.log(
      `👑 Manual host transfer in room ${room.code}: ${oldHost} -> ${targetUserId}`,
    );
    this.broadcastToRoom(room.code, {
      type: 'event',
      data: {
        name: 'session/host-changed',
        oldHostId: oldHost,
        newHostId: targetUserId,
        reason: 'manual-transfer',
        message: 'Host privileges have been transferred.',
      },
      timestamp: Date.now(),
    });
  }

  private handleAddCoHost(
    fromUuid: string,
    connection: Connection,
    room: Room,
    data: { targetUserId: string },
  ) {
    if (room.host !== fromUuid) {
      this.sendError(connection, 'Only the current host can add co-hosts');
      return;
    }
    const targetUserId = data.targetUserId;
    if (!targetUserId || !room.players.has(targetUserId)) {
      this.sendError(connection, 'Invalid target user for co-host addition');
      return;
    }
    if (room.coHosts.has(targetUserId)) {
      this.sendError(connection, 'User is already a co-host');
      return;
    }
    room.coHosts.add(targetUserId);
    const targetConnection = this.socketManager.connections.get(targetUserId);
    if (targetConnection) {
      targetConnection.user = {
        name: targetConnection.user?.name || 'Co-Host',
        type: 'host',
      };
    }
    console.log(`👥 Added co-host in room ${room.code}: ${targetUserId}`);
    this.broadcastToRoom(room.code, {
      type: 'event',
      data: {
        name: 'session/cohost-added',
        coHostId: targetUserId,
        message: 'A new co-host has been added to the session.',
      },
      timestamp: Date.now(),
    });
  }

  private handleRemoveCoHost(
    fromUuid: string,
    connection: Connection,
    room: Room,
    data: { targetUserId: string },
  ) {
    if (room.host !== fromUuid) {
      this.sendError(connection, 'Only the current host can remove co-hosts');
      return;
    }
    const targetUserId = data.targetUserId;
    if (!targetUserId || !room.coHosts.has(targetUserId)) {
      this.sendError(connection, 'Invalid target user for co-host removal');
      return;
    }
    room.coHosts.delete(targetUserId);
    const targetConnection = this.socketManager.connections.get(targetUserId);
    if (targetConnection) {
      targetConnection.user = {
        name: targetConnection.user?.name || 'Player',
        type: 'player',
      };
    }
    console.log(`👥 Removed co-host in room ${room.code}: ${targetUserId}`);
    this.broadcastToRoom(room.code, {
      type: 'event',
      data: {
        name: 'session/cohost-removed',
        coHostId: targetUserId,
        message: 'A co-host has been removed from the session.',
      },
      timestamp: Date.now(),
    });
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    do {
      result = '';
      for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.socketManager.rooms.has(result));
    return result;
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) return;
    console.log('💓 Starting heartbeat mechanism');
    this.heartbeatTimer = setInterval(() => {
      this.socketManager.connections.forEach((connection) => {
        this.sendHeartbeatPing(connection);
      });
    }, this.HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      console.log('💓 Stopped heartbeat mechanism');
    }
  }

  private startHeartbeatForConnection(_connection: Connection) {
    if (this.socketManager.connections.size === 1) {
      this.startHeartbeat();
    }
  }

  private sendHeartbeatPing(connection: Connection) {
    const pingId = uuidv4();
    connection.lastPing = Date.now();
    connection.pendingPing = pingId;
    this.sendMessage(connection, {
      type: 'heartbeat',
      data: { type: 'ping', id: pingId },
      timestamp: Date.now(),
    });
    setTimeout(() => {
      if (connection.pendingPing === pingId) {
        this.handleMissedPong(connection.id);
      }
    }, this.HEARTBEAT_TIMEOUT);
  }

  private handleHeartbeatPong(fromUuid: string, pongId: string) {
    const connection = this.socketManager.connections.get(fromUuid);
    if (!connection || connection.pendingPing !== pongId) return;
    const responseTime = Date.now() - (connection.lastPing || 0);
    connection.lastPong = Date.now();
    connection.pendingPing = undefined;
    connection.consecutiveMisses = 0;
    this.updateConnectionQuality(connection, responseTime);
  }

  private handleMissedPong(uuid: string) {
    const connection = this.socketManager.connections.get(uuid);
    if (!connection) return;
    connection.consecutiveMisses += 1;
    connection.pendingPing = undefined;
    if (connection.consecutiveMisses >= this.MAX_CONSECUTIVE_MISSES) {
      connection.connectionQuality = 'critical';
      console.warn(
        `⚠️ Connection ${uuid} has critical quality (${connection.consecutiveMisses} missed pings)`,
      );
      this.forceDisconnectDueToMissedPings(connection);
    } else if (connection.consecutiveMisses >= 2) {
      connection.connectionQuality = 'poor';
    } else if (connection.consecutiveMisses >= 1) {
      connection.connectionQuality = 'good';
    }
  }

  private updateConnectionQuality(
    connection: Connection,
    responseTime: number,
  ) {
    if (responseTime < 100) {
      connection.connectionQuality = 'excellent';
    } else if (responseTime < 500) {
      connection.connectionQuality = 'good';
    } else if (responseTime < 2000) {
      connection.connectionQuality = 'poor';
    } else {
      connection.connectionQuality = 'critical';
    }
  }

  /**
   * Forcefully disconnect a connection that has missed too many pings to
   * prevent zombie sockets from spamming logs.
   */
  private async forceDisconnectDueToMissedPings(connection: Connection) {
    try {
      console.warn(
        `🔌 Forcing disconnect for ${connection.id} due to missed pings`,
      );
      // Close the socket; use terminate to avoid waiting for close handshake
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.terminate();
      }
      await this.handleDisconnect(connection.id);
    } catch (error) {
      console.error(`Failed to forcefully disconnect ${connection.id}:`, error);
    }
  }

  public async shutdown() {
    console.log('🛑 Shutting down Nexus server...');
    this.stopHeartbeat();
    this.socketManager.rooms.forEach((room) => {
      if (room.hibernationTimer) {
        clearTimeout(room.hibernationTimer);
      }
    });
    this.socketManager.connections.forEach((connection) => {
      connection.ws.close();
    });
    this.socketManager.rooms.clear();
    this.socketManager.connections.clear();
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

  public getStats() {
    const activeRooms = Array.from(this.socketManager.rooms.values()).filter(
      (r) => r.status === 'active',
    ).length;
    const hibernatingRooms = Array.from(this.socketManager.rooms.values()).filter(
      (r) => r.status === 'hibernating',
    ).length;
    return {
      activeRooms,
      hibernatingRooms,
      totalRooms: this.socketManager.rooms.size,
      totalConnections: this.socketManager.connections.size,
      serverPort: this.port,
      rooms: Array.from(this.socketManager.rooms.entries()).map(([code, room]) => ({
        code,
        playerCount: room.players.size,
        connectionCount: room.connections.size,
        status: room.status,
        created: new Date(room.created).toISOString(),
        lastActivity: new Date(room.lastActivity).toISOString(),
        hasGameState: !!room.gameState,
      })),
    };
  }
}

const REQUIRED_PORT = process.env.PORT ? parseInt(process.env.PORT) : 5001;
console.log(`🚀 Starting WebSocket server on port ${REQUIRED_PORT}...`);
new NexusServer(REQUIRED_PORT);
