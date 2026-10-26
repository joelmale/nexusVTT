import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Step4Abilities } from '../components/CharacterCreationWizard/steps/Step4Abilities';
import { Step4Spells } from '../components/CharacterCreationWizard/steps/Step4Spells';
import { REFERENCE_BUILDS } from './fixtures/referenceBuilds';
import type { CharacterCreationData } from '../types/dnd';

describe('creator customization controls', () => {
  it('swaps two assigned standard array scores through the actual selector', () => {
    const changed = vi.fn();
    render(
      <Step4Abilities
        stepIndex={4}
        data={REFERENCE_BUILDS.F24.creationData}
        updateData={changed}
        nextStep={vi.fn()}
        prevStep={vi.fn()}
      />,
    );
    fireEvent.change(
      screen.getByRole('combobox', { name: 'DEX standard array score' }),
      { target: { value: '15' } },
    );
    expect(changed).toHaveBeenCalledWith(
      expect.objectContaining({
        abilities: { STR: 13, DEX: 15, CON: 14, INT: 8, WIS: 12, CHA: 10 },
      }),
    );
  });

  it('randomizes a real Wizard spellbook and matching preparations only on request', () => {
    let result: CharacterCreationData | undefined;
    function Spells() {
      const [data, setData] = useState(REFERENCE_BUILDS.W24.creationData);
      result = data;
      return (
        <Step4Spells
          stepIndex={8}
          data={data}
          updateData={(update) =>
            setData((current) => ({ ...current, ...update }))
          }
          nextStep={vi.fn()}
          prevStep={vi.fn()}
        />
      );
    }
    render(<Spells />);
    fireEvent.click(screen.getByRole('button', { name: /^Randomize$/ }));
    expect(result?.spellSelection.selectedCantrips).toHaveLength(3);
    expect(result?.spellSelection.spellbook).toHaveLength(6);
    expect(result?.spellSelection.dailyPrepared).toHaveLength(4);
    expect(
      result?.spellSelection.dailyPrepared?.every((spell) =>
        result?.spellSelection.spellbook?.includes(spell),
      ),
    ).toBe(true);
  });
});
