import { Pool } from 'pg';

export interface DatabaseConfig {
  connectionString?: string;
  ssl?: boolean;
}

export interface UserRecord {
  id: string;
  email: string | null;
  name: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  provider: string;
  passwordHash: string | null;
  passwordSalt: string | null;
  passwordIterations: number | null;
  preferences: Record<string, unknown> | null;
  isActive: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OAuthProfile {
  email: string | null;
  name: string;
  avatarUrl: string | null;
  provider: string;
}

export interface CampaignRecord {
  id: string;
  name: string;
  description: string | null;
  dmId: string;
  scenes: unknown;
  lastRoomCode: string | null;
  lastRoomCodeUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterRecord {
  id: string;
  name: string;
  ownerId: string;
  data: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionRecord {
  id: string;
  joinCode: string;
  campaignId: string;
  primaryHostId: string;
  status: 'active' | 'hibernating' | 'abandoned';
  gameState: unknown;
  stateVersion: number;
  syncToken: string | null;
  createdAt: Date;
  lastActivity: Date;
}

export interface PlayerRecord {
  id: string;
  userId: string;
  sessionId: string;
  characterId: string | null;
  isConnected: boolean;
  lastSeen: Date;
}

export interface HostRecord {
  id: string;
  userId: string;
  sessionId: string;
  permissions: unknown;
  isPrimary: boolean;
}

export abstract class BaseRepository {
  constructor(protected pool: Pool) {}
}
