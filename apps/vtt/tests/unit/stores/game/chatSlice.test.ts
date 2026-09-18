import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChatSlice } from '@/stores/game/chatSlice';
import type { GameStoreGet, GameStoreSet } from '@/stores/game/types';
import type { ChatMessage } from '@/types/game';

const mockSendChatMessage = vi.fn();
const mockSendEvent = vi.fn();
vi.mock('@/services/websocket', () => ({
  webSocketService: {
    sendChatMessage: (...args: unknown[]) => mockSendChatMessage(...args),
    sendEvent: (...args: unknown[]) => mockSendEvent(...args),
  },
}));

interface MockChatState {
  user: { id: string; name: string; connected: boolean };
  session: { id: string; name: string } | null;
  chat: {
    messages: ChatMessage['data'][];
    isOpen: boolean;
    unreadCount: number;
  };
  [key: string]: unknown;
}

describe('chatSlice', () => {
  let state: MockChatState;
  let get: GameStoreGet;
  let set: GameStoreSet;

  beforeEach(() => {
    mockSendChatMessage.mockClear();
    mockSendEvent.mockClear();

    state = {
      user: { id: 'u-1', name: 'Thorin', connected: true },
      session: { id: 's-1', name: 'Erebor Campaign' },
      chat: {
        messages: [] as ChatMessage['data'][],
        isOpen: false,
        unreadCount: 0,
      },
    };

    get = vi.fn(() => state) as unknown as GameStoreGet;
    set = vi.fn((updater) => {
      if (typeof updater === 'function') {
        updater(state);
      } else {
        Object.assign(state, updater);
      }
    }) as unknown as GameStoreSet;
  });

  describe('sendChatMessage', () => {
    it('does nothing if user name or session is missing', () => {
      state.user.name = '';
      const slice = createChatSlice(set, get);

      slice.sendChatMessage('Hello there');
      expect(set).not.toHaveBeenCalled();
      expect(mockSendChatMessage).not.toHaveBeenCalled();

      state.user.name = 'Thorin';
      state.session = null;
      slice.sendChatMessage('Hello there');
      expect(set).not.toHaveBeenCalled();
    });

    it('creates and appends a message, trims whitespace, and sends via websocket', async () => {
      const slice = createChatSlice(set, get);

      slice.sendChatMessage(
        '  Greetings warriors!  ',
        'text',
        undefined,
        { roll: 20 } as unknown as ChatMessage['data']['diceData'],
      );

      expect(state.chat.messages).toHaveLength(1);
      const msg = state.chat.messages[0];
      expect(msg.content).toBe('Greetings warriors!');
      expect(msg.userName).toBe('Thorin');
      expect(msg.userId).toBe('u-1');
      expect(msg.messageType).toBe('text');
      expect(msg.diceData).toEqual({ roll: 20 });
      expect(msg.id).toBeDefined();
      expect(msg.timestamp).toBeGreaterThan(0);

      // Wait for dynamic import microtask
      await vi.waitFor(() => {
        expect(mockSendChatMessage).toHaveBeenCalledTimes(1);
        expect(mockSendChatMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            content: 'Greetings warriors!',
            userName: 'Thorin',
          }),
        );
      });
    });

    it('caps optimistic messages at 100 max', () => {
      const slice = createChatSlice(set, get);

      for (let i = 0; i < 105; i++) {
        slice.sendChatMessage(`Message ${i}`);
      }

      expect(state.chat.messages).toHaveLength(100);
      expect(state.chat.messages[0].content).toBe('Message 5');
      expect(state.chat.messages[99].content).toBe('Message 104');
    });
  });

  describe('addChatMessage', () => {
    it('adds message and does not increment unread count if message is from self', () => {
      const slice = createChatSlice(set, get);

      const message: ChatMessage['data'] = {
        id: 'msg-1',
        userId: 'u-1',
        userName: 'Thorin',
        content: 'I am here',
        timestamp: Date.now(),
        messageType: 'text',
      };

      slice.addChatMessage(message);

      expect(state.chat.messages).toHaveLength(1);
      expect(state.chat.unreadCount).toBe(0);
    });

    it('increments unreadCount if message is from another user', () => {
      const slice = createChatSlice(set, get);

      const message: ChatMessage['data'] = {
        id: 'msg-2',
        userId: 'peer-2',
        userName: 'Bilbo',
        content: 'I found something shiny',
        timestamp: Date.now(),
        messageType: 'text',
      };

      slice.addChatMessage(message);

      expect(state.chat.messages).toHaveLength(1);
      expect(state.chat.unreadCount).toBe(1);
    });

    it('caps stored messages at 100 max and avoids duplicates', () => {
      const slice = createChatSlice(set, get);

      const dupMessage: ChatMessage['data'] = {
        id: 'dup-1',
        userId: 'u-1',
        userName: 'Thorin',
        content: 'Unique message',
        timestamp: 100,
        messageType: 'text',
      };

      slice.addChatMessage(dupMessage);
      slice.addChatMessage(dupMessage);
      expect(state.chat.messages).toHaveLength(1);

      for (let i = 0; i < 105; i++) {
        slice.addChatMessage({
          id: `msg-${i}`,
          userId: 'u-1',
          userName: 'Thorin',
          content: `Line ${i}`,
          timestamp: Date.now() + i,
          messageType: 'text',
        });
      }

      expect(state.chat.messages).toHaveLength(100);
      expect(state.chat.messages[0].id).toBe('msg-5');
      expect(state.chat.messages[99].id).toBe('msg-104');
    });
  });

  describe('setTyping, clearChat, and markChatAsRead', () => {
    it('sends typing event via websocket', async () => {
      const slice = createChatSlice(set, get);

      slice.setTyping(true);

      await vi.waitFor(() => {
        expect(mockSendEvent).toHaveBeenCalledWith({
          type: 'chat/typing',
          data: {
            userId: 'u-1',
            userName: 'Thorin',
            isTyping: true,
          },
        });
      });
    });

    it('clears chat messages and resets unread count', () => {
      state.chat.messages = [
        {
          id: '1',
          content: 'hello',
          userId: 'u-1',
          userName: 'Thorin',
          timestamp: 100,
          messageType: 'text',
        },
      ];
      state.chat.unreadCount = 5;

      const slice = createChatSlice(set, get);
      slice.clearChat();

      expect(state.chat.messages).toEqual([]);
      expect(state.chat.unreadCount).toBe(0);
    });

    it('marks chat as read by resetting unreadCount', () => {
      state.chat.unreadCount = 7;

      const slice = createChatSlice(set, get);
      slice.markChatAsRead();

      expect(state.chat.unreadCount).toBe(0);
    });
  });
});
