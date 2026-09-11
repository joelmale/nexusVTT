import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CoinManagement } from './CoinManagement';
import { Character } from '../../types/dnd';

// Mock the character data
const mockCharacter: Character = {
  id: 'test-id',
  name: 'Test Character',
  species: 'Human',
  class: 'Fighter',
  level: 1,
  alignment: 'Neutral Good',
  background: 'Soldier',
  edition: '2024',
  inspiration: false,
  proficiencyBonus: 2,
  armorClass: 16,
  hitPoints: 12,
  maxHitPoints: 12,
  hitDice: { current: 1, max: 1, dieType: 10 },
  speed: 30,
  initiative: 2,
  abilities: {
    STR: { score: 16, modifier: 3 },
    DEX: { score: 14, modifier: 2 },
    CON: { score: 14, modifier: 2 },
    INT: { score: 10, modifier: 0 },
    WIS: { score: 12, modifier: 1 },
    CHA: { score: 10, modifier: 0 },
  },
  skills: {
    Acrobatics: { proficient: false, value: 2 },
    AnimalHandling: { proficient: false, value: 1 },
    Arcana: { proficient: false, value: 0 },
    Athletics: { proficient: true, value: 5 },
    Deception: { proficient: false, value: 0 },
    History: { proficient: false, value: 0 },
    Insight: { proficient: false, value: 1 },
    Intimidation: { proficient: false, value: 0 },
    Investigation: { proficient: false, value: 0 },
    Medicine: { proficient: false, value: 0 },
    Nature: { proficient: false, value: 0 },
    Perception: { proficient: false, value: 1 },
    Performance: { proficient: false, value: 0 },
    Persuasion: { proficient: false, value: 0 },
    Religion: { proficient: false, value: 0 },
    SleightOfHand: { proficient: false, value: 0 },
    Stealth: { proficient: false, value: 0 },
    Survival: { proficient: false, value: 0 },
  },
  currency: { cp: 150, sp: 20, gp: 50, pp: 2 },
  featuresAndTraits: {
    personality: 'Test personality',
    ideals: 'Test ideals',
    bonds: 'Test bonds',
    flaws: 'Test flaws',
     classFeatures: [],
     speciesTraits: [],
     backgroundFeatures: [],
     musicalInstrumentProficiencies: [],
   },
};

describe('CoinManagement Component', () => {
  const mockOnUpdateCharacter = vi.fn();

  it('renders coin values correctly', () => {
    render(
      <CoinManagement
        character={mockCharacter}
        onUpdateCharacter={mockOnUpdateCharacter}
        compact={false}
      />
    );

    expect(screen.getByText('150')).toBeInTheDocument(); // CP
    expect(screen.getByText('20')).toBeInTheDocument();  // SP
    expect(screen.getByText('50')).toBeInTheDocument();  // GP
    expect(screen.getByText('2')).toBeInTheDocument();   // PP
  });

  it('calculates total value correctly', () => {
    render(
      <CoinManagement
        character={mockCharacter}
        onUpdateCharacter={mockOnUpdateCharacter}
        compact={false}
      />
    );

    // 150 CP = 1.5 gp, 20 SP = 2 gp, 50 GP = 50 gp, 2 PP = 20 gp
    // Total = 1.5 + 2 + 50 + 20 = 73.5 gp
    expect(screen.getByText('73.50 gp')).toBeInTheDocument();
  });

  it('renders compact version correctly', () => {
    render(
      <CoinManagement
        character={mockCharacter}
        onUpdateCharacter={mockOnUpdateCharacter}
        compact={true}
      />
    );

    // Should show editable inputs in compact mode
    const cpInput = screen.getByDisplayValue('150');
    const spInput = screen.getByDisplayValue('20');
    const gpInput = screen.getByDisplayValue('50');
    const ppInput = screen.getByDisplayValue('2');

    expect(cpInput).toBeInTheDocument();
    expect(spInput).toBeInTheDocument();
    expect(gpInput).toBeInTheDocument();
    expect(ppInput).toBeInTheDocument();
  });

  it('updates coin values when inputs change in compact mode', () => {
    render(
      <CoinManagement
        character={mockCharacter}
        onUpdateCharacter={mockOnUpdateCharacter}
        compact={true}
      />
    );

    const cpInput = screen.getByDisplayValue('150');
    fireEvent.change(cpInput, { target: { value: '200' } });

    expect(mockOnUpdateCharacter).toHaveBeenCalledWith({
      ...mockCharacter,
      currency: { ...mockCharacter.currency, cp: 200 },
    });
  });

  it('handles empty currency object', () => {
    const characterWithoutCurrency = { ...mockCharacter, currency: undefined };

    render(
      <CoinManagement
        character={characterWithoutCurrency}
        onUpdateCharacter={mockOnUpdateCharacter}
        compact={false}
      />
    );

    // Should show 0.00 gp for total value when no currency
    expect(screen.getByText('0.00 gp')).toBeInTheDocument();
  });
});