import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import { createDatabaseService } from './database.js';

/**
 * Represents a user object stored in session
 * @interface SessionUser
 */
interface SessionUser {
  /** Unique user identifier (UUID) */
  id: string;
  /** User's email address */
  email: string | null;
  /** User's display name */
  name: string;
  /** URL to user's avatar */
  avatarUrl: string | null;
  /** OAuth provider used */
  provider: string;
}

// Initialize database service for auth operations
const db = createDatabaseService();

/**
 * Serializes user to session
 * Only stores user ID in session to minimize session data size
 * @param {Express.User} user - User object to serialize
 * @param {Function} done - Callback function (error, userId)
 */
passport.serializeUser((user: Express.User, done) => {
  // Store only the user ID in the session
  done(null, (user as SessionUser).id);
});

/**
 * Deserializes user from session
 * Fetches full user object from database using stored user ID
 * @param {string} id - User ID from session
 * @param {Function} done - Callback function (error, user)
 */
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await db.getUserById(id);

    if (!user) {
      // User not found in database (possibly deleted or stale session)
      return done(null, false);
    }

    // Return user object to be attached to req.user
    done(null, user);
  } catch (err) {
    console.error('Error deserializing user:', err);
    done(err, null);
  }
});

/**
 * Validates required environment variables for OAuth
 * @throws {Error} If required environment variables are missing
 */
function validateOAuthConfig(): void {
  const requiredEnvVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
  ];

  const missing = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required OAuth environment variables: ${missing.join(', ')}`,
    );
  }
}

// Validate OAuth configuration on module load
if (process.env.NODE_ENV === 'production') {
  validateOAuthConfig();
} else {
  // In development, just warn about missing config
  const requiredEnvVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
  ];

  const missing = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    console.warn(
      `⚠️ Missing OAuth environment variables: ${missing.join(', ')}`,
    );
    console.warn('OAuth login will not work until these are configured');
  }
}

const googleCallbackURL = process.env.GOOGLE_CALLBACK_URL;
const discordCallbackURL = process.env.DISCORD_CALLBACK_URL;

if (
  process.env.NODE_ENV === 'production' &&
  (!googleCallbackURL || !googleCallbackURL.startsWith('https'))
) {
  throw new Error(
    'GOOGLE_CALLBACK_URL must be an absolute URL in production (e.g., https://your-domain.com/auth/google/callback)',
  );
}

if (
  process.env.NODE_ENV === 'production' &&
  (!discordCallbackURL || !discordCallbackURL.startsWith('https'))
) {
  throw new Error(
    'DISCORD_CALLBACK_URL must be an absolute URL in production (e.g., https://your-domain.com/auth/discord/callback)',
  );
}

/**
 * Google OAuth 2.0 Strategy Configuration
 * Handles authentication via Google accounts
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || 'placeholder',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'placeholder',
      callbackURL: googleCallbackURL || '/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log('🔐 Google OAuth callback received');
        console.log('Profile:', { id: profile.id, email: profile.emails?.[0]?.value, name: profile.displayName });
        console.log('Access Token received:', accessToken ? 'YES' : 'NO');

        // Extract user profile data from Google response
        const userProfile = {
          email: profile.emails?.[0]?.value || null,
          name: profile.displayName,
          avatarUrl: profile.photos?.[0]?.value || null,
          provider: 'google' as const,
        };

        // Find existing user or create new one
        const user = await db.findOrCreateUserByOAuth(userProfile);

        console.log(`✅ Google OAuth successful for user: ${user.email}`);

        // Return user object to Passport
        return done(null, user);
      } catch (err) {
        console.error('❌ Google OAuth error:', err);
        return done(err as Error);
      }
    },
  ),
);

/**
 * Discord OAuth 2.0 Strategy Configuration
 * Handles authentication via Discord accounts
 */
passport.use(
  'discord',
  new OAuth2Strategy(
    {
      authorizationURL: 'https://discord.com/api/oauth2/authorize',
      tokenURL: 'https://discord.com/api/oauth2/token',
      clientID: process.env.DISCORD_CLIENT_ID || 'placeholder',
      clientSecret: process.env.DISCORD_CLIENT_SECRET || 'placeholder',
      callbackURL: discordCallbackURL || '/auth/discord/callback',
      scope: 'identify email',
    },
    async (
      accessToken: string,
      refreshToken: string,
      profile: unknown,
      done: (err?: Error | null, user?: Express.User) => void,
    ) => {
      try {
        // Fetch user profile from Discord API
        const response = await fetch('https://discord.com/api/users/@me', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch Discord user profile');
        }

        const discordUser = (await response.json()) as {
          id: string;
          username: string;
          email?: string;
          avatar?: string;
        };

        // Extract user profile data from Discord response
        const userProfile = {
          email: discordUser.email || null,
          name: discordUser.username,
          // Construct Discord avatar URL if avatar hash exists
          avatarUrl: discordUser.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
            : null,
          provider: 'discord' as const,
        };

        // Find existing user or create new one
        const user = await db.findOrCreateUserByOAuth(userProfile);

        console.log(
          `✅ Discord OAuth successful for user: ${user.email || user.name}`,
        );

        // Return user object to Passport
        return done(null, user);
      } catch (err) {
        console.error('Discord OAuth error:', err);
        return done(err as Error);
      }
    },
  ),
);

/**
 * Export configured passport instance
 * This should be imported and initialized in the Express app
 */
export default passport;
