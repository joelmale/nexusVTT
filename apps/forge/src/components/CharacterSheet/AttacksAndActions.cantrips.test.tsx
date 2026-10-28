import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { REFERENCE_BUILDS } from '@nexus/character-creator/tests/fixtures/referenceBuilds';
import { calculateCharacterStats } from '@nexus/character-creator/utils/characterCreationUtils';
import { AttacksAndActions } from './AttacksAndActions';

const warlock = (level: number, effects?: Record<string, unknown>) => {
  const character = calculateCharacterStats(REFERENCE_BUILDS.WL24.creationData);
  character.level = level;
  if (effects)
    character.classMechanics = {
      attacksPerAction: 1,
      criticalThreshold: 20,
      cantripEffects: effects,
    } as typeof character.classMechanics;
  return character;
};

const renderPanel = (character: ReturnType<typeof warlock>) => {
  const onDiceRoll = vi.fn();
  render(
    <AttacksAndActions
      character={character}
      onUpdateCharacter={vi.fn()}
      onDiceRoll={onDiceRoll}
      setRollResult={vi.fn()}
    />,
  );
  return onDiceRoll;
};

describe('Forge cantrip actions apply saved invocation effects', () => {
  it('rolls one attack and damage roll per Eldritch Blast beam with Agonizing Blast', () => {
    const character = warlock(5, {
      'eldritch-blast': {
        damageBonus: 3,
        rangeBonus: 150,
        pushFeet: 10,
        requiresHit: true,
        targetSizeLimit: 'Large',
      },
    });
    expect(character.spellcasting?.cantripsKnown).toContain('eldritch-blast');
    const onDiceRoll = renderPanel(character);

    // The action describes what the invocations changed.
    expect(screen.getByText(/1d10\+3 force/)).toBeTruthy();
    expect(screen.getByText(/2 beams/)).toBeTruthy();
    expect(screen.getByText(/270 ft/)).toBeTruthy(); // 120 + 30 x level 5
    expect(screen.getByText(/push 10 ft on a hit/)).toBeTruthy();

    fireEvent.click(screen.getAllByText('Roll Attack')[1]);
    expect(onDiceRoll).toHaveBeenCalledTimes(2);
    const rolls = onDiceRoll.mock.calls.map(([roll]) => roll);
    expect(rolls.map((roll) => roll.label)).toEqual([
      'Eldritch Blast beam 1/2',
      'Eldritch Blast beam 2/2',
    ]);
    for (const roll of rolls)
      expect(roll).toMatchObject({
        type: 'attack',
        notation: `1d20+${character.spellcasting!.spellAttackBonus}`,
        damageNotation: '1d10+3',
        damageType: 'force',
      });
    expect(new Set(rolls.map((roll) => roll.id)).size).toBe(2);
  });

  it('makes a single beam at level four and no bonus without the invocation', () => {
    const onDiceRoll = renderPanel(warlock(4));
    expect(screen.queryByText(/beams/)).toBeNull();
    fireEvent.click(screen.getAllByText('Roll Attack')[1]);
    expect(onDiceRoll).toHaveBeenCalledOnce();
    expect(onDiceRoll.mock.calls[0][0]).toMatchObject({
      label: 'Eldritch Blast Attack',
      damageNotation: '1d10',
    });
  });

  it('keeps the generic spell attack roll', () => {
    const onDiceRoll = renderPanel(warlock(1));
    fireEvent.click(screen.getAllByText('Roll Attack')[0]);
    expect(onDiceRoll.mock.calls[0][0]).toMatchObject({
      label: 'Spell Attack',
    });
  });
});
