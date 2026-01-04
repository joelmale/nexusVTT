/**
 * Extended Chat Types
 *
 * Additional type definitions for enhanced chat functionality
 */

import type { Player } from './game';

// Extended message types beyond basic text/system/whisper
export type ExtendedMessageType =
  | 'dice-roll'      // Dice roll results
  | 'emote'          // /me actions (roleplay)
  | 'ooc'            // Out of character messages
  | 'combat-action'; // Combat log entries

// All possible message types
export type AllMessageType =
  | 'text'
  | 'system'
  | 'dm-announcement'
  | 'whisper'
  | ExtendedMessageType;

// Dice roll data structure
export interface DiceRollData {
  expression: string;      // Original expression: "2d20+5"
  results: number[];       // Individual die results: [18, 12]
  total: number;           // Final total: 35
  breakdown: string;       // Human-readable: "[18, 12] + 5 = 35"
  modifier: number;        // Modifier value: 5
  diceType?: number;       // Die type: 20 (for d20)
  diceCount?: number;      // Number of dice: 2
  isCrit?: boolean;        // Natural 20 (or max)
  isCritFail?: boolean;    // Natural 1
  rollType?: 'normal' | 'advantage' | 'disadvantage';
}

// Emoji reaction data
export interface MessageReaction {
  emoji: string;
  userIds: string[];
  count: number;
}

// Extended chat message with all optional fields
export interface ExtendedChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  messageType: AllMessageType;
  recipientId?: string;
  timestamp: number;

  // Extended fields
  diceData?: DiceRollData;
  characterId?: string;
  characterName?: string;
  reactions?: MessageReaction[];
  isEdited?: boolean;
  editedAt?: number;
  mentionedUserIds?: string[];
}

// Chat command context
export interface ChatCommandContext {
  user: {
    id: string;
    name: string;
    type: 'host' | 'player' | 'spectator';
  };
  session: {
    roomCode: string;
    players: Player[];
  } | null;
  isHost: boolean;
  activeCharacter?: {
    id: string;
    name: string;
  };
}

// Command execution result
export interface ChatCommandResult {
  success: boolean;
  message?: string;
  preventDefault?: boolean;
  // Optional data to send as chat message
  messageOverride?: {
    content: string;
    messageType: AllMessageType;
    diceData?: DiceRollData;
    recipientId?: string;
  };
}

// Command handler function signature
export type ChatCommandHandler = (
  args: string[],
  context: ChatCommandContext
) => ChatCommandResult | Promise<ChatCommandResult>;

// Command definition
export interface ChatCommand {
  command: string;           // Primary command name (e.g., 'roll')
  aliases: string[];         // Alternative names (e.g., ['r'])
  pattern: RegExp;           // Regex to match the command
  handler: ChatCommandHandler;
  description: string;       // Help text description
  usage: string;             // Usage example
  requiresHost?: boolean;    // DM/host only
  requiresSession?: boolean; // Requires active session
}

// Chat filter options
export interface ChatFilter {
  search: string;
  messageTypes: AllMessageType[];
  playerIds: string[];
  dateRange?: {
    start: number;
    end: number;
  };
}

// Chat tab types
export type ChatTabType =
  | 'all'
  | 'combat'
  | 'roleplay'
  | 'ooc'
  | 'whispers';

export interface ChatTabState {
  active: ChatTabType;
  unreadCount: Record<ChatTabType, number>;
}
