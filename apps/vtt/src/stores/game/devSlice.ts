/**
 * Developer slice — the development-only mock session toggle and the
 * `dev_quickDM` / `dev_quickPlayer` one-click session bootstrappers, plus the
 * mock player/session fixtures they hand out.
 *
 * Extracted verbatim from gameStore.ts. Every action here is gated on
 * `process.env.NODE_ENV === 'development'` (unchanged), and they reach the
 * real room-creation path through `get().createGameRoom()` /
 * `get().joinRoomWithCode()` rather than writing canonical state themselves.
 */

import type { Player, PlayerCharacter, Session } from '@/types/game';
import type { GameStore, GameStoreGet, GameStoreSet } from '@/stores/game/types';
import { getBrowserId, initialState } from '@/stores/game/initialState';

// --- Mock Data for Development (can be toggled via settings) ---
const MOCK_PLAYERS: Player[] = [
  {
    id: 'user-joel',
    name: 'Joel',
    type: 'host',
    color: '#6366f1',
    connected: true,
    canEditScenes: true,
  },
  {
    id: 'user-alice',
    name: 'Alice',
    type: 'player',
    color: '#ec4899',
    connected: true,
    canEditScenes: false,
  },
  {
    id: 'user-bob',
    name: 'Bob',
    type: 'player',
    color: '#22c55e',
    connected: false,
    canEditScenes: false,
  },
  {
    id: 'user-charlie',
    name: 'Charlie',
    type: 'player',
    color: '#f59e0b',
    connected: true,
    canEditScenes: false,
  },
];

const MOCK_SESSION: Session = {
  roomCode: 'TEST',
  hostId: 'user-joel',
  players: MOCK_PLAYERS,
  status: 'connected',
};

export type DevSlice = Pick<
  GameStore,
  | 'toggleMockData'
  | 'dev_quickDM'
  | 'dev_quickPlayer'
>;

export const createDevSlice = (
  set: GameStoreSet,
  get: GameStoreGet,
): DevSlice => ({
  toggleMockData: (enable) => {
    if (process.env.NODE_ENV !== 'development') return;

    set((state) => {
      state.session = enable ? MOCK_SESSION : null;
      // When disabling mock data, also reset the user to avoid being stuck as the mock host.
      if (!enable) {
        state.user = { ...initialState.user, id: getBrowserId() };
      }
    });
  },

  dev_quickDM: async (name: string = 'Test DM') => {
    try {
      // Create guest user
      const guestResponse = await fetch('/api/guest-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
        credentials: 'include',
      });

      if (!guestResponse.ok) {
        throw new Error('Failed to create guest user');
      }

      const guestUser = await guestResponse.json();

      // Set user
      set((state) => {
        state.user = { ...guestUser, type: 'host', name };
      });

      // Generate random game config
      const gameConfig = {
        name: 'Quick Dev Campaign',
        description: 'Development test session with generated content',
        estimatedTime: '2',
        campaignType: 'oneshot' as const,
        maxPlayers: 6,
      };

      // Create game room
      const roomCode = await get().createGameRoom(gameConfig);

      // Navigate to game
      window.location.href = `/lobby/game/${roomCode}`;
    } catch (error) {
      console.error('❌ Failed to create quick DM session:', error);
      // Fallback to offline mode
      set((state) => {
        state.user.name = name;
        state.user.type = 'host';
        state.user.id = getBrowserId();
        state.user.connected = false;
      });
    }
  },

  dev_quickPlayer: async (
    name: string = 'Test Player',
    autoJoinRoom?: string,
  ) => {
    try {
      // Create guest user
      const guestResponse = await fetch('/api/guest-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
        credentials: 'include',
      });

      if (!guestResponse.ok) {
        throw new Error('Failed to create guest user');
      }

      const guestUser = await guestResponse.json();

      // Set user
      set((state) => {
        state.user = { ...guestUser, type: 'player', name };
      });

      // Create a test character with random stats
      const randomStats = {
        strength: Math.floor(Math.random() * 6) + 10, // 10-15
        dexterity: Math.floor(Math.random() * 6) + 10, // 10-15
        constitution: Math.floor(Math.random() * 6) + 10, // 10-15
        intelligence: Math.floor(Math.random() * 6) + 10, // 10-15
        wisdom: Math.floor(Math.random() * 6) + 10, // 10-15
        charisma: Math.floor(Math.random() * 6) + 10, // 10-15
      };

      const characterNames = [
        'Aragorn',
        'Legolas',
        'Gimli',
        'Gandalf',
        'Frodo',
        'Samwise',
        'Boromir',
        'Gollum',
      ];
      const races = [
        'Human',
        'Elf',
        'Dwarf',
        'Halfling',
        'Half-Elf',
        'Half-Orc',
      ];
      const classes = [
        'Fighter',
        'Wizard',
        'Rogue',
        'Cleric',
        'Ranger',
        'Barbarian',
        'Bard',
        'Paladin',
      ];
      const backgrounds = [
        'Folk Hero',
        'Sage',
        'Soldier',
        'Criminal',
        'Entertainer',
        'Noble',
        'Outlander',
      ];

      const testCharacter: PlayerCharacter = {
        id: `char-${Date.now()}`,
        name: characterNames[
          Math.floor(Math.random() * characterNames.length)
        ],
        race: races[Math.floor(Math.random() * races.length)],
        class: classes[Math.floor(Math.random() * classes.length)],
        level: Math.floor(Math.random() * 10) + 1, // 1-10
        background:
          backgrounds[Math.floor(Math.random() * backgrounds.length)],
        stats: randomStats,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        playerId: guestUser.id,
      };

      // Save character and set as selected
      set((state) => {
        state.selectedCharacter = testCharacter;
      });

      get().saveCharacter(testCharacter);

      // Create or join room
      let roomCode: string;
      if (autoJoinRoom) {
        // Try to join existing room
        roomCode = await get().joinRoomWithCode(autoJoinRoom);
      } else {
        // Create new room as player (will be converted to host)
        const gameConfig = {
          name: 'Quick Dev Game',
          description: 'Development test session',
          estimatedTime: '1',
          campaignType: 'oneshot' as const,
          maxPlayers: 6,
        };
        roomCode = await get().createGameRoom(gameConfig);
      }

      // Navigate to game
      window.location.href = `/lobby/game/${roomCode}`;
    } catch (error) {
      console.error('❌ Failed to create quick player session:', error);
      // Fallback to offline mode
      set((state) => {
        state.user.name = name;
        state.user.type = 'player';
        state.user.id = `player-${Date.now()}`;
        state.user.connected = false;
      });
    }
  },
});
