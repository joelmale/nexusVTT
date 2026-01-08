import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CharacterSheet } from '@/components/CharacterSheet';
import { useCharacterStore } from '@/stores/characterStore';
import type { Character } from '@/types/character';

// Mock the character store
vi.mock('@/stores/characterStore', () => ({
  useCharacterStore: vi.fn(),
}));

// Mock the character types
vi.mock('@/types/character', async () => {
  const actual = await vi.importActual<typeof import('@/types/character')>(
    '@/types/character',
  );
  return {
    ...actual,
    STANDARD_SKILLS: [
      { name: 'Athletics', ability: 'STR' },
      { name: 'Acrobatics', ability: 'DEX' },
      { name: 'Perception', ability: 'WIS' },
    ],
  };
});

describe('CharacterSheet', () => {
  const mockCharacter: Character = {
    id: 'char-123',
    playerId: 'player-123',
    name: 'Test Character',
    level: 5,
    race: 'Human',
    class: 'Fighter',
    background: 'Soldier',
    abilities: {
      STR: { score: 16, modifier: 3 },
      DEX: { score: 14, modifier: 2 },
      CON: { score: 15, modifier: 2 },
      INT: { score: 10, modifier: 0 },
      WIS: { score: 13, modifier: 1 },
      CHA: { score: 12, modifier: 1 },
    },
    skills: {
      Athletics: { proficient: true, value: 6 },
      Acrobatics: { proficient: false, value: 2 },
      Perception: { proficient: true, expertise: true, value: 7 },
    },
    hitPoints: 35,
    maxHitPoints: 47,
    temporaryHitPoints: 5,
    armorClass: 18,
    initiative: 2,
    speed: 30,
    proficiencyBonus: 3,
    inventory: [
      {
        equipmentSlug: 'Plate Armor',
        equipped: true,
        quantity: 1,
      },
      {
        equipmentSlug: 'Longsword',
        equipped: true,
        quantity: 1,
      },
    ],
    featuresAndTraits: {
      personality: 'I face problems head-on.',
      ideals: 'Honor is more important than gold.',
      bonds: 'I would die for my unit.',
      flaws: 'I have trouble trusting new allies.',
    },
    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    updatedAt: new Date().toISOString(),
  };

  const mockStoreActions = {
    updateCharacter: vi.fn(),
    updateAbilityScore: vi.fn(),
    updateSkillProficiency: vi.fn(),
    addEquipment: vi.fn(),
    updateEquipment: vi.fn(),
    removeEquipment: vi.fn(),
    equipItem: vi.fn(),
    unequipItem: vi.fn(),
    updateSavingThrowProficiency: vi.fn(),
    updateCharacterHP: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock the store hook to return our mock functions
    vi.mocked(useCharacterStore).mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector(mockStoreActions);
      }
      return mockStoreActions;
    });
  });

  describe('Component Rendering', () => {
    it('should render character sheet with basic information', () => {
      render(<CharacterSheet character={mockCharacter} />);

      expect(screen.getByDisplayValue('Test Character')).toBeInTheDocument();
      expect(screen.getByLabelText('Level')).toHaveValue(5);
      expect(screen.getByDisplayValue('Human')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Fighter')).toBeInTheDocument();
    });

    it('should render all tab buttons', () => {
      render(<CharacterSheet character={mockCharacter} />);

      expect(screen.getByText(/Stats/)).toBeInTheDocument();
      expect(screen.getByText(/Equipment/)).toBeInTheDocument();
      expect(screen.getByText(/Spells/)).toBeInTheDocument();
      expect(screen.getByText(/Notes/)).toBeInTheDocument();
    });

    it('should show Stats tab by default', () => {
      render(<CharacterSheet character={mockCharacter} />);

      // Check that ability scores are visible (Stats tab content)
      expect(screen.getByText('STR')).toBeInTheDocument();
      expect(screen.getByText('DEX')).toBeInTheDocument();
      expect(screen.getByText('CON')).toBeInTheDocument();
    });

    it('should switch tabs when clicked', () => {
      render(<CharacterSheet character={mockCharacter} />);

      // Click Equipment tab
      fireEvent.click(screen.getByText(/Equipment/));
      expect(screen.getByDisplayValue('Plate Armor')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Longsword')).toBeInTheDocument();

      // Click Notes tab
      fireEvent.click(screen.getByText(/Notes/));
      expect(screen.getByText('Personality Traits')).toBeInTheDocument();
      expect(screen.getByDisplayValue(/I face problems head-on./)).toBeInTheDocument();
    });

    it('should display readonly mode correctly', () => {
      render(<CharacterSheet character={mockCharacter} readonly={true} />);

      // In readonly mode, inputs should be readonly
      const nameInput = screen.getByDisplayValue('Test Character');
      expect(nameInput).toHaveAttribute('readonly');
    });
  });

  describe('Stats Tab', () => {
    it('should display ability scores correctly', () => {
      render(<CharacterSheet character={mockCharacter} />);

      // Check ability scores and modifiers
      const strengthScore = screen.getByDisplayValue('16');
      const strengthModifier = strengthScore.parentElement?.querySelector('.modifier');
      expect(strengthModifier).toHaveTextContent('+3');

      const dexterityScore = screen.getByDisplayValue('14');
      const dexterityModifier = dexterityScore.parentElement?.querySelector('.modifier');
      expect(dexterityModifier).toHaveTextContent('+2');
    });

    it('should display skill proficiencies correctly', () => {
      render(<CharacterSheet character={mockCharacter} />);

      // Athletics should show as proficient
      const athleticsRow = screen.getByText('Athletics').closest('.skill-item');
      expect(athleticsRow?.querySelector('input[type="checkbox"]')).toBeChecked();

      // Perception should show as expertise
      const perceptionRow = screen.getByText('Perception').closest('.skill-item');
      expect(perceptionRow?.querySelector('.expertise-checkbox')).toBeChecked();
    });

    it('should display hit points correctly', () => {
      render(<CharacterSheet character={mockCharacter} />);

      expect(screen.getByLabelText('Current Hit Points')).toHaveValue(35);
      expect(screen.getByLabelText('Maximum Hit Points')).toHaveValue(47);
      expect(screen.getByLabelText('Temp HP')).toHaveValue(5);
    });

    it('should allow editing ability scores when not readonly', () => {
      render(<CharacterSheet character={mockCharacter} />);

      const strengthInput = screen.getByDisplayValue('16');
      fireEvent.change(strengthInput, { target: { value: '18' } });

      expect(mockStoreActions.updateAbilityScore).toHaveBeenCalledWith(
        'char-123',
        'STR',
        18
      );
    });

    it('should allow toggling skill proficiencies', () => {
      render(<CharacterSheet character={mockCharacter} />);

      const acrobaticsCheckbox = screen.getByText('Acrobatics').closest('.skill-item')?.querySelector('input[type="checkbox"]');
      expect(acrobaticsCheckbox).not.toBeNull();
      fireEvent.click(acrobaticsCheckbox!);

      expect(mockStoreActions.updateSkillProficiency).toHaveBeenCalledWith(
        'char-123',
        'Acrobatics',
        true
      );
    });
  });

  describe('Equipment Tab', () => {
    it('should display equipment list', () => {
      render(<CharacterSheet character={mockCharacter} />);

      fireEvent.click(screen.getByText(/Equipment/));

      expect(screen.getByDisplayValue('Plate Armor')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Longsword')).toBeInTheDocument();
    });

    it('should show equipped status', () => {
      render(<CharacterSheet character={mockCharacter} />);

      fireEvent.click(screen.getByText(/Equipment/));

      // Both items should show as equipped
      const equippedItems = screen.getAllByText('Unequip');
      expect(equippedItems).toHaveLength(2);
    });

    it('should allow equipping/unequipping items', () => {
      render(<CharacterSheet character={mockCharacter} />);

      fireEvent.click(screen.getByText(/Equipment/));

      const equipButton = screen.getAllByText('Unequip')[0]; // First equipped item
      fireEvent.click(equipButton);

      expect(mockStoreActions.unequipItem).toHaveBeenCalledWith('char-123', 'Plate Armor');
    });

    it('should allow removing equipment', () => {
      render(<CharacterSheet character={mockCharacter} />);

      fireEvent.click(screen.getByText(/Equipment/));

      const removeButtons = screen.getAllByText('❌');
      fireEvent.click(removeButtons[0]);

      expect(mockStoreActions.removeEquipment).toHaveBeenCalledWith('char-123', 'Plate Armor');
    });
  });

  describe('Notes Tab', () => {
    it('should display personality traits', () => {
      render(<CharacterSheet character={mockCharacter} />);

      fireEvent.click(screen.getByText(/Notes/));

      expect(screen.getByDisplayValue(/I face problems head-on./)).toBeInTheDocument();
      expect(screen.getByDisplayValue(/Honor is more important than gold./)).toBeInTheDocument();
      expect(screen.getByDisplayValue(/I would die for my unit./)).toBeInTheDocument();
      expect(screen.getByDisplayValue(/I have trouble trusting new allies./)).toBeInTheDocument();
    });

    it('should allow editing personality traits when not readonly', () => {
      render(<CharacterSheet character={mockCharacter} />);

      fireEvent.click(screen.getByText(/Notes/));

      const traitsTextarea = screen.getByDisplayValue(/I face problems head-on./);
      fireEvent.change(traitsTextarea, { target: { value: 'Updated traits' } });

      expect(mockStoreActions.updateCharacter).toHaveBeenCalledWith('char-123', {
        featuresAndTraits: {
          ...mockCharacter.featuresAndTraits,
          personality: 'Updated traits',
        },
      });
    });
  });

  describe('Character Information Editing', () => {
    it('should allow editing character name', () => {
      render(<CharacterSheet character={mockCharacter} />);

      const nameInput = screen.getByDisplayValue('Test Character');
      fireEvent.change(nameInput, { target: { value: 'Updated Character' } });

      expect(mockStoreActions.updateCharacter).toHaveBeenCalledWith('char-123', {
        name: 'Updated Character'
      });
    });

    it('should allow editing character level', () => {
      render(<CharacterSheet character={mockCharacter} />);

      const levelInput = screen.getByLabelText('Level');
      fireEvent.change(levelInput, { target: { value: '6' } });

      expect(mockStoreActions.updateCharacter).toHaveBeenCalledWith('char-123', {
        level: 6
      });
    });

    it('should not allow editing in readonly mode', () => {
      render(<CharacterSheet character={mockCharacter} readonly={true} />);

      const nameInput = screen.getByDisplayValue('Test Character');
      const levelInput = screen.getByLabelText('Level');

      expect(nameInput).toHaveAttribute('readonly');
      expect(levelInput).toHaveAttribute('readonly');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing character data gracefully', () => {
      const incompleteCharacter = {
        id: 'incomplete',
        name: 'Incomplete',
        level: 1,
        hitPoints: 10,
        maxHitPoints: 10,
        temporaryHitPoints: 0,
        armorClass: 10,
        speed: 30,
        abilities: { 
          STR: { score: 10, modifier: 0 },
          DEX: { score: 10, modifier: 0 },
          CON: { score: 10, modifier: 0 },
          INT: { score: 10, modifier: 0 },
          WIS: { score: 10, modifier: 0 },
          CHA: { score: 10, modifier: 0 },
        },
        skills: {},
        inventory: [],
      } as Character;

      expect(() => {
        render(<CharacterSheet character={incompleteCharacter} />);
      }).not.toThrow();
    });

    it('should handle store action failures gracefully', () => {
      mockStoreActions.updateCharacter.mockImplementation(() => {
        throw new Error('Store update failed');
      });

      render(<CharacterSheet character={mockCharacter} />);

      const nameInput = screen.getByDisplayValue('Test Character');

      expect(() => {
        fireEvent.change(nameInput, { target: { value: 'New Name' } });
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<CharacterSheet character={mockCharacter} />);

      expect(screen.getByLabelText('Level')).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      render(<CharacterSheet character={mockCharacter} />);

      const equipmentTab = screen.getByText(/Equipment/);

      // Tab navigation should work
      fireEvent.click(equipmentTab);
      expect(equipmentTab).toHaveClass('active');

      // Keyboard activation should work
      fireEvent.keyDown(equipmentTab, { key: 'Enter', code: 'Enter' });
      expect(screen.getByDisplayValue('Plate Armor')).toBeInTheDocument();
    });
  });
});
