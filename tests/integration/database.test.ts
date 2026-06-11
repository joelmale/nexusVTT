import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import { DatabaseService, createDatabaseService } from '../../server/database';

// Skip these tests if DATABASE_URL is not set (e.g., in CI without database)
const shouldSkip = !process.env.DATABASE_URL;
const describeDatabase = shouldSkip ? describe.skip : describe;

describeDatabase('DatabaseService Integration Tests', () => {
  let dbService: DatabaseService;
  let pool: Pool;
  let testHostId: string;
  let testCampaignId: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    dbService = createDatabaseService({ connectionString: process.env.DATABASE_URL });
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    // Initialize the database schema
    await dbService.initialize();

    // Create a test user (host) for all tests
    const testUser = await dbService.createGuestUser('Test Host');
    testHostId = testUser.id;

    // Create a test campaign for all tests
    const testCampaign = await dbService.createCampaign(
      testHostId,
      'Test Campaign',
      'Integration test campaign'
    );
    testCampaignId = testCampaign.id;
  });

  afterAll(async () => {
    if (dbService && pool) {
      await dbService.close();
      await pool.end();
    }
  });

  beforeEach(async () => {
    // Clean up sessions, players, and hosts before each test (in order to respect foreign keys)
    await pool.query('TRUNCATE TABLE hosts, players, sessions RESTART IDENTITY CASCADE');
  });

  it('should connect to the database and verify schema exists', async () => {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    const tableNames = result.rows.map(row => row.table_name);
    expect(tableNames).toContain('sessions');
    expect(tableNames).toContain('players');
    expect(tableNames).toContain('hosts');
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('campaigns');
    expect(tableNames).toContain('characters');
  });

  describe('Session Operations', () => {
    it('should create a new session with a host', async () => {
      const { sessionId, joinCode } = await dbService.createSession(
        testCampaignId,
        testHostId
      );

      // Verify session was created
      const sessionResult = await pool.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
      expect(sessionResult.rowCount).toBe(1);
      expect(sessionResult.rows[0].joinCode).toBe(joinCode);
      expect(sessionResult.rows[0].primaryHostId).toBe(testHostId);

      // Verify host record was created
      const hostResult = await pool.query('SELECT * FROM hosts WHERE "sessionId" = $1 AND "userId" = $2', [sessionId, testHostId]);
      expect(hostResult.rowCount).toBe(1);
      expect(hostResult.rows[0].isPrimary).toBe(true);

      // Verify host was added as a player
      const playerResult = await pool.query('SELECT * FROM players WHERE "sessionId" = $1 AND "userId" = $2', [sessionId, testHostId]);
      expect(playerResult.rowCount).toBe(1);
    });

    it('should get a session by join code', async () => {
      const { joinCode } = await dbService.createSession(testCampaignId, testHostId);
      const session = await dbService.getSessionByJoinCode(joinCode);
      expect(session).not.toBeNull();
      expect(session?.joinCode).toBe(joinCode);
    });

    it('should update session status', async () => {
      const { sessionId, joinCode } = await dbService.createSession(testCampaignId, testHostId);
      await dbService.updateSessionStatus(sessionId, 'hibernating');
      const session = await dbService.getSessionByJoinCode(joinCode);
      expect(session?.status).toBe('hibernating');
    });

    it('should transfer primary host', async () => {
      const { sessionId, joinCode } = await dbService.createSession(testCampaignId, testHostId);

      // Create a new user to transfer to
      const newHost = await dbService.createGuestUser('New Host');

      // Add new host as a player first
      await dbService.addPlayerToSession(newHost.id, sessionId);

      // Transfer host
      await dbService.transferPrimaryHost(sessionId, newHost.id);

      const session = await dbService.getSessionByJoinCode(joinCode);
      expect(session?.primaryHostId).toBe(newHost.id);
    });
  });

  describe('Game State Operations', () => {
    let sessionId: string;
    let joinCode: string;
    const gameState = { scenes: [{ id: 'scene1', name: 'Test Scene' }], activeSceneId: 'scene1' };

    beforeEach(async () => {
      const result = await dbService.createSession(testCampaignId, testHostId);
      sessionId = result.sessionId;
      joinCode = result.joinCode;
    });

    it('should save game state', async () => {
      await dbService.saveGameState(sessionId, gameState);
      const result = await pool.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
      expect(result.rowCount).toBe(1);
      expect(result.rows[0].gameState).toEqual(gameState);
    });

    it('should save game state by join code', async () => {
      await dbService.saveGameStateByJoinCode(joinCode, gameState);
      const loadedState = await dbService.getGameStateByJoinCode(joinCode);
      expect(loadedState).toEqual(gameState);
    });

    it('should load game state by join code', async () => {
      await dbService.saveGameStateByJoinCode(joinCode, gameState);
      const loadedState = await dbService.getGameStateByJoinCode(joinCode);
      expect(loadedState).toEqual(gameState);
    });
  });

  describe('Player and Host Operations', () => {
    let sessionId: string;
    let player1Id: string;

    beforeEach(async () => {
      const result = await dbService.createSession(testCampaignId, testHostId);
      sessionId = result.sessionId;

      // Create a player user
      const player1 = await dbService.createGuestUser('Player 1');
      player1Id = player1.id;
    });

    it('should add a player to a session', async () => {
      await dbService.addPlayerToSession(player1Id, sessionId);
      const players = await dbService.getPlayersBySession(sessionId);
      expect(players.length).toBe(2); // Host + Player 1
      expect(players.some(p => p.userId === player1Id)).toBe(true);
    });

    it('should remove a player from a session', async () => {
      await dbService.addPlayerToSession(player1Id, sessionId);
      let players = await dbService.getPlayersBySession(sessionId);
      expect(players.length).toBe(2);

      await dbService.removePlayerFromSession(player1Id, sessionId);
      players = await dbService.getPlayersBySession(sessionId);
      expect(players.length).toBe(1);
      expect(players[0].userId).toBe(testHostId);
    });

    it('should add and remove a co-host', async () => {
      await dbService.addPlayerToSession(player1Id, sessionId);
      await dbService.addCoHost(player1Id, sessionId, { canEditScenes: true });

      let hosts = await dbService.getHostsBySession(sessionId);
      expect(hosts.length).toBe(2);
      expect(hosts.some(h => h.userId === player1Id && h.isPrimary === false)).toBe(true);

      await dbService.removeCoHost(player1Id, sessionId);
      hosts = await dbService.getHostsBySession(sessionId);
      expect(hosts.length).toBe(1);
      expect(hosts.some(h => h.userId === player1Id)).toBe(false);
    });

    it('should verify campaign authorization correctly', async () => {
      // Host should be authorized (as DM)
      let authorized = await dbService.isUserAuthorizedForCampaign(testHostId, testCampaignId);
      expect(authorized).toBe(true);

      // Random user should NOT be authorized
      const randomUser = await dbService.createGuestUser('Random User');
      authorized = await dbService.isUserAuthorizedForCampaign(randomUser.id, testCampaignId);
      expect(authorized).toBe(false);

      // Once added to the session as a player, they should be authorized
      await dbService.addPlayerToSession(randomUser.id, sessionId);
      authorized = await dbService.isUserAuthorizedForCampaign(randomUser.id, testCampaignId);
      expect(authorized).toBe(true);
    });
  });
});
