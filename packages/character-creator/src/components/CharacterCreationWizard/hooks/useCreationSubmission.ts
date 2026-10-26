import { useCallback, useRef, useState } from 'react';
import type {
  CharacterCreationCompleteHandler,
  CharacterCreationResult,
} from '../../../api/types';
import type { CharacterCreationData, Edition } from '../../../types/dnd';
import type { CreationDraft } from '../../../types/draft';
import { creationDataToDraft } from '../../../adapters/draftAdapter';
import {
  evaluateDraft,
  toCharacterCreationResult,
} from '../../../services/draftEvaluator';

interface UseCreationSubmissionOptions {
  onComplete: CharacterCreationCompleteHandler;
  /** Fallback edition when the wizard data has none. */
  edition?: Edition;
  draft?: CreationDraft;
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
  draft,
}: UseCreationSubmissionOptions) => {
  // A ref, not state: it is read synchronously so a second call in the same
  // tick cannot slip past before React has re-rendered.
  const inFlight = useRef(false);
  const completed = useRef(false);
  const attempt = useRef<CreationDraft | null>(null);
  const pendingResult = useRef<CharacterCreationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultBuild = useCallback(async (data: CharacterCreationData) => {
    const { calculateCharacterStats } =
      await import('../../../utils/characterCreationUtils');
    const { generateUUID } = await import('../../../services/diceService');
    return {
      character: { ...calculateCharacterStats(data), id: generateUUID() },
    };
  }, []);

  const submit = useCallback(
    async (data: CharacterCreationData) => {
      if (inFlight.current || completed.current) return;
      inFlight.current = true;
      setIsSubmitting(true);

      try {
        setError(null);
        if (pendingResult.current) {
          await onComplete(pendingResult.current);
          completed.current = true;
          return;
        }
        const identity = draft || attempt.current;
        const current = creationDataToDraft(
          data,
          identity
            ? {
                draftId: identity.draftId,
                characterId: identity.characterId,
                attemptId: identity.attemptId,
                revision: identity.revision,
              }
            : undefined,
        );
        attempt.current = current;
        current.allowedSources = identity?.allowedSources;
        if (buildCharacter) {
          const { character } = await buildCharacter(data);
          pendingResult.current = {
            character: { ...character, id: current.characterId },
            creationData: data,
            edition: data.edition || edition || '2014',
            createdAt: new Date().toISOString(),
            creationAttemptId: current.attemptId,
            draftId: current.draftId,
            draftRevision: current.revision,
          };
        } else {
          pendingResult.current = toCharacterCreationResult(
            evaluateDraft(current),
          );
        }
        await onComplete(pendingResult.current);
        completed.current = true;
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
    [buildCharacter, defaultBuild, edition, onComplete, draft],
  );

  /** True while a submission is in flight; used to block cancellation. */
  const isSubmittingRef = inFlight;

  return { submit, isSubmitting, isSubmittingRef, error, setError };
};
