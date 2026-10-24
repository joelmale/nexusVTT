import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CHARACTER_CREATOR_ROOT_CLASS } from '../../api/types';
import type { CharacterCreationCompleteHandler } from '../../api/types';
import type { CharacterCreationData, Edition } from '../../types/dnd';
import { useCreationSubmission } from '../CharacterCreationWizard/hooks/useCreationSubmission';
import PersonalityWizard from './PersonalityWizard';
import { FourScreenNewcomerFlow } from './FourScreenNewcomerFlow';

import type { CreationDraft } from '../../types/draft';

export interface GuidedCharacterCreatorProps {
  isOpen: boolean;
  edition?: Edition;
  /** Written to `data-theme` on the creator root — the explicit theme boundary. */
  theme?: string;
  initialDraft?: CreationDraft;
  onDraftChange?: (draft: CreationDraft) => void;
  onDraftDiscard?: () => void;
  onCancel: () => void;
  /**
   * Receives the finished character, exactly as the full wizard does, so a host
   * needs only one completion handler regardless of which door the player used.
   */
  onComplete: CharacterCreationCompleteHandler;
  /** Offered as "I'd rather choose everything myself" when the host supports it. */
  onSwitchToFullWizard?: () => void;
}

/**
 * The guided door into character creation.
 *
 * It asks about temperament and playstyle rather than rules — path, archetype,
 * combat style, social style, worldview — and derives class, species,
 * background, ability scores, spells and starting equipment from the answers.
 * A new player reaches a complete, playable character without meeting point-buy
 * or a proficiency list.
 *
 * The rules output is identical to the full wizard's: both produce
 * `CharacterCreationData`, both run it through the same calculator, and both
 * hand the host the same `CharacterCreationResult`.
 */
export const GuidedCharacterCreator: React.FC<GuidedCharacterCreatorProps> = ({
  isOpen,
  edition,
  theme,
  initialDraft,
  onDraftChange,
  onDraftDiscard,
  onCancel,
  onComplete,
  onSwitchToFullWizard,
}) => {
  const { submit, isSubmitting, isSubmittingRef, error, setError } =
    useCreationSubmission({ onComplete, edition });

  const rootRef = useRef<HTMLDivElement | null>(null);

  // Never dismiss while a save is in flight.
  const handleCancel = useCallback(() => {
    if (isSubmittingRef.current) return;
    onCancel();
  }, [isSubmittingRef, onCancel]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        handleCancel();
      }
    },
    [handleCancel],
  );

  // Move focus into the dialog on open, restore it on close.
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = rootRef.current?.querySelector<HTMLElement>('[role="dialog"]');
    dialog?.focus();
    return () => previouslyFocused?.focus?.();
  }, [isOpen]);

  const [flowMode, setFlowMode] = useState<'four-screen' | 'quiz'>('four-screen');

  const handleGuidedComplete = useCallback(
    (data: CharacterCreationData) => {
      // The guided flow derives these; a missing one means the profile mapping
      // failed rather than that the player skipped something, so say so plainly.
      if (!data?.speciesSlug || !data?.classSlug) {
        setError(
          'Could not build a character from those answers. Please go back and ' +
            'pick again, or switch to the full wizard.',
        );
        return;
      }
      void submit(data);
    },
    [setError, submit],
  );

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={rootRef}
      className={`${CHARACTER_CREATOR_ROOT_CLASS} fixed inset-0 z-50 overflow-y-auto`}
      data-theme={theme}
      onKeyDown={handleKeyDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create a character — guided"
        tabIndex={-1}
      >
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[calc(100%-2rem)]"
          >
            <div className="bg-red-900 border border-accent-red-dark rounded-lg p-4 text-sm text-red-200 flex items-start gap-3">
              <span className="flex-1">{error}</span>
              <button
                onClick={() => setError(null)}
                className="text-accent-red-light hover:text-white"
              >
                <span className="sr-only">Dismiss</span>✕
              </button>
            </div>
          </div>
        )}

        {flowMode === 'four-screen' ? (
          <FourScreenNewcomerFlow
            isOpen
            edition={edition ?? '2024'}
            initialDraft={initialDraft}
            onDraftChange={onDraftChange}
            onDraftDiscard={onDraftDiscard}
            onClose={handleCancel}
            onComplete={handleGuidedComplete}
            onSwitchToFullWizard={onSwitchToFullWizard}
            onSwitchToQuiz={() => setFlowMode('quiz')}
            backLabel={
              onSwitchToFullWizard
                ? 'Choose everything myself'
                : 'Back to Options'
            }
          />
        ) : (
          <PersonalityWizard
            isOpen
            edition={edition ?? '2024'}
            onClose={handleCancel}
            onBack={() => setFlowMode('four-screen')}
            backLabel="Back to Quick Build"
            onComplete={handleGuidedComplete}
          />
        )}

        {isSubmitting && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            aria-busy="true"
          >
            <div className="bg-theme-secondary rounded-xl px-6 py-4 text-white">
              Saving…
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
