/**
 * Chat Command Parser
 *
 * Parses and executes chat commands like /roll, /w, /me, etc.
 */

import type {
  ChatCommand,
  ChatCommandContext,
  ChatCommandResult,
} from '@/types/chat';

/**
 * Chat Command Parser
 *
 * Manages registration and execution of chat commands
 */
export class ChatCommandParser {
  private commands: Map<string, ChatCommand> = new Map();

  /**
   * Register a command
   */
  register(command: ChatCommand): void {
    // Register primary command
    this.commands.set(command.command.toLowerCase(), command);

    // Register aliases
    command.aliases.forEach((alias) => {
      this.commands.set(alias.toLowerCase(), command);
    });
  }

  /**
   * Register multiple commands
   */
  registerAll(commands: ChatCommand[]): void {
    commands.forEach((cmd) => this.register(cmd));
  }

  /**
   * Parse and execute a command
   *
   * @param input - The full message input
   * @param context - Chat context (user, session, etc.)
   * @returns Command result or null if not a command
   */
  async parse(
    input: string,
    context: ChatCommandContext,
  ): Promise<ChatCommandResult | null> {
    const trimmed = input.trim();

    // Not a command if doesn't start with /
    if (!trimmed.startsWith('/')) {
      return null;
    }

    // Extract command and arguments
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

    // Check host requirement
    if (command.requiresHost && !context.isHost) {
      return {
        success: false,
        message: `Command /${commandName} is only available to the host/DM.`,
        preventDefault: true,
      };
    }

    // Check session requirement
    if (command.requiresSession && !context.session) {
      return {
        success: false,
        message: `Command /${commandName} requires an active session.`,
        preventDefault: true,
      };
    }

    // Execute command handler
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

  /**
   * Get autocomplete suggestions
   *
   * @param partial - Partial command input (e.g., "/ro")
   * @returns Array of matching commands
   */
  autocomplete(partial: string): ChatCommand[] {
    if (!partial.startsWith('/')) {
      return [];
    }

    const search = partial.slice(1).toLowerCase();

    if (!search) {
      // Return all commands if just "/"
      return Array.from(new Set(this.commands.values()));
    }

    // Find commands that match the partial input
    const matches: ChatCommand[] = [];
    const seen = new Set<string>();

    this.commands.forEach((command, key) => {
      // Avoid duplicates (aliases point to same command)
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

  /**
   * Get help text for all commands or a specific command
   *
   * @param commandName - Optional specific command name
   * @returns Help text string
   */
  getHelp(commandName?: string): string {
    if (commandName) {
      const command = this.commands.get(commandName.toLowerCase());
      if (!command) {
        return `Unknown command: ${commandName}`;
      }

      return this.formatCommandHelp(command);
    }

    // Generate help for all commands
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

  /**
   * Format help text for a single command
   */
  private formatCommandHelp(command: ChatCommand): string {
    const aliases =
      command.aliases.length > 0
        ? `\nAliases: ${command.aliases.map((a) => `/${a}`).join(', ')}`
        : '';

    return `Command: /${command.command}${aliases}\n\n${command.description}\n\nUsage: ${command.usage}`;
  }

  /**
   * Check if input is a command
   */
  isCommand(input: string): boolean {
    return input.trim().startsWith('/');
  }

  /**
   * Get all registered commands (for testing/debugging)
   */
  getAllCommands(): ChatCommand[] {
    return Array.from(new Set(this.commands.values()));
  }
}

// Global command parser instance
export const chatCommandParser = new ChatCommandParser();
