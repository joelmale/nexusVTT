/**
 * Enhanced Chat Panel Component
 *
 * Real-time chat interface with command support, markdown, and dice rolls
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useGameStore, useIsHost } from '@/stores/gameStore';
import { chatCommandParser } from '@/utils/chatCommands';
import { allCommands } from '@/utils/chatCommandHandlers';
import { parseMarkdown, parseMentions } from '@/utils/markdownParser';
import { DiceRollMessage } from './DiceRollMessage';
import type { ChatMessage as ChatMessageType } from '@/types/game';

interface ChatMessageProps {
  message: ChatMessageType['data'];
  isOwnMessage: boolean;
  onReroll?: () => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  isOwnMessage,
  onReroll,
}) => {
  const session = useGameStore((state) => state.session);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMessageTypeIcon = (messageType: string) => {
    switch (messageType) {
      case 'system':
        return '📢';
      case 'dm-announcement':
        return '👑';
      case 'whisper':
        return '🕵️';
      case 'dice-roll':
        return '🎲';
      case 'emote':
        return '🎭';
      case 'ooc':
        return '💬';
      default:
        return '';
    }
  };

  const getMessageTypeLabel = (messageType: string) => {
    switch (messageType) {
      case 'system':
        return 'System';
      case 'dm-announcement':
        return 'DM Announcement';
      case 'whisper':
        return 'Whisper';
      case 'dice-roll':
        return 'Roll';
      case 'emote':
        return 'Emote';
      case 'ooc':
        return 'OOC';
      default:
        return '';
    }
  };

  // Render dice roll messages differently
  if (message.messageType === 'dice-roll' && message.diceData) {
    return (
      <div className="chat-panel__message dice-roll">
        <DiceRollMessage
          userName={message.userName}
          diceData={message.diceData}
          onReroll={onReroll}
        />
      </div>
    );
  }

  // Parse markdown and mentions
  let content = message.content;
  if (session?.players) {
    const { html } = parseMentions(content, session.players);
    content = html;
  }
  content = parseMarkdown(content);

  return (
    <div
      className={`chat-panel__message ${isOwnMessage ? 'chat-panel__message--own' : 'chat-panel__message--other'} ${message.messageType}`}
    >
      <div className="chat-panel__message-header">
        <span className="chat-panel__message-author">{message.userName}</span>
        {message.messageType !== 'text' && (
          <span className="chat-panel__message-type">
            {getMessageTypeIcon(message.messageType)}{' '}
            {getMessageTypeLabel(message.messageType)}
          </span>
        )}
        <span className="chat-panel__message-timestamp">
          {formatTimestamp(message.timestamp)}
        </span>
      </div>
      <div
        className="chat-panel__message-content"
        dangerouslySetInnerHTML={{ __html: content }}
      />
      {message.messageType === 'whisper' && message.recipientId && (
        <div className="chat-panel__message-recipient">
          To: {session?.players.find((p) => p.id === message.recipientId)?.name}
        </div>
      )}
    </div>
  );
};

export const ChatPanel: React.FC = () => {
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [autocompleteHidden, setAutocompleteHidden] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageTypeFilter, setMessageTypeFilter] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [messagesHeight, setMessagesHeight] = useState(() => {
    const saved = localStorage.getItem('chat-messages-height');
    return saved ? parseInt(saved, 10) : 400;
  });
  const [isResizing, setIsResizing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resizeStartYRef = useRef<number>(0);
  const resizeStartHeightRef = useRef<number>(0);

  const { chat, user, session, sendChatMessage, clearChat, setTyping, markChatAsRead } =
    useGameStore();

  const isHost = useIsHost();

  // Register all commands on mount
  useEffect(() => {
    chatCommandParser.registerAll(allCommands);
  }, []);

  // Filter messages based on visibility rules
  let visibleMessages = chat.messages.filter((message) => {
    // Always show system messages and DM announcements
    if (
      message.messageType === 'system' ||
      message.messageType === 'dm-announcement'
    ) {
      return true;
    }

    // Show public messages to everyone
    if (
      message.messageType === 'text' ||
      message.messageType === 'dice-roll' ||
      message.messageType === 'emote' ||
      message.messageType === 'ooc'
    ) {
      return true;
    }

    // For whispers, only show to sender, recipient, and DM
    if (message.messageType === 'whisper') {
      return (
        message.userId === user.id || // Sender can see
        message.recipientId === user.id || // Recipient can see
        isHost // DM can see all whispers
      );
    }

    return true;
  });

  // Apply search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    visibleMessages = visibleMessages.filter(
      (message) =>
        message.content.toLowerCase().includes(query) ||
        message.userName.toLowerCase().includes(query),
    );
  }

  // Apply message type filter
  if (messageTypeFilter.length > 0) {
    visibleMessages = visibleMessages.filter((message) =>
      messageTypeFilter.includes(message.messageType),
    );
  }

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages]);

  // Mark chat as read when panel is viewed
  useEffect(() => {
    markChatAsRead();
  }, [markChatAsRead]);

  // Handle command autocomplete (computed value)
  const autocompleteData = useMemo(() => {
    if (messageInput.startsWith('/')) {
      const commands = chatCommandParser.autocomplete(messageInput);
      return { commands, show: commands.length > 0 };
    }
    return { commands: [], show: false };
  }, [messageInput]);

  const autocompleteCommands = autocompleteData.commands;
  const showAutocomplete = autocompleteData.show && !autocompleteHidden;

  // Handle typing indicator
  const handleInputChange = useCallback((value: string) => {
    setMessageInput(value);
    // Reset autocomplete hidden state when user types
    setAutocompleteHidden(false);
    // Reset index when showing autocomplete
    if (value.startsWith('/')) {
      setAutocompleteIndex(0);
    }

    // Don't show typing for commands
    if (value.startsWith('/')) {
      if (isTyping) {
        setIsTyping(false);
        setTyping(false);
      }
      return;
    }

    // Send typing indicator
    if (!isTyping && value.trim()) {
      setIsTyping(true);
      setTyping(true);

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        setTyping(false);
      }, 3000);
    } else if (isTyping && !value.trim()) {
      setIsTyping(false);
      setTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  }, [isTyping, setTyping]);

  const handleSendMessage = useCallback(async () => {
    if (!messageInput.trim()) return;

    const trimmed = messageInput.trim();

    // Check if it's a command
    if (trimmed.startsWith('/')) {
      const context = {
        user: {
          id: user.id,
          name: user.name,
          type: user.type,
        },
        session,
        isHost,
      };

      const result = await chatCommandParser.parse(trimmed, context);

      if (result) {
        if (result.message?.startsWith('help:')) {
          // Show help
          const commandName = result.message.replace('help:', '');
          const helpText =
            commandName === 'all'
              ? chatCommandParser.getHelp()
              : chatCommandParser.getHelp(commandName);

          // Send help as system message
          sendChatMessage(helpText, 'system');
        } else if (result.message === 'Chat cleared' && isHost) {
          // Clear chat
          clearChat();
        } else if (result.messageOverride) {
          // Send the command's message
          sendChatMessage(
            result.messageOverride.content,
            result.messageOverride.messageType,
            result.messageOverride.recipientId,
            result.messageOverride.diceData,
          );
        } else if (!result.success && result.message) {
          // Show error
          sendChatMessage(result.message, 'system');
        }

        // Clear input
        setMessageInput('');
        setIsTyping(false);
        setTyping(false);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        return;
      }
    }

    // Regular message
    sendChatMessage(trimmed, 'text');
    setMessageInput('');
    setIsTyping(false);
    setTyping(false);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [messageInput, user, session, isHost, sendChatMessage, clearChat, setTyping]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    // Handle autocomplete navigation
    if (showAutocomplete && autocompleteCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocompleteIndex((prev) =>
          Math.min(prev + 1, autocompleteCommands.length - 1),
        );
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocompleteIndex((prev) => Math.max(prev - 1, 0));
        return;
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const selected = autocompleteCommands[autocompleteIndex];
        if (selected) {
          setMessageInput(`/${selected.command} `);
          setAutocompleteHidden(true);
        }
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setAutocompleteHidden(true);
        return;
      }
    }

    // Send message on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [showAutocomplete, autocompleteCommands, autocompleteIndex, handleSendMessage]);

  const handleReroll = useCallback((expression: string) => {
    setMessageInput(`/roll ${expression}`);
    // Auto-submit the reroll
    setTimeout(() => handleSendMessage(), 100);
  }, [handleSendMessage]);

  const selectAutocompleteCommand = useCallback((index: number) => {
    const selected = autocompleteCommands[index];
    if (selected) {
      setMessageInput(`/${selected.command} `);
      setAutocompleteHidden(true);
      inputRef.current?.focus();
    }
  }, [autocompleteCommands]);

  const toggleMessageTypeFilter = useCallback((type: string) => {
    setMessageTypeFilter((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setMessageTypeFilter([]);
    setShowFilters(false);
  }, []);

  const hasActiveFilters = searchQuery.trim() !== '' || messageTypeFilter.length > 0;

  // Handle resize drag
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartYRef.current = e.clientY;
    resizeStartHeightRef.current = messagesHeight;
  }, [messagesHeight]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const deltaY = e.clientY - resizeStartYRef.current;
    const newHeight = Math.max(150, Math.min(800, resizeStartHeightRef.current + deltaY));
    setMessagesHeight(newHeight);
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      localStorage.setItem('chat-messages-height', messagesHeight.toString());
    }
  }, [isResizing, messagesHeight]);

  // Add/remove resize event listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  return (
    <div className="chat-panel">
      <div className="panel-section">
        <h3>Chat</h3>

        {/* Search and Filter Bar */}
        <div className="chat-panel__search-bar">
          <input
            type="text"
            className="chat-panel__search-input"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            className={`chat-panel__filter-toggle ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            title="Filter message types"
            type="button"
          >
            🔍
          </button>
          {hasActiveFilters && (
            <button
              className="chat-panel__clear-filters"
              onClick={clearFilters}
              title="Clear filters"
              type="button"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="chat-panel__filters">
            {['text', 'dice-roll', 'emote', 'ooc', 'whisper', 'dm-announcement', 'system'].map(
              (type) => (
                <button
                  key={type}
                  className={`chat-filter-chip ${messageTypeFilter.includes(type) ? 'active' : ''}`}
                  onClick={() => toggleMessageTypeFilter(type)}
                  type="button"
                >
                  {type === 'dice-roll'
                    ? '🎲 Rolls'
                    : type === 'emote'
                      ? '🎭 Emotes'
                      : type === 'ooc'
                        ? '💬 OOC'
                        : type === 'whisper'
                          ? '🕵️ Whispers'
                          : type === 'dm-announcement'
                            ? '👑 DM'
                            : type === 'system'
                              ? '📢 System'
                              : '💭 Text'}
                </button>
              ),
            )}
          </div>
        )}

        {/* Messages Area */}
        <div
          className="chat-panel__messages"
          style={{ height: `${messagesHeight}px` }}
        >
          {visibleMessages.length === 0 ? (
            <div className="chat-panel__empty">
              <p>No messages yet. Start the conversation!</p>
              <p style={{ fontSize: '0.8em', opacity: 0.7, marginTop: '0.5em' }}>
                Type <code>/help</code> for available commands
              </p>
            </div>
          ) : (
            visibleMessages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isOwnMessage={message.userId === user.id}
                onReroll={
                  message.diceData
                    ? () => handleReroll(message.diceData!.expression)
                    : undefined
                }
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Resize Handle */}
        <div
          className={`chat-panel__resize-handle ${isResizing ? 'resizing' : ''}`}
          onMouseDown={handleResizeStart}
          title="Drag to resize messages area"
        >
          <div className="resize-handle-bar" />
        </div>

        {/* Typing Indicators */}
        {chat.typingUsers.length > 0 && (
          <div className="chat-panel__typing-indicators">
            {chat.typingUsers.map((typingUser) => (
              <span key={typingUser.userId} className="chat-panel__typing-user">
                {typingUser.userName} is typing...
              </span>
            ))}
          </div>
        )}

        {/* Message Input */}
        <div className="chat-panel__input-section" style={{ position: 'relative' }}>
          {/* Command Autocomplete */}
          {showAutocomplete && autocompleteCommands.length > 0 && (
            <div className="chat-command-autocomplete">
              {autocompleteCommands.map((cmd, index) => (
                <div
                  key={cmd.command}
                  className={`autocomplete-command ${index === autocompleteIndex ? 'active' : ''}`}
                  onClick={() => selectAutocompleteCommand(index)}
                  onMouseEnter={() => setAutocompleteIndex(index)}
                >
                  <div className="autocomplete-command-name">
                    /{cmd.command}
                    {cmd.aliases.length > 0 && (
                      <span style={{ opacity: 0.6, fontSize: '0.9em' }}>
                        {' '}
                        ({cmd.aliases.map((a) => `/${a}`).join(', ')})
                      </span>
                    )}
                  </div>
                  <div className="autocomplete-command-description">
                    {cmd.description}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="chat-panel__input-container">
            <textarea
              ref={inputRef}
              className="chat-panel__input"
              placeholder="Type a message or /help for commands..."
              value={messageInput}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyPress}
              rows={1}
              maxLength={500}
            />
            <button
              className="chat-panel__send-btn"
              onClick={handleSendMessage}
              disabled={!messageInput.trim()}
              title="Send message (Enter)"
              type="button"
            >
              📤
            </button>
          </div>

          {/* DM Announcement Button (Host Only) */}
          {isHost && (
            <button
              className="chat-panel__announcement-btn"
              onClick={() => {
                if (messageInput.trim()) {
                  sendChatMessage(messageInput.trim(), 'dm-announcement');
                  setMessageInput('');
                }
              }}
              disabled={!messageInput.trim()}
              title="Send DM Announcement"
              type="button"
            >
              👑 Announce
            </button>
          )}
        </div>

        {/* Unread Count Badge */}
        {chat.unreadCount > 0 && (
          <div className="chat-panel__unread-badge">{chat.unreadCount} unread</div>
        )}
      </div>
    </div>
  );
};
