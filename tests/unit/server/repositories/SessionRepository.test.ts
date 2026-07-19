import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pool, QueryResult, type PoolClient } from 'pg';
import { SessionRepository } from '../../../../server/repositories/SessionRepository.js';

describe('SessionRepository', () => {
  let pool: { query: ReturnType<typeof vi.fn> };
  let repository: SessionRepository;

  beforeEach(() => {
    pool = {
      query: vi.fn(),
      connect: vi.fn().mockReturnValue({
        query: vi.fn(),
        release: vi.fn(),
      }),
    };
    repository = new SessionRepository(pool as unknown as Pool);
  });

  it('should activate session by join code successfully', async () => {
    const mockSession = {
      id: 'session-1',
      joinCode: 'ABC1',
      status: 'hibernating',
    };

    // Mock getSessionByJoinCode call in activateSessionByJoinCode
    pool.query.mockResolvedValueOnce({ rows: [mockSession] } as QueryResult); // first getSessionByJoinCode
    pool.query.mockResolvedValueOnce({ rowCount: 1 } as QueryResult); // updateSessionStatus query
    pool.query.mockResolvedValueOnce({ rowCount: 1 } as QueryResult); // addPlayerToSession insert
    pool.query.mockResolvedValueOnce({
      rows: [{ ...mockSession, status: 'active' }],
    } as QueryResult); // final getSessionByJoinCode

    // Mock transferPrimaryHost transaction connect and query calls
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rowCount: 1 }),
      release: vi.fn(),
    };
    vi.mocked(pool.connect).mockResolvedValueOnce(
      mockClient as unknown as PoolClient,
    );

    const session = await repository.activateSessionByJoinCode(
      'ABC1',
      'host-1',
    );

    expect(session).toEqual({ ...mockSession, status: 'active' });
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM sessions WHERE "joinCode" = $1',
      ['ABC1'],
    );
    expect(pool.query).toHaveBeenCalledWith(
      `UPDATE sessions SET status = $1, "lastActivity" = NOW() WHERE id = $2`,
      ['active', 'session-1'],
    );
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith(
      `UPDATE hosts SET "isPrimary" = false WHERE "sessionId" = $1 AND "isPrimary" = true`,
      ['session-1'],
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      `INSERT INTO hosts (id, "userId", "sessionId", "isPrimary", permissions)
         VALUES (uuid_generate_v4(), $1, $2, true, '{}'::jsonb)
         ON CONFLICT ("userId", "sessionId") DO UPDATE
         SET "isPrimary" = true`,
      ['host-1', 'session-1'],
    );
    expect(mockClient.query).toHaveBeenCalledWith(
      `UPDATE sessions SET "primaryHostId" = $1 WHERE id = $2`,
      ['host-1', 'session-1'],
    );
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('should return null if session to activate is not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] } as QueryResult);

    const session = await repository.activateSessionByJoinCode(
      'INVALID',
      'host-1',
    );

    expect(session).toBeNull();
  });

  it('should retrieve player character details successfully', async () => {
    const mockPlayer = { characterId: 'char-123' };
    const mockCharacter = { id: 'char-123', name: 'Gimli', ownerId: 'user-1' };

    pool.query.mockResolvedValueOnce({ rows: [mockPlayer] } as QueryResult);
    pool.query.mockResolvedValueOnce({ rows: [mockCharacter] } as QueryResult);

    const character = await repository.getPlayerCharacter(
      'user-1',
      'session-1',
    );

    expect(character).toEqual(mockCharacter);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT "characterId" FROM players WHERE "userId" = $1 AND "sessionId" = $2',
      ['user-1', 'session-1'],
    );
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM characters WHERE id = $1',
      ['char-123'],
    );
  });

  it('should return null if player has no character linked', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ characterId: null }],
    } as QueryResult);

    const character = await repository.getPlayerCharacter(
      'user-1',
      'session-1',
    );

    expect(character).toBeNull();
  });
});
