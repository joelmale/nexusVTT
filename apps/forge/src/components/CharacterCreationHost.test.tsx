/**
 * Forge's host binding for the shared character creator.
 *
 * Forge keeps its local IndexedDB workflow: the shared creator hands back a
 * finished character and Forge writes it through `dbService`. These tests pin
 * that contract — a successful save, a failed save that keeps the wizard open,
 * and no duplicate writes from a repeated submission.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useCreationSubmission,
  type CharacterCreationData,
  type CharacterCreationResult,
} from '@nexus/character-creator';

const addCharacter = vi.fn();
vi.mock('../services/dbService', () => ({
  addCharacter: (...args: unknown[]) => addCharacter(...args),
}));

const creationData = {
  name: 'Forge Subject',
  edition: '2024',
} as unknown as CharacterCreationData;

const builtCharacter = {
  id: 'forge-char-1',
  name: 'Forge Subject',
} as unknown as CharacterCreationResult['character'];

/**
 * Mirrors `App.tsx`'s `handleCreatorComplete`: persist to IndexedDB, refresh
 * the character list, then close the wizard.
 */
const ForgeHost: React.FC<{
  loadCharacters: () => Promise<void>;
  onClosed: () => void;
}> = ({ loadCharacters, onClosed }) => {
  const { submit, isSubmitting, error } = useCreationSubmission({
    onComplete: async (result) => {
      const { addCharacter: add } = await import('../services/dbService');
      await add(result.character);
      await loadCharacters();
      onClosed();
    },
    edition: '2024',
    buildCharacter: async () => ({ character: builtCharacter }),
  });

  return (
    <div>
      <button onClick={() => submit(creationData)} disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Create Character'}
      </button>
      {error && <div role="alert">{error}</div>}
    </div>
  );
};

describe('Forge character creation host', () => {
  beforeEach(() => {
    addCharacter.mockReset();
    addCharacter.mockResolvedValue(undefined);
  });

  it('writes the created character to IndexedDB and closes the wizard', async () => {
    const user = userEvent.setup();
    const loadCharacters = vi.fn(async () => undefined);
    const onClosed = vi.fn();

    render(<ForgeHost loadCharacters={loadCharacters} onClosed={onClosed} />);
    await user.click(screen.getByRole('button'));

    await waitFor(() => expect(addCharacter).toHaveBeenCalledTimes(1));
    expect(addCharacter).toHaveBeenCalledWith(builtCharacter);
    expect(loadCharacters).toHaveBeenCalledTimes(1);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('keeps the wizard open and shows the error when the write fails', async () => {
    const user = userEvent.setup();
    addCharacter.mockRejectedValueOnce(new Error('QuotaExceededError'));
    const onClosed = vi.fn();

    render(
      <ForgeHost loadCharacters={vi.fn(async () => undefined)} onClosed={onClosed} />,
    );
    await user.click(screen.getByRole('button'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'QuotaExceededError',
    );
    expect(onClosed).not.toHaveBeenCalled();
  });

  it('writes only once when the submit button is pressed repeatedly', async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    addCharacter.mockImplementation(
      () => new Promise<void>((resolve) => (release = resolve)),
    );

    render(
      <ForgeHost loadCharacters={vi.fn(async () => undefined)} onClosed={vi.fn()} />,
    );
    const button = screen.getByRole('button');

    await user.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    button.click();
    button.click();

    expect(addCharacter).toHaveBeenCalledTimes(1);

    release();
    await waitFor(() => expect(button).toBeEnabled());
  });
});
