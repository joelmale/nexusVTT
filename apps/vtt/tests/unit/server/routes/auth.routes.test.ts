import express, { type Express } from 'express';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAuthRouter } from '../../../../server/routes/auth.routes.js';
import type { DatabaseService } from '../../../../server/database.js';
import type { PassportStatic } from 'passport';

interface Behavior {
  loginError: Error | null;
}

function defaultBehavior(): Behavior {
  return { loginError: null };
}

describe('authentication routes: local register/login', () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server?.close((error) => (error ? reject(error) : resolve())),
      );
      server = undefined;
    }
  });

  async function startApp(
    overrides: {
      existingUser?: { provider: string } | null;
      getUserByEmailError?: Error;
      createLocalUserError?: Error;
      validateLoginResult?: unknown;
      validateLoginError?: Error;
    } = {},
  ): Promise<{
    baseUrl: string;
    database: Record<string, ReturnType<typeof vi.fn>>;
    behavior: Behavior;
  }> {
    const behavior = defaultBehavior();
    const database = {
      getUserByEmail: vi.fn(async () => {
        if (overrides.getUserByEmailError) throw overrides.getUserByEmailError;
        return overrides.existingUser ?? null;
      }),
      createLocalUser: vi.fn(
        async (email: string, _password: string, displayName?: string) => {
          if (overrides.createLocalUserError) throw overrides.createLocalUserError;
          return {
            id: 'user-1',
            email,
            displayName: displayName ?? 'Player',
            provider: 'local',
          };
        },
      ),
      validateLocalLogin: vi.fn(async () => {
        if (overrides.validateLoginError) throw overrides.validateLoginError;
        return 'validateLoginResult' in overrides
          ? overrides.validateLoginResult
          : {
              id: 'user-1',
              email: 'player@example.test',
              displayName: 'Player',
              provider: 'local',
            };
      }),
      getUserProfile: vi.fn(async () => null),
    };
    const passport = {
      authenticate: vi.fn(
        () => (_req: unknown, _res: unknown, next: () => void) => next(),
      ),
    };
    const app: Express = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.login = vi.fn((_user, callback) => callback(behavior.loginError ?? undefined));
      req.isAuthenticated = () => false;
      next();
    });
    app.use(
      createAuthRouter({
        db: database as unknown as DatabaseService,
        passport: passport as unknown as PassportStatic,
      }),
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

  describe('POST /auth/register', () => {
    it('rejects a request with no body at all', async () => {
      const { baseUrl } = await startApp();
      const response = await fetch(`${baseUrl}/auth/register`, { method: 'POST' });
      expect(response.status).toBe(400);
    });

    it('rejects a missing or malformed email', async () => {
      const { baseUrl } = await startApp();
      await expect(
        fetch(`${baseUrl}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: 'password1' }),
        }),
      ).resolves.toMatchObject({ status: 400 });
      await expect(
        fetch(`${baseUrl}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'bad', password: 'password1' }),
        }),
      ).resolves.toMatchObject({ status: 400 });
    });

    it('rejects a missing or out-of-range password', async () => {
      const { baseUrl } = await startApp();
      const missing = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.test' }),
      });
      expect(missing.status).toBe(400);
      await expect(missing.json()).resolves.toMatchObject({ error: 'Password is required' });

      const tooShort = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.test', password: 'short' }),
      });
      expect(tooShort.status).toBe(400);

      const tooLong = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.test', password: 'x'.repeat(129) }),
      });
      expect(tooLong.status).toBe(400);
    });

    it('validates registration input and normalizes accepted emails', async () => {
      const { baseUrl, database } = await startApp();
      const response = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: ' PLAYER@Example.Test ',
          password: 'password1',
          displayName: 'Player',
        }),
      });
      expect(response.status).toBe(200);
      expect(database.createLocalUser).toHaveBeenCalledWith(
        'player@example.test',
        'password1',
        'Player',
      );
    });

    it('rejects a duplicate local account distinctly from a duplicate OAuth account', async () => {
      const local = await startApp({ existingUser: { provider: 'local' } });
      const localResponse = await fetch(`${local.baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.test', password: 'password1' }),
      });
      expect(localResponse.status).toBe(409);
      await expect(localResponse.json()).resolves.toMatchObject({
        error: 'Account already exists. Please sign in.',
      });

      const oauth = await startApp({ existingUser: { provider: 'google' } });
      const oauthResponse = await fetch(`${oauth.baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.test', password: 'password1' }),
      });
      expect(oauthResponse.status).toBe(409);
      await expect(oauthResponse.json()).resolves.toMatchObject({
        error: expect.stringContaining('google'),
      });
    });

    it('returns 500 when establishing the session after registration fails', async () => {
      const { baseUrl, behavior } = await startApp();
      behavior.loginError = new Error('session store unavailable');
      const response = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.test', password: 'password1' }),
      });
      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toMatchObject({ error: 'Login failed' });
    });

    it('returns 500 when account creation throws unexpectedly', async () => {
      const { baseUrl } = await startApp({
        createLocalUserError: new Error('db unavailable'),
      });
      const response = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.test', password: 'password1' }),
      });
      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toMatchObject({ error: 'Registration failed' });
    });
  });

  describe('POST /auth/login', () => {
    it('rejects a request with no body at all', async () => {
      const { baseUrl } = await startApp();
      const response = await fetch(`${baseUrl}/auth/login`, { method: 'POST' });
      expect(response.status).toBe(400);
    });

    it('rejects a missing email or password', async () => {
      const { baseUrl } = await startApp();
      const missingPassword = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.test' }),
      });
      expect(missingPassword.status).toBe(400);
      const missingEmail = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'password1' }),
      });
      expect(missingEmail.status).toBe(400);
    });

    it('rejects invalid credentials without a session', async () => {
      const { baseUrl } = await startApp({ validateLoginResult: null });
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.test', password: 'wrong' }),
      });
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({ error: 'Invalid credentials' });
    });

    it('logs in a valid local account and normalizes the email before lookup', async () => {
      const { baseUrl, database } = await startApp();
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ' Player@Example.Test ', password: 'password1' }),
      });
      expect(response.status).toBe(200);
      expect(database.validateLocalLogin).toHaveBeenCalledWith(
        'player@example.test',
        'password1',
      );
    });

    it('returns 500 when establishing the session after login fails', async () => {
      const { baseUrl, behavior } = await startApp();
      behavior.loginError = new Error('session store unavailable');
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.test', password: 'password1' }),
      });
      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toMatchObject({ error: 'Login failed' });
    });

    it('returns 500 when credential validation throws unexpectedly', async () => {
      const { baseUrl } = await startApp({ validateLoginError: new Error('db unavailable') });
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.test', password: 'password1' }),
      });
      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toMatchObject({ error: 'Login failed' });
    });
  });
});
