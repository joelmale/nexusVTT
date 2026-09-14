import type {
  ChatCommand,
  ChatCommandContext,
  ChatCommandResult,
  DiceRollData,
} from '@/types/chat';

function rollDice(expression: string): DiceRollData | null {
  const cleaned = expression.trim().toLowerCase();
  const match = cleaned.match(/^(\d+)d(\d+)([+-]\d+)?$/);

  if (!match) {
    return null;
  }

  const diceCount = parseInt(match[1], 10);
  const diceType = parseInt(match[2], 10);
  const modifierMatch = match[3];
  const modifier = modifierMatch ? parseInt(modifierMatch, 10) : 0;

  if (diceCount < 1 || diceCount > 100) {
    return null;
  }

  if (![2, 3, 4, 6, 8, 10, 12, 20, 100].includes(diceType)) {
    return null;
  }

  const results: number[] = [];
  for (let i = 0; i < diceCount; i++) {
    results.push(Math.floor(Math.random() * diceType) + 1);
  }

  const diceTotal = results.reduce((sum, val) => sum + val, 0);
  const total = diceTotal + modifier;
  const resultsStr = `[${results.join(', ')}]`;
  const modifierStr = modifier !== 0 ? ` ${modifier > 0 ? '+' : ''}${modifier}` : '';
  const breakdown = `${resultsStr}${modifierStr} = ${total}`;
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

    return {
      success: true,
      preventDefault: true,
      messageOverride: {
        content: args.join(' '),
        messageType: 'emote',
      },
    };
  },
};

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

    return {
      success: true,
      preventDefault: true,
      messageOverride: {
        content: args.join(' '),
        messageType: 'ooc',
      },
    };
  },
};

const clearCommand: ChatCommand = {
  command: 'clear',
  aliases: [],
  pattern: /^\/clear$/,
  description: 'Clear all chat messages (DM only)',
  usage: '/clear',
  requiresHost: true,

  handler: (): ChatCommandResult => {
    return {
      success: true,
      message: 'Chat cleared',
      preventDefault: true,
    };
  },
};

const helpCommand: ChatCommand = {
  command: 'help',
  aliases: ['?', 'commands'],
  pattern: /^\/(?:help|\?|commands)(?:\s+(.+))?$/,
  description: 'Show available commands or help for a specific command',
  usage: '/help or /help roll',

  handler: (args: string[]): ChatCommandResult => {
    const commandName = args[0];
    return {
      success: true,
      message: commandName ? `help:${commandName}` : 'help:all',
      preventDefault: true,
    };
  },
};

export const allCommands: ChatCommand[] = [
  rollCommand,
  whisperCommand,
  emoteCommand,
  oocCommand,
  clearCommand,
  helpCommand,
];

export { rollCommand, whisperCommand, emoteCommand, oocCommand, clearCommand, helpCommand, rollDice };

export class ChatCommandParser {
  private commands: Map<string, ChatCommand> = new Map();

  register(command: ChatCommand): void {
    this.commands.set(command.command.toLowerCase(), command);
    command.aliases.forEach((alias) => {
      this.commands.set(alias.toLowerCase(), command);
    });
  }

  registerAll(commands: ChatCommand[]): void {
    commands.forEach((cmd) => this.register(cmd));
  }

  async parse(
    input: string,
    context: ChatCommandContext,
  ): Promise<ChatCommandResult | null> {
    const trimmed = input.trim();

    if (!trimmed.startsWith('/')) {
      return null;
    }

    const parts = trimmed.slice(1).split(/\s+/);
    const commandName = parts[0]?.toLowerCase();

    if (!commandName) {
      return null;
    }

    const command = this.commands.get(commandName);

    if (!command) {
      return {
        success: false,
        message: `Unknown command: /${commandName}. Type /help for available commands.`,
        preventDefault: true,
      };
    }

    if (command.requiresHost && !context.isHost) {
      return {
        success: false,
        message: `Command /${commandName} is only available to the host/DM.`,
        preventDefault: true,
      };
    }

    if (command.requiresSession && !context.session) {
      return {
        success: false,
        message: `Command /${commandName} requires an active session.`,
        preventDefault: true,
      };
    }

    try {
      const args = parts.slice(1);
      const result = await command.handler(args, context);
      return result;
    } catch (error) {
      console.error(`Error executing command /${commandName}:`, error);
      return {
        success: false,
        message: `Error executing command: ${error instanceof Error ? error.message : 'Unknown error'}`,
        preventDefault: true,
      };
    }
  }

  autocomplete(partial: string): ChatCommand[] {
    if (!partial.startsWith('/')) {
      return [];
    }

    const search = partial.slice(1).toLowerCase();

    if (!search) {
      return Array.from(new Set(this.commands.values()));
    }

    const matches: ChatCommand[] = [];
    const seen = new Set<string>();

    this.commands.forEach((command, key) => {
      if (seen.has(command.command)) {
        return;
      }

      if (
        key.startsWith(search) ||
        command.aliases.some((alias) => alias.toLowerCase().startsWith(search))
      ) {
        matches.push(command);
        seen.add(command.command);
      }
    });

    return matches;
  }

  getHelp(commandName?: string): string {
    if (commandName) {
      const command = this.commands.get(commandName.toLowerCase());
      if (!command) {
        return `Unknown command: ${commandName}`;
      }
      return this.formatCommandHelp(command);
    }

    const uniqueCommands = Array.from(new Set(this.commands.values()));
    const lines = ['Available Commands:', ''];

    uniqueCommands.forEach((cmd) => {
      const aliases = cmd.aliases.length > 0 ? ` (${cmd.aliases.join(', ')})` : '';
      lines.push(`/${cmd.command}${aliases}`);
      lines.push(`  ${cmd.description}`);
      lines.push(`  Usage: ${cmd.usage}`);
      lines.push('');
    });

    return lines.join('\n');
  }

  private formatCommandHelp(command: ChatCommand): string {
    const aliases =
      command.aliases.length > 0
        ? `\nAliases: ${command.aliases.map((a) => `/${a}`).join(', ')}`
        : '';
    return `Command: /${command.command}${aliases}\n\n${command.description}\n\nUsage: ${command.usage}`;
  }

  isCommand(input: string): boolean {
    return input.trim().startsWith('/');
  }

  getAllCommands(): ChatCommand[] {
    return Array.from(new Set(this.commands.values()));
  }
}

export const chatCommandParser = new ChatCommandParser();
