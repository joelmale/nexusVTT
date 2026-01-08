import { useNavigate } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { within } from '@testing-library/react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerPanel } from '@/components/PlayerPanel';
import { useSession, useIsHost, useGameStore } from '@/stores/gameStore';
import { useCharacters, useCharacterCreation } from '@/stores/characterStore';
import { useCharacterCreationLauncher } from '@/hooks';
import { useInitiativeStore } from '@/stores/initiativeStore';
import type { Character } from '@/types/character';
import type { Player, Session } from '@/types/game';

// Mock the store hooks
vi.mock('@/stores/gameStore', () => ({
  useSession: vi.fn(),
  useIsHost: vi.fn(),
  useGameStore: vi.fn(),
}));

vi.mock('@/stores/characterStore', () => ({
  useCharacters: vi.fn(),
  useCharacterCreation: vi.fn(),
}));

vi.mock('@/hooks', () => ({
  useCharacterCreationLauncher: vi.fn(),
}));

vi.mock('@/stores/initiativeStore', () => ({
  useInitiativeStore: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

// Mock the CharacterSheet component
vi.mock('@/components/CharacterSheet', () => ({
  CharacterSheet: ({
    character,
    readonly,
  }: {
    character: Character;
    readonly: boolean;
  }) => (
    <div data-testid="character-sheet">
      Character Sheet for {character.name} (readonly: {readonly.toString()})
    </div>
  ),
}));

// Mock the CharacterImportModal component
vi.mock('@/components/CharacterImportModal', () => ({
  CharacterImportModal: ({
    isOpen,
    onClose,
    onImportComplete,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onImportComplete?: (result: { successful: number; failed: number }) => void;
  }) => (
    isOpen ? (
      <div data-testid="character-import-modal">
        Character Import Modal
        <button onClick={onClose}>Close</button>
        <button onClick={() => onImportComplete?.({ successful: 1, failed: 0 })}>
          Import
        </button>
      </div>
    ) : null
  ),
}));

describe('PlayerPanel', () => {
  const mockPlayers: Player[] = [
    {
      id: 'host-123',
      name: 'Game Master',
      type: 'host',
      color: '#6366f1',
      connected: true,
      canEditScenes: true,
    },
    {
      id: 'player-1',
      name: 'Alice',
      type: 'player',
      color: '#ec4899',
      connected: true,
      canEditScenes: false,
    },
    {
      id: 'player-2',
      name: 'Bob',
      type: 'player',
      color: '#22c55e',
      connected: false,
      canEditScenes: false,
    },
  ];

  const mockSession: Session = {
    roomCode: 'TEST',
    hostId: 'host-123',
    players: mockPlayers,
    status: 'connected',
  };

  const mockCharacters: Character[] = [
    {
      id: 'char-1',
      playerId: 'host-123', // Character for the host
      name: 'Host Character',
      level: 5,
      race: 'Dragonborn',
      class: 'Paladin',
      hitPoints: 40,
      maxHitPoints: 50,
      temporaryHitPoints: 0,
      armorClass: 20,
      abilities: {
        STR: { score: 16, modifier: 3 },
        DEX: { score: 12, modifier: 1 },
        CON: { score: 14, modifier: 2 },
        INT: { score: 10, modifier: 0 },
        WIS: { score: 12, modifier: 1 },
        CHA: { score: 14, modifier: 2 },
      },
    } as Character,
    {
      id: 'char-2',
      playerId: 'player-1', // Character for Alice
      name: 'Alice Fighter',
      level: 3,
      race: 'Human',
      class: 'Fighter',
      hitPoints: 25,
      maxHitPoints: 30,
      temporaryHitPoints: 0,
      armorClass: 18,
      abilities: {
        STR: { score: 14, modifier: 2 },
        DEX: { score: 12, modifier: 1 },
        CON: { score: 12, modifier: 1 },
        INT: { score: 10, modifier: 0 },
        WIS: { score: 10, modifier: 0 },
        CHA: { score: 10, modifier: 0 },
      },
    } as Character,
  ];

  const mockCharacterActions = {
    setActiveCharacter: vi.fn(),
    createCharacter: vi.fn(),
  };

  const mockCharacterCreation = {
    creationState: null,
    startCharacterCreation: vi.fn(),
    cancelCharacterCreation: vi.fn(),
    updateCreationState: vi.fn(),
    nextCreationStep: vi.fn(),
    previousCreationStep: vi.fn(),
    completeCharacterCreation: vi.fn(),
  };

  const mockInitiativeActions = {
    addEntry: vi.fn(),
    rollInitiativeForAll: vi.fn(),
    startCombat: vi.fn(),
  };

  const mockLauncher = {
    startCharacterCreation: vi.fn(),
    LauncherComponent: null,
    isActive: false,
  };

  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(useSession).mockReturnValue(mockSession);
    vi.mocked(useIsHost).mockReturnValue(false);
    vi.mocked(useCharacters).mockReturnValue({
      characters: mockCharacters,
      activeCharacter: null,
      ...mockCharacterActions,
    });
    vi.mocked(useCharacterCreation).mockReturnValue(mockCharacterCreation);
    vi.mocked(useInitiativeStore).mockReturnValue(mockInitiativeActions);
    vi.mocked(useCharacterCreationLauncher).mockReturnValue(mockLauncher);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useGameStore).mockReturnValue({} as any);
  });

  describe('Component Rendering', () => {
    it('should render player panel with header', () => {
      render(<PlayerPanel />);

      expect(screen.getByText('Players & Characters')).toBeInTheDocument();
    });

    it('should render my characters section for a player', () => {
      vi.mocked(useIsHost).mockReturnValue(false); // Viewing as a player
      render(<PlayerPanel />);

      const myCharactersSection = screen
        .getByText('My Characters')
        .closest('.my-characters-section')!;
      expect(myCharactersSection).toBeInTheDocument();

      // Should only show Alice's character
      expect(
        within(myCharactersSection).getByText('Alice Fighter'),
      ).toBeInTheDocument();
      expect(
        within(myCharactersSection).queryByText('Host Character'),
      ).not.toBeInTheDocument();
    });

    it('should render my characters section for a host', () => {
      vi.mocked(useIsHost).mockReturnValue(true); // Viewing as the host
      render(<PlayerPanel />);

      const myCharactersSection = screen
        .getByText('My Characters')
        .closest('.my-characters-section')!;
      expect(myCharactersSection).toBeInTheDocument();

      // Should only show the host's character
      expect(
        within(myCharactersSection).getByText('Host Character'),
      ).toBeInTheDocument();
      expect(
        within(myCharactersSection).queryByText('Alice Fighter'),
      ).not.toBeInTheDocument();
    });

    it('should render all players section', () => {
      render(<PlayerPanel />);

      expect(screen.getByText('All Players (2/3 online)')).toBeInTheDocument();
      expect(screen.getByText('Game Master')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('should show Begin Combat button for hosts', () => {
      vi.mocked(useIsHost).mockReturnValue(true);

      render(<PlayerPanel />);

      expect(screen.getByText('⚔️ Begin Combat')).toBeInTheDocument();
    });

    it('should not show Begin Combat button for players', () => {
      vi.mocked(useIsHost).mockReturnValue(false);

      render(<PlayerPanel />);

      expect(screen.queryByText('⚔️ Begin Combat')).not.toBeInTheDocument();
    });
  });

  describe('Character Management', () => {
    it('should display character information correctly for a host', () => {
      vi.mocked(useIsHost).mockReturnValue(true);
      render(<PlayerPanel />);

      const myCharactersSection = screen
        .getByText('My Characters')
        .closest('.my-characters-section')!;

      const characterList = within(myCharactersSection)
        .getByText('Host Character')
        .closest('.character-item')!;
      expect(
        within(characterList).getByText('Level 5 Dragonborn Paladin'),
      ).toBeInTheDocument();
      expect(
        within(characterList).getByText('HP: 40/50 | AC: 20'),
      ).toBeInTheDocument();
    });

    it('should show create character button', () => {
      render(<PlayerPanel />);

      expect(screen.getByText('➕ New Character')).toBeInTheDocument();
    });

    it('should handle create character click', () => {
      render(<PlayerPanel />);

      const createButton = screen.getByText('➕ New Character');
      fireEvent.click(createButton);

      expect(mockNavigate).toHaveBeenCalledWith('/lobby/player-setup');
    });

    it('should handle character view click', () => {
      render(<PlayerPanel />);

      const myCharactersSection = screen
        .getByText('My Characters')
        .closest('.my-characters-section')!;
      const characterItem =
        within(myCharactersSection).getByText('Alice Fighter');
      fireEvent.click(characterItem.closest('.character-item')!);

      expect(mockCharacterActions.setActiveCharacter).toHaveBeenCalledWith(
        'char-2',
      );
    });

    it('should show empty state when no characters', () => {
      vi.mocked(useCharacters).mockReturnValue({
        characters: [],
        activeCharacter: null,
        ...mockCharacterActions,
      });

      render(<PlayerPanel />);

      expect(
        screen.getByText('No characters created yet.'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Create a character to get started!'),
      ).toBeInTheDocument();
    });
  });

  describe('Player Cards', () => {
    it('should display player connection status', () => {
      render(<PlayerPanel />);

      const onlineIndicators = screen.getAllByText('Online');
      const offlineIndicators = screen.getAllByText('Offline');

      expect(
        onlineIndicators.some((el) =>
          el.closest('.player-card')?.classList.contains('online'),
        ),
      ).toBe(true);

      expect(
        offlineIndicators.some((el) =>
          el.closest('.player-card')?.classList.contains('offline'),
        ),
      ).toBe(true);
    });

    it('should display host badge', () => {
      render(<PlayerPanel />);

      expect(screen.getByText('Dungeon Master')).toBeInTheDocument();
    });

    it('should display character count for each player', () => {
      render(<PlayerPanel />);

      const hostCard = screen.getByText('Game Master').closest('.player-card');
      expect(hostCard).toHaveTextContent('1 character');

      const aliceCard = screen.getByText('Alice').closest('.player-card');
      expect(aliceCard).toHaveTextContent('1 character');

      const bobCard = screen.getByText('Bob').closest('.player-card');
      expect(bobCard).toHaveTextContent('0 characters');
    });

    it('should show player controls for hosts', () => {
      vi.mocked(useIsHost).mockReturnValue(true);

      render(<PlayerPanel />);

      const playerCards = screen.getAllByText('🚪'); // Kick buttons
      expect(playerCards).toHaveLength(2); // For Alice and Bob
    });

    it('should not show player controls for non-hosts', () => {
      vi.mocked(useIsHost).mockReturnValue(false);

      render(<PlayerPanel />);

      expect(screen.queryByText('🚪')).not.toBeInTheDocument();
    });
  });

  describe('Combat Integration', () => {
    it('should handle Begin Combat button click', () => {
      vi.mocked(useIsHost).mockReturnValue(true);

      render(<PlayerPanel />);

      const beginCombatButton = screen.getByText('⚔️ Begin Combat');
      fireEvent.click(beginCombatButton);

      expect(mockInitiativeActions.addEntry).toHaveBeenCalledTimes(2);
      expect(mockInitiativeActions.rollInitiativeForAll).toHaveBeenCalled();
      expect(mockInitiativeActions.startCombat).toHaveBeenCalled();
    });

    it('should disable Begin Combat button when no characters', () => {
      vi.mocked(useIsHost).mockReturnValue(true);
      vi.mocked(useCharacters).mockReturnValue({
        characters: [],
        activeCharacter: null,
        ...mockCharacterActions,
      });

      render(<PlayerPanel />);

      const beginCombatButton = screen.getByText('⚔️ Begin Combat');
      expect(beginCombatButton).toBeDisabled();
    });

    it('should show combat preparation section for hosts with characters', () => {
      vi.mocked(useIsHost).mockReturnValue(true);

      render(<PlayerPanel />);

      expect(screen.getByText('Combat Preparation')).toBeInTheDocument();
      expect(screen.getByText('2 player characters ready')).toBeInTheDocument();
      expect(screen.getByText('🎲 Add All to Initiative')).toBeInTheDocument();
    });
  });

  describe('Character Creation Wizard', () => {
    it('should render character creation wizard when active', () => {
      const mockLauncher = {
        startCharacterCreation: vi.fn(),
        LauncherComponent: (
          <div data-testid="wizard">Character Creation Wizard</div>
        ),
        isActive: true,
      };
      vi.mocked(useCharacterCreationLauncher).mockReturnValue(mockLauncher);

      render(<PlayerPanel />);

      expect(screen.getByTestId('wizard')).toBeInTheDocument();
    });
  });

  describe('Character Sheet View', () => {
    it('should render character sheet when character is selected', () => {
      vi.mocked(useCharacters).mockReturnValue({
        characters: mockCharacters,
        activeCharacter: mockCharacters[0], // Host Character
        ...mockCharacterActions,
      });

      render(<PlayerPanel />);

      expect(screen.getByTestId('character-sheet')).toBeInTheDocument();
      expect(screen.getByText('Host Character')).toBeInTheDocument();
      expect(screen.getByText('← Back to Players')).toBeInTheDocument();
    });

    it('should handle back to players navigation', () => {
      vi.mocked(useCharacters).mockReturnValue({
        characters: mockCharacters,
        activeCharacter: mockCharacters[0],
        ...mockCharacterActions,
      });

      render(<PlayerPanel />);

      const backButton = screen.getByText('← Back to Players');
      fireEvent.click(backButton);

      // Should call setActiveCharacter with null to go back
      expect(mockCharacterActions.setActiveCharacter).toHaveBeenCalledWith(
        null,
      );
    });

    it('should show readonly character sheet for other players characters', () => {
      const otherPlayerCharacter = {
        ...mockCharacters[0],
        playerId: 'other-player',
      };

      vi.mocked(useCharacters).mockReturnValue({
        characters: [otherPlayerCharacter],
        activeCharacter: otherPlayerCharacter,
        ...mockCharacterActions,
      });

      render(<PlayerPanel />);

      expect(screen.getByTestId('character-sheet')).toHaveTextContent(
        'readonly: true',
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle missing session gracefully', () => {
      vi.mocked(useSession).mockReturnValue(null);

      expect(() => {
        render(<PlayerPanel />);
      }).not.toThrow();
    });

    it('should handle empty players list', () => {
      vi.mocked(useSession).mockReturnValue({
        ...mockSession,
        players: [],
      });

      render(<PlayerPanel />);

      expect(screen.getByText('All Players (0/0 online)')).toBeInTheDocument();
    });

    it('should handle character action failures gracefully', () => {
      mockCharacterActions.setActiveCharacter.mockImplementation(() => {
        throw new Error('Store error');
      });

      render(<PlayerPanel />);

      const myCharactersSection = screen
        .getByText('My Characters')
        .closest('.my-characters-section')!;
      const characterItem =
        within(myCharactersSection).getByText('Alice Fighter');

      expect(() => {
        fireEvent.click(characterItem.closest('.character-item')!);
      }).not.toThrow();
    });
  });
});
