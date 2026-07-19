import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { UserRepository } from './repositories/UserRepository.js';
import { CampaignRepository } from './repositories/CampaignRepository.js';
import { CharacterRepository } from './repositories/CharacterRepository.js';
import { SessionRepository } from './repositories/SessionRepository.js';
import { EventJournalRepository } from './repositories/EventJournalRepository.js';
import {
  DatabaseConfig,
  OAuthProfile,
  CampaignRecord,
  CharacterRecord,
} from './repositories/base.js';
export type { SessionRecord } from './repositories/base.js';

export class DatabaseService {
  private pool: Pool;
  public users: UserRepository;
  public campaigns: CampaignRepository;
  public characters: CharacterRepository;
  public sessions: SessionRepository;
  public eventJournal: EventJournalRepository;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      connectionString: config.connectionString,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      max: 20,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });

    this.pool.on('error', (err: Error) => {
      console.error('🗄️ Unexpected database pool error:', err);
    });

    this.pool.on('connect', () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('🗄️ New database connection established');
      }
    });

    // Initialize repositories
    this.users = new UserRepository(this.pool);
    this.campaigns = new CampaignRepository(this.pool);
    this.characters = new CharacterRepository(this.pool);
    this.sessions = new SessionRepository(this.pool);
    this.eventJournal = new EventJournalRepository(this.pool);

    console.log('✅ Database connection pool and repositories created');
  }

  async initialize(): Promise<void> {
    let retries = 5;
    while (retries) {
      try {
        const client = await this.pool.connect();
        await client.query('SELECT NOW()');
        client.release();
        console.log('✅ Database connection successful');

        await this.initSchema();
        await this.eventJournal.initialize();
        return;
      } catch (error) {
        console.error('❌ Failed to initialize database:', error);
        retries -= 1;
        console.log(`Retries left: ${retries}`);
        if (retries === 0) {
          throw error;
        }
        await new Promise((res) => setTimeout(res, 5000));
      }
    }
  }

  private async initSchema(): Promise<void> {
    const result = await this.pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
      );
    `);

    if (!result.rows[0].exists) {
      console.log('🗄️ Schema not found, creating tables...');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const schemaPath = path.join(__dirname, 'schema.sql');

      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf-8');
        await this.pool.query(schema);
        console.log('✅ Database schema created successfully');
      } else {
        throw new Error('schema.sql not found at: ' + schemaPath);
      }
    } else {
      console.log('✅ Database schema already exists');
    }
  }

  // Backward compatibility wrapper methods
  // These will eventually be removed as we migrate callers to use .users, .campaigns, etc.

  async getUserById(id: string) { return this.users.getUserById(id); }
  async getUserByEmail(email: string) { return this.users.getUserByEmail(email); }
  async findOrCreateUserByOAuth(profile: OAuthProfile) { return this.users.findOrCreateUserByOAuth(profile); }
  async createLocalUser(email: string, pass: string, name?: string) { return this.users.createLocalUser(email, pass, name); }
  async createGuestUser(name: string, id?: string) { return this.users.createGuestUser(name, id); }
  async getUserProfile(id: string) { return this.users.getUserProfile(id); }
  async updateUserProfile(
    id: string,
    updates: { displayName?: string | null; bio?: string | null; avatarUrl?: string | null },
  ) { return this.users.updateUserProfile(id, updates); }
  async getUserPreferences(id: string) { return this.users.getUserPreferences(id); }
  async updateUserPreferences(id: string, prefs: Record<string, unknown>) { return this.users.updateUserPreferences(id, prefs); }
  async deactivateUser(id: string) { return this.users.deactivateUser(id); }
  async validateLocalLogin(email: string, pass: string) { return this.users.validateLocalLogin(email, pass); }

  async createCampaign(dmId: string, name: string, desc?: string) { return this.campaigns.createCampaign(dmId, name, desc); }
  async getCampaignsByUser(id: string) { return this.campaigns.getCampaignsByUser(id); }
  async getCampaignById(id: string) { return this.campaigns.getCampaignById(id); }
  async isUserAuthorizedForCampaign(userId: string, campId: string) { return this.campaigns.isUserAuthorizedForCampaign(userId, campId); }
  async updateCampaign(id: string, updates: Partial<CampaignRecord>) { return this.campaigns.updateCampaign(id, updates); }
  async deleteCampaign(id: string) { return this.campaigns.deleteCampaign(id); }
  async saveCampaignScenes(id: string, scenes: unknown[]) { return this.campaigns.saveCampaignScenes(id, scenes); }
  async getCampaignScenes(id: string) { return this.campaigns.getCampaignScenes(id); }

  async createCharacter(ownerId: string, name: string, data: unknown) { return this.characters.createCharacter(ownerId, name, data); }
  async getCharactersByUser(id: string) { return this.characters.getCharactersByUser(id); }
  async getCharacterById(id: string) { return this.characters.getCharacterById(id); }
  async updateCharacter(id: string, updates: Partial<CharacterRecord>) { return this.characters.updateCharacter(id, updates); }
  async deleteCharacter(id: string) { return this.characters.deleteCharacter(id); }
  async deleteCharactersByUser(id: string) { return this.characters.deleteCharactersByUser(id); }
  async deleteCharactersByIds(ids: string[]) { return this.characters.deleteCharactersByIds(ids); }

  async createSession(campId: string, hostId: string) { return this.sessions.createSession(campId, hostId); }
  async createSessionWithJoinCode(campId: string, hostId: string, code: string) { return this.sessions.createSessionWithJoinCode(campId, hostId, code); }
  async activateSessionByJoinCode(code: string, hostId: string) { return this.sessions.activateSessionByJoinCode(code, hostId); }
  async getSessionByJoinCode(code: string) { return this.sessions.getSessionByJoinCode(code); }
  async getCampaignIdByJoinCode(code: string) { return this.sessions.getCampaignIdByJoinCode(code); }
  async updateSessionStatus(
    id: string,
    status: 'active' | 'hibernating' | 'abandoned',
  ) { return this.sessions.updateSessionStatus(id, status); }
  async saveGameState(id: string, state: unknown) { return this.sessions.saveGameState(id, state); }
  async saveGameStateByJoinCode(code: string, state: unknown) { return this.sessions.saveGameStateByJoinCode(code, state); }
  async getGameStateByJoinCode(code: string) { return this.sessions.getGameStateByJoinCode(code); }
  async deleteSession(id: string) { return this.sessions.deleteSession(id); }

  async addPlayerToSession(uId: string, sId: string, cId?: string | null) { return this.sessions.addPlayerToSession(uId, sId, cId); }
  async removePlayerFromSession(uId: string, sId: string) { return this.sessions.removePlayerFromSession(uId, sId); }
  async getPlayerCharacter(uId: string, sId: string) { return this.sessions.getPlayerCharacter(uId, sId); }
  async updatePlayerConnection(uId: string, sId: string, conn: boolean) { return this.sessions.updatePlayerConnection(uId, sId, conn); }
  async getPlayersBySession(sId: string) { return this.sessions.getPlayersBySession(sId); }

  async addCoHost(uId: string, sId: string, perms?: unknown) { return this.sessions.addCoHost(uId, sId, perms); }
  async removeCoHost(uId: string, sId: string) { return this.sessions.removeCoHost(uId, sId); }
  async transferPrimaryHost(sId: string, hId: string) { return this.sessions.transferPrimaryHost(sId, hId); }
  async getHostsBySession(sId: string) { return this.sessions.getHostsBySession(sId); }

  async appendRoomEvent(
    roomCode: string,
    identity: Parameters<EventJournalRepository['append']>[1],
    message: Parameters<EventJournalRepository['append']>[2],
    echoToActor: Parameters<EventJournalRepository['append']>[3],
  ) {
    return this.eventJournal.append(
      roomCode,
      identity,
      message,
      echoToActor,
    );
  }

  async getRoomEventReplay(roomCode: string, afterSequence: number | null) {
    return this.eventJournal.getReplayWindow(roomCode, afterSequence);
  }

  async findRoomEvent(roomCode: string, eventId: string) {
    return this.eventJournal.find(roomCode, eventId);
  }

  async migrateGuestToUser(guestId: string, userId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE characters SET "ownerId" = $1 WHERE "ownerId" = $2', [userId, guestId]);
      await client.query('UPDATE campaigns SET "dmId" = $1 WHERE "dmId" = $2', [userId, guestId]);
      await client.query('UPDATE sessions SET "primaryHostId" = $1 WHERE "primaryHostId" = $2', [userId, guestId]);
      await client.query('UPDATE users SET "isActive" = FALSE, "updatedAt" = NOW() WHERE id = $1', [guestId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    console.log('🗄️ Database connection pool closed');
  }

  async healthCheck(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
  }

  getPool(): Pool {
    return this.pool;
  }
}

export function createDatabaseService(config?: DatabaseConfig): DatabaseService {
  let dbConfig: DatabaseConfig;
  if (config) {
    dbConfig = config;
  } else {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable must be set');
    }
    dbConfig = {
      connectionString,
      ssl: process.env.DB_SSL === 'true',
    };
  }
  return new DatabaseService(dbConfig);
}
