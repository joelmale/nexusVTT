import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepSpells } from './StepSpells';
import { LevelUpData } from '../../../data/classProgression';
import { Character, LevelUpChoices } from '../../../types/dnd';
import { loadSpells } from '../../../services/dataService';

vi.mock('../../../services/dataService', () => ({
  loadSpells: vi.fn(),
}));

describe('StepSpells', () => {
  const mockSpells = [
    { slug: 'light', name: 'Light', level: 0, school: 'Evocation', castingTime: 'Action', classes: ['sorcerer', 'bard'] },
    { slug: 'burning-hands', name: 'Burning Hands', level: 1, school: 'Evocation', castingTime: 'Action', classes: ['sorcerer', 'bard'] },
    { slug: 'scorching-ray', name: 'Scorching Ray', level: 2, school: 'Evocation', castingTime: 'Action', classes: ['sorcerer', 'bard'] },
    { slug: 'ice-storm', name: 'Ice Storm', level: 4, school: 'Evocation', castingTime: 'Action', classes: ['sorcerer', 'bard'] },
    { slug: 'cone-of-cold', name: 'Cone of Cold', level: 5, school: 'Evocation', castingTime: 'Action', classes: ['sorcerer', 'bard'] },
  ];

  const character = {
    class: 'sorcerer',
    spellcasting: {
      ability: 'CHA',
      spellSaveDC: 10,
      spellAttackBonus: 2,
      cantripsKnown: [],
      spellsKnown: [],
      spellSlots: [4, 3, 0, 0, 0, 0, 0, 0, 0],
      usedSpellSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      spellcastingType: 'known' as const,
      cantripChoicesByLevel: {},
    },
  } as unknown as Character;

  const levelUpData: LevelUpData = {
    fromLevel: 2,
    toLevel: 3,
    newProficiencyBonus: 2,
    hitDie: 'd6',
    conModifier: 2,
    averageHpGain: 5,
    features: [],
    requiresChoices: true,
    choices: [
      {
        type: 'spells',
        description: 'Learn one sorcerer spell',
        count: 1,
      },
    ],
  };

  const baseChoices: LevelUpChoices = {};
  const noop = () => {};

  beforeEach(() => {
    vi.mocked(loadSpells).mockReturnValue(mockSpells as any);
  });

  it('only shows spells up to the highest castable level', () => {
    render(
      <StepSpells
        character={character}
        levelUpData={levelUpData}
        choices={baseChoices}
        updateChoices={noop}
        onNext={noop}
        onPrev={noop}
      />
    );

    expect(screen.getByText('Burning Hands')).toBeInTheDocument();
    expect(screen.getByText('Scorching Ray')).toBeInTheDocument();
    expect(screen.queryByText('Ice Storm')).not.toBeInTheDocument();
    expect(screen.queryByText('Cone of Cold')).not.toBeInTheDocument();
  });

  it('handles bard zero-based slot arrays by normalizing to cantrip placeholder', () => {
    const bardCharacter = {
      ...character,
      class: 'bard',
    } as Character;

    render(
      <StepSpells
        character={bardCharacter}
        levelUpData={{ ...levelUpData, toLevel: 2 }}
        choices={baseChoices}
        updateChoices={noop}
        onNext={noop}
        onPrev={noop}
      />
    );

    expect(screen.getByText('Burning Hands')).toBeInTheDocument();
    expect(screen.queryByText('Scorching Ray')).not.toBeInTheDocument();
  });
});
