import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { calculatePreparationLimit } from '@nexus/rules-5e';
import { REFERENCE_BUILDS } from './fixtures/referenceBuilds';
import type { CharacterCreationData } from '../types/dnd';
import { Step4Spells } from '../components/CharacterCreationWizard/steps/Step4Spells';
import { Step8Traits } from '../components/CharacterCreationWizard/steps/Step8Traits';
import { Step0Level } from '../components/CharacterCreationWizard/steps/Step0Level';
import {
  getCantripsByClass,
  getLeveledSpellsByClass,
} from '../services/dataService';
import cantripsData from '../data/cantrips.json';
import { calculateCharacterStats } from '../utils/characterCreationUtils';

const base = REFERENCE_BUILDS.W24.creationData as CharacterCreationData;

function props(data: CharacterCreationData) {
  return {
    data,
    updateData: vi.fn(),
    nextStep: vi.fn(),
    prevStep: vi.fn(),
    getNextStepLabel: () => 'Next',
    stepIndex: 0,
  };
}

describe('level 5 Wizard spell step', () => {
  const cantrips = getCantripsByClass('wizard', '2024')
    .slice(0, cantripsData.wizard['5'])
    .map((s) => s.slug);
  const pool = [1, 2, 3].flatMap((level) =>
    getLeveledSpellsByClass('wizard', level, '2024'),
  );
  const spellbook = pool.slice(0, 14).map((s) => s.slug);
  const level5 = { ...base, level: 5 } as CharacterCreationData;
  const prep = calculatePreparationLimit(
    'wizard',
    5,
    calculateCharacterStats(level5).abilities.INT.modifier,
    '2024',
  );

  const complete = (spells: string[]) =>
    ({
      ...level5,
      spellSelection: {
        ...level5.spellSelection,
        selectedCantrips: cantrips,
        spellbook: spells,
        dailyPrepared: spells.slice(0, prep),
      },
    }) as CharacterCreationData;

  it('asks for 14 spellbook spells and enables Next once they are chosen', () => {
    render(<Step4Spells {...props(complete(spellbook))} />);
    expect(screen.getByText(/Spellbook \(14 \/\s*14 selected\)/)).toBeTruthy();
    const next = screen.getByRole('button', { name: /^Next/ }) as HTMLButtonElement;
    expect(next.disabled).toBe(false);
  });

  it('keeps Next disabled with only the level 1 amount of 6', () => {
    render(<Step4Spells {...props(complete(spellbook.slice(0, 6)))} />);
    expect(screen.getByText(/Add 8 more spells to spellbook/)).toBeTruthy();
    const next = screen.getByRole('button', { name: /^Next/ }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
  });
});

describe('Warlock spell step after switching from Wizard', () => {
  it('never reports a negative number of cantrips to pick', () => {
    const data = {
      ...base,
      classSlug: 'warlock',
      level: 5,
      spellSelection: {
        selectedCantrips: ['fire-bolt', 'mage-hand', 'ray-of-frost', 'eldritch-blast'],
        spellbook: [],
      },
    } as unknown as CharacterCreationData;
    const p = props(data);
    render(<Step4Spells {...p} />);
    expect(screen.queryByText(/Pick -/)).toBeNull();
    const updates = p.updateData.mock.calls;
    const pruned = updates[updates.length - 1]?.[0]?.spellSelection?.selectedCantrips;
    expect(pruned).not.toContain('fire-bolt');
  });
});

describe('level 5 final step', () => {
  it('shows the level 5 HP total, not the 1st-level figure', () => {
    const data = {
      ...base,
      level: 5,
      highLevelSetup: { useAverage: true, totalHP: 0 },
    } as unknown as CharacterCreationData;
    render(<Step8Traits {...props(data)} onSubmit={vi.fn()} isSubmitting={false} submitLabel="Finish" />);
    expect(screen.queryByText(/Standard for 1st level/)).toBeNull();
    const hp = calculateCharacterStats(data).maxHitPoints;
    expect(screen.getByText(`${hp} HP`)).toBeTruthy();
  });
});

describe('level tile', () => {
  it('does not promise Extra Attack to every class at level 5', () => {
    render(<Step0Level {...props({ ...base, level: 5 } as CharacterCreationData)} />);
    expect(screen.queryAllByText(/make two attacks per turn/).length).toBe(0);
  });
});
