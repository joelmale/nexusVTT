import { Pool } from 'pg';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  createDatabaseService,
  type DatabaseService,
} from '../../server/database.js';
import { assertTestDatabase } from './assertTestDatabase.js';

// Two-letter alphabet, four characters: only 16 distinct codes exist, so
// concurrent creators collide constantly. The PostgreSQL UNIQUE constraint must
// resolve every collision without failing a create.
const { codeSource } = vi.hoisted(() => ({
  codeSource: { next: null as null | (() => string) },
}));
vi.mock('../../server/utils/secureCode.js', () => ({
  generateSecureJoinCode: (length = 4) =>
    codeSource.next
      ? codeSource.next()
      : Array.from({ length }, () => 'AB'[Math.floor(Math.random() * 2)]).join(
          '',
        ),
}));

const shouldSkip = !process.env.DATABASE_URL;
const describeIntegration = shouldSkip ? describe.skip : describe;

describeIntegration('join code uniqueness is database-authoritative', () => {
  let pool: Pool;
  let db: DatabaseService;
  let hostId: string;
  let campaignId: string;

  beforeAll(async () => {
    assertTestDatabase();
    const connectionString = process.env.DATABASE_URL!;
    db = createDatabaseService({ connectionString });
    pool = new Pool({ connectionString });
    await db.initialize();
    const host = await db.createGuestUser('Join Code Host');
    hostId = host.id;
    campaignId = (await db.createCampaign(hostId, 'Join Code Campaign')).id;
  });

  afterAll(async () => {
    await db?.close();
    await pool?.end();
  });

  beforeEach(async () => {
    codeSource.next = null;
    await pool.query(
      'TRUNCATE TABLE hosts, players, sessions RESTART IDENTITY CASCADE',
    );
  });

  it('creates N concurrent sessions over a tiny alphabet with distinct codes', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => db.createSession(campaignId, hostId)),
    );

    const codes = results.map((result) => result.joinCode);
    expect(new Set(codes).size).toBe(8);
    const rows = await pool.query('SELECT "joinCode" FROM sessions');
    expect(rows.rows.map((row) => row.joinCode).sort()).toEqual(
      [...codes].sort(),
    );
    const hostRows = await pool.query('SELECT COUNT(*)::int AS n FROM hosts');
    expect(hostRows.rows[0].n).toBe(8);
  });

  it('retries past an occupied code and leaves no partial rows', async () => {
    await db.createSessionWithJoinCode(campaignId, hostId, 'AAAA');
    const queue = ['AAAA', 'AAAA', 'BBBB'];
    codeSource.next = () => queue.shift() ?? 'BBBB';

    const created = await db.createSession(campaignId, hostId);

    expect(created.joinCode).toBe('BBBB');
    const sessions = await pool.query(
      'SELECT COUNT(*)::int AS n FROM sessions',
    );
    expect(sessions.rows[0].n).toBe(2);
    const hosts = await pool.query('SELECT COUNT(*)::int AS n FROM hosts');
    expect(hosts.rows[0].n).toBe(2);
  });

  it('fails with a clear error and rolls back when attempts are exhausted', async () => {
    await db.createSessionWithJoinCode(campaignId, hostId, 'AAAA');
    codeSource.next = () => 'AAAA';

    await expect(db.createSession(campaignId, hostId)).rejects.toThrow(
      /unique join code after \d+ attempts/,
    );
    const sessions = await pool.query(
      'SELECT COUNT(*)::int AS n FROM sessions',
    );
    expect(sessions.rows[0].n).toBe(1);
  });

  it('lets exactly one concurrent createSessionWithJoinCode claim a code', async () => {
    const settled = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        db.createSessionWithJoinCode(campaignId, hostId, 'ZZZZ'),
      ),
    );

    expect(settled.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = settled.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    expect(rejected).toHaveLength(5);
    for (const failure of rejected) {
      expect(String(failure.reason)).toMatch(/Join code already exists: ZZZZ/);
    }
  });
});
