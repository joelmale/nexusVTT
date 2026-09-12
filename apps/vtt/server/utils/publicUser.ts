/**
 * Utilities for securely mapping internal user and profile records to public DTOs.
 * Ensures that sensitive fields (like password hashes, auth providers, or internal DB IDs if hidden)
 * are never leaked to the client.
 */

export interface PublicUser {
  id: string;
  name: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
}

export interface PublicProfile extends PublicUser {
  preferences: Record<string, unknown>;
  isActive: boolean;
}

export interface AuthResponse extends PublicProfile {
  email: string | null;
  provider: string;
}

/**
 * Strips sensitive data from a user object for public consumption (e.g. in room participant lists).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toPublicUser(user: any): PublicUser | null {
  if (!user || typeof user !== 'object' || !user.id) return null;
  
  return {
    id: user.id,
    name: user.name || 'Unknown User',
    displayName: user.displayName || user.name || 'Unknown User',
    avatarUrl: user.avatarUrl || null,
    bio: user.bio || null,
  };
}

/**
 * Maps a full profile for public consumption. 
 * Use when a user views another user's public profile page.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toPublicProfile(user: any): PublicProfile | null {
  if (!user || typeof user !== 'object' || !user.id) return null;
  
  return {
    ...toPublicUser(user)!,
    preferences: user.preferences || {},
    isActive: typeof user.isActive === 'boolean' ? user.isActive : true,
  };
}

/**
 * Maps a user record for the authenticated user themselves (e.g., /auth/me).
 * Includes email and provider.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toAuthResponse(user: any): AuthResponse | null {
  if (!user || typeof user !== 'object' || !user.id) return null;
  
  return {
    ...toPublicProfile(user)!,
    email: user.email || null,
    provider: user.provider || 'unknown',
  };
}
