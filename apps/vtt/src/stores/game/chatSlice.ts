/**
 * Chat slice — session chat message send/receive, typing indicators and the
 * unread counter.
 *
 * Extracted verbatim from gameStore.ts. The `chat` state itself stays in the
 * single gameStore state object, so `useGameStore(s => s.chat)` and every
 * getState() read keep identical semantics; only these action bodies moved.
 * Chat is deliberately NOT part of buildGameStateProjection()'s canonical
 * snapshot (chat is ephemeral — see CLAUDE.md s.8), so nothing here touches
 * the durability path.
 *
 * `@/services/websocket` stays a dynamic import inside the actions, exactly
 * as before: it is what keeps this module out of an import cycle with the
 * socket service.
 */

import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage } from '@/types/game';
import type { GameStore, GameStoreGet, GameStoreSet } from '@/stores/game/types';

export type ChatSlice = Pick<
  GameStore,
  | 'sendChatMessage'
  | 'addChatMessage'
  | 'setTyping'
  | 'clearChat'
  | 'markChatAsRead'
>;

export const createChatSlice = (
  set: GameStoreSet,
  get: GameStoreGet,
): ChatSlice => ({
  sendChatMessage: (
    content,
    messageType = 'text',
    recipientId,
    diceData,
  ) => {
    const state = get();
    if (!state.user.name || !state.session) return;

    const message: ChatMessage['data'] = {
      id: uuidv4(),
      userId: state.user.id,
      userName: state.user.name,
      content: content.trim(),
      messageType,
      recipientId,
      timestamp: Date.now(),
      ...(diceData && { diceData }),
    };

    // Add to local state immediately for optimistic UI
    set((draft) => {
      draft.chat.messages.push(message);

      // Keep only last 100 messages
      if (draft.chat.messages.length > 100) {
        draft.chat.messages = draft.chat.messages.slice(-100);
      }
    });

    // Send via WebSocket if connected
    if (state.user.connected) {
      try {
        import('@/services/websocket').then(({ webSocketService }) => {
          webSocketService.sendChatMessage(message);
        });
      } catch (error) {
        console.error('Failed to send chat message:', error);
      }
    }
  },

  addChatMessage: (message) => {
    set((state) => {
      // Avoid duplicates
      if (!state.chat.messages.some((m) => m.id === message.id)) {
        state.chat.messages.push(message);

        // Keep only last 100 messages
        if (state.chat.messages.length > 100) {
          state.chat.messages = state.chat.messages.slice(-100);
        }

        // Increment unread count if message is not from current user
        if (message.userId !== state.user.id) {
          state.chat.unreadCount++;

          // Show toast for DM announcements
          if (message.messageType === 'dm-announcement') {
            import('@/utils/notifications').then(({ toast }) => {
              toast.success(`👑 ${message.userName}: ${message.content}`, {
                duration: 5000,
                description: 'DM Announcement',
              });
            });
          }
        }
      }
    });
  },

  setTyping: (isTyping) => {
    const state = get();
    if (!state.user.name || !state.session || !state.user.connected) return;

    try {
      import('@/services/websocket').then(({ webSocketService }) => {
        webSocketService.sendEvent({
          type: 'chat/typing',
          data: {
            userId: state.user.id,
            userName: state.user.name,
            isTyping,
          },
        });
      });
    } catch (error) {
      console.error('Failed to send typing status:', error);
    }
  },

  clearChat: () => {
    set((state) => {
      state.chat.messages = [];
      state.chat.unreadCount = 0;
    });
  },

  markChatAsRead: () => {
    set((state) => {
      state.chat.unreadCount = 0;
    });
  },
});
