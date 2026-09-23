import { Router } from 'express';
import type { PassportStatic } from 'passport';
import type { DatabaseService } from '../database.js';
import { toAuthResponse } from '../utils/publicUser.js';

export interface AuthRouterDependencies {
  /** Database service used for local account creation and lookup. */
  db: DatabaseService;
  /** Configured passport instance (see server/auth.ts). */
  passport: PassportStatic;
}

/**
 * Builds the authentication router: local registration/login, the Google and
 * Discord OAuth entry points and callbacks, logout, the current-user probe, and
 * the gateway session check.
 *
 * Mounted at the application root so the routes keep their `/auth/...` paths.
 */
export function createAuthRouter({
  db,
  passport,
}: AuthRouterDependencies): Router {
  const router = Router();

  // Local account registration
  router.post('/auth/register', async (req, res) => {
    try {
      const { email, password, displayName } = req.body || {};

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email is required' });
      }
      const normalizedEmail = email.toLowerCase().trim();
      const atIdx = normalizedEmail.indexOf('@');
      const dotIdx = normalizedEmail.lastIndexOf('.');
      if (
        atIdx < 1 ||
        dotIdx <= atIdx + 1 ||
        dotIdx >= normalizedEmail.length - 1
      ) {
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

      const existing = await db.getUserByEmail(normalizedEmail);
      if (existing) {
        return res.status(409).json({
          error:
            existing.provider === 'local'
              ? 'Account already exists. Please sign in.'
              : `Account exists via ${existing.provider}. Please sign in with ${existing.provider}.`,
        });
      }

      const user = await db.createLocalUser(
        normalizedEmail,
        password,
        displayName,
      );

      req.login(user, (err) => {
        if (err) {
          console.error('Login after register failed', err);
          return res.status(500).json({ error: 'Login failed' });
        }
        res.json(toAuthResponse(user));
      });
    } catch (error) {
      console.error('Registration failed:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  // Local account login
  router.post('/auth/login', async (req, res) => {
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
      const user = await db.validateLocalLogin(normalizedEmail, password);

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      req.login(user, (err) => {
        if (err) {
          console.error('Login failed', err);
          return res.status(500).json({ error: 'Login failed' });
        }

        res.json(toAuthResponse(user));
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  router.get(
    '/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] }),
  );
  router.get('/auth/google/callback', (req, res, next) => {
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
  router.get('/auth/discord', passport.authenticate('discord'));
  router.get(
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
  router.get('/auth/logout', (req, res, next) => {
    req.logout((err) => {
      if (err) {
        return next(err);
      }
      res.redirect('/');
    });
  });
  // Gate for the gateway's nginx `auth_request` (docker/nginx.conf). Body-less
  // and profile-free because nginx only reads the status. Guest sessions do
  // not pass: anyone can mint one anonymously via POST /api/guest-users.
  router.get('/auth/session-check', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.status(req.isAuthenticated() ? 204 : 401).end();
  });

  router.get('/auth/me', async (req, res) => {
    if (req.isAuthenticated()) {
      try {
        const user = req.user as { id: string };
        const profile = await db.getUserProfile(user.id);
        if (!profile) {
          res.status(404).json({ error: 'User profile not found' });
          return;
        }
        res.json(toAuthResponse(profile));
      } catch (error) {
        console.error('Failed to fetch user profile for /auth/me:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
      }
    } else {
      res.status(401).json({ message: 'Not authenticated' });
    }
  });

  return router;
}
