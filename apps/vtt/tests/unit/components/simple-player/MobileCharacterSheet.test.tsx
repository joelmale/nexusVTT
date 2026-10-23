import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Character, Weapon } from '@nexus/character-contracts';
import {
  MobileCharacterSheet,
  type MobileCharacterSheetProps,
} from '@/components/simple-player/MobileCharacterSheet';

function character(overrides: Partial<Character> = {}): Character {
  return {
    id: 'c1',
    name: 'Aria',
    level: 3,
    hitPoints: 20,
    proficiencyBonus: 2,
    abilities: {
      STR: { score: 16, modifier: 3 },
      DEX: { score: 14, modifier: 2 },
      CON: { score: 12, modifier: 1 },
      INT: { score: 10, modifier: 0 },
      WIS: { score: 8, modifier: -1 },
      CHA: { score: 10, modifier: 0 },
    },
    skills: {
      Stealth: { value: 4, proficient: true },
      Arcana: { value: 0, proficient: false },
      Perception: { value: 3, proficient: true, expertise: true },
    },
    savingThrowProficiencies: {
      STR: true,
      DEX: false,
      CON: true,
      INT: false,
      WIS: false,
      CHA: false,
    },
    inventory: [
      { equipmentSlug: 'longsword', equipped: true, quantity: 1 },
      { equipmentSlug: 'healing-potion', quantity: 2 },
    ],
    currency: { cp: 5, sp: 3, gp: 12, pp: 0 },
    featuresAndTraits: {
      classFeatures: ['Second Wind'],
      racialTraits: ['Darkvision'],
    },
    spellcasting: {
      ability: 'INT',
      spellSaveDC: 13,
      spellAttackBonus: 5,
      cantripsKnown: [],
      spellSlots: [],
      usedSpellSlots: [],
      spellcastingType: 'known',
    },
    ...overrides,
  } as Character;
}

const weapons: Weapon[] = [
  {
    id: 'longsword',
    name: 'Longsword',
    type: 'martial',
    category: 'melee',
    damage: '1d8',
    properties: [],
  },
];

function props(
  overrides: Partial<MobileCharacterSheetProps> = {},
): MobileCharacterSheetProps {
  return {
    character: character(),
    weapons,
    isMyTurn: false,
    onRoll: vi.fn(),
    onDeathSave: vi.fn().mockResolvedValue(undefined),
    onSelectCharacter: vi.fn(),
    ...overrides,
  };
}

describe('MobileCharacterSheet', () => {
  it('asks a player without a character to pick one', () => {
    const p = props({ character: undefined });
    render(<MobileCharacterSheet {...p} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Select or Create Your Character' }),
    );
    expect(p.onSelectCharacter).toHaveBeenCalled();
  });

  it('rolls attack and damage, honouring the roll mode', () => {
    const p = props();
    render(<MobileCharacterSheet {...p} />);
    expect(screen.getByText('+5 to hit · 1d8+3 damage')).toBeInTheDocument();
    expect(screen.getByText('Spell save DC 13')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Advantage' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Roll attack with Longsword' }),
    );
    expect(p.onRoll).toHaveBeenLastCalledWith(
      '1d20+5',
      'advantage',
      'Longsword attack',
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Roll damage with Longsword' }),
    );
    expect(p.onRoll).toHaveBeenLastCalledWith(
      '1d8+3',
      'none',
      'Longsword damage',
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Disadvantage' }));
    fireEvent.click(screen.getByRole('button', { name: /Initiative/ }));
    expect(p.onRoll).toHaveBeenLastCalledWith(
      '1d20+2',
      'disadvantage',
      'Initiative',
    );
  });

  it('rolls checks, saves and skills', () => {
    const p = props();
    render(<MobileCharacterSheet {...p} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Skills & Saves' }));

    fireEvent.click(screen.getByRole('button', { name: 'STR save +5' }));
    expect(p.onRoll).toHaveBeenLastCalledWith('1d20+5', 'none', 'STR save');
    fireEvent.click(screen.getByRole('button', { name: 'WIS check -1' }));
    expect(p.onRoll).toHaveBeenLastCalledWith('1d20-1', 'none', 'WIS check');
    fireEvent.click(screen.getByRole('button', { name: 'Stealth +4' }));
    expect(p.onRoll).toHaveBeenLastCalledWith('1d20+4', 'none', 'Stealth');
    fireEvent.click(screen.getByRole('button', { name: 'Arcana +0' }));
    expect(p.onRoll).toHaveBeenLastCalledWith('1d20', 'none', 'Arcana');
    expect(screen.getByLabelText('Expertise')).toBeInTheDocument();
  });

  it('shows gear, coins and features', () => {
    render(<MobileCharacterSheet {...props()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Gear & Traits' }));
    expect(screen.getByText('Healing Potion ×2')).toBeInTheDocument();
    expect(screen.getByText('12 GP · 3 SP · 5 CP')).toBeInTheDocument();
    expect(screen.getByText('Darkvision')).toBeInTheDocument();
  });

  it('handles a sparse character', () => {
    render(
      <MobileCharacterSheet
        {...props({
          character: character({
            inventory: undefined,
            currency: undefined,
            featuresAndTraits: undefined,
            spellcasting: undefined,
            skills: undefined as unknown as Character['skills'],
          }),
        })}
      />,
    );
    expect(screen.getByText('No equipped weapons.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Skills & Saves' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Gear & Traits' }));
    expect(screen.getByText('Nothing carried.')).toBeInTheDocument();
  });

  it('tracks the action economy and resets it on a new turn', () => {
    const p = props();
    const { rerender } = render(<MobileCharacterSheet {...p} />);
    const action = screen.getByRole('checkbox', { name: 'Action' });
    fireEvent.click(action);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Reaction' }));
    expect(action).toBeChecked();

    rerender(<MobileCharacterSheet {...p} isMyTurn />);
    expect(screen.getByRole('checkbox', { name: 'Action' })).not.toBeChecked();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Bonus Action' }));
    rerender(<MobileCharacterSheet {...p} isMyTurn={false} />);
    expect(
      screen.getByRole('checkbox', { name: 'Bonus Action' }),
    ).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Reset Turn' }));
    expect(
      screen.getByRole('checkbox', { name: 'Bonus Action' }),
    ).not.toBeChecked();
  });

  it('offers death saves at 0 HP', async () => {
    const p = props({
      character: character({
        hitPoints: 0,
        deathSaves: { successes: 1, failures: 2 },
      }),
    });
    render(<MobileCharacterSheet {...p} />);
    expect(
      screen.getByText('Successes 1/3 · Failures 2/3'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Roll Death Save' }));
    expect(p.onRoll).toHaveBeenCalledWith('1d20', 'none', 'Death save');

    fireEvent.click(screen.getByRole('button', { name: 'Mark Failure' }));
    expect(p.onDeathSave).toHaveBeenCalledWith('failure');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Mark Success' }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mark Success' }));
    expect(p.onDeathSave).toHaveBeenCalledWith('success');
  });

  it('defaults missing death saves to zero', () => {
    render(
      <MobileCharacterSheet
        {...props({ character: character({ hitPoints: 0 }) })}
      />,
    );
    expect(
      screen.getByText('Successes 0/3 · Failures 0/3'),
    ).toBeInTheDocument();
  });
});
