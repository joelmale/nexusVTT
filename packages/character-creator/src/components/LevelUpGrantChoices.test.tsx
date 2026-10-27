import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { REFERENCE_BUILDS } from '../tests/fixtures/referenceBuilds';
import { calculateCharacterStats } from '../utils/characterCreationUtils';
import type { LevelUpChoices } from '../types/dnd';
import { LevelUpClassCastingChoices } from './LevelUpClassCastingChoices';
import { LevelUpExpertiseChoices } from './LevelUpExpertiseChoices';

describe('required level-up grant steps', () => {
  it('requires two distinct signature selections from the book and retains them while editing', () => {
    const character = calculateCharacterStats({
      ...REFERENCE_BUILDS.W24.creationData,
      level: 19,
      spellSelection: {
        ...REFERENCE_BUILDS.W24.creationData.spellSelection,
        spellbook: ['fireball', 'fly'],
      },
    });
    const onNext = vi.fn();
    function Harness() {
      const [choices, setChoices] = useState<LevelUpChoices>({});
      return (
        <LevelUpClassCastingChoices
          character={character}
          choices={choices}
          onChange={(update) =>
            setChoices((prior) => ({ ...prior, ...update }))
          }
          onNext={onNext}
          onPrev={vi.fn()}
        />
      );
    }
    render(<Harness />);
    const submit = screen.getByRole('button', { name: 'Continue' });
    expect(submit).toBeDisabled();
    const first = screen.getByRole('combobox', {
      name: 'Level 3 spell for signature-spell-1',
    });
    const second = screen.getByRole('combobox', {
      name: 'Level 3 spell for signature-spell-2',
    });
    fireEvent.change(first, { target: { value: 'fireball' } });
    fireEvent.change(second, { target: { value: 'fireball' } });
    expect(submit).toBeDisabled();
    fireEvent.change(second, { target: { value: 'fly' } });
    expect(first).toHaveValue('fireball');
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    expect(onNext).toHaveBeenCalledOnce();
    expect(screen.queryByText('Class choices')).not.toBeInTheDocument();
  });
  it('requires Scholar to select an eligible knowledge proficiency', () => {
    const character = calculateCharacterStats(
      REFERENCE_BUILDS.W24.creationData,
    );
    character.skills.Arcana.proficient = true;
    character.skills.Stealth.proficient = true;
    const onNext = vi.fn();
    function Harness() {
      const [choices, setChoices] = useState<LevelUpChoices>({});
      return (
        <LevelUpExpertiseChoices
          character={character}
          choices={choices}
          onChange={(update) =>
            setChoices((prior) => ({ ...prior, ...update }))
          }
          onNext={onNext}
          onPrev={vi.fn()}
        />
      );
    }
    render(<Harness />);
    expect(
      screen.queryByRole('checkbox', { name: 'Stealth' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Arcana' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Arcana' }));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Arcana' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onNext).toHaveBeenCalledOnce();
  });
});
