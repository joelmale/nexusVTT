/**
 * The creator's completion handshake: exactly one character per submission,
 * host failures surfaced without losing the player's work, and cancellation
 * blocked while a save is in flight.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  useCreationSubmission,
  type CharacterCreationData,
  type CharacterCreationResult,
} from '@nexus/character-creator';

const creationData = {
  name: 'Test Subject',
  edition: '2014',
} as unknown as CharacterCreationData;

const builtCharacter = {
  id: 'built-1',
  name: 'Test Subject',
} as unknown as CharacterCreationResult['character'];

const buildCharacter = vi.fn(async () => ({ character: builtCharacter }));

/** Minimal harness that drives the hook the way the final wizard step does. */
const Harness: React.FC<{
  onComplete: (result: CharacterCreationResult) => void | Promise<void>;
  onCancel?: () => void;
}> = ({ onComplete, onCancel = () => undefined }) => {
  const { submit, isSubmitting, isSubmittingRef, error } =
    useCreationSubmission({
      onComplete,
      edition: '2014',
      buildCharacter,
    });

  return (
    <div>
      <button
        onClick={() => submit(creationData)}
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? 'Saving…' : 'Create Character'}
      </button>
      {/* Mirrors the wizard's cancel guard: the ref is read in the handler. */}
      <button
        onClick={() => {
          if (isSubmittingRef.current) return;
          onCancel();
        }}
      >
        Cancel
      </button>
      {error && <div role="alert">{error}</div>}
    </div>
  );
};

describe('useCreationSubmission', () => {
  it('hands a calculated character to the host exactly once', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);

    await user.click(screen.getByRole('button', { name: /create character/i }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    const result = onComplete.mock.calls[0][0] as CharacterCreationResult;
    expect(result.character).toBe(builtCharacter);
    expect(result.creationData).toBe(creationData);
    expect(result.edition).toBe('2014');
    expect(result.createdAt).toBeTruthy();
  });

  it('prevents duplicate creation from rapid repeat clicks', async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    const onComplete = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const onCancel = vi.fn();
    render(<Harness onComplete={onComplete} onCancel={onCancel} />);

    const button = screen.getByRole('button', { name: /create character/i });
    const cancel = screen.getByRole('button', { name: /cancel/i });
    await user.click(button);

    // The button is disabled and reports busy while the host saves.
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute('aria-busy', 'true');

    // Cancellation is refused while a save is in flight.
    await user.click(cancel);
    expect(onCancel).not.toHaveBeenCalled();

    // Even a programmatic second submission is refused.
    button.click();

    expect(onComplete).toHaveBeenCalledTimes(1);

    release();
    await waitFor(() => expect(button).toBeEnabled());

    // Cancellation works again once the save has settled.
    await user.click(cancel);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('surfaces a host save failure and allows a retry', async () => {
    const user = userEvent.setup();
    const onComplete = vi
      .fn()
      .mockRejectedValueOnce(new Error('Database unavailable'))
      .mockResolvedValueOnce(undefined);

    render(<Harness onComplete={onComplete} />);
    const button = screen.getByRole('button', { name: /create character/i });

    await user.click(button);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Database unavailable');
    // The wizard stays usable — the player retries without re-entering data.
    await waitFor(() => expect(button).toBeEnabled());

    await user.click(button);
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('reports a generic message for a non-Error rejection', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn().mockRejectedValue('kaboom');

    render(<Harness onComplete={onComplete} />);
    await user.click(screen.getByRole('button', { name: /create character/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /unexpected error occurred/i,
    );
  });

  it('surfaces a failure to calculate the character', async () => {
    const user = userEvent.setup();
    buildCharacter.mockRejectedValueOnce(
      new Error('Character creation missing required data'),
    );

    render(<Harness onComplete={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /create character/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Character creation missing required data',
    );
  });
});
