import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pool, QueryResult } from 'pg';
import { UserRepository } from '../../../../server/repositories/UserRepository.js';
import { verifyPassword } from '../../../../server/utils/auth.js';

vi.mock('../../../../server/utils/auth.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../server/utils/auth.js')>();
  return {
    ...actual,
    verifyPassword: vi.fn(),
  };
});

describe('UserRepository', () => {
  let pool: { query: ReturnType<typeof vi.fn> };
  let repository: UserRepository;

  beforeEach(() => {
    pool = {
      query: vi.fn(),
    };
    repository = new UserRepository(pool as unknown as Pool);
  });

  it('should fetch user by id', async () => {
    const mockUser = { id: 'uuid-1', name: 'Test User' };
    pool.query.mockResolvedValueOnce({ rows: [mockUser] } as QueryResult);

    const user = await repository.getUserById('uuid-1');

    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM users WHERE id = $1',
      ['uuid-1']
    );
    expect(user).toEqual(mockUser);
  });

  it('should return null if user not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] } as QueryResult);

    const user = await repository.getUserById('unknown');

    expect(user).toBeNull();
  });

  it('should get user preferences', async () => {
    const mockPrefs = { allowSpectators: true };
    pool.query.mockResolvedValueOnce({ rows: [{ preferences: mockPrefs }] } as QueryResult);

    const prefs = await repository.getUserPreferences('uuid-1');

    expect(pool.query).toHaveBeenCalledWith(
      'SELECT preferences FROM users WHERE id = $1',
      ['uuid-1']
    );
    expect(prefs).toEqual(mockPrefs);
  });

  it('should return empty object if user preferences are null', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ preferences: null }] } as QueryResult);

    const prefs = await repository.getUserPreferences('uuid-1');

    expect(prefs).toEqual({});
  });

  it('should update user preferences', async () => {
    const mockPrefs = { allowSpectators: false };
    pool.query.mockResolvedValueOnce({ rows: [{ preferences: mockPrefs }] } as QueryResult);

    const prefs = await repository.updateUserPreferences('uuid-1', mockPrefs);

    expect(pool.query).toHaveBeenCalledWith(
      `UPDATE users
       SET preferences = $2,
           "updatedAt" = NOW()
       WHERE id = $1
       RETURNING preferences`,
      ['uuid-1', mockPrefs]
    );
    expect(prefs).toEqual(mockPrefs);
  });

  it('should deactivate user', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 } as QueryResult);

    await repository.deactivateUser('uuid-1');

    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE users SET "isActive" = FALSE, "updatedAt" = NOW() WHERE id = $1',
      ['uuid-1']
    );
  });

  it('should validate local login successfully', async () => {
    const mockUser = {
      id: 'uuid-1',
      email: 'test@example.com',
      provider: 'local',
      passwordHash: 'hash',
      passwordSalt: 'salt',
      passwordIterations: 1000,
      isActive: true,
    };
    // Mock getUserByEmail query, verifyPassword (mocked below), and lastLogin update query
    pool.query.mockResolvedValueOnce({ rows: [mockUser] } as QueryResult); // getUserByEmail
    pool.query.mockResolvedValueOnce({ rowCount: 1 } as QueryResult); // update lastLogin

    vi.mocked(verifyPassword).mockReturnValueOnce(true);

    const user = await repository.validateLocalLogin('test@example.com', 'password123');

    expect(user).toEqual(mockUser);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM users WHERE email = $1',
      ['test@example.com']
    );
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE users SET "lastLogin" = NOW(), "updatedAt" = NOW() WHERE id = $1',
      ['uuid-1']
    );
  });

  it('should return null on local login with invalid password', async () => {
    const mockUser = {
      id: 'uuid-1',
      email: 'test@example.com',
      provider: 'local',
      passwordHash: 'hash',
      passwordSalt: 'salt',
      passwordIterations: 1000,
      isActive: true,
    };
    pool.query.mockResolvedValueOnce({ rows: [mockUser] } as QueryResult); // getUserByEmail

    vi.mocked(verifyPassword).mockReturnValueOnce(false);

    const user = await repository.validateLocalLogin('test@example.com', 'wrongpassword');

    expect(user).toBeNull();
  });
});
