import { Pool, type PoolClient } from 'pg';

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

export interface CampaignActorRecord {
  id: string;
  campaignId: string;
  sourceRef: unknown | null;
  ownerId: string | null;
  name: string;
  ruleset: unknown;
  stateVersion: number;
  currentHp: number;
  maxHp: number;
  tempHp: number;
  conditions: unknown[];
  deathSaves: { successes: number; failures: number };
  resourcePools: Record<string, unknown>;
  spellcastingProfiles: unknown[];
  inventory: unknown[];
  activeSessionId: string | null;
  payload: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface DomainCommandReceiptRecord {
  commandId: string;
  principalId: string;
  scopeKind: 'campaign' | 'session' | 'account';
  scopeId: string;
  commandType: string;
  payloadHash: string;
  committedAt: Date;
  result: unknown;
}

export interface LegacyObjectIdRecord {
  namespace: string;
  legacyId: string;
  canonicalId: string;
  ownerId: string | null;
  createdAt: Date;
}

export interface LibraryObjectRecord {
  id: string;
  ownerId: string;
  campaignId: string | null;
  kind: 'monster' | 'spell' | 'item' | 'encounter';
  name: string;
  tags: string[];
  currentRevision: number;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LibraryObjectRevisionRecord {
  objectId: string;
  revision: number;
  ruleset: unknown;
  data: unknown;
  createdAt: Date;
}

export interface EncounterRunRecord {
  id: string;
  campaignId: string;
  templateRef: unknown;
  stage: 'staged' | 'deployed' | 'active' | 'completed' | 'archived';
  deploymentCommandId: string;
  activeSessionId: string | null;
  currentRound: number;
  currentTurnIndex: number;
  activeWaveIndex: number;
  participants: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

export type CampaignPrepObjectKind =
  | 'note'
  | 'npc'
  | 'location'
  | 'faction'
  | 'quest'
  | 'lore'
  | 'clue'
  | 'scene-template'
  | 'campaign-map'
  | 'session-plan';

export type CampaignPrepObjectStatus =
  'draft' | 'ready' | 'retired' | 'archived';

export interface CampaignPrepObjectRecord {
  id: string;
  campaignId: string;
  kind: CampaignPrepObjectKind;
  title: string;
  currentRevision: number;
  status: CampaignPrepObjectStatus;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignPrepObjectRevisionRecord {
  objectId: string;
  revision: number;
  schemaVersion: number;
  data: unknown;
  dependencyManifest: unknown[];
  createdBy: string | null;
  requestId: string;
  createdAt: Date;
}

export interface CampaignPrepObjectLinkRecord {
  sourceObjectId: string;
  sourceRevision: number;
  targetKey: string;
  target: unknown;
  createdAt: Date;
}

export abstract class BaseRepository {
  constructor(protected pool: Pool) {}

  protected getExecutor(client?: PoolClient) {
    return client ?? this.pool;
  }
}
