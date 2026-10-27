import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { REFERENCE_BUILDS } from '@nexus/character-creator/tests/fixtures/referenceBuilds';
import { calculateCharacterStats } from '@nexus/character-creator/utils/characterCreationUtils';
import { AttacksAndActions } from './AttacksAndActions';

describe('Forge limited resource actions', () => {
  it('persists an explicit correction for an unrecorded imported balance', async () => {
    const character = calculateCharacterStats(
      REFERENCE_BUILDS.F24.creationData,
    );
    character.resources!.find(
      (entry) => entry.id === 'second-wind',
    )!.currentUses = undefined;
    const onUpdate = vi.fn().mockResolvedValue(true);
    render(
      <AttacksAndActions
        character={character}
        onUpdateCharacter={onUpdate}
        onDiceRoll={vi.fn()}
        setRollResult={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByText('Record Second Wind recovery or correction'),
    );
    fireEvent.change(
      screen.getByRole('spinbutton', { name: 'Remaining Second Wind uses' }),
      { target: { value: '1' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Record Second Wind' }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledOnce());
    expect(
      onUpdate.mock.calls[0][0].resources.find(
        (entry: { id: string }) => entry.id === 'second-wind',
      ),
    ).toMatchObject({ currentUses: 1, cooldown: { remaining: 0 } });
    expect(
      character.resources!.find((entry) => entry.id === 'second-wind')!
        .currentUses,
    ).toBeUndefined();
  });
  it.each(['F14', 'F24'])(
    'spends %s Second Wind before rolling healing and preserves the original character',
    async (reference) => {
      const character = calculateCharacterStats(
        REFERENCE_BUILDS[reference].creationData,
      );
      const onUpdate = vi.fn().mockResolvedValue(true);
      const onDiceRoll = vi.fn();
      render(
        <AttacksAndActions
          character={character}
          onUpdateCharacter={onUpdate}
          onDiceRoll={onDiceRoll}
          setRollResult={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Heal' }));
      await waitFor(() =>
        expect(onDiceRoll).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({
            description: 'Second Wind Healing',
            notation: '1d10+1',
          }),
        ),
      );
      expect(
        onUpdate.mock.calls[0][0].resources.find(
          (resource: { id: string }) => resource.id === 'second-wind',
        ).currentUses,
      ).toBe(reference === 'F14' ? 0 : 1);
      expect(
        character.resources!.find((resource) => resource.id === 'second-wind')!
          .currentUses,
      ).toBe(reference === 'F14' ? 1 : 2);
    },
  );

  it('deduplicates pending healing clicks and does not roll if saving fails', async () => {
    let finish!: (saved: boolean) => void;
    const onUpdate = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    const onDiceRoll = vi.fn();
    render(
      <AttacksAndActions
        character={calculateCharacterStats(REFERENCE_BUILDS.F24.creationData)}
        onUpdateCharacter={onUpdate}
        onDiceRoll={onDiceRoll}
        setRollResult={vi.fn()}
      />,
    );
    const heal = screen.getByRole('button', { name: 'Heal' });
    fireEvent.click(heal);
    expect(heal).toBeDisabled();
    fireEvent.click(heal);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onDiceRoll).not.toHaveBeenCalled();
    finish(false);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('not confirmed'),
    );
    expect(onDiceRoll).not.toHaveBeenCalled();
    onUpdate.mockResolvedValueOnce(true);
    fireEvent.click(heal);
    await waitFor(() => expect(onDiceRoll).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('disables healing for depleted or unrecorded uses', () => {
    const character = calculateCharacterStats(
      REFERENCE_BUILDS.F24.creationData,
    );
    const wind = character.resources!.find(
      (resource) => resource.id === 'second-wind',
    )!;
    wind.currentUses = 0;
    const props = {
      onUpdateCharacter: vi.fn(),
      onDiceRoll: vi.fn(),
      setRollResult: vi.fn(),
    };
    const { rerender } = render(
      <AttacksAndActions character={character} {...props} />,
    );
    expect(screen.getByRole('button', { name: 'Heal' })).toBeDisabled();
    wind.currentUses = undefined;
    rerender(<AttacksAndActions character={{ ...character }} {...props} />);
    expect(screen.getByRole('button', { name: 'Heal' })).toBeDisabled();
  });
});
