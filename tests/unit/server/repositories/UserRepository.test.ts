import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pool, QueryResult } from 'pg';
import { UserRepository } from '../../../../server/repositories/UserRepository.js';

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
});
