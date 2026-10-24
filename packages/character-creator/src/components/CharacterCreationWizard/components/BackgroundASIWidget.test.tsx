import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BackgroundASIWidget } from './BackgroundASIWidget';
import type { CharacterCreationData } from '../../../types/dnd';

describe('BackgroundASIWidget', () => {
  const baseData = {
    backgroundAbilityChoices: {
      method: '2/1',
      bonuses: { STR: 2, CON: 1 },
    },
  } as unknown as CharacterCreationData;

  it('does not wipe existing bonuses on initial mount', () => {
    const updateDataMock = vi.fn();
    render(
      <BackgroundASIWidget
        availableOptions={['STR', 'DEX', 'CON']}
        data={baseData}
        updateData={updateDataMock}
      />
    );

    // Initial mount should NOT call updateData to reset bonuses to {}
    expect(updateDataMock).not.toHaveBeenCalledWith({
      backgroundAbilityChoices: { method: '2/1', bonuses: {} },
    });
  });

  it('resets bonuses when the player switches methods', () => {
    const updateDataMock = vi.fn();
    render(
      <BackgroundASIWidget
        availableOptions={['STR', 'DEX', 'CON']}
        data={baseData}
        updateData={updateDataMock}
      />
    );

    const buttonThreePlusOnes = screen.getByRole('button', { name: /\+1 \/ \+1 \/ \+1/i });
    fireEvent.click(buttonThreePlusOnes);

    expect(updateDataMock).toHaveBeenCalledWith({
      backgroundAbilityChoices: { method: '1/1/1', bonuses: {} },
    });
  });
});
