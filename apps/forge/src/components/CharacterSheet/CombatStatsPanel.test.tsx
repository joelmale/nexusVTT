import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CombatStatsPanel } from './CombatStatsPanel';
import { loadEquipment } from '../../services/dataService';

// Mock the data service
vi.mock('../../services/dataService', () => ({
  loadEquipment: vi.fn(),
  getModifier: vi.fn((score) => Math.floor((score - 10) / 2)),
}));

// Mock hooks
vi.mock('../../hooks', () => ({
  useLayout: () => ({ layoutMode: 'modern' }),
}));

describe('CombatStatsPanel', () => {
  // Mock equipment data matching D&D 5e SRD
  const mockEquipmentData = [
    {
      slug: 'chain-mail',
      name: 'Chain Mail',
      index: 'chain-mail',
      equipment_category: 'Armor',
      armor_category: 'Heavy' as const,
      armor_class: { base: 16, dex_bonus: false },
      cost: { quantity: 75, unit: 'gp' as const },
      weight: 55,
      year: 2014
    },
    {
      slug: 'breastplate',
      name: 'Breastplate',
      index: 'breastplate',
      equipment_category: 'Armor',
      armor_category: 'Medium' as const,
      armor_class: { base: 14, max_bonus: 2 },
      cost: { quantity: 400, unit: 'gp' as const },
      weight: 20,
      year: 2014
    },
    {
      slug: 'leather',
      name: 'Leather',
      index: 'leather',
      equipment_category: 'Armor',
      armor_category: 'Light' as const,
      armor_class: { base: 11 },
      cost: { quantity: 10, unit: 'gp' as const },
      weight: 10,
      year: 2014
    },
    {
      slug: 'shield',
      name: 'Shield',
      index: 'shield',
      equipment_category: 'Armor',
      armor_category: 'Shield' as const,
      armor_class: { base: 2 },
      cost: { quantity: 10, unit: 'gp' as const },
      weight: 6,
      year: 2014
    }
  ] as any;

  const createMockCharacter = (overrides = {}): any => ({
    id: 'test-char',
    name: 'Test Character',
    species: 'Human',
    class: 'Fighter',
    level: 1,
    alignment: 'neutral-good',
    background: 'soldier',
    edition: '2024',
    abilities: {
      STR: { score: 14, modifier: 2 },
      DEX: { score: 14, modifier: 2 },
      CON: { score: 14, modifier: 2 },
      INT: { score: 10, modifier: 0 },
      WIS: { score: 12, modifier: 1 },
      CHA: { score: 10, modifier: 0 }
    },
    equippedArmor: null,
    equippedWeapons: [],
    armorClass: 10,
    proficiencyBonus: 2,
    hitPoints: 12,
    maxHitPoints: 12,
    hitDice: { current: 1, max: 1, dieType: 10 },
    speed: 30,
    initiative: 2,
    savingThrows: [],
    skills: [],
    proficiencies: [],
    languages: ['Common'],
    inventory: [],
    currency: { gp: 0, sp: 0, cp: 0, pp: 0 },
    inspiration: false,
    featuresAndTraits: { personality: [], ideals: [], bonds: [], flaws: [] },
    spellcasting: null,
    subclass: null,
    selectedFightingStyle: null,
    selectedFeats: [],
    divineOrder: null,
    primalOrder: null,
    pactBoon: null,
    expertiseSkills: [],
    weaponMastery: [],
    fightingStyle: null,
    eldritchInvocations: [],
    secondWindUses: 1,
    backgroundFeat: null,
    srdFeatures: { classFeatures: [], subclassFeatures: [] },
    ...overrides
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadEquipment).mockReturnValue(mockEquipmentData);
  });

  describe('AC Tooltip Calculations', () => {
    describe('Heavy Armor', () => {
      it('should show flat AC for heavy armor without shield', () => {
        const character = createMockCharacter({
          equippedArmor: 'chain-mail',
          abilities: {
            ...createMockCharacter().abilities,
            DEX: { score: 14, modifier: 2 } // +2 DEX (should be ignored)
          },
          armorClass: 16
        });

        render(<CombatStatsPanel
          character={character}
          layoutMode="modern"
          setRollResult={vi.fn()}
          onDiceRoll={vi.fn()}
          onUpdateCharacter={vi.fn()}
        />);

        const acElement = screen.getByTitle('Chain Mail: 16 = 16 AC');
        expect(acElement).toBeInTheDocument();
      });

      it('should show flat AC for heavy armor with shield', () => {
        const character = createMockCharacter({
          equippedArmor: 'chain-mail',
          equippedWeapons: ['shield'],
          armorClass: 18
        });

        render(<CombatStatsPanel
          character={character}
          layoutMode="modern"
          setRollResult={vi.fn()}
          onDiceRoll={vi.fn()}
          onUpdateCharacter={vi.fn()}
        />);

        const acElement = screen.getByTitle('Chain Mail: 16, Shield: +2 = 18 AC');
        expect(acElement).toBeInTheDocument();
      });

      it('should ignore negative DEX modifier for heavy armor', () => {
        const character = createMockCharacter({
          equippedArmor: 'chain-mail',
          abilities: {
            ...createMockCharacter().abilities,
            DEX: { score: 8, modifier: -1 } // -1 DEX (should be ignored)
          },
          armorClass: 16
        });

        render(<CombatStatsPanel
          character={character}
          layoutMode="modern"
          setRollResult={vi.fn()}
          onDiceRoll={vi.fn()}
          onUpdateCharacter={vi.fn()}
        />);

        const acElement = screen.getByTitle('Chain Mail: 16 = 16 AC');
        expect(acElement).toBeInTheDocument();
      });
    });

    describe('Medium Armor', () => {
      it('should apply DEX bonus up to max +2 for medium armor', () => {
        const character = createMockCharacter({
          equippedArmor: 'breastplate',
          abilities: {
            ...createMockCharacter().abilities,
            DEX: { score: 16, modifier: 3 } // +3 DEX (capped at +2)
          },
          armorClass: 16
        });

        render(<CombatStatsPanel
          character={character}
          layoutMode="modern"
          setRollResult={vi.fn()}
          onDiceRoll={vi.fn()}
          onUpdateCharacter={vi.fn()}
        />);

        const acElement = screen.getByTitle('Breastplate: 14, DEX: +2 = 16 AC');
        expect(acElement).toBeInTheDocument();
      });

      it('should apply partial DEX bonus for medium armor', () => {
        const character = createMockCharacter({
          equippedArmor: 'breastplate',
          abilities: {
            ...createMockCharacter().abilities,
            DEX: { score: 12, modifier: 1 } // +1 DEX (under max +2)
          },
          armorClass: 15
        });

        render(<CombatStatsPanel
          character={character}
          layoutMode="modern"
          setRollResult={vi.fn()}
          onDiceRoll={vi.fn()}
          onUpdateCharacter={vi.fn()}
        />);

        const acElement = screen.getByTitle('Breastplate: 14, DEX: +1 = 15 AC');
        expect(acElement).toBeInTheDocument();
      });

      it('should apply negative DEX modifier for medium armor', () => {
        const character = createMockCharacter({
          equippedArmor: 'breastplate',
          abilities: {
            ...createMockCharacter().abilities,
            DEX: { score: 8, modifier: -1 } // -1 DEX
          },
          armorClass: 13
        });

        render(<CombatStatsPanel
          character={character}
          layoutMode="modern"
          setRollResult={vi.fn()}
          onDiceRoll={vi.fn()}
          onUpdateCharacter={vi.fn()}
        />);

        const acElement = screen.getByTitle('Breastplate: 14, DEX: -1 = 13 AC');
        expect(acElement).toBeInTheDocument();
      });
    });

    describe('Light Armor', () => {
      it('should apply full DEX modifier for light armor', () => {
        const character = createMockCharacter({
          equippedArmor: 'leather',
          abilities: {
            ...createMockCharacter().abilities,
            DEX: { score: 16, modifier: 3 } // +3 DEX
          },
          armorClass: 14
        });

        render(<CombatStatsPanel
          character={character}
          layoutMode="modern"
          setRollResult={vi.fn()}
          onDiceRoll={vi.fn()}
          onUpdateCharacter={vi.fn()}
        />);

        const acElement = screen.getByTitle('Leather: 11, DEX: +3 = 14 AC');
        expect(acElement).toBeInTheDocument();
      });

      it('should apply negative DEX modifier for light armor', () => {
        const character = createMockCharacter({
          equippedArmor: 'leather',
          abilities: {
            ...createMockCharacter().abilities,
            DEX: { score: 8, modifier: -1 } // -1 DEX
          },
          armorClass: 10
        });

        render(<CombatStatsPanel
          character={character}
          layoutMode="modern"
          setRollResult={vi.fn()}
          onDiceRoll={vi.fn()}
          onUpdateCharacter={vi.fn()}
        />);

        const acElement = screen.getByTitle('Leather: 11, DEX: -1 = 10 AC');
        expect(acElement).toBeInTheDocument();
      });
    });

    describe('Unarmored', () => {
      it('should show base AC with DEX for unarmored characters', () => {
        const character = createMockCharacter({
          equippedArmor: null,
          abilities: {
            ...createMockCharacter().abilities,
            DEX: { score: 14, modifier: 2 } // +2 DEX
          },
          armorClass: 12
        });

        render(<CombatStatsPanel
          character={character}
          layoutMode="modern"
          setRollResult={vi.fn()}
          onDiceRoll={vi.fn()}
          onUpdateCharacter={vi.fn()}
        />);

        const acElement = screen.getByTitle('Base: 10, DEX: +2 = 12 AC');
        expect(acElement).toBeInTheDocument();
      });

      it('should include shield bonus for unarmored characters', () => {
        const character = createMockCharacter({
          equippedArmor: null,
          equippedWeapons: ['shield'],
          abilities: {
            ...createMockCharacter().abilities,
            DEX: { score: 14, modifier: 2 } // +2 DEX
          },
          armorClass: 14
        });

        render(<CombatStatsPanel
          character={character}
          layoutMode="modern"
          setRollResult={vi.fn()}
          onDiceRoll={vi.fn()}
          onUpdateCharacter={vi.fn()}
        />);

        const acElement = screen.getByTitle('Base: 10, DEX: +2, Shield: +2 = 14 AC');
        expect(acElement).toBeInTheDocument();
      });

      it('should handle zero DEX modifier', () => {
        const character = createMockCharacter({
          equippedArmor: null,
          abilities: {
            ...createMockCharacter().abilities,
            DEX: { score: 10, modifier: 0 } // +0 DEX
          },
          armorClass: 10
        });

        render(<CombatStatsPanel
          character={character}
          layoutMode="modern"
          setRollResult={vi.fn()}
          onDiceRoll={vi.fn()}
          onUpdateCharacter={vi.fn()}
        />);

        const acElement = screen.getByTitle('Base: 10 = 10 AC');
        expect(acElement).toBeInTheDocument();
      });
    });

    describe('Edge Cases', () => {
      it('should handle very high DEX modifier with medium armor cap', () => {
        const character = createMockCharacter({
          equippedArmor: 'breastplate',
          abilities: {
            ...createMockCharacter().abilities,
            DEX: { score: 20, modifier: 5 } // +5 DEX (capped at +2 for medium)
          },
          armorClass: 16
        });

        render(<CombatStatsPanel
          character={character}
          layoutMode="modern"
          setRollResult={vi.fn()}
          onDiceRoll={vi.fn()}
          onUpdateCharacter={vi.fn()}
        />);

        const acElement = screen.getByTitle('Breastplate: 14, DEX: +2 = 16 AC');
        expect(acElement).toBeInTheDocument();
      });

      it('should handle shield with no armor equipped', () => {
        const character = createMockCharacter({
          equippedArmor: null,
          equippedWeapons: ['shield'],
          armorClass: 12
        });

        render(<CombatStatsPanel
          character={character}
          layoutMode="modern"
          setRollResult={vi.fn()}
          onDiceRoll={vi.fn()}
          onUpdateCharacter={vi.fn()}
        />);

        const acElement = screen.getByTitle('Base: 10, DEX: +2, Shield: +2 = 14 AC');
        expect(acElement).toBeInTheDocument();
      });
    });
  });
});