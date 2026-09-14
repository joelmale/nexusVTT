/**
 * Hybrid State Management Types
 *
 * These types extend the existing game types to support:
 * - Local-first IndexedDB persistence
 * - Real-time multiplayer synchronization
 * - Seamless mode transitions
 */

import type { GameState, Session, User } from './game';

// =============================================================================
// PERSISTENCE LAYER TYPES
// =============================================================================

export interface PersistedGameState extends GameState {
  // Persistence metadata
  persistenceVersion: number;
  lastSaved: number;
  lastModified: number;

  // Sync metadata for multiplayer
  syncVersion: number; // Incremented on each change for conflict resolution
  lastSyncedAt?: number; // Last time synced with server
  localChanges: LocalChange[]; // Pending changes not yet synced
}

export interface LocalChange {
  id: string;
  timestamp: number;
  type: 'action' | 'state-update';
  action?: GameAction;
  stateUpdate?: Partial<GameState>;
  applied: boolean; // Whether this change has been applied locally
  synced: boolean; // Whether this change has been sent to server
}

// =============================================================================
// MULTIPLAYER SESSION TYPES
// =============================================================================

export type SessionMode = 'local' | 'hosting' | 'joined';

export interface MultiplayerSession extends Session {
  mode: SessionMode;

  // Session metadata
  sessionId: string; // Unique session identifier
  createdAt: number;
  lastActivity: number;

  // Authority and permissions
  authorityId: string; // Who has write permissions (usually DM)
  isAuthority: boolean; // Whether current user is the authority

  // Connection status
  connectionState:
    | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'reconnecting'
    | 'error';
  lastConnected?: number;
  connectionAttempts: number;

  // Sync state
  fullSyncRequired: boolean; // Whether client needs full state sync
  lastFullSync?: number;
  pendingActions: GameAction[]; // Actions waiting to be processed
}

export interface ConnectedPlayer extends User {
  // Connection metadata
  joinedAt: number;
  lastSeen: number;
  socketId?: string; // Socket.IO connection ID

  // Sync state
  lastSyncedVersion: number; // Last sync version sent to this player
  needsFullSync: boolean; // Whether player needs complete state

  // Permissions
  permissions: PlayerPermissions;
}

export interface PlayerPermissions {
  canEditScenes: boolean;
  canMoveTokens: boolean;
  canCreateTokens: boolean;
  canDeleteTokens: boolean;
  canUseDrawingTools: boolean;
  canManageInitiative: boolean;
  canRollDice: boolean;
  canViewPrivateContent: boolean;
}

// =============================================================================
// ACTION SYSTEM TYPES
// =============================================================================

export interface GameAction {
  // Action metadata
  id: string;
  type: string;
  timestamp: number;

  // Source and target
  userId: string;
  sessionId?: string;

  // Payload
  payload: unknown;

  // Sync metadata
  version: number; // Sync version when this action was created
  requiresAuth: boolean; // Whether action requires authority permissions
  optimistic?: boolean; // Whether this is an optimistic local action
}

export interface ActionResult {
  success: boolean;
  action: GameAction;
  newState?: Partial<GameState>;
  error?: string;
  rollback?: PersistedGameState; // State to rollback to if action fails
  metadata?: unknown;
}

// =============================================================================
// SYNC AND CONFLICT RESOLUTION
// =============================================================================

export interface SyncState {
  // Current sync status
  isSyncing: boolean;
  lastSyncAttempt: number;
  lastSuccessfulSync: number;
  syncErrors: SyncError[];

  // Version tracking
  localVersion: number; // Current local state version
  remoteVersion: number; // Last known remote state version
  conflictVersion?: number; // Version where conflict occurred

  // Conflict resolution
  hasConflicts: boolean;
  conflicts: StateConflict[];
  resolutionStrategy: 'local-wins' | 'remote-wins' | 'merge' | 'manual';
}

export interface SyncError {
  id: string;
  timestamp: number;
  type: 'network' | 'conflict' | 'auth' | 'validation';
  message: string;
  action?: GameAction;
  retryable: boolean;
  retryCount: number;
}

export interface StateConflict {
  id: string;
  timestamp: number;
  path: string; // JSONPath to conflicted property
  localValue: unknown;
  remoteValue: unknown;
  baseValue?: unknown; // Original value before conflict
  resolution?: 'local' | 'remote' | 'merged' | 'custom';
  resolvedValue?: unknown;
}

// =============================================================================
// STORAGE AND PERSISTENCE
// =============================================================================

export interface StorageAdapter {
  // Basic CRUD operations
  save(key: string, data: unknown): Promise<void>;
  load<T>(key: string): Promise<T | null>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;

  // Batch operations
  saveBatch(items: Array<{ key: string; data: unknown }>): Promise<void>;
  loadBatch<T>(keys: string[]): Promise<Array<T | null>>;

  // Metadata
  exists(key: string): Promise<boolean>;
  size(): Promise<number>;
  keys(): Promise<string[]>;
}

export interface IndexedDBConfig {
  dbName: string;
  version: number;
  stores: Array<{
    name: string;
    keyPath?: string;
    indexes?: Array<{ name: string; keyPath: string; unique?: boolean }>;
  }>;
}

// =============================================================================
// WEBSOCKET AND REAL-TIME COMMUNICATION
// =============================================================================

export interface RealtimeMessage {
  type:
    | 'action'
    | 'state-sync'
    | 'player-join'
    | 'player-leave'
    | 'session-control';
  sessionId: string;
  timestamp: number;
  version: number;

  // Source information
  from: {
    userId: string;
    socketId: string;
    isAuthority: boolean;
  };

  // Target information (optional for broadcast)
  to?: {
    userId?: string;
    socketId?: string;
    broadcast?: boolean;
  };

  // Message payload
  payload: unknown;

  // Delivery and acknowledgment
  requiresAck: boolean;
  messageId: string;
  replyTo?: string;
}

export interface StateSyncMessage extends RealtimeMessage {
  type: 'state-sync';
  payload: {
    syncType: 'full' | 'partial' | 'diff';
    state?: Partial<PersistedGameState>;
    actions?: GameAction[];
    version: number;
    checksum?: string; // For integrity verification
  };
}

export interface ActionMessage extends RealtimeMessage {
  type: 'action';
  payload: {
    action: GameAction;
    optimistic: boolean;
    requiresResponse: boolean;
  };
}

// =============================================================================
// CONFIGURATION AND OPTIONS
// =============================================================================

export interface HybridStoreConfig {
  // Storage configuration
  storage: {
    adapter: 'indexeddb' | 'localStorage' | 'custom';
    dbName: string;
    version: number;
    autoSave: boolean;
    saveDebounceMs: number;
    compressionEnabled: boolean;
  };

  // Sync configuration
  sync: {
    enableRealtime: boolean;
    conflictResolution: 'local-wins' | 'remote-wins' | 'merge' | 'manual';
    maxRetries: number;
    retryDelayMs: number;
    fullSyncIntervalMs: number;
    heartbeatIntervalMs: number;
  };

  // Performance configuration
  performance: {
    maxCachedActions: number;
    maxSyncErrors: number;
    stateCompressionThreshold: number;
    optimisticUpdates: boolean;
  };

  // Development configuration
  debug: {
    enableLogging: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    enableMetrics: boolean;
    simulateLatency: boolean;
    simulateErrors: boolean;
  };
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type StateSelector<T> = (state: PersistedGameState) => T;

export type ActionCreator<P = unknown> = (payload: P) => GameAction;

export type StateUpdater<T> = (current: T) => T | void;
