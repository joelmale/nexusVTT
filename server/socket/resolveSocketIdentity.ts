import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database.js';

export interface IdentityResolutionResult {
  uuid: string;
  displayName: string;
  userType: 'Authenticated' | 'Guest' | 'Anonymous';
}

export async function resolveSocketIdentity(
  session: any,
  db: DatabaseService
): Promise<IdentityResolutionResult> {
  const authUserId = session?.passport?.user;
  const guestUser = session?.guestUser;

  // 1. Check Authenticated Session
  if (authUserId) {
    try {
      const existingUser = await db.getUserById(authUserId);
      if (existingUser) {
        return {
          uuid: existingUser.id,
          displayName: existingUser.name,
          userType: 'Authenticated',
        };
      } else {
        console.warn(
          `⚠️ Security warning: Stale authenticated session for missing user ID ${authUserId}. Dropping to anonymous.`
        );
      }
    } catch (error) {
      console.warn(`Failed to verify authenticated user:`, error);
    }
  }

  // 2. Check Guest Session
  if (guestUser && guestUser.id) {
    try {
      const existingUser = await db.getUserById(guestUser.id);
      if (existingUser) {
        return {
          uuid: existingUser.id,
          displayName: existingUser.name,
          userType: 'Guest',
        };
      } else {
        console.log(
          `🔧 Creating missing database record for guest user: ${guestUser.id} (${guestUser.name})`
        );
        await db.createGuestUser(guestUser.name, guestUser.id);
        return {
          uuid: guestUser.id,
          displayName: guestUser.name,
          userType: 'Guest',
        };
      }
    } catch (error) {
      console.warn(`⚠️ Failed to verify or create guest user:`, error);
    }
  }

  // 3. Fallback to Anonymous (query identity is ignored as per requirements)
  const newAnonymousId = uuidv4();
  const anonymousName = 'Anonymous';

  try {
    console.log(
      `🔧 Creating missing database record for anonymous user: ${newAnonymousId}`
    );
    await db.createGuestUser(anonymousName, newAnonymousId);
  } catch (error) {
    console.warn(`⚠️ Failed to create anonymous user:`, error);
  }

  return {
    uuid: newAnonymousId,
    displayName: anonymousName,
    userType: 'Anonymous',
  };
}
