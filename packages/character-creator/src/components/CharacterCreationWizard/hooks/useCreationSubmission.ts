import { useCallback, useRef, useState } from 'react';
import type { CharacterCreationCompleteHandler } from '../../../api/types';
import type { CharacterCreationData, Edition } from '../../../types/dnd';

interface UseCreationSubmissionOptions {
  onComplete: CharacterCreationCompleteHandler;
  /** Fallback edition when the wizard data has none. */
  edition?: Edition;
  /** Injectable for tests; defaults to the real calculator and UUID source. */
  buildCharacter?: (data: CharacterCreationData) => Promise<{
    character: import('../../../types/dnd').Character;
  }>;
}

/**
 * Owns the hand-off from the wizard to the host application.
 *
 * Responsibilities:
 * - calculate the finished character exactly once per submission;
 * - refuse concurrent or repeated submissions, so a double click or a slow
 *   host save can never create two characters;
 * - surface a host-side failure as wizard-visible error text while leaving the
 *   wizard open with the player's answers intact, so they can retry.
 */
export const useCreationSubmission = ({
  onComplete,
  edition,
  buildCharacter,
}: UseCreationSubmissionOptions) => {
  // A ref, not state: it is read synchronously so a second call in the same
  // tick cannot slip past before React has re-rendered.
  const inFlight = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultBuild = useCallback(async (data: CharacterCreationData) => {
    const { calculateCharacterStats } = await import(
      '../../../utils/characterCreationUtils'
    );
    const { generateUUID } = await import('../../../services/diceService');
    return {
      character: { ...calculateCharacterStats(data), id: generateUUID() },
    };
  }, []);

  const submit = useCallback(
    async (data: CharacterCreationData) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setIsSubmitting(true);

      try {
        setError(null);
        const { character } = await (buildCharacter ?? defaultBuild)(data);

        await onComplete({
          character,
          creationData: data,
          edition: data.edition || edition || '2014',
          createdAt: new Date().toISOString(),
        });
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'An unexpected error occurred while creating the character.',
        );
      } finally {
        inFlight.current = false;
        setIsSubmitting(false);
      }
    },
    [buildCharacter, defaultBuild, edition, onComplete],
  );

  /** True while a submission is in flight; used to block cancellation. */
  const isSubmittingRef = inFlight;

  return { submit, isSubmitting, isSubmittingRef, error, setError };
};
