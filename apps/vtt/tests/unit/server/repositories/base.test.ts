import { describe, it, expect } from 'vitest';
import { Pool } from 'pg';
import { BaseRepository } from '../../../../server/repositories/base.js';

class ConcreteRepository extends BaseRepository {
  getPool(): Pool {
    return this.pool;
  }
}

describe('BaseRepository', () => {
  it('stores and provides access to pool in subclasses', () => {
    const mockPool = {} as Pool;
    const repo = new ConcreteRepository(mockPool);
    expect(repo.getPool()).toBe(mockPool);
  });
});
