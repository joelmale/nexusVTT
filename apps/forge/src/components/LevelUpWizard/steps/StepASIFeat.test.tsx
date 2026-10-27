import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StepASIFeat } from './StepASIFeat';
import type { LevelUpData } from '@nexus/character-creator/data/classProgression';
import type { Character } from '../../../types/dnd';

vi.mock('../../../services/dataService', () => ({
  loadFeats: () => [],
  resolveSpeciesSlug: () => 'human',
}));
vi.mock('../../../utils/featUtils', () => ({
  getAvailableFeatsForCharacter: () => [
    { slug: 'fey-touched', name: 'Fey Touched', description: 'Fey magic.' },
    { slug: 'lucky', name: 'Lucky', description: 'Luck points.' },
  ],
}));

const abilities = Object.fromEntries(
  ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map((name) => [
    name,
    { score: 12, modifier: 1 },
  ]),
);
const character = {
  class: 'Fighter',
  species: 'Human',
  edition: '2024',
  level: 3,
  abilities,
} as unknown as Character;
const levelUpData = { fromLevel: 3, toLevel: 4 } as LevelUpData;

const setup = () => {
  const updateChoices = vi.fn();
  render(
    <StepASIFeat
      character={character}
      levelUpData={levelUpData}
      choices={{}}
      updateChoices={updateChoices}
      onNext={vi.fn()}
      onPrev={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByText('Choose a Feat'));
  return updateChoices;
};

describe('StepASIFeat feat spell choices', () => {
  it('requires a legal Fey Touched spell before continuing and records it', () => {
    const updateChoices = setup();
    fireEvent.click(screen.getByText('Fey Touched'));
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect((screen.getByText('Continue') as HTMLButtonElement).disabled).toBe(
      true,
    );

    const options = [...select.options].map((option) => option.value);
    expect(options).toContain('charm-person');
    expect(options).not.toContain('shield');

    fireEvent.change(select, { target: { value: 'charm-person' } });
    expect((screen.getByText('Continue') as HTMLButtonElement).disabled).toBe(
      false,
    );
    fireEvent.click(screen.getByText('Continue'));
    expect(updateChoices).toHaveBeenCalledWith(
      expect.objectContaining({
        featChosen: 'fey-touched',
        featChoices: { 'fey-touched': { spell: 'charm-person' } },
      }),
    );
  });

  it('shows no spell selects for a feat without spell choices', () => {
    const updateChoices = setup();
    fireEvent.click(screen.getByText('Lucky'));
    expect(screen.queryByRole('combobox')).toBeNull();
    fireEvent.click(screen.getByText('Continue'));
    expect(updateChoices).toHaveBeenCalledWith(
      expect.objectContaining({
        featChosen: 'lucky',
        featChoices: undefined,
      }),
    );
  });

  it('clears an earlier spell pick when the feat changes', () => {
    setup();
    fireEvent.click(screen.getByText('Fey Touched'));
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'charm-person' },
    });
    fireEvent.click(screen.getByText('Lucky'));
    fireEvent.click(screen.getByText('Fey Touched'));
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('');
  });
});
