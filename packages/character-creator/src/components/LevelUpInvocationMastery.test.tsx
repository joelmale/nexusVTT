import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';
import { calculateCharacterStats } from '../utils/characterCreationUtils';
import {
  applyLevelUp,
  calculateLevelUpData,
  getLevelUpSteps,
} from '../utils/levelUpUtils';
import type { Character, LevelUpChoices } from '../types/dnd';
import { LevelUpInvocationChoices } from './LevelUpInvocationChoices';
import { LevelUpWeaponMasteryChoices } from './LevelUpWeaponMasteryChoices';

const characterAt = (id: string, level: number): Character =>
  calculateCharacterStats({ ...REFERENCE_BUILDS[id].creationData, level });
const stepsAt = (id: string, level: number) =>
  getLevelUpSteps(calculateLevelUpData(characterAt(id, level))!);

describe('which levels offer the new steps', () => {
  // SRD 5.2.1 Warlock invocation counts: 1, 3, 3, 3, 5, 5, 6, 6, 7, ...
  it.each([
    [1, true], // 1 -> 2: one to three
    [2, false],
    [3, false],
    [4, true], // 4 -> 5: three to five
    [5, false],
    [6, true], // 6 -> 7: five to six
    [8, true], // 8 -> 9: six to seven
    [11, true], // 11 -> 12: seven to eight
  ])('Warlock level %i -> next offers invocations: %s', (level, offered) => {
    expect(stepsAt('WL24', level).includes('invocations')).toBe(offered);
  });

  it.each([
    ['F24', 3, true], // three masteries become four at level 4
    ['F24', 4, false],
    ['F24', 9, true], // four become five at level 10
    ['B24', 3, true], // two become three at level 4
    ['B24', 4, false],
    ['R24', 3, false], // Rangers stay at two
  ])('%s level %i -> next offers weapon mastery: %s', (id, level, offered) => {
    expect(stepsAt(id, level).includes('weapon-mastery')).toBe(offered);
  });

  it('never offers either step under the 2014 rules or to other classes', () => {
    for (const [id, level] of [
      ['WL14', 1],
      ['WL14', 4],
      ['F14', 3],
      ['W24', 3],
    ] as const) {
      const steps = stepsAt(id, level);
      expect(steps).not.toContain('invocations');
      expect(steps).not.toContain('weapon-mastery');
    }
  });

  it('places the steps before the features summary and confirmation', () => {
    const steps = stepsAt('WL24', 1);
    expect(steps.indexOf('invocations')).toBeGreaterThan(-1);
    expect(steps.indexOf('invocations')).toBeLessThan(steps.indexOf('confirm'));
  });
});

function InvocationHarness({
  character,
  toLevel,
  onChoices,
}: {
  character: Character;
  toLevel: number;
  onChoices: (choices: LevelUpChoices) => void;
}) {
  const [choices, setChoices] = useState<LevelUpChoices>({});
  return (
    <LevelUpInvocationChoices
      character={character}
      toLevel={toLevel}
      choices={choices}
      onChange={(next) => {
        const merged = { ...choices, ...next };
        setChoices(merged);
        onChoices(merged);
      }}
      onNext={() => undefined}
      onPrev={() => undefined}
    />
  );
}

describe('LevelUpInvocationChoices', () => {
  it('walks a Warlock from one invocation to the three allowed at level 2', () => {
    const character = characterAt('WL24', 1);
    let latest: LevelUpChoices = {};
    render(
      <InvocationHarness
        character={character}
        toLevel={2}
        onChoices={(choices) => (latest = choices)}
      />,
    );
    const next = screen.getByRole('button', { name: 'Continue' });
    // Eldritch Mind is already known, so two more picks are still needed.
    expect((next as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toMatch(
      /Choose 3 Eldritch Invocations at Warlock level 2/,
    );

    fireEvent.click(screen.getByLabelText('Armor of Shadows'));
    fireEvent.click(screen.getByLabelText('Agonizing Blast'));
    // Agonizing Blast needs a target before the selection is complete.
    expect((next as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toMatch(/eligible targets/);

    fireEvent.click(screen.getByLabelText('Eldritch Blast'));
    expect((next as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(latest.eldritchInvocationsChosen).toEqual([
      'eldritch-mind',
      'armor-of-shadows',
      'agonizing-blast',
    ]);
    expect(latest.featChoices?.['invocation:agonizing-blast']).toEqual({
      targets: ['eldritch-blast'],
    });

    // What the UI collected is exactly what applyLevelUp accepts.
    const data = calculateLevelUpData(character)!;
    const updated = applyLevelUp(character, data, {
      ...latest,
      hpGained: data.averageHpGain,
      spellsLearned: ['hellish-rebuke'],
    });
    expect(updated.eldritchInvocations).toEqual(
      latest.eldritchInvocationsChosen,
    );
  });

  it('disables invocations above the Warlock level', () => {
    render(
      <InvocationHarness
        character={characterAt('WL24', 1)}
        toLevel={2}
        onChoices={() => undefined}
      />,
    );
    // Higher-level invocations are not offered as choices; they are listed collapsed with the reason.
    expect(screen.queryByLabelText(/Ascendant Step/)).toBeNull();
    const unlocks = screen
      .getByText(/Unlocks at higher levels/)
      .closest('details')!;
    expect(unlocks).not.toHaveAttribute('open');
    expect(unlocks.textContent).toMatch(/Ascendant Step/);
    expect(unlocks.textContent).toMatch(/requires level 5/);
  });

  it('lets a deselected invocation be replaced and clears its targets', () => {
    const character = characterAt('WL24', 1);
    let latest: LevelUpChoices = {};
    render(
      <InvocationHarness
        character={character}
        toLevel={2}
        onChoices={(choices) => (latest = choices)}
      />,
    );
    fireEvent.click(screen.getByLabelText('Eldritch Mind')); // drop it
    expect(latest.eldritchInvocationsChosen).toEqual([]);
    fireEvent.click(screen.getByLabelText('Devil’s Sight'));
    expect(latest.eldritchInvocationsChosen).toEqual(['devils-sight']);
  });
});

function MasteryHarness({
  character,
  toLevel,
  onChoices,
}: {
  character: Character;
  toLevel: number;
  onChoices: (choices: LevelUpChoices) => void;
}) {
  const [choices, setChoices] = useState<LevelUpChoices>({});
  return (
    <LevelUpWeaponMasteryChoices
      character={character}
      toLevel={toLevel}
      choices={choices}
      onChange={(next) => {
        const merged = { ...choices, ...next };
        setChoices(merged);
        onChoices(merged);
      }}
      onNext={() => undefined}
      onPrev={() => undefined}
    />
  );
}

describe('LevelUpWeaponMasteryChoices', () => {
  it('grows a Fighter from three masteries to the four allowed at level 4', () => {
    const character = characterAt('F24', 3);
    let latest: LevelUpChoices = {};
    render(
      <MasteryHarness
        character={character}
        toLevel={4}
        onChoices={(choices) => (latest = choices)}
      />,
    );
    const next = screen.getByRole('button', { name: 'Continue' });
    expect(screen.getByRole('heading').textContent).toMatch(/Choose 4/);
    expect((next as HTMLButtonElement).disabled).toBe(true);
    // Existing picks arrive checked.
    for (const name of ['Greatsword', 'Flail', 'Javelin'])
      expect((screen.getByLabelText(name) as HTMLInputElement).checked).toBe(
        true,
      );

    fireEvent.click(screen.getByLabelText('Longsword'));
    expect((next as HTMLButtonElement).disabled).toBe(false);
    expect(latest.weaponMasteriesChosen).toEqual([
      'Greatsword',
      'Flail',
      'Javelin',
      'Longsword',
    ]);
    // Once full, other weapons cannot be added without swapping one out.
    expect((screen.getByLabelText('Rapier') as HTMLInputElement).disabled).toBe(
      true,
    );

    const data = calculateLevelUpData(character)!;
    const updated = applyLevelUp(character, data, {
      ...latest,
      hpGained: data.averageHpGain,
    });
    expect(updated.weaponMastery).toEqual(latest.weaponMasteriesChosen);
  });

  it('allows swapping an earlier weapon for another', () => {
    let latest: LevelUpChoices = {};
    render(
      <MasteryHarness
        character={characterAt('F24', 3)}
        toLevel={4}
        onChoices={(choices) => (latest = choices)}
      />,
    );
    fireEvent.click(screen.getByLabelText('Flail')); // drop
    fireEvent.click(screen.getByLabelText('Rapier'));
    fireEvent.click(screen.getByLabelText('Longsword'));
    expect(latest.weaponMasteriesChosen).toEqual([
      'Greatsword',
      'Javelin',
      'Rapier',
      'Longsword',
    ]);
  });
});
