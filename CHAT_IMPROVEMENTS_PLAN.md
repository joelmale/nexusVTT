# Chat Panel Improvements - Implementation Plan

## Overview
This plan outlines the implementation of comprehensive chat improvements to make Nexus VTT's chat panel competitive with major VTTs like Roll20 and Foundry VTT.

**Branch:** `improvement/chat`
**Estimated Timeline:** 10-14 days
**Priority:** High (chat is core VTT functionality)

---

## Phase 1: Quick Wins (1-2 days)

### 1.1 Chat Command Parser Infrastructure

**Files to Create:**
- `src/utils/chatCommands.ts` - Command parser and registry
- `src/types/chat.ts` - Extended chat types

**Files to Modify:**
- `src/components/ChatPanel.tsx` - Integrate command parser
- `src/stores/gameStore.ts` - Add command handlers
- `src/types/game.ts` - Extend message types

**Implementation:**
```typescript
// src/utils/chatCommands.ts
interface ChatCommand {
  command: string;
  aliases: string[];
  pattern: RegExp;
  handler: (args: string[], context: ChatContext) => ChatCommandResult;
  description: string;
  usage: string;
  requiresHost?: boolean;
}

interface ChatCommandResult {
  success: boolean;
  message?: string;
  preventDefault?: boolean;
}

interface ChatContext {
  user: User;
  session: Session;
  isHost: boolean;
  activeCharacter?: Character;
}

class ChatCommandParser {
  private commands: Map<string, ChatCommand> = new Map();

  register(command: ChatCommand): void;
  parse(input: string, context: ChatContext): ChatCommandResult | null;
  autocomplete(partial: string): ChatCommand[];
  getHelp(): string;
}
```

**Commands to Implement:**
- `/roll [dice]` or `/r [dice]` - Roll dice
- `/w [player] [message]` - Whisper
- `/me [action]` - Emote/action
- `/ooc [message]` - Out of character
- `/clear` - Clear chat (host only)
- `/help` - Show command list

**Testing:**
- Unit tests for command parser
- Test each command type
- Test permission checks (host-only commands)

---

### 1.2 Better Dice Roll Display

**Files to Modify:**
- `src/components/ChatPanel.tsx` - Add DiceRollMessage component
- `src/types/game.ts` - Add dice-roll message type
- `src/styles/chat.css` - Add dice roll styles

**New Message Type:**
```typescript
interface DiceRollMessage extends ChatMessage {
  messageType: 'dice-roll';
  diceData: {
    expression: string;      // "2d20+5"
    results: number[];       // [18, 12]
    total: number;           // 35
    breakdown: string;       // "[18, 12] + 5 = 35"
    modifiers: DiceModifier[];
    isCrit?: boolean;
    isCritFail?: boolean;
    rollType?: 'normal' | 'advantage' | 'disadvantage';
  };
}
```

**UI Components:**
```typescript
<DiceRollMessage>
  <div className="dice-roll-header">
    <span className="dice-expression">2d20+5</span>
    <button className="reroll-btn" title="Roll again">🎲</button>
  </div>
  <div className="dice-results">
    {results.map(r => <DieResult value={r} isCrit={r === 20} />)}
    <span className="modifier">+5</span>
  </div>
  <div className="dice-total">Total: 35</div>
</DiceRollMessage>
```

**Integration:**
- Connect to existing DiceRoller component
- Parse `/roll` commands into dice rolls
- Display results inline in chat
- Add "reroll" button to repeat roll

---

### 1.3 Message Search & Filter

**Files to Modify:**
- `src/components/ChatPanel.tsx` - Add search UI
- `src/stores/gameStore.ts` - Add search/filter state

**UI Components:**
```typescript
<ChatSearchBar>
  <input
    placeholder="Search messages..."
    onChange={handleSearch}
  />
  <FilterDropdown>
    <option value="all">All Messages</option>
    <option value="dice">Dice Rolls</option>
    <option value="whispers">Whispers</option>
    <option value="announcements">Announcements</option>
    <option value="player:id">From Player X</option>
  </FilterDropdown>
</ChatSearchBar>
```

**Search Features:**
- Full-text search across message content
- Filter by message type
- Filter by sender
- Clear filters button
- Show "X results" count

**Performance:**
- Debounce search input (300ms)
- Virtual scrolling for large message lists
- Index messages for fast search

---

### 1.4 Rich Text Formatting (Markdown)

**Files to Create:**
- `src/utils/markdownParser.ts` - Lightweight markdown parser

**Files to Modify:**
- `src/components/ChatPanel.tsx` - Render markdown
- `src/styles/chat.css` - Markdown styles

**Supported Syntax:**
```markdown
*italic*
**bold**
`code`
> quote
[link](url)
```

**Implementation:**
```typescript
// Lightweight markdown parser (no external deps)
function parseMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');
}
```

**Security:**
- Sanitize HTML output
- Block script tags
- Whitelist allowed tags

---

## Phase 2: High Value Features (3-5 days)

### 2.1 Character Context & Portraits

**Files to Modify:**
- `src/components/ChatPanel.tsx` - Add portrait display
- `src/types/game.ts` - Add characterId to messages
- `src/styles/chat.css` - Portrait styles

**UI Components:**
```typescript
<ChatMessage>
  <CharacterPortrait
    src={character.portrait}
    name={character.name}
    size="sm"
  />
  <MessageBubble>
    <header>
      <CharacterName>{character.name}</CharacterName>
      <PlayerName>(played by {player.name})</PlayerName>
    </header>
    <content>{message.content}</content>
  </MessageBubble>
</ChatMessage>
```

**Features:**
- Show character portrait next to in-character messages
- Different style for OOC messages (no portrait)
- Hover tooltip shows character details

---

### 2.2 Speaking As Selector

**Files to Modify:**
- `src/components/ChatPanel.tsx` - Add selector UI
- `src/stores/gameStore.ts` - Add speaking mode state
- `src/stores/characterStore.ts` - Integration

**UI Component:**
```typescript
<SpeakingAsSelector>
  <select value={speakingAs} onChange={handleChange}>
    <optgroup label="Characters">
      {characters.map(c => (
        <option value={`character:${c.id}`}>
          🧙 {c.name}
        </option>
      ))}
    </optgroup>
    <option value="player">👤 {player.name} (Out of Character)</option>
    {isHost && <option value="dm">🎭 DM Voice</option>}
  </select>
</SpeakingAsSelector>
```

**State:**
```typescript
interface ChatState {
  speakingAs: {
    type: 'player' | 'character' | 'dm';
    characterId?: string;
  };
}
```

---

### 2.3 Roll As Character

**Files to Modify:**
- `src/utils/chatCommands.ts` - Add character context to /roll
- `src/components/DiceRoller.tsx` - Use character modifiers
- `src/stores/characterStore.ts` - Add modifier helpers

**Features:**
- When rolling as character, auto-add character modifiers
- Show character name in dice roll
- Support skill/ability shortcuts:
  ```
  /roll strength
  /roll perception
  /roll attack
  ```

**Implementation:**
```typescript
// Parse roll command with character context
function handleRollCommand(args: string[], context: ChatContext) {
  const expression = args.join(' ');

  // Check for character ability shortcuts
  if (context.activeCharacter) {
    const ability = parseAbilityName(expression);
    if (ability) {
      const modifier = context.activeCharacter.abilities[ability].modifier;
      return rollDice(`1d20+${modifier}`);
    }
  }

  return rollDice(expression);
}
```

---

### 2.4 @Mentions

**Files to Create:**
- `src/utils/mentionParser.ts` - Parse @mentions

**Files to Modify:**
- `src/components/ChatPanel.tsx` - Highlight mentions
- `src/stores/gameStore.ts` - Track mention notifications
- `src/styles/chat.css` - Mention styles

**Features:**
```typescript
// Parse @mentions in messages
function parseMentions(text: string, players: Player[]): {
  html: string;
  mentionedIds: string[];
} {
  const mentions: string[] = [];
  const html = text.replace(/@(\w+)/g, (match, name) => {
    const player = players.find(p =>
      p.name.toLowerCase() === name.toLowerCase()
    );
    if (player) {
      mentions.push(player.id);
      return `<span class="mention" data-user-id="${player.id}">@${player.name}</span>`;
    }
    return match;
  });

  return { html, mentionedIds: mentions };
}
```

**UI:**
- Highlight @mentions in blue
- Send notification to mentioned player
- "You were mentioned" badge
- Click mention to scroll to message

**Autocomplete:**
- Show dropdown when typing `@`
- Filter players by name
- Tab/Enter to complete

---

### 2.5 Emoji Reactions

**Files to Modify:**
- `src/components/ChatPanel.tsx` - Add reaction UI
- `src/types/game.ts` - Add reactions to message type
- `src/stores/gameStore.ts` - Add reaction handlers
- `src/styles/chat.css` - Reaction styles

**Data Structure:**
```typescript
interface ChatMessage {
  // ... existing fields
  reactions?: {
    emoji: string;
    userIds: string[];
    count: number;
  }[];
}
```

**UI Component:**
```typescript
<MessageReactions>
  {reactions.map(r => (
    <ReactionBubble
      emoji={r.emoji}
      count={r.count}
      active={r.userIds.includes(user.id)}
      onClick={() => toggleReaction(message.id, r.emoji)}
    />
  ))}
  <AddReactionButton>
    <EmojiPicker
      onSelect={(emoji) => addReaction(message.id, emoji)}
      quickEmojis={['👍', '❤️', '😂', '🎲', '✅', '❌']}
    />
  </AddReactionButton>
</MessageReactions>
```

**Features:**
- Hover message to show reaction button
- Click to open emoji picker
- Quick reactions: 👍 ❤️ 😂 🎲
- Click existing reaction to toggle
- Show who reacted on hover

---

### 2.6 Sound Notifications

**Files to Create:**
- `src/utils/soundManager.ts` - Sound playback manager
- `public/sounds/message.mp3` - Default message sound
- `public/sounds/whisper.mp3` - Whisper sound
- `public/sounds/crit.mp3` - Critical roll sound

**Files to Modify:**
- `src/components/ChatPanel.tsx` - Trigger sounds
- `src/stores/gameStore.ts` - Sound preferences
- `src/components/Settings.tsx` - Sound settings

**Implementation:**
```typescript
class SoundManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private enabled = true;
  private volume = 0.5;

  preload(name: string, url: string): void;
  play(name: string): void;
  setVolume(volume: number): void;
  setEnabled(enabled: boolean): void;
}

// Usage
soundManager.play('message'); // On new message
soundManager.play('whisper'); // On whisper received
soundManager.play('crit');    // On nat 20
soundManager.play('mention'); // On @mention
```

**Settings:**
```typescript
interface SoundSettings {
  enabled: boolean;
  volume: number;
  sounds: {
    newMessage: boolean;
    whisper: boolean;
    mention: boolean;
    diceRoll: boolean;
    critSuccess: boolean;
    critFailure: boolean;
  };
}
```

---

## Phase 3: Polish Features (5-7 days)

### 3.1 Chat Tabs

**Files to Modify:**
- `src/components/ChatPanel.tsx` - Add tab navigation
- `src/stores/gameStore.ts` - Track active tab
- `src/styles/chat.css` - Tab styles

**Tabs:**
```typescript
type ChatTab =
  | 'all'          // All messages
  | 'combat'       // Combat log + dice rolls
  | 'roleplay'     // In-character messages only
  | 'ooc'          // Out of character messages
  | 'whispers';    // Private messages

interface ChatTabs {
  active: ChatTab;
  unreadCount: Record<ChatTab, number>;
}
```

**UI:**
```typescript
<ChatTabs>
  <Tab active={tab === 'all'} unread={unread.all}>
    All
  </Tab>
  <Tab active={tab === 'combat'} unread={unread.combat}>
    🗡️ Combat
  </Tab>
  <Tab active={tab === 'roleplay'} unread={unread.roleplay}>
    🎭 RP
  </Tab>
  <Tab active={tab === 'ooc'} unread={unread.ooc}>
    💬 OOC
  </Tab>
  <Tab active={tab === 'whispers'} unread={unread.whispers}>
    🕵️ Whispers
  </Tab>
</ChatTabs>
```

**Features:**
- Filter messages by tab
- Show unread count per tab
- Persist active tab in localStorage

---

### 3.2 Combat Integration

**Files to Create:**
- `src/utils/combatLogger.ts` - Combat event logger

**Files to Modify:**
- `src/stores/initiativeStore.ts` - Add chat logging
- `src/components/ChatPanel.tsx` - Display combat events
- `src/types/game.ts` - Add combat message types

**Combat Events:**
```typescript
type CombatEvent =
  | 'combat-start'
  | 'combat-end'
  | 'turn-start'
  | 'turn-end'
  | 'initiative-roll'
  | 'attack'
  | 'damage'
  | 'healing'
  | 'condition-applied'
  | 'condition-removed';

interface CombatMessage {
  type: 'combat-action';
  event: CombatEvent;
  actor: string;
  target?: string;
  value?: number;
  details: string;
}
```

**Log Examples:**
```
🗡️ Combat Started!
┌─────────────────────┐
│ Initiative Order:   │
│ 1. Goblin (18)      │
│ 2. Ranger (15)      │
│ 3. Wizard (12)      │
└─────────────────────┘

▶️ Goblin's turn!

🎯 Goblin attacks Ranger
  Roll: [14] + 3 = 17 (Hit!)
  Damage: [6, 4] = 10 slashing damage

💚 Wizard casts Cure Wounds on Ranger
  Healing: [8] + 3 = 11 HP restored

⏭️ End of Goblin's turn
```

**Integration:**
- Auto-log initiative rolls
- Auto-log combat actions
- Show turn timer in chat
- Highlight current turn

---

### 3.3 Export Chat Log

**Files to Create:**
- `src/utils/chatExporter.ts` - Export functionality

**Files to Modify:**
- `src/components/ChatPanel.tsx` - Add export button
- `src/styles/chat.css` - Export menu styles

**Export Formats:**
```typescript
class ChatExporter {
  exportAsText(messages: ChatMessage[]): string;
  exportAsHTML(messages: ChatMessage[]): string;
  exportAsJSON(messages: ChatMessage[]): string;
  downloadFile(content: string, filename: string, type: string): void;
}
```

**UI:**
```typescript
<ExportMenu>
  <button onClick={() => exportAs('txt')}>
    📄 Export as Text
  </button>
  <button onClick={() => exportAs('html')}>
    🌐 Export as HTML
  </button>
  <button onClick={() => exportAs('json')}>
    📋 Export as JSON
  </button>
</ExportMenu>
```

**Features:**
- Export all messages or filtered view
- Include timestamps and authors
- Preserve formatting (markdown)
- Auto-generate filename: `session-chat-2026-01-03.txt`

---

### 3.4 Visual Dice Display

**Files to Create:**
- `src/components/VisualDie.tsx` - Animated die component
- `src/styles/dice-visual.css` - Die visual styles

**Files to Modify:**
- `src/components/ChatPanel.tsx` - Use visual dice

**Component:**
```typescript
<VisualDie
  value={18}
  size="md"
  color="blue"
  isCrit={true}
  animated={true}
/>

<DicePool>
  {results.map((value, i) => (
    <VisualDie
      key={i}
      value={value}
      isCrit={value === 20}
      isCritFail={value === 1}
      onClick={() => rerollDie(i)}
    />
  ))}
</DicePool>
```

**Features:**
- Show d4, d6, d8, d10, d12, d20
- Highlight crits (gold border)
- Highlight fails (red border)
- Click individual die to reroll
- Animate on roll (optional)

**CSS:**
```css
.visual-die {
  width: 40px;
  height: 40px;
  border: 2px solid #333;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 18px;
}

.visual-die.crit {
  border-color: gold;
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.visual-die.fail {
  border-color: red;
  box-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
}
```

---

### 3.5 Message Context Menu

**Files to Create:**
- `src/components/MessageContextMenu.tsx` - Right-click menu

**Files to Modify:**
- `src/components/ChatPanel.tsx` - Add context menu
- `src/stores/gameStore.ts` - Add edit/delete handlers

**Menu Options:**
```typescript
interface ContextMenuOption {
  label: string;
  icon: string;
  action: () => void;
  divider?: boolean;
  requiresHost?: boolean;
  requiresOwnership?: boolean;
}

const contextMenuOptions: ContextMenuOption[] = [
  { label: 'Copy Text', icon: '📋', action: copyText },
  { label: 'Reply', icon: '↩️', action: reply },
  { label: 'React', icon: '😊', action: openReactions },
  { divider: true },
  { label: 'Edit', icon: '✏️', action: editMessage, requiresOwnership: true },
  { label: 'Delete', icon: '🗑️', action: deleteMessage, requiresHost: true },
];
```

**Features:**
- Right-click message to open menu
- Copy message text to clipboard
- Reply with quote
- Edit own messages (5 min window)
- Delete messages (host only)
- Show/hide menu on click outside

---

## File Structure Summary

```
src/
├── components/
│   ├── ChatPanel.tsx                    [MODIFY - main chat UI]
│   ├── ChatSearchBar.tsx                [CREATE - search/filter]
│   ├── DiceRollMessage.tsx              [CREATE - dice roll display]
│   ├── VisualDie.tsx                    [CREATE - visual dice]
│   ├── MessageContextMenu.tsx           [CREATE - right-click menu]
│   ├── CharacterPortrait.tsx            [CREATE - avatar display]
│   └── SpeakingAsSelector.tsx           [CREATE - character selector]
│
├── utils/
│   ├── chatCommands.ts                  [CREATE - command parser]
│   ├── markdownParser.ts                [CREATE - markdown support]
│   ├── mentionParser.ts                 [CREATE - @mention parser]
│   ├── combatLogger.ts                  [CREATE - combat integration]
│   ├── chatExporter.ts                  [CREATE - export functionality]
│   └── soundManager.ts                  [CREATE - sound playback]
│
├── types/
│   ├── chat.ts                          [CREATE - chat-specific types]
│   └── game.ts                          [MODIFY - extend message types]
│
├── stores/
│   ├── gameStore.ts                     [MODIFY - add chat features]
│   ├── characterStore.ts                [MODIFY - character integration]
│   └── initiativeStore.ts               [MODIFY - combat logging]
│
└── styles/
    ├── chat.css                         [MODIFY - chat styles]
    └── dice-visual.css                  [CREATE - dice visual styles]

public/
└── sounds/
    ├── message.mp3                      [CREATE]
    ├── whisper.mp3                      [CREATE]
    ├── crit.mp3                         [CREATE]
    └── mention.mp3                      [CREATE]
```

---

## Testing Strategy

### Unit Tests
- Chat command parser
- Markdown parser
- Mention parser
- Dice roll formatting

### Integration Tests
- Send message with commands
- React to messages
- Filter and search messages
- Export chat log

### E2E Tests (Playwright)
- Complete chat workflow
- Multi-user whispers
- Dice rolling from chat
- Combat log integration

---

## Migration & Backwards Compatibility

### Data Migration
```typescript
// Migrate old messages to new format
function migrateChatMessages(oldMessages: OldChatMessage[]): ChatMessage[] {
  return oldMessages.map(msg => ({
    ...msg,
    reactions: [],
    characterId: null,
    speakingAs: 'player',
    mentions: [],
  }));
}
```

### Backwards Compatibility
- Old message format still readable
- Graceful degradation for missing features
- Version check in message schema

---

## Performance Considerations

### Virtual Scrolling
- Render only visible messages
- Lazy load message history
- Paginate old messages

### Debouncing
- Search input: 300ms
- Typing indicator: 3s timeout
- Auto-save draft: 1s

### Caching
- Cache rendered markdown
- Cache message search index
- Cache character portraits

---

## Deployment Checklist

- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] TypeScript compilation successful
- [ ] No console errors
- [ ] Performance benchmarks met
- [ ] Accessibility audit passed
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Mobile responsive testing
- [ ] Documentation updated
- [ ] Migration script tested
- [ ] Feature flags enabled

---

## Future Enhancements (Post-Launch)

### Advanced Features
- Voice-to-text for messages
- Message translation
- Chat macros/shortcuts
- Pinned messages
- Message threads/replies
- Rich embeds (images, videos)
- Dice roll statistics/history
- Chat backup to cloud

### Integration
- Discord webhook integration
- Twitch chat integration
- Stream overlay for rolls
- Session recording/playback

---

## Success Metrics

### User Engagement
- Messages per session (target: +50%)
- Dice rolls from chat (target: 80% of all rolls)
- Command usage (target: 30% of messages)

### Performance
- Message render time < 16ms
- Search results < 100ms
- No lag with 500+ messages

### Quality
- Bug reports < 5 per 100 users
- User satisfaction > 4.5/5
- Feature adoption > 70%

---

## Conclusion

This comprehensive plan transforms the chat panel from a basic messenger into a full-featured VTT communication hub. By implementing these features in three phases, we maintain development momentum while delivering incremental value.

**Total Estimated Time:** 10-14 development days
**Priority:** High
**Risk:** Low-Medium
**Impact:** High
