import express, { type Express } from 'express';
import http from 'node:http';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAuthRouter } from '../../../../server/routes/auth.routes.js';
import type { DatabaseService } from '../../../../server/database.js';
import type { PassportStatic } from 'passport';

interface Behavior {
  loginError: Error | null;
  logoutError: Error | null;
  authenticated: boolean;
  profile: { id: string; email: string; displayName: string } | null;
  getUserProfileError: Error | null;
  googleCallback: { err: unknown; user: unknown; info?: unknown };
}

function defaultBehavior(): Behavior {
  return {
    loginError: null,
    logoutError: null,
    authenticated: false,
    profile: {
      id: 'user-1',
      email: 'player@example.test',
      displayName: 'Player',
    },
    getUserProfileError: null,
    googleCallback: {
      err: null,
      user: { id: 'user-1', email: 'player@example.test' },
    },
  };
}

/** GET a URL without following redirects, so `Location` and 3xx status are observable. */
function getNoRedirect(
  url: string,
): Promise<{ status: number; location: string | undefined }> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        resolve({ status: res.statusCode ?? 0, location: res.headers.location });
        res.resume();
      })
      .on('error', reject);
  });
}

describe('authentication routes: OAuth, logout, and /auth/me', () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server?.close((error) => (error ? reject(error) : resolve())),
      );
      server = undefined;
    }
    vi.unstubAllEnvs();
  });

  async function startApp(): Promise<{
    baseUrl: string;
    database: Record<string, ReturnType<typeof vi.fn>>;
    behavior: Behavior;
  }> {
    const behavior = defaultBehavior();
    const database = {
      getUserProfile: vi.fn(async () => {
        if (behavior.getUserProfileError) throw behavior.getUserProfileError;
        return behavior.profile;
      }),
    };
    const passport = {
      authenticate: vi.fn((_strategy: string, optionsOrCallback?: unknown) => {
        if (typeof optionsOrCallback === 'function') {
          // google-style: a verify callback is passed directly to authenticate().
          return (_req: unknown, _res: unknown, _next: unknown) => {
            (
              optionsOrCallback as (
                err: unknown,
                user: unknown,
                info?: unknown,
              ) => void
            )(behavior.googleCallback.err, behavior.googleCallback.user, behavior.googleCallback.info);
          };
        }
        // options-style (scope / failureRedirect): behaves as a passing middleware.
        return (_req: unknown, _res: unknown, next: () => void) => next();
      }),
    };
    const app: Express = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.login = vi.fn((_user, callback) => callback(behavior.loginError ?? undefined));
      req.logout = vi.fn((callback) => callback(behavior.logoutError ?? undefined));
      req.isAuthenticated = () => behavior.authenticated;
      req.user = { id: 'user-1' };
      next();
    });
    app.use(
      createAuthRouter({
        db: database as unknown as DatabaseService,
        passport: passport as unknown as PassportStatic,
      }),
    );
    app.use((_req, res) => res.status(204).send());
    app.use(
       
      (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(500).json({ error: err.message });
      },
    );
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      server?.once('listening', resolve);
      server?.once('error', reject);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP server');
    return { baseUrl: `http://127.0.0.1:${address.port}`, database, behavior };
  }

  describe('OAuth entry points', () => {
    it('mounts the Google and Discord entry points behind passport.authenticate', async () => {
      const { baseUrl } = await startApp();
      expect((await fetch(`${baseUrl}/auth/google`)).status).toBe(204);
      expect((await fetch(`${baseUrl}/auth/discord`)).status).toBe(204);
    });
  });

  describe('GET /auth/google/callback', () => {
    it('redirects with an error flag when the strategy reports an error', async () => {
      const { baseUrl, behavior } = await startApp();
      behavior.googleCallback = { err: new Error('provider down'), user: null };
      const { status, location } = await getNoRedirect(`${baseUrl}/auth/google/callback`);
      expect(status).toBe(302);
      expect(location).toBe('/?oauthError=google_auth_error');
    });

    it('redirects with an error flag when no user is returned', async () => {
      const { baseUrl, behavior } = await startApp();
      behavior.googleCallback = { err: null, user: false };
      const { status, location } = await getNoRedirect(`${baseUrl}/auth/google/callback`);
      expect(status).toBe(302);
      expect(location).toBe('/?oauthError=google_no_user');
    });

    it('redirects with an error flag when session creation fails', async () => {
      const { baseUrl, behavior } = await startApp();
      behavior.loginError = new Error('session store unavailable');
      const { status, location } = await getNoRedirect(`${baseUrl}/auth/google/callback`);
      expect(status).toBe(302);
      expect(location).toBe('/?oauthError=google_session_error');
    });

    it('redirects to FRONTEND_URL when configured', async () => {
      vi.stubEnv('FRONTEND_URL', 'https://app.example.test/home');
      const { baseUrl } = await startApp();
      const { status, location } = await getNoRedirect(`${baseUrl}/auth/google/callback`);
      expect(status).toBe(302);
      expect(location).toBe('https://app.example.test/home');
    });

    // NOTE: the NODE_ENV-conditional fallback branch (production vs. local Vite
    // dev server) is intentionally not exercised with vi.stubEnv('NODE_ENV', ...)
    // here. Doing so reliably corrupts this file's v8 coverage collection when
    // the module is compiled across more than one test file in the same run
    // (reproduced consistently, including through vitest's blob merge-reports
    // path) -- the row silently disappears from the aggregate report instead of
    // reporting 0% or an error. Root cause looks like a Vite/Vitest transform
    // interaction with a mutated process.env.NODE_ENV, not a bug in this file.
  });

  describe('GET /auth/discord/callback', () => {
    it('redirects to the dashboard after a successful strategy exchange', async () => {
      vi.stubEnv('FRONTEND_URL', 'https://app.example.test/home');
      const { baseUrl } = await startApp();
      const { status, location } = await getNoRedirect(`${baseUrl}/auth/discord/callback`);
      expect(status).toBe(302);
      expect(location).toBe('https://app.example.test/home');
    });

    // See the matching note under GET /auth/google/callback: the NODE_ENV
    // ternary branch is not exercised via vi.stubEnv('NODE_ENV', ...) because
    // it corrupts this file's v8 coverage collection across test files.
  });

  describe('GET /auth/logout', () => {
    it('destroys the session and redirects home', async () => {
      const { baseUrl } = await startApp();
      const { status, location } = await getNoRedirect(`${baseUrl}/auth/logout`);
      expect(status).toBe(302);
      expect(location).toBe('/');
    });

    it('forwards logout errors to the error-handling middleware', async () => {
      const { baseUrl, behavior } = await startApp();
      behavior.logoutError = new Error('session teardown failed');
      const response = await fetch(`${baseUrl}/auth/logout`);
      expect(response.status).toBe(500);
    });
  });

  describe('GET /auth/me', () => {
    it('rejects unauthenticated requests', async () => {
      const { baseUrl } = await startApp();
      const response = await fetch(`${baseUrl}/auth/me`);
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({ message: 'Not authenticated' });
    });

    it('returns the public profile for an authenticated user', async () => {
      const { baseUrl, behavior } = await startApp();
      behavior.authenticated = true;
      const response = await fetch(`${baseUrl}/auth/me`);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        id: 'user-1',
        email: 'player@example.test',
        displayName: 'Player',
      });
    });

    it('returns 404 when the authenticated user has no stored profile', async () => {
      const { baseUrl, behavior } = await startApp();
      behavior.authenticated = true;
      behavior.profile = null;
      const response = await fetch(`${baseUrl}/auth/me`);
      expect(response.status).toBe(404);
    });

    it('returns 500 when the profile lookup throws unexpectedly', async () => {
      const { baseUrl, behavior } = await startApp();
      behavior.authenticated = true;
      behavior.getUserProfileError = new Error('db unavailable');
      const response = await fetch(`${baseUrl}/auth/me`);
      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toMatchObject({
        error: 'Failed to fetch user profile',
      });
    });
  });
});
