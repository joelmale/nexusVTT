import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveSocketIdentity } from '../../../../server/socket/resolveSocketIdentity.js';
import type { DatabaseService } from '../../../../server/database.js';

describe('resolveSocketIdentity', () => {
  let db: {
    getUserById: ReturnType<typeof vi.fn>;
    createGuestUser: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    db = {
      getUserById: vi.fn(),
      createGuestUser: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('resolves valid authenticated user session', async () => {
    db.getUserById.mockResolvedValueOnce({
      id: 'auth-user-1',
      name: 'Authenticated Alice',
    });

    const session = { passport: { user: 'auth-user-1' } };
    const identity = await resolveSocketIdentity(session, db as unknown as DatabaseService);

    expect(db.getUserById).toHaveBeenCalledWith('auth-user-1');
    expect(identity).toEqual({
      uuid: 'auth-user-1',
      displayName: 'Authenticated Alice',
      userType: 'Authenticated',
    });
  });

  it('falls back to guest when authenticated user is not found in database', async () => {
    db.getUserById
      .mockResolvedValueOnce(null) // auth user missing
      .mockResolvedValueOnce({ id: 'guest-1', name: 'Guest Bob' }); // guest user exists

    const session = {
      passport: { user: 'stale-user' },
      guestUser: { id: 'guest-1', name: 'Guest Bob' },
    };

    const identity = await resolveSocketIdentity(session, db as unknown as DatabaseService);

    expect(identity).toEqual({
      uuid: 'guest-1',
      displayName: 'Guest Bob',
      userType: 'Guest',
    });
  });

  it('creates missing database record for guest if not found', async () => {
    db.getUserById.mockResolvedValueOnce(null); // guest not yet in DB

    const session = {
      guestUser: { id: 'guest-new', name: 'Guest Charlie' },
    };

    const identity = await resolveSocketIdentity(session, db as unknown as DatabaseService);

    expect(db.createGuestUser).toHaveBeenCalledWith('Guest Charlie', 'guest-new');
    expect(identity).toEqual({
      uuid: 'guest-new',
      displayName: 'Guest Charlie',
      userType: 'Guest',
    });
  });

  it('falls back to anonymous if no session or guest is provided', async () => {
    const session = {};

    const identity = await resolveSocketIdentity(session, db as unknown as DatabaseService);

    expect(db.createGuestUser).toHaveBeenCalledWith(
      'Anonymous',
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );
    expect(identity).toEqual({
      uuid: expect.stringMatching(/^[0-9a-f-]{36}$/),
      displayName: 'Anonymous',
      userType: 'Anonymous',
    });
  });

  it('handles DB exceptions gracefully without crashing', async () => {
    db.getUserById.mockRejectedValueOnce(new Error('DB failure'));
    db.createGuestUser.mockRejectedValueOnce(new Error('Insert failure'));

    const session = { passport: { user: 'auth-1' } };
    const identity = await resolveSocketIdentity(session, db as unknown as DatabaseService);

    expect(identity.userType).toBe('Anonymous');
    expect(identity.displayName).toBe('Anonymous');
  });
});
