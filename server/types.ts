import type { WebSocket } from 'ws';
import type { ServerDiceRoll } from './diceRoller.js';
import type {
  StateHash,
  JsonPatch,
  ResyncReason,
} from '../shared/sync/contracts.js';
import type {
  ClientEventIdentity,
  EventAcknowledgement,
  EventCursorUpdate,
} from '../shared/events/contracts.js';

export interface GameState {
  scenes: unknown[];
  activeSceneId: string | null;
  characters: unknown[];
  initiative: unknown;
}

// Server-side types
export interface Room {
  code: string;
  host: string;
  coHosts: Set<string>; // Support for multiple co-hosts
  players: Set<string>;
  connections: Map<string, WebSocket>;
  created: number;
  lastActivity: number;
  status: 'active' | 'hibernating' | 'abandoned';
  dmConnected: boolean;
  hibernationTimer?: NodeJS.Timeout;
  gameState?: GameState;
  previousGameState?: GameState; // For delta generation
  stateVersion: number; // State version counter for patches
  entityVersions: Map<string, number>;
  // Content-hash of the current room.gameState under SyncableGameState shape.
  // Anchors the delta-sync token chain. null until first commit.
  syncToken: StateHash | null;
}

export interface Connection {
  id: string;
  ws: WebSocket;
  room?: string;
  user?: {
    name: string;
    type: 'host' | 'player';
  };
  // Heartbeat and connection quality tracking
  lastPing?: number;
  lastPong?: number;
  pendingPing?: string;
  consecutiveMisses: number;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'critical';
  maliciousAttemptsCount?: number; // Tracks anti-tamper security violations
  requestedEventCursor?: number | null;
  legacyClientSequence?: number;
}

export interface BaseServerMessage {
  src?: string;
  dst?: string;
  timestamp: number;
  eventId?: string;
  actorId?: string;
  clientSequence?: number;
  serverSequence?: number;
  occurredAt?: number;
  roomCode?: string;
}

export interface ServerEventMessage extends BaseServerMessage {
  type: 'event';
  data: {
    name: string;
    [key: string]: unknown; // Allow other properties
  };
}

export interface ServerDiceRollResultMessage extends BaseServerMessage {
  type: 'event';
  data: {
    name: 'dice/roll-result';
    roll: ServerDiceRoll;
  };
}

export interface ServerErrorMessage extends BaseServerMessage {
  type: 'error';
  data: {
    message: string;
    code?: number;
  };
}

export interface ServerHeartbeatMessage extends BaseServerMessage {
  type: 'heartbeat';
  data: {
    type: 'ping' | 'pong';
    id: string;
    serverTime?: number;
  };
}

export interface ServerUpdateConfirmationMessage extends BaseServerMessage {
  type: 'update-confirmed';
  data: {
    updateId: string;
  };
}

export interface ServerEventAcknowledgementMessage extends BaseServerMessage {
  type: 'event-ack';
  data: EventAcknowledgement;
}

export interface ServerEventCursorMessage extends BaseServerMessage {
  type: 'event-cursor';
  data: EventCursorUpdate;
}

export interface ServerChatMessage extends BaseServerMessage {
  type: 'chat-message';
  data: {
    content: string;
  };
}

export interface ServerGameStatePatchMessage extends BaseServerMessage {
  type: 'game-state-patch';
  data: {
    patch: unknown[]; // JSON Patch operations
    version: number; // State version
    // Delta-sync chain anchors (added by the content-hash-chained sync). The
    // legacy client reads only patch/version; these are additive and ignored
    // by older handlers.
    baseToken?: StateHash | null;
    newToken?: StateHash;
  };
}

/**
 * Server→sender ack confirming a committed upload and its new token.
 * NEW message type; the legacy client ignores unknown types.
 */
export interface ServerSyncAckMessage extends BaseServerMessage {
  type: 'game-state-ack';
  data: {
    token: StateHash;
    version: number;
  };
}

/**
 * Server→sender directive to resend a full snapshot after a chain break.
 * NEW message type; the legacy client ignores unknown types.
 */
export interface ServerResyncRequiredMessage extends BaseServerMessage {
  type: 'game-state-resync-required';
  data: {
    serverToken: StateHash | null;
    reason: ResyncReason;
  };
}

// Re-export shared sync aliases for server-internal use.
export type { StateHash, JsonPatch, ResyncReason };

// Union type for all possible server messages
export type ServerMessage =
  | ServerEventMessage
  | ServerDiceRollResultMessage
  | ServerErrorMessage
  | ServerHeartbeatMessage
  | ServerUpdateConfirmationMessage
  | ServerEventAcknowledgementMessage
  | ServerEventCursorMessage
  | ServerChatMessage
  | ServerGameStatePatchMessage
  | ServerSyncAckMessage
  | ServerResyncRequiredMessage;

export type { ClientEventIdentity };
