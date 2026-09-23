import { describe, expect, it, vi } from 'vitest';
import { ChatCommandParser, allCommands, rollDice } from '@/services/chatCommands';
import type { ChatCommandContext } from '@/types/chat';

const context = { user: { id: 'user-1', name: 'Player' }, isHost: false, session: null } as unknown as ChatCommandContext;

describe('chat commands', () => {
  it('validates dice and reports crits with deterministic rolls', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    expect(rollDice('1d20+2')).toMatchObject({ total: 22, isCrit: true, modifier: 2 });
    expect(rollDice('101d6')).toBeNull(); expect(rollDice('1d7')).toBeNull(); expect(rollDice('not dice')).toBeNull();
  });

  it('enforces command prerequisites and parses aliases, whisper, and help', async () => {
    const parser = new ChatCommandParser(); parser.registerAll(allCommands);
    expect(await parser.parse('hello', context)).toBeNull();
    await expect(parser.parse('/clear', context)).resolves.toMatchObject({ success: false, message: expect.stringContaining('host') });
    await expect(parser.parse('/w Player secret', context)).resolves.toMatchObject({ success: false, message: expect.stringContaining('active session') });
    const sessionContext = { ...context, session: { players: [{ id: 'user-1', name: 'Player' }, { id: 'user-2', name: 'Target' }] } } as ChatCommandContext;
    await expect(parser.parse('/w target secret words', sessionContext)).resolves.toMatchObject({ success: true, messageOverride: { recipientId: 'user-2', content: 'secret words' } });
    await expect(parser.parse('/r 1d6', context)).resolves.toMatchObject({ success: true });
    expect(parser.autocomplete('/r').map((command) => command.command)).toContain('roll');
    expect(parser.getHelp('roll')).toContain('Command: /roll'); expect(parser.getHelp()).toContain('Available Commands');
  });
});
