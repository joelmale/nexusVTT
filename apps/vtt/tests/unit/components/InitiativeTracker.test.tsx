import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { InitiativeTracker } from '../../../src/components/InitiativeTracker';
import { useInitiativeStore, useInitiative, useInitiativeActions } from '../../../src/stores/initiativeStore';

// Mock the initiative store
vi.mock('../../../src/stores/initiativeStore', () => ({
  useInitiativeStore: vi.fn(),
  useInitiative: vi.fn(),
  useInitiativeActions: vi.fn(),
}));

describe('InitiativeTracker', () => {
  const renderWithDnd = (ui: React.ReactElement) =>
    render(<DndProvider backend={HTML5Backend}>{ui}</DndProvider>);
  const mockStore = {
    isActive: false,
    isPaused: false,
    round: 0,
    entries: [],
    activeEntryId: null,
    history: [],
    showPlayerHP: true,
    sortByInitiative: true,
    startCombat: vi.fn(),
    endCombat: vi.fn(),
    nextTurn: vi.fn(),
    previousTurn: vi.fn(),
    addEntry: vi.fn(),
    removeEntry: vi.fn(),
    updateEntry: vi.fn(),
    applyDamage: vi.fn(),
    applyHealing: vi.fn(),
    addCondition: vi.fn(),
    removeCondition: vi.fn(),
    rollInitiativeForAll: vi.fn(),
    updateSettings: vi.fn(),
    pauseCombat: vi.fn(),
    resumeCombat: vi.fn(),
    getEntry: vi.fn(),
    getActiveEntry: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useInitiativeStore).mockReturnValue(mockStore);
    vi.mocked(useInitiative).mockReturnValue({
      isActive: mockStore.isActive,
      isPaused: mockStore.isPaused,
      round: mockStore.round,
      entries: mockStore.entries,
      activeEntry: mockStore.getActiveEntry(),
      combatLog: [],
    });
    vi.mocked(useInitiativeActions).mockReturnValue({
      startCombat: mockStore.startCombat,
      endCombat: mockStore.endCombat,
      nextTurn: mockStore.nextTurn,
      previousTurn: mockStore.previousTurn,
      addEntry: mockStore.addEntry,
      removeEntry: mockStore.removeEntry,
      updateEntry: mockStore.updateEntry,
      applyDamage: mockStore.applyDamage,
      applyHealing: mockStore.applyHealing,
      addCondition: mockStore.addCondition,
      removeCondition: mockStore.removeCondition,
      rollInitiativeForAll: mockStore.rollInitiativeForAll,
    });
  });

  it('renders initiative tracker header', () => {
    renderWithDnd(<InitiativeTracker />);

    expect(screen.getByText('⚔️ Initiative')).toBeInTheDocument();
  });

  it('shows start combat button when not active', () => {
    renderWithDnd(<InitiativeTracker />);

    const startButton = screen.getByText('▶️ Start Combat');
    expect(startButton).toBeInTheDocument();
    expect(startButton).toBeDisabled(); // No entries added yet
  });

  it('shows combat controls when active', () => {
    const activeStore = {
      ...mockStore,
      isActive: true,
      round: 3,
      entries: [
        {
          id: '1',
          name: 'Fighter',
          type: 'player' as const,
          initiative: 15,
          maxHP: 25,
          currentHP: 20,
          tempHP: 0,
          armorClass: 16,
          conditions: [],
          isActive: true,
          isReady: false,
          isDelayed: false,
          notes: '',
          deathSaves: { successes: 0, failures: 0 },
          initiativeModifier: 2,
          dexterityModifier: 2,
        },
      ],
    };

    vi.mocked(useInitiative).mockReturnValue({
      ...activeStore,
      activeEntry: activeStore.entries[0],
      combatLog: [],
    });

    renderWithDnd(<InitiativeTracker />);

    expect(screen.getByText('Round 3')).toBeInTheDocument();
    expect(screen.getByTitle('Previous Turn')).toBeInTheDocument();
    expect(screen.getByTitle('Next Turn')).toBeInTheDocument();
    expect(screen.getByText('🏁 End')).toBeInTheDocument();
  });

  it('handles adding new entry', async () => {
    renderWithDnd(<InitiativeTracker />);

    const nameInput = screen.getByPlaceholderText('Name');
    const addButton = screen.getByText('Add');

    fireEvent.change(nameInput, { target: { value: 'Test Fighter' } });
    fireEvent.click(addButton);

    expect(mockStore.addEntry).toHaveBeenCalledWith({
      name: 'Test Fighter',
      type: 'monster',
      initiative: 10,
      maxHP: 10,
      currentHP: 10,
      tempHP: 0,
      armorClass: 10,
      conditions: [],
      isActive: false,
      isReady: false,
      isDelayed: false,
      notes: '',
      deathSaves: { successes: 0, failures: 0 },
      initiativeModifier: 0,
      dexterityModifier: 0,
    });
  });

  it('handles adding entry on Enter key press', () => {
    renderWithDnd(<InitiativeTracker />);

    const nameInput = screen.getByPlaceholderText('Name');

    fireEvent.change(nameInput, { target: { value: 'Test Fighter' } });
    fireEvent.keyDown(nameInput, { key: 'Enter', code: 'Enter' });

    expect(mockStore.addEntry).toHaveBeenCalled();
  });

  it('displays entries correctly', () => {
    const storeWithEntries = {
      ...mockStore,
      entries: [
        {
          id: '1',
          name: 'Fighter',
          type: 'player' as const,
          initiative: 20,
          maxHP: 25,
          currentHP: 20,
          tempHP: 5,
          armorClass: 16,
          conditions: [],
          isActive: true,
          isReady: false,
          isDelayed: false,
          notes: '',
          deathSaves: { successes: 0, failures: 0 },
          initiativeModifier: 2,
          dexterityModifier: 2,
        },
        {
          id: '2',
          name: 'Goblin',
          type: 'monster' as const,
          initiative: 15,
          maxHP: 7,
          currentHP: 3,
          tempHP: 0,
          armorClass: 15,
          conditions: [],
          isActive: false,
          isReady: false,
          isDelayed: false,
          notes: '',
          deathSaves: { successes: 0, failures: 0 },
          initiativeModifier: 2,
          dexterityModifier: 2,
        },
      ],
    };

    vi.mocked(useInitiative).mockReturnValue({
      ...storeWithEntries,
      activeEntry: null,
      combatLog: [],
    });

    renderWithDnd(<InitiativeTracker />);

    expect(screen.getByDisplayValue('Fighter')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Goblin')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('20')[0]).toBeInTheDocument(); // Initiative
    const goblinInitiative = screen.getAllByDisplayValue('15');
    expect(
      goblinInitiative.some((input) =>
        input.classList.contains('initiative-number-input')
      )
    ).toBe(true); // Initiative
  });

  it('shows current turn indicator when combat is active', () => {
    const activeStore = {
      ...mockStore,
      isActive: true,
      entries: [
        {
          id: '1',
          name: 'Fighter',
          type: 'player' as const,
          initiative: 15,
          maxHP: 25,
          currentHP: 20,
          tempHP: 0,
          armorClass: 16,
          conditions: [],
          isActive: true,
          isReady: false,
          isDelayed: false,
          notes: '',
          deathSaves: { successes: 0, failures: 0 },
          initiativeModifier: 2,
          dexterityModifier: 2,
        },
      ],
    };

    vi.mocked(useInitiative).mockReturnValue({
      ...activeStore,
      activeEntry: activeStore.entries[0],
      combatLog: [],
    });

    renderWithDnd(<InitiativeTracker />);

    expect(screen.getByText('Fighter')).toBeInTheDocument();
    expect(screen.getByText("It's their turn!")).toBeInTheDocument();
  });

  it('handles combat control buttons', () => {
    const activeStore = {
      ...mockStore,
      isActive: true,
      entries: [
        {
          id: '1',
          name: 'Fighter',
          type: 'player' as const,
          initiative: 15,
          maxHP: 25,
          currentHP: 20,
          tempHP: 0,
          armorClass: 16,
          conditions: [],
          isActive: true,
          isReady: false,
          isDelayed: false,
          notes: '',
          deathSaves: { successes: 0, failures: 0 },
          initiativeModifier: 2,
          dexterityModifier: 2,
        },
      ],
    };

    vi.mocked(useInitiative).mockReturnValue({
      ...activeStore,
      activeEntry: activeStore.entries[0],
      combatLog: [],
    });

    renderWithDnd(<InitiativeTracker />);

    const nextTurnButton = screen.getByTitle('Next Turn');
    const prevTurnButton = screen.getByTitle('Previous Turn');
    const endCombatButton = screen.getByText('🏁 End');

    fireEvent.click(nextTurnButton);
    expect(mockStore.nextTurn).toHaveBeenCalled();

    fireEvent.click(prevTurnButton);
    expect(mockStore.previousTurn).toHaveBeenCalled();

    fireEvent.click(endCombatButton);
    expect(mockStore.endCombat).toHaveBeenCalled();
  });

  it('handles rolling initiative for all entries', () => {
    const storeWithEntries = {
      ...mockStore,
      entries: [
        {
          id: '1',
          name: 'Fighter',
          type: 'player' as const,
          initiative: 15,
          maxHP: 25,
          currentHP: 20,
          tempHP: 0,
          armorClass: 16,
          conditions: [],
          isActive: false,
          isReady: false,
          isDelayed: false,
          notes: '',
          deathSaves: { successes: 0, failures: 0 },
          initiativeModifier: 2,
          dexterityModifier: 2,
        },
      ],
    };

    vi.mocked(useInitiative).mockReturnValue({
      ...storeWithEntries,
      activeEntry: null,
      combatLog: [],
    });

    renderWithDnd(<InitiativeTracker />);

    const rollAllButton = screen.getByText('🎲 Roll All');
    fireEvent.click(rollAllButton);

    expect(mockStore.rollInitiativeForAll).toHaveBeenCalled();
  });

  it('handles settings changes', () => {
    renderWithDnd(<InitiativeTracker />);

    const showHPCheckbox = screen.getByLabelText('Show HP');
    const autoSortCheckbox = screen.getByLabelText('Auto-Sort');

    fireEvent.click(showHPCheckbox);
    expect(mockStore.updateSettings).toHaveBeenCalledWith({ showPlayerHP: false });

    fireEvent.click(autoSortCheckbox);
    expect(mockStore.updateSettings).toHaveBeenCalledWith({ sortByInitiative: false });
  });

  it('shows empty state when no entries', () => {
    renderWithDnd(<InitiativeTracker />);

    expect(screen.getByText('No combatants yet')).toBeInTheDocument();
    expect(screen.getByText('Add players, NPCs, or monsters above')).toBeInTheDocument();
  });

  it('allows changing entry type and initiative when adding', () => {
    renderWithDnd(<InitiativeTracker />);

    const typeSelect = screen.getByDisplayValue('👹 Monster');
    const initiativeInput = screen.getByDisplayValue('10');

    fireEvent.change(typeSelect, { target: { value: 'monster' } });
    fireEvent.change(initiativeInput, { target: { value: '18' } });

    const nameInput = screen.getByPlaceholderText('Name');
    const addButton = screen.getByText('Add');

    fireEvent.change(nameInput, { target: { value: 'Dragon' } });
    fireEvent.click(addButton);

    expect(mockStore.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Dragon',
        type: 'monster',
        initiative: 18,
      })
    );
  });
});
