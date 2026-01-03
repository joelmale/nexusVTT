/**
 * Chat Command Handlers
 *
 * Implementation of all chat commands
 */

import type {
  ChatCommand,
  ChatCommandContext,
  ChatCommandResult,
  DiceRollData,
} from '@/types/chat';

/**
 * Parse dice expression and roll
 *
 * Supports: 2d20, 1d6+3, 3d8-2, etc.
 */
function rollDice(expression: string): DiceRollData | null {
  // Clean the expression
  const cleaned = expression.trim().toLowerCase();

  // Match pattern: XdY+Z or XdY-Z or XdY
  const match = cleaned.match(/^(\d+)d(\d+)([+-]\d+)?$/);

  if (!match) {
    return null;
  }

  const diceCount = parseInt(match[1], 10);
  const diceType = parseInt(match[2], 10);
  const modifierMatch = match[3];
  const modifier = modifierMatch ? parseInt(modifierMatch, 10) : 0;

  // Validate ranges
  if (diceCount < 1 || diceCount > 100) {
    return null; // Too many dice
  }

  if (![2, 3, 4, 6, 8, 10, 12, 20, 100].includes(diceType)) {
    return null; // Invalid die type
  }

  // Roll the dice
  const results: number[] = [];
  for (let i = 0; i < diceCount; i++) {
    results.push(Math.floor(Math.random() * diceType) + 1);
  }

  const diceTotal = results.reduce((sum, val) => sum + val, 0);
  const total = diceTotal + modifier;

  // Build breakdown string
  const resultsStr = `[${results.join(', ')}]`;
  const modifierStr = modifier !== 0 ? ` ${modifier > 0 ? '+' : ''}${modifier}` : '';
  const breakdown = `${resultsStr}${modifierStr} = ${total}`;

  // Check for crits (only for single d20)
  const isCrit = diceCount === 1 && diceType === 20 && results[0] === 20;
  const isCritFail = diceCount === 1 && diceType === 20 && results[0] === 1;

  return {
    expression: cleaned,
    results,
    total,
    breakdown,
    modifier,
    diceType,
    diceCount,
    isCrit,
    isCritFail,
    rollType: 'normal',
  };
}

/**
 * /roll or /r - Roll dice
 */
const rollCommand: ChatCommand = {
  command: 'roll',
  aliases: ['r'],
  pattern: /^\/r(?:oll)?\s+(.+)$/,
  description: 'Roll dice with standard notation',
  usage: '/roll 2d20+5 or /r 1d6',

  handler: (args: string[]): ChatCommandResult => {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Please specify dice to roll. Example: /roll 2d20+5',
        preventDefault: true,
      };
    }

    const expression = args.join(' ');
    const rollResult = rollDice(expression);

    if (!rollResult) {
      return {
        success: false,
        message: `Invalid dice expression: "${expression}". Use format like "2d20+5" or "1d6".`,
        preventDefault: true,
      };
    }

    // Return dice roll message
    return {
      success: true,
      preventDefault: true,
      messageOverride: {
        content: `rolled ${rollResult.breakdown}`,
        messageType: 'dice-roll',
        diceData: rollResult,
      },
    };
  },
};

/**
 * /w or /whisper - Send private message
 */
const whisperCommand: ChatCommand = {
  command: 'whisper',
  aliases: ['w'],
  pattern: /^\/w(?:hisper)?\s+(\S+)\s+(.+)$/,
  description: 'Send a private message to another player',
  usage: '/w PlayerName Your secret message or /whisper PlayerName message',
  requiresSession: true,

  handler: (args: string[], context: ChatCommandContext): ChatCommandResult => {
    if (args.length < 2) {
      return {
        success: false,
        message: 'Usage: /w PlayerName Your message',
        preventDefault: true,
      };
    }

    if (!context.session) {
      return {
        success: false,
        message: 'You must be in a session to whisper.',
        preventDefault: true,
      };
    }

    const targetName = args[0];
    const message = args.slice(1).join(' ');

    // Find target player (case-insensitive)
    const targetPlayer = context.session.players.find(
      (p) => p.name.toLowerCase() === targetName.toLowerCase(),
    );

    if (!targetPlayer) {
      return {
        success: false,
        message: `Player "${targetName}" not found.`,
        preventDefault: true,
      };
    }

    if (targetPlayer.id === context.user.id) {
      return {
        success: false,
        message: 'You cannot whisper to yourself.',
        preventDefault: true,
      };
    }

    return {
      success: true,
      preventDefault: true,
      messageOverride: {
        content: message,
        messageType: 'whisper',
        recipientId: targetPlayer.id,
      },
    };
  },
};

/**
 * /me - Emote/action message
 */
const emoteCommand: ChatCommand = {
  command: 'me',
  aliases: [],
  pattern: /^\/me\s+(.+)$/,
  description: 'Perform an action or emote',
  usage: '/me waves hello',

  handler: (args: string[]): ChatCommandResult => {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Please specify an action. Example: /me waves',
        preventDefault: true,
      };
    }

    const action = args.join(' ');

    return {
      success: true,
      preventDefault: true,
      messageOverride: {
        content: action,
        messageType: 'emote',
      },
    };
  },
};

/**
 * /ooc - Out of character message
 */
const oocCommand: ChatCommand = {
  command: 'ooc',
  aliases: [],
  pattern: /^\/ooc\s+(.+)$/,
  description: 'Send an out-of-character message',
  usage: '/ooc Hey folks, I need to step away for 5 minutes',

  handler: (args: string[]): ChatCommandResult => {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Please specify a message. Example: /ooc Break time?',
        preventDefault: true,
      };
    }

    const message = args.join(' ');

    return {
      success: true,
      preventDefault: true,
      messageOverride: {
        content: message,
        messageType: 'ooc',
      },
    };
  },
};

/**
 * /clear - Clear chat (host only)
 */
const clearCommand: ChatCommand = {
  command: 'clear',
  aliases: [],
  pattern: /^\/clear$/,
  description: 'Clear all chat messages (DM only)',
  usage: '/clear',
  requiresHost: true,

  handler: (): ChatCommandResult => {
    // This will be handled by the chat component
    return {
      success: true,
      message: 'Chat cleared',
      preventDefault: true,
    };
  },
};

/**
 * /help - Show command help
 */
const helpCommand: ChatCommand = {
  command: 'help',
  aliases: ['?', 'commands'],
  pattern: /^\/(?:help|\?|commands)(?:\s+(.+))?$/,
  description: 'Show available commands or help for a specific command',
  usage: '/help or /help roll',

  handler: (args: string[]): ChatCommandResult => {
    // Help text will be generated by the command parser
    // This is just a placeholder that signals to show help
    const commandName = args[0];

    return {
      success: true,
      message: commandName ? `help:${commandName}` : 'help:all',
      preventDefault: true,
    };
  },
};

/**
 * All available commands
 */
export const allCommands: ChatCommand[] = [
  rollCommand,
  whisperCommand,
  emoteCommand,
  oocCommand,
  clearCommand,
  helpCommand,
];

/**
 * Export individual commands for testing
 */
export { rollCommand, whisperCommand, emoteCommand, oocCommand, clearCommand, helpCommand };

/**
 * Utility: Export rollDice for use in other modules
 */
export { rollDice };
